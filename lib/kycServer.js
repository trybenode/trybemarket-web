import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { CREDIT_EVENT_TYPES } from "./creditConstants.js";
import { BADGE_KEYS } from "./badgeConstants.js";

export const KYC_CREDIT_AMOUNT = 150;

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
 * @returns {{ status: "verified"|"rejected", rejectionReason: string|null }}
 */
export async function finalizeKyc(userId, { ocrStatus, matricNumber }) {
  const normalizedMatric = normalizeMatric(matricNumber);
  const kycRef = adminDB.collection("kycRequests").doc(userId);
  const userRef = adminDB.collection("users").doc(userId);
  const ledgerRef = userRef.collection("creditLedger").doc("kyc_verification_complete");
  const badgeRef = userRef.collection("badges").doc(BADGE_KEYS.VERIFIED_STUDENT);
  const claimRef = adminDB.collection("kycMatricClaims").doc(normalizedMatric);

  // Set inside the transaction (it may retry), read after it by the caller.
  let status = ocrStatus;
  let rejectionReason = null;

  await adminDB.runTransaction(async (tx) => {
    // All reads must precede all writes in a Firestore transaction.
    const ledgerSnap = ocrStatus === "verified" ? await tx.get(ledgerRef) : null;
    const badgeSnap = ocrStatus === "verified" ? await tx.get(badgeRef) : null;
    const claimSnap = ocrStatus === "verified" ? await tx.get(claimRef) : null;

    const claimedByAnotherUser = !!claimSnap?.exists && claimSnap.data().userId !== userId;
    status = claimedByAnotherUser ? "rejected" : ocrStatus;
    rejectionReason = claimedByAnotherUser ? "matric_already_used" : null;

    tx.update(kycRef, {
      status,
      reviewedAt: new Date(),
      notificationSent: true,
      ...(rejectionReason ? { rejectionReason } : {}),
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
    }
  });

  return { status, rejectionReason };
}
