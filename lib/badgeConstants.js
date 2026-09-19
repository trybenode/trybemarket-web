/**
 * Pure constants for the Badge system — see 02-badge-system.md.
 * No Firestore imports here so both client and Admin SDK code can share one
 * definition (mirrors lib/creditConstants.js's split).
 */

export const BADGE_KEYS = {
  VERIFIED_STUDENT: "verified_student",
  FOUNDING_MEMBER: "founding_member",
  TOP_SELLER: "top_seller",
  // Phase 2 (backlog, not built): og_seller, first_sale, reliable_trader,
  // category_expert, power_buyer, streak_badge. Plus Phase 1 but blocked on
  // unbuilt dependencies: safe_trader (escrow), crsa_member (CRSA tracking).
};

/**
 * Founding Member is awarded to every existing user at launch, then to new
 * signups until this cumulative running total is reached — a hard cutoff,
 * not time-boxed to any campaign date. See change-answers.md §4.
 * Raised from an initial 300 to 400 once the actual existing-user count
 * (237) turned out higher than expected, to keep meaningful headroom for
 * new signups after the backfill.
 */
export const FOUNDING_MEMBER_USER_CAP = 400;
