/**
 * Pure constants for ranking unification — see 07-ranking-unification.md.
 * No Firestore imports here so both client display code (if ever needed)
 * and server computation (lib/rankScoreServer.js) can share one definition.
 */

// Large gaps between tiers so no combination of the smaller bonuses below
// can ever cross a tier boundary — Boost can lift a listing within its own
// tier, but a Free listing boosted can never outrank a Premium listing that
// isn't, matching the design principle in 07-ranking-unification.md §2.
export const TIER_WEIGHTS = {
  vip: 2000,
  premium: 1000,
  free: 0,
};

export const VIP_TAG_BONUS = 200;
export const BOOST_BONUS = 500;

// Boost duration used when a boost is applied — matches the existing
// select-boost-item/apply-boost default of 7 days.
export const DEFAULT_BOOST_DURATION_DAYS = 7;
