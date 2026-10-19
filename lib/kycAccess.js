/**
 * The one answer to "has this user cleared KYC enough to sell and subscribe?"
 * Every check — server routes, the subscription page, the upload pages — goes
 * through this, mirroring isKycCleared() in firestore.rules. Adding a new
 * clearance level (e.g. a provisional tier for freshers) is a change here and
 * in that rule, not a hunt through every caller.
 *
 * Pure and dependency-free so both server and browser code can import it.
 *
 * @param {{ isVerified?: boolean } | null | undefined} user - a users/{uid} doc's data
 */
export function isKycCleared(user) {
  return user?.isVerified === true;
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
