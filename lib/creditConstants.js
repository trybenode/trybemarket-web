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
