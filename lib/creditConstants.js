/**
 * Pure constants for the App Credit system — see 01-app-credit-system.md.
 * No Firestore imports here so both the client SDK (lib/creditStore.js) and
 * the Admin SDK (lib/creditServer.js) can share one definition.
 */

export const CREDIT_EVENT_TYPES = {
  KYC_VERIFICATION_COMPLETE: "kyc_verification_complete",
  CONFIRMED_SALE: "confirmed_sale",
  WEEKLY_ACTIVE_STREAK: "weekly_active_streak",
  SPEND_BOOST: "spend_boost",
  SPEND_PREMIUM_PLAN: "spend_premium_plan",
  SPEND_COSMETIC_FRAME: "spend_cosmetic_frame",
  ADMIN_ADJUSTMENT: "admin_adjustment",
};

/**
 * Max % of a plan's price that credit can cover, keyed by planId.
 * bundle_yearly is a deliberate exception to the standard bundle/premium rate —
 * see 05-pricing-tier-fix.md §4.
 */
export const CREDIT_SPEND_CAPS = {
  boost: 1, // 100%
  product_premium: 0.5,
  product_vip: 0.5,
  service_premium: 0.5,
  service_vip: 0.5,
  bundle_premium: 0.5,
  bundle_quarterly: 0.5,
  bundle_yearly: 0.25,
};

/**
 * Confirmed-sale earning (03-sale-confirmation.md, 01-app-credit-system.md §4).
 * 15 credit to EACH of the buyer and seller once both sides independently
 * confirm the same sale — deliberately the WEAKEST-verified earning event in
 * the system (both-sides-confirm proves two accounts agreed, not that money
 * moved), so it carries the heaviest anti-abuse stack of any trigger here:
 *
 *  1. buyerId !== sellerId — rejected outright, checked before any of this.
 *  2. CONFIRMED_SALE_DAILY_PAIR_CAP — credit-eligible confirmed sales between
 *     the same two accounts, per calendar day. Exact number still an open
 *     question per the spec; kept at 1 pending a decision.
 *  3. CONFIRMED_SALE_WEEKLY_USER_CAP — hard per-user ceiling on total
 *     confirmed-sale credit per week, regardless of how many different
 *     partners are involved. This is the one that actually bounds abuse
 *     spread across multiple colluding accounts, not just one repeated pair.
 *
 * All three are a single all-or-nothing gate per confirmation event — if
 * either side would exceed their weekly cap, NEITHER side is paid for that
 * event (see lib/saleConfirmationServer.js). Every block is written to
 * creditAuditLog rather than silently skipped, per the spec's explicit
 * "log the attempt" requirement.
 */
export const CONFIRMED_SALE_CREDIT_AMOUNT = 15;
export const CONFIRMED_SALE_DAILY_PAIR_CAP = 1;
export const CONFIRMED_SALE_WEEKLY_USER_CAP = 90;

/**
 * An account that hits CONFIRMED_SALE_WEEKLY_USER_CAP while younger than this
 * gets flagged in `moderationFlags` for admin review — "day one of using the
 * app" hitting the weekly ceiling is the spec's own example of a signal worth
 * a human look, not just a silent rate-limit.
 */
export const NEW_ACCOUNT_FLAG_THRESHOLD_DAYS = 7;

/**
 * Weekly active streak (change-answers.md §1, streak-detection-mechanism.md).
 * 10 credit for a week where all 7 days had a qualifying two-way conversation
 * exchange — strict, no partial-week credit. Deliberately the lowest-value
 * trigger in the system: it's also the easiest one to approximate.
 */
export const WEEKLY_STREAK_CREDIT_AMOUNT = 10;

/**
 * Credit spending mechanics — see credit-spending-security-checklist.md.
 * A reservation pessimistically deducts creditBalance immediately (so two
 * concurrent checkouts can't both reserve the same credit), then either
 * commits (Paystack payment for the remainder succeeds) or voids (declined,
 * abandoned, or timed out) — voiding refunds the reservation back to balance.
 */
export const PENDING_SPEND_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const SPEND_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const SPEND_RATE_LIMIT_WINDOW_MS = 60 * 1000; // 5 reservation attempts per minute per user
