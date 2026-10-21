/**
 * Seller tier computation — shared, framework-agnostic logic used to decide
 * search/homepage ranking boost. No Firestore imports so it works from both
 * client code (lib/subscriptionStore.js) and admin/server code
 * (pages/api/subscription/*) without duplicating the tier rules.
 */

import { isPlanActive } from "./planStatus.js";

export const TIER_WEIGHT = { vip: 2, premium: 1, free: 0 };

function tierFromPlanId(planId) {
  if (!planId) return "free";
  if (planId.endsWith("_vip")) return "vip";
  if (planId.endsWith("_premium")) return "premium";
  return "free"; // maintenance/free/unknown — no ranking boost
}

export function getTierWeight(tier) {
  return TIER_WEIGHT[tier] ?? 0;
}

/**
 * @param {Object} subscriptions - { product, service, bundle } as stored under subscriptions/{uid}
 * @param {"product"|"service"} category
 * @returns {"vip"|"premium"|"free"}
 */
export function computeSellerTier(subscriptions, category) {
  let tier = "free";

  const direct = subscriptions?.[category];
  if (isPlanActive(direct)) {
    tier = tierFromPlanId(direct.planId);
  }

  // Bundle plans grant premium-level product+service per their `includes` field.
  const bundle = subscriptions?.bundle;
  if (isPlanActive(bundle) && TIER_WEIGHT.premium > TIER_WEIGHT[tier]) {
    tier = "premium";
  }

  return tier;
}
