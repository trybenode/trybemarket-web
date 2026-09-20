import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { CREDIT_EVENT_TYPES } from "./creditConstants.js";
import { BADGE_KEYS } from "./badgeConstants.js";
import {
  prepareReferralKycCount,
  applyReferralKycCount,
  maybeFlagReferralVelocity,
} from "./crsaServer.js";

export const KYC_CREDIT_AMOUNT = 150;

export class KycError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// A matric number this short/long after normalizing is never a real one — and
// an empty normalized string would make the OCR "includes" check match
// anything, so callers must reject these before any OCR work happens.
const MIN_NORMALIZED_MATRIC_LENGTH = 4;
const MAX_NORMALIZED_MATRIC_LENGTH = 40;

export function normalizeMatric(str) {
  return String(str).toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
}

export function isValidNormalizedMatric(normalized) {
  return (
    normalized.length >= MIN_NORMALIZED_MATRIC_LENGTH &&
    normalized.length <= MAX_NORMALIZED_MATRIC_LENGTH
  );
}

/**
 * Records the outcome of a KYC OCR check — flips isVerified, awards the
 * one-time KYC credit and the Verified Student badge, and enforces
 * one-matric-one-account — all in a single transaction. This is the only
 * place isVerified is ever set to true (never client-side; see
 * firestore.rules), and every award is idempotent by construction: each
 * doc's fixed ID IS the "already awarded" check, so re-submitting an
 * already-verified user (or a concurrent duplicate call) can't double-pay
 * or double-award.
 *
 * One matric number = one verified account: without this, the OCR check
 * (any image containing the typed name + matric text passes) let one matric
 * verify unlimited accounts — farming the KYC credit, and inflating the CRSA
 * referral leaderboard, which counts KYC completions.
 *
 * Also counts the completion toward the referring CRSA's kycCompletions, if
 * the user arrived via a referral link (04-crsa-affiliate-program.md) — inside
 * this same transaction, so the count and the verification commit or fail
 * together, and idempotently (see prepareReferralKycCount). Only a genuinely
 * verified outcome counts: a matric-conflict rejection or OCR failure never
 * does.
 *
 * `reviewedBy` (an admin uid) marks a MANUAL decision made through the admin
 * app's /api/admin/kyc/decision — it goes through this same transaction, so a
 * manual approval gets exactly the same isVerified / credit / badge /
 * matric-claim / referral-count treatment as an OCR approval. (Before that,
 * the admin app only flipped kycRequests.status from the browser, leaving the
 * user "verified" on paper with none of the above.)
 *
 * @returns {{ status: "verified"|"rejected", rejectionReason: string|null, referralCounted: boolean }}
 */
export async function finalizeKyc(userId, { ocrStatus, matricNumber, reviewedBy = null }) {
  const normalizedMatric = normalizeMatric(matricNumber);
  const kycRef = adminDB.collection("kycRequests").doc(userId);
  const userRef = adminDB.collection("users").doc(userId);
  const ledgerRef = userRef.collection("creditLedger").doc("kyc_verification_complete");
  const badgeRef = userRef.collection("badges").doc(BADGE_KEYS.VERIFIED_STUDENT);
  const claimRef = adminDB.collection("kycMatricClaims").doc(normalizedMatric);

  // Set inside the transaction (it may retry), read after it by the caller.
  let status = ocrStatus;
  let rejectionReason = null;
  let referralPlan = null;

  await adminDB.runTransaction(async (tx) => {
    // All reads must precede all writes in a Firestore transaction.
    const ledgerSnap = ocrStatus === "verified" ? await tx.get(ledgerRef) : null;
    const badgeSnap = ocrStatus === "verified" ? await tx.get(badgeRef) : null;
    const claimSnap = ocrStatus === "verified" ? await tx.get(claimRef) : null;

    const claimedByAnotherUser = !!claimSnap?.exists && claimSnap.data().userId !== userId;
    status = claimedByAnotherUser ? "rejected" : ocrStatus;
    rejectionReason = claimedByAnotherUser ? "matric_already_used" : null;

    // Still a read phase: the referral lookup must happen before the first write below.
    referralPlan = status === "verified" ? await prepareReferralKycCount(tx, userId) : null;

    tx.update(kycRef, {
      status,
      reviewedAt: new Date(),
      notificationSent: true,
      ...(rejectionReason ? { rejectionReason } : {}),
      ...(reviewedBy ? { reviewedBy, reviewMethod: "manual" } : {}),
    });

    if (status === "verified") {
      if (!claimSnap.exists) {
        tx.set(claimRef, {
          userId,
          claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      const userUpdate = { isVerified: true };
      if (!ledgerSnap.exists) {
        tx.set(ledgerRef, {
          amount: KYC_CREDIT_AMOUNT,
          type: CREDIT_EVENT_TYPES.KYC_VERIFICATION_COMPLETE,
          referenceId: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        userUpdate.creditBalance = admin.firestore.FieldValue.increment(KYC_CREDIT_AMOUNT);
      }
      if (!badgeSnap.exists) {
        tx.set(badgeRef, {
          badgeKey: BADGE_KEYS.VERIFIED_STUDENT,
          awardedAt: admin.firestore.FieldValue.serverTimestamp(),
          periodKey: null,
        });
      }
      tx.set(userRef, userUpdate, { merge: true });

      if (referralPlan) applyReferralKycCount(tx, referralPlan);
    }
  });

  // Best-effort, outside the transaction — never blocks or reverses a count.
  if (referralPlan) await maybeFlagReferralVelocity(referralPlan.referrerUid);

  return { status, rejectionReason, referralCounted: !!referralPlan };
}

/**
 * Manual rejection by an admin. Refuses to touch a request that is already
 * verified: the user's isVerified flag, credit and badge stay in place (there
 * is no automated clawback — 02-badge-system.md / change-answers.md §4), so
 * flipping just the status would leave the two out of sync.
 */
export async function rejectKyc(userId, { reviewedBy, reason }) {
  const kycRef = adminDB.collection("kycRequests").doc(userId);

  await adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(kycRef);
    if (!snap.exists) throw new KycError("KYC request not found", 404);
    if (/verified|approved/i.test(String(snap.data().status))) {
      throw new KycError(
        "This request is already verified — its credit and badge have been issued, so it can't be rejected here",
        409
      );
    }
    tx.update(kycRef, {
      status: "rejected",
      reviewedAt: new Date(),
      reviewedBy,
      reviewMethod: "manual",
      rejectionReason: reason || "Rejected by an admin",
      notificationSent: true,
    });
  });

  return { status: "rejected" };
}
