import admin from "firebase-admin";
import crypto from "crypto";
import { adminDB } from "./firebaseAdmin.js";
import { isKycCheckRunning } from "./kycAccess.js";
import { CREDIT_EVENT_TYPES } from "./creditConstants.js";
import { BADGE_KEYS } from "./badgeConstants.js";
import {
  prepareReferralKycCount,
  applyReferralKycCount,
  prepareReferralKycReversal,
  applyReferralKycReversal,
  maybeFlagReferralVelocity,
} from "./crsaServer.js";
import { getKycConfig } from "./kycConfig.js";
import { HOLD_REASONS, holdListings, pausePlans, releaseKycHold, resumePlans } from "./kycHold.js";

export const KYC_CREDIT_AMOUNT = 150;

export class KycError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// The text checks are pure (no Firebase), so they live in lib/kycText.js and
// can be tested against fixtures; re-exported here for existing callers.
export {
  normalizeMatric,
  isValidNormalizedMatric,
  isPlausibleMatric,
  nameWords,
  evaluateIdText,
} from "./kycText.js";
import { normalizeMatric } from "./kycText.js";

const KYC_SUBMISSIONS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

export const KYC_TRACKS = Object.freeze({ ID_CARD: "id_card", FRESHER: "fresher_document" });
export const FRESHER_DOCUMENTS = Object.freeze({ PORTAL: "portal_screenshot", LIBRARY: "library_card" });

/**
 * The one-number-one-account claim key for a request (kycMatricClaims doc ID).
 *   - ID card:   the normalized matric number, exactly as before ("lcuug2535669")
 *   - portal:    "temp:2501164"   (a fresher's temporary 7-digit number)
 *   - library:   "library:21246"  (the library Card No)
 * The prefixes keep the number types apart — a normalized matric never
 * contains ":" — so existing claims need no migration. Claims are kept when a
 * student upgrades or is revoked; an admin can release or take one over.
 */
export function claimKeyFor({ track, documentType, matricNumber, tempMatric, libraryCardNumber }) {
  if (track === KYC_TRACKS.FRESHER) {
    if (documentType === FRESHER_DOCUMENTS.PORTAL) return `temp:${tempMatric}`;
    if (documentType === FRESHER_DOCUMENTS.LIBRARY) return `library:${libraryCardNumber}`;
    throw new KycError("Unknown document type", 400);
  }
  return normalizeMatric(matricNumber);
}

/** Who holds a claim key, if anyone other than `userId`: { holderUid, holderLevel } or null. */
export async function findClaimConflict(claimKey, userId) {
  const claim = await adminDB.collection("kycMatricClaims").doc(claimKey).get();
  if (!claim.exists || claim.data().userId === userId) return null;
  const holder = await adminDB.collection("users").doc(claim.data().userId).get();
  const data = holder.exists ? holder.data() : {};
  return {
    holderUid: claim.data().userId,
    holderLevel: data.isVerified ? "full" : data.kycLevel || null,
  };
}

/**
 * Starts a submission: refuses if already verified, if a check is still
 * running, or past the daily limit; otherwise archives the previous request
 * (kycRequests/{uid}/history — nothing a student submitted is lost) and
 * writes a fresh pending request with a running automatic check. Only the
 * server writes kycRequests — see firestore.rules.
 *
 * A provisional (fresher) student may submit again only on the ID-card track
 * — that's the upgrade to full verification.
 *
 * @returns {Promise<{ attemptId: string, upgrade: boolean, provisionalName: string|null }>}
 *   attemptId identifies this check, so a late result can't overwrite a newer
 *   submission or an admin's decision.
 */
export async function claimKycSubmission(userId, submission) {
  const kycRef = adminDB.collection("kycRequests").doc(userId);
  const userRef = adminDB.collection("users").doc(userId);
  const now = Date.now();

  return adminDB.runTransaction(async (tx) => {
    const [snap, userSnap] = await Promise.all([tx.get(kycRef), tx.get(userRef)]);
    const prev = snap.exists ? snap.data() : null;
    const user = userSnap.exists ? userSnap.data() : {};

    if (user.isVerified === true || (prev && /verified|approved/i.test(String(prev.status)))) {
      throw new KycError("Your KYC is already verified.", 409);
    }
    const isProvisional = user.kycLevel === "provisional";
    if (isProvisional && submission.track !== KYC_TRACKS.ID_CARD) {
      throw new KycError("You're already provisionally verified — upgrade with your student ID card.", 409);
    }
    if (isKycCheckRunning(prev, now)) {
      throw new KycError("We're still checking your last submission — give it a minute.", 409);
    }

    const windowStartMs = prev?.submissions?.windowStartMs;
    const inWindow = typeof windowStartMs === "number" && now - windowStartMs < DAY_MS;
    const count = inWindow ? prev.submissions.count || 0 : 0;
    if (count >= KYC_SUBMISSIONS_PER_DAY) {
      throw new KycError(
        "You've submitted several times today. Our team will review your latest request — or try again tomorrow.",
        429
      );
    }

    const attemptId = crypto.randomUUID();
    if (prev) {
      tx.set(kycRef.collection("history").doc(), {
        ...prev,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        replacedByAttempt: attemptId,
      });
    }
    const { track, documentType, fullName, matricNumber, tempMatric, libraryCardNumber, photos, selfieSource } = submission;
    tx.set(kycRef, {
      userId,
      track,
      documentType,
      fullName,
      ...(matricNumber ? { matricNumber } : {}),
      ...(tempMatric ? { tempMatric } : {}),
      ...(libraryCardNumber ? { libraryCardNumber } : {}),
      // Private Cloudinary assets ({ publicId, version }), read only server-side
      // (lib/kycPhotos.js). Requests from before this kept public frontID/backID URLs.
      photos,
      ...(selfieSource ? { selfieSource } : {}),
      ...(isProvisional ? { upgradeFrom: "provisional" } : {}),
      status: "pending",
      notificationSent: false,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      autoCheck: { state: "running", attemptId, startedAtMs: now },
      submissions: { count: count + 1, windowStartMs: inWindow ? windowStartMs : now },
    });
    return {
      attemptId,
      upgrade: isProvisional,
      provisionalName: isProvisional ? prev?.fullName ?? null : null,
    };
  });
}

/**
 * Leaves a request pending for an admin, recording why the automatic check
 * didn't decide it (`needs_review`: didn't match; `error`: couldn't run) and
 * anything the admin should see (`extra`: OCR summary, eligibility, liveness,
 * a claim clash). A no-op if the request moved on meanwhile.
 *
 * @returns {Promise<boolean>} whether it was recorded
 */
export async function markKycForReview(userId, attemptId, autoCheck, extra = {}) {
  const kycRef = adminDB.collection("kycRequests").doc(userId);
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(kycRef);
    const kyc = snap.exists ? snap.data() : null;
    if (kyc?.status !== "pending" || kyc?.autoCheck?.attemptId !== attemptId) return false;
    tx.update(kycRef, {
      ...extra,
      autoCheck: { ...kyc.autoCheck, ...autoCheck, attemptId, finishedAtMs: Date.now() },
    });
    return true;
  });
}

/**
 * An automatic rejection — only for a fresher request that's clearly not
 * eligible (a portal screenshot showing 300 level or above, or a non-LCU
 * account). An admin can still approve it from Rejected. A no-op if the
 * request moved on meanwhile.
 */
export async function rejectKycAutomatically(userId, attemptId, { rejectionReason, autoCheck, extra = {} }) {
  const kycRef = adminDB.collection("kycRequests").doc(userId);
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(kycRef);
    const kyc = snap.exists ? snap.data() : null;
    if (kyc?.status !== "pending" || kyc?.autoCheck?.attemptId !== attemptId) return false;
    tx.update(kycRef, {
      ...extra,
      status: "rejected",
      rejectionReason,
      reviewMethod: "auto",
      reviewedAt: new Date(),
      notificationSent: true,
      autoCheck: { ...kyc.autoCheck, ...autoCheck, attemptId, finishedAtMs: Date.now() },
    });
    return true;
  });
}

/**
 * Records a KYC decision for a student — automatic (`autoCheck`) or an
 * admin's (`reviewedBy`) — in one transaction. The only place isVerified or
 * kycLevel is ever set (never client-side; see firestore.rules).
 *
 * level "full" (a student ID — including a provisional student's upgrade):
 *   isVerified, kycLevel "full", the one-time 150 KYC credit and the Verified
 *   Student badge (each idempotent: the doc's fixed ID IS the "already
 *   awarded" check), the matric claim, and the ambassador's referral count.
 *   Clears any provisional fields. Earlier claims (temp:/library:) are kept.
 *
 * level "provisional" (a fresher's portal screenshot or library card):
 *   kycLevel "provisional" with a deadline `provisionalDays` away, the
 *   temp:/library: claim, and the ambassador's referral count (counted once —
 *   the marker stops the upgrade counting again). No credit, no badge.
 *
 * Claims: one number, one account. If another account holds the claim:
 *   - full, automatic: rejected as matric_already_used (as before);
 *   - otherwise a KycError 409 carrying `conflict`, unless an admin passes
 *     `takeOverClaim: { reason }` — then the claim moves to this student and
 *     kycClaimAudit records who moved it, from whom and why.
 *
 * After a decision that clears the student, listings held by an expiry or a
 * revoke are released and paused plans resumed (best-effort; the daily
 * maintenance cron reconciles anything missed).
 *
 * `autoCheck` results only apply to the submission they checked (matched by
 * attemptId); `superseded` comes back true if the student resubmitted or an
 * admin decided meanwhile, and nothing changes.
 *
 * @returns {{ status, rejectionReason, referralCounted, superseded?, level? }}
 */
export async function finalizeKyc(
  userId,
  {
    level = "full",
    ocrStatus = "verified",
    matricNumber,
    claimKey = null,
    reviewedBy = null,
    autoCheck = null,
    takeOverClaim = null,
    extra = {},
    provisionalDays = null,
  }
) {
  const isProvisional = level === "provisional";
  const resolvedClaimKey = claimKey || normalizeMatric(matricNumber);
  const kycRef = adminDB.collection("kycRequests").doc(userId);
  const userRef = adminDB.collection("users").doc(userId);
  const ledgerRef = userRef.collection("creditLedger").doc("kyc_verification_complete");
  const badgeRef = userRef.collection("badges").doc(BADGE_KEYS.VERIFIED_STUDENT);
  const claimRef = adminDB.collection("kycMatricClaims").doc(resolvedClaimKey);
  const config = await getKycConfig();
  const days = provisionalDays ?? config.provisionalDays;

  // Set inside the transaction (it may retry), read after it by the caller.
  let status = ocrStatus;
  let rejectionReason = null;
  let referralPlan = null;
  let superseded = false;

  await adminDB.runTransaction(async (tx) => {
    status = isProvisional ? "provisional" : ocrStatus;
    rejectionReason = null;
    referralPlan = null;
    superseded = false;

    // All reads must precede all writes in a Firestore transaction.
    if (autoCheck?.attemptId) {
      const kycSnap = await tx.get(kycRef);
      const kyc = kycSnap.exists ? kycSnap.data() : null;
      if (kyc?.status !== "pending" || kyc?.autoCheck?.attemptId !== autoCheck.attemptId) {
        superseded = true;
        status = kyc?.status ?? null;
        return;
      }
    }

    const clearing = isProvisional || ocrStatus === "verified";
    const userSnap = await tx.get(userRef);
    const user = userSnap.exists ? userSnap.data() : {};
    if (isProvisional && user.isVerified === true) {
      throw new KycError("This student is already fully verified.", 409);
    }
    const ledgerSnap = clearing && !isProvisional ? await tx.get(ledgerRef) : null;
    const badgeSnap = clearing && !isProvisional ? await tx.get(badgeRef) : null;
    const claimSnap = clearing ? await tx.get(claimRef) : null;

    const heldBy = claimSnap?.exists ? claimSnap.data().userId : null;
    const conflict = !!heldBy && heldBy !== userId;
    if (conflict && !takeOverClaim) {
      if (!isProvisional && !reviewedBy) {
        status = "rejected";
        rejectionReason = "matric_already_used";
      } else {
        const error = new KycError("This number is already claimed by another account.", 409);
        error.conflict = { claimKey: resolvedClaimKey, holderUid: heldBy };
        throw error;
      }
    }

    // Still a read phase: the referral lookup must happen before the first write below.
    referralPlan = status === "verified" || status === "provisional" ? await prepareReferralKycCount(tx, userId) : null;

    tx.update(kycRef, {
      ...extra,
      status,
      reviewedAt: new Date(),
      notificationSent: true,
      ...(rejectionReason ? { rejectionReason } : {}),
      ...(reviewedBy ? { reviewedBy, reviewMethod: "manual" } : {}),
      ...(autoCheck ? { autoCheck: { ...autoCheck, finishedAtMs: Date.now() }, reviewMethod: "auto" } : {}),
    });

    if (status !== "verified" && status !== "provisional") return;

    if (!claimSnap.exists || conflict) {
      tx.set(claimRef, {
        userId,
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(conflict ? { previousUserId: heldBy, takenOverBy: reviewedBy } : {}),
      });
    }
    if (conflict) {
      tx.set(adminDB.collection("kycClaimAudit").doc(), {
        action: "take_over",
        claimKey: resolvedClaimKey,
        fromUid: heldBy,
        toUid: userId,
        adminUid: reviewedBy,
        reason: takeOverClaim.reason,
        at: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    const del = admin.firestore.FieldValue.delete();
    if (status === "provisional") {
      const nowMs = Date.now();
      tx.set(
        userRef,
        {
          kycLevel: "provisional",
          provisionalSince: admin.firestore.Timestamp.fromMillis(nowMs),
          provisionalExpiresAt: admin.firestore.Timestamp.fromMillis(nowMs + days * DAY_MS),
          kycExpiredAt: del,
          kycRevokedAt: del,
        },
        { merge: true }
      );
    } else {
      const userUpdate = {
        isVerified: true,
        kycLevel: "full",
        provisionalSince: del,
        provisionalExpiresAt: del,
        kycExpiredAt: del,
        kycRevokedAt: del,
      };
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

    if (referralPlan) applyReferralKycCount(tx, referralPlan);
  });

  if (superseded) return { status, rejectionReason: null, referralCounted: false, superseded: true };

  if (status === "verified" || status === "provisional") {
    // Cleared again: bring back anything an expiry or revoke held. Best-effort —
    // the daily maintenance cron reconciles anything missed.
    try {
      await releaseKycHold(userId, { lapseDays: config.pausedPlanLapseDays });
      await resumePlans(userId);
    } catch (error) {
      console.error(`KYC: couldn't release holds for ${userId} (the daily cron will retry):`, error);
    }
  }

  // Best-effort, outside the transaction — never blocks or reverses a count.
  if (referralPlan) await maybeFlagReferralVelocity(referralPlan.referrerUid);

  return { status, rejectionReason, referralCounted: !!referralPlan, level: status === "provisional" ? "provisional" : status === "verified" ? "full" : null };
}

/**
 * Manual rejection of a PENDING request by an admin. A verified or
 * provisional student is revoked instead (revokeKyc), which undoes what their
 * approval granted; flipping only the request's status would leave the two
 * out of sync.
 */
export async function rejectKyc(userId, { reviewedBy, reason }) {
  const kycRef = adminDB.collection("kycRequests").doc(userId);

  await adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(kycRef);
    if (!snap.exists) throw new KycError("KYC request not found", 404);
    if (/verified|approved|provisional/i.test(String(snap.data().status))) {
      throw new KycError("This request is already approved — use Revoke to take the approval back.", 409);
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

/**
 * Admin takes back a student's KYC — provisional or full — e.g. a document
 * turns out to be fake. Undoes what the approval granted:
 *   - clears isVerified / kycLevel and the provisional fields;
 *   - removes the Verified Student badge (re-awarded automatically if
 *     re-approved);
 *   - reverses the ambassador's referral count (and an install counted with
 *     it), so a later genuine approval counts again;
 *   - holds the student's listings and pauses their plans.
 * Number claims are KEPT (an admin can release one separately). Credit is NOT
 * clawed back automatically — it may already be spent; `creditNote` tells the
 * admin so they can decide.
 */
export async function revokeKyc(userId, { reviewedBy, reason }) {
  const kycRef = adminDB.collection("kycRequests").doc(userId);
  const userRef = adminDB.collection("users").doc(userId);
  const badgeRef = userRef.collection("badges").doc(BADGE_KEYS.VERIFIED_STUDENT);
  const ledgerRef = userRef.collection("creditLedger").doc("kyc_verification_complete");
  let reversalPlan = null;
  let hadCredit = false;

  await adminDB.runTransaction(async (tx) => {
    reversalPlan = null;
    const [kycSnap, userSnap, ledgerSnap] = await Promise.all([tx.get(kycRef), tx.get(userRef), tx.get(ledgerRef)]);
    const user = userSnap.exists ? userSnap.data() : {};
    if (user.isVerified !== true && !user.kycLevel) {
      throw new KycError("This student isn't verified or provisional — there's nothing to revoke.", 409);
    }
    hadCredit = ledgerSnap.exists;
    reversalPlan = await prepareReferralKycReversal(tx, userId);

    const del = admin.firestore.FieldValue.delete();
    tx.set(
      userRef,
      {
        isVerified: false,
        kycLevel: del,
        provisionalSince: del,
        provisionalExpiresAt: del,
        kycExpiredAt: del,
        kycRevokedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.delete(badgeRef);
    if (kycSnap.exists) {
      tx.update(kycRef, {
        status: "rejected",
        rejectionReason: reason,
        reviewMethod: "manual",
        reviewedBy,
        reviewedAt: new Date(),
        revokedAt: new Date(),
        revokedBy: reviewedBy,
      });
    }
    if (reversalPlan) applyReferralKycReversal(tx, reversalPlan);
  });

  const heldListings = await holdListings(userId, HOLD_REASONS.REVOKED);
  const pausedPlans = await pausePlans(userId, HOLD_REASONS.REVOKED);

  return {
    status: "rejected",
    referralReversed: !!reversalPlan,
    heldListings,
    pausedPlans,
    creditNote: hadCredit
      ? `This student received ${KYC_CREDIT_AMOUNT} App Credit when they were verified. It hasn't been taken back — adjust it from Credit if needed.`
      : null,
  };
}

/** Admin frees a number claim (e.g. an impostor's), logging who, why and from whom. */
export async function releaseKycClaim(claimKey, { adminUid, reason }) {
  const claimRef = adminDB.collection("kycMatricClaims").doc(claimKey);
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(claimRef);
    if (!snap.exists) throw new KycError("Nobody holds that number.", 404);
    tx.delete(claimRef);
    tx.set(adminDB.collection("kycClaimAudit").doc(), {
      action: "release",
      claimKey,
      fromUid: snap.data().userId,
      toUid: null,
      adminUid,
      reason,
      at: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { released: true, fromUid: snap.data().userId };
  });
}
