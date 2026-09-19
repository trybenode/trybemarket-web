import {
  REFERRAL_STORAGE_KEY,
  REFERRAL_TTL_MS,
  normalizeReferralCode,
} from "./crsaConstants";

/**
 * Client-side half of CRSA referral attribution (see lib/crsaServer.js for
 * the server half, which is where every rule is actually enforced — nothing
 * here is trusted). localStorage is wrapped in try/catch throughout: it can
 * throw or be empty in private windows or with blocked site data, and a
 * broken referral must never break signup.
 */

/** Stores a code from ?ref= — first-touch wins: an unexpired code is never overwritten. */
export function captureReferralCode(rawCode) {
  const code = normalizeReferralCode(rawCode);
  if (!code) return;
  try {
    if (getStoredReferralCode()) return;
    localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify({ code, capturedAt: Date.now() }));
  } catch {
    // storage unavailable — referral simply isn't captured
  }
}

export function getStoredReferralCode() {
  try {
    const raw = localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    const { code, capturedAt } = JSON.parse(raw);
    if (!code || Date.now() - capturedAt > REFERRAL_TTL_MS) {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return code;
  } catch {
    return null;
  }
}

export function clearStoredReferralCode() {
  try {
    localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Best-effort call to /api/user/on-signup (Founding Member badge + CRSA
 * referral attribution). Never throws — signup must not depend on it. The
 * stored referral code is cleared once the server has answered, whether or
 * not it attached, so a refused code isn't retried forever.
 */
export async function notifySignup(firebaseUser) {
  try {
    const idToken = await firebaseUser.getIdToken();
    const ref = getStoredReferralCode();
    const response = await fetch("/api/user/on-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify(ref ? { ref } : {}),
    });
    if (response.ok && ref) clearStoredReferralCode();
  } catch (error) {
    console.error("Error running post-signup checks:", error);
  }
}
