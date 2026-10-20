/**
 * The one answer to "has this user cleared KYC enough to sell and subscribe?"
 * Every check — server routes, the subscription page, the upload pages — goes
 * through this, mirroring isKycCleared() in firestore.rules.
 *
 * Two ways to be cleared:
 *   - full:        isVerified === true (a student ID card, checked or approved)
 *   - provisional: kycLevel "provisional" and provisionalExpiresAt in the
 *                  future (a fresher's portal screenshot or library card plus a
 *                  selfie, approved by an admin; one session to bring a real ID)
 *
 * Pure and dependency-free so both server and browser code can import it.
 */

export const KYC_LEVEL_PROVISIONAL = "provisional";
export const KYC_LEVEL_FULL = "full";

/**
 * Milliseconds since the epoch for a Firestore Timestamp (client or Admin
 * SDK, or its serialized { seconds } / { _seconds } shape), a Date, a number
 * or an ISO string. Null if missing or unreadable.
 */
export function toMillis(value) {
  if (value == null) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value._seconds === "number") return value._seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Full verification (a student ID). Only this earns the Verified badge and credit. */
export function isFullyVerified(user) {
  return user?.isVerified === true;
}

/** Provisional, and the deadline hasn't passed. */
export function isProvisionalActive(user, now = Date.now()) {
  if (user?.kycLevel !== KYC_LEVEL_PROVISIONAL) return false;
  const expiresAt = toMillis(user.provisionalExpiresAt);
  return expiresAt !== null && expiresAt > now;
}

/** Provisional, and the deadline has passed (listings held until a student ID is verified). */
export function isProvisionalExpired(user, now = Date.now()) {
  return user?.kycLevel === KYC_LEVEL_PROVISIONAL && !isProvisionalActive(user, now);
}

/** Cleared to sell and subscribe: fully verified, or provisional within the deadline. */
export function isKycCleared(user, now = Date.now()) {
  return isFullyVerified(user) || isProvisionalActive(user, now);
}

// A "running" automatic check older than this was abandoned (the function was
// killed) — longer than app/api/kyc-submit's maxDuration, so a live one never
// counts. After it, the student may resubmit and the request reads as
// "under review".
export const KYC_CHECK_STALE_MS = 90 * 1000;

/** Whether a kycRequests doc's automatic check is genuinely still running. */
export function isKycCheckRunning(kyc, now = Date.now()) {
  return (
    kyc?.status === "pending" &&
    kyc?.autoCheck?.state === "running" &&
    now - (kyc.autoCheck.startedAtMs || 0) < KYC_CHECK_STALE_MS
  );
}
