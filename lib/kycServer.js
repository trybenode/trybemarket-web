import admin from "firebase-admin";
import crypto from "crypto";
import { adminDB } from "./firebaseAdmin.js";
import { isKycCheckRunning } from "./kycAccess.js";
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
 * Stricter check for a matric number a STUDENT types (admins approving by hand
 * still use isValidNormalizedMatric). Formats differ by school — LCU/UG/25/35669,
 * EAUED1234567, FUO/22/1234 — but every real one has a run of digits, while
 * junk seen in past requests ("HFHCHG", "LCUCJVD") has none.
 */
export function isPlausibleMatric(raw) {
  const normalized = normalizeMatric(raw ?? "");
  const digits = (normalized.match(/[0-9]/g) || []).length;
  return normalized.length >= 5 && normalized.length <= MAX_NORMALIZED_MATRIC_LENGTH && digits >= 4;
}

// Lowercased, accent-stripped words of at least two letters/digits.
function words(text) {
  return String(text ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2);
}

/** The words of a typed full name the ID check matches on (initials dropped). */
export function nameWords(fullName) {
  return words(fullName).filter((w) => /\p{L}/u.test(w));
}

// Words that mark text as coming from an institution's document. A speed bump
// for a plain handwritten note carrying just a name and matric number — not a
// real defence; that's the liveness check's job (next task).
const INSTITUTION_WORDS = ["university", "polytechnic", "college", "institute", "school"];
// Too common in school names to identify one.
const GENERIC_SCHOOL_WORDS = new Set([
  ...INSTITUTION_WORDS, "of", "the", "and", "for", "state", "federal", "technology",
  "education", "science", "sciences", "agriculture",
]);

/**
 * Decides whether OCR text from a student's ID supports what they typed.
 * Pure — no I/O — so it can be checked against fixtures.
 *
 * - Name: at least two typed name words appear as whole OCR words. A word of
 *   4+ letters may also sit inside a longer OCR word, since OCR often merges
 *   neighbours ("SURNAMEKUTI"). The old check matched substrings of the whole
 *   text, so "ade" matched inside "grade".
 * - Matric: the normalized matric appears in the normalized text.
 * - Institution: a school word ("university", …) or a distinctive word of the
 *   student's own school ("lead", "city", "ibadan") appears.
 *
 * @returns {{ pass: boolean, nameMatched: number, nameWords: number, matricFound: boolean, institutionFound: boolean }}
 */
export function evaluateIdText(text, { fullName, matricNumber, university }) {
  const tokens = words(text);
  const tokenSet = new Set(tokens);
  const has = (w) => tokenSet.has(w) || (w.length >= 4 && tokens.some((t) => t.length > w.length && t.includes(w)));

  const typedName = [...new Set(nameWords(fullName))];
  const nameMatched = typedName.filter(has).length;

  const normalizedMatric = normalizeMatric(matricNumber ?? "");
  const matricFound = normalizedMatric.length > 0 && normalizeMatric(text ?? "").includes(normalizedMatric);

  const schoolWords = words(university).filter((w) => w.length >= 4 && !GENERIC_SCHOOL_WORDS.has(w));
  const institutionFound = INSTITUTION_WORDS.some(has) || schoolWords.some(has);

  return {
    pass: nameMatched >= 2 && matricFound && institutionFound,
    nameMatched,
    nameWords: typedName.length,
    matricFound,
    institutionFound,
  };
}

const KYC_SUBMISSIONS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Starts a submission: refuses if already verified, if a check is still
 * running, or past the daily limit; otherwise writes a fresh pending request
 * (replacing any previous one, which clears old review fields) with a running
 * automatic check. Only the server writes kycRequests — see firestore.rules.
 *
 * @returns {Promise<{ attemptId: string }>} identifies this check, so a late
 *   result can't overwrite a newer submission or an admin's decision.
 */
export async function claimKycSubmission(userId, { fullName, matricNumber, photos }) {
  const kycRef = adminDB.collection("kycRequests").doc(userId);
  const now = Date.now();

  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(kycRef);
    const prev = snap.exists ? snap.data() : null;

    if (prev && /verified|approved/i.test(String(prev.status))) {
      throw new KycError("Your KYC is already verified.", 409);
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
    tx.set(kycRef, {
      userId,
      fullName,
      matricNumber,
      // Private Cloudinary assets ({ publicId, version }), read only server-side
      // (lib/kycPhotos.js). Requests from before this kept public frontID/backID URLs.
      photos,
      status: "pending",
      notificationSent: false,
      submittedAt: admin.firestore.FieldValue.serverTimestamp(),
      autoCheck: { state: "running", attemptId, startedAtMs: now },
      submissions: { count: count + 1, windowStartMs: inWindow ? windowStartMs : now },
    });
    return { attemptId };
  });
}

/**
 * Leaves a request pending for an admin, recording why the automatic check
 * didn't decide it (`needs_review`: didn't match; `error`: couldn't run). A
 * no-op if the request moved on meanwhile (resubmitted, or an admin decided).
 *
 * @returns {Promise<boolean>} whether it was recorded
 */
export async function markKycForReview(userId, attemptId, autoCheck) {
  const kycRef = adminDB.collection("kycRequests").doc(userId);
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(kycRef);
    const kyc = snap.exists ? snap.data() : null;
    if (kyc?.status !== "pending" || kyc?.autoCheck?.attemptId !== attemptId) return false;
    tx.update(kycRef, {
      autoCheck: { ...kyc.autoCheck, ...autoCheck, attemptId, finishedAtMs: Date.now() },
    });
    return true;
  });
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
 * `autoCheck` marks an AUTOMATIC result from app/api/kyc-submit: it's stored
 * on the request, and the result only applies to the submission it checked
 * (matched by autoCheck.attemptId) — `superseded` comes back true if the
 * student resubmitted or an admin decided in the meantime, and nothing changes.
 *
 * @returns {{ status: "verified"|"rejected"|string|null, rejectionReason: string|null, referralCounted: boolean, superseded?: boolean }}
 */
export async function finalizeKyc(userId, { ocrStatus, matricNumber, reviewedBy = null, autoCheck = null }) {
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
  let superseded = false;

  await adminDB.runTransaction(async (tx) => {
    status = ocrStatus;
    rejectionReason = null;
    referralPlan = null;
    superseded = false;

    // All reads must precede all writes in a Firestore transaction.
    // An automatic result (autoCheck given) only applies to the submission it
    // checked: if the student resubmitted or an admin decided meanwhile, it's
    // dropped rather than overwriting them.
    if (autoCheck?.attemptId) {
      const kycSnap = await tx.get(kycRef);
      const kyc = kycSnap.exists ? kycSnap.data() : null;
      if (kyc?.status !== "pending" || kyc?.autoCheck?.attemptId !== autoCheck.attemptId) {
        superseded = true;
        status = kyc?.status ?? null;
        return;
      }
    }
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
      ...(autoCheck ? { autoCheck: { ...autoCheck, finishedAtMs: Date.now() }, reviewMethod: "auto" } : {}),
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

  if (superseded) return { status, rejectionReason: null, referralCounted: false, superseded: true };

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
