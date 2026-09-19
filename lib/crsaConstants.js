/**
 * Pure constants for the CRSA (Course Rep Student Ambassador) referral
 * program — see 04-crsa-affiliate-program.md. No Firestore imports so client
 * code (the referral-capture component) and Admin SDK code share one
 * definition, mirroring lib/creditConstants.js / lib/badgeConstants.js.
 *
 * CRSA is explicitly NOT part of the App Credit system: no credit is earned
 * through any of this. It is a counted-stats + recognition program only.
 */

// Referral codes are what appears in a shareable link (?ref=CODE).
// Unambiguous alphabet — no 0/O or 1/I/L — since people read these aloud
// and retype them.
export const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_LENGTH = 7;

// Accepts what the generator produces plus a little slack, so a hand-picked
// code (if ever added) still validates. Used to reject junk before any
// database lookup.
export const REFERRAL_CODE_REGEX = /^[A-Z0-9]{4,12}$/;

export function normalizeReferralCode(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return REFERRAL_CODE_REGEX.test(code) ? code : null;
}

// localStorage key + how long a captured ?ref= stays valid. First-touch
// wins: an existing unexpired code is never overwritten by a later link, so
// one ambassador can't displace another's earlier referral.
export const REFERRAL_STORAGE_KEY = "trybe_ref";
export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// A referral only attaches to an account this fresh (checked against Firebase
// Auth's own creationTime, not anything client-supplied) — so an existing
// user can't retroactively attach themselves to a referrer.
export const REFERRAL_ATTACH_WINDOW_MS = 10 * 60 * 1000;

// Velocity flag: this many of one ambassador's referrals completing KYC
// within 24h is a signal worth a human look (fake-account farming), not a
// block — the counts themselves are never reversed automatically.
export const REFERRAL_VELOCITY_FLAG_THRESHOLD = 8;
export const REFERRAL_VELOCITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export const REFERRAL_LINK_BASE = "https://trybemarket.online/signup";

export function buildReferralLink(code) {
  return `${REFERRAL_LINK_BASE}?ref=${code}`;
}
