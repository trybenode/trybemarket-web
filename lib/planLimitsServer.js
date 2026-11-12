/**
 * A seller's listing limits, worked out on the server — the same rules as
 * getUserLimits in lib/subscriptionStore.js (which runs in the browser and
 * so can't be trusted to enforce anything): the free-tier defaults, replaced
 * by the limits of an active bundle's included plans, or of an active
 * product / service plan. "Active" is lib/planStatus.js — not past its
 * expiry date — and, as in the browser version, a paid plan must carry one.
 *
 * `db` is passed in (the Admin Firestore), so this file has no Firebase import.
 */
import { isPlanActive } from "./planStatus.js";

export const FREE_LIMITS = { maxProducts: 3, maxServices: 1 };
/** Plans store "unlimited" as this number. */
export const UNLIMITED = 9999;

const paidAndActive = (plan, now) => !!plan?.expiryDate && isPlanActive(plan, now);

/**
 * @param {object} subs      the seller's subscriptions document (or {})
 * @param {(planId: string) => Promise<object|null>} getPlan  a subscriptionPlans document's data, or null
 * @returns {Promise<{ maxProducts: number, maxServices: number, vipTagsProduct: number, vipTagsService: number }>}
 */
export async function resolveLimits(subs, getPlan, now = Date.now()) {
  const free = (await getPlan("free-tier"))?.limits || {};
  let product = { maxProducts: free.maxProducts || FREE_LIMITS.maxProducts, vipTags: free.vipTags || 0 };
  let service = { maxServices: free.maxServices || FREE_LIMITS.maxServices, vipTags: 0 };

  if (paidAndActive(subs?.bundle, now)) {
    const includes = (await getPlan(subs.bundle.planId))?.includes || [];
    const productPlanId = includes.find((id) => id.startsWith("product_"));
    const servicePlanId = includes.find((id) => id.startsWith("service_"));
    if (productPlanId) product = (await getPlan(productPlanId))?.limits || product;
    if (servicePlanId) service = (await getPlan(servicePlanId))?.limits || service;
  } else {
    if (paidAndActive(subs?.product, now)) product = (await getPlan(subs.product.planId))?.limits || product;
    if (paidAndActive(subs?.service, now)) service = (await getPlan(subs.service.planId))?.limits || service;
  }

  return {
    // A plan document without the number falls back to the free limit rather than to "no limit".
    maxProducts: product.maxProducts || FREE_LIMITS.maxProducts,
    maxServices: service.maxServices || FREE_LIMITS.maxServices,
    vipTagsProduct: product.vipTags || 0,
    vipTagsService: service.vipTags || 0,
  };
}

/** The limits for `uid`, plus their subscriptions document (callers often need both). */
export async function getUserLimitsServer(db, uid, now = Date.now()) {
  const subSnap = await db.collection("subscriptions").doc(uid).get();
  const subs = subSnap.exists ? subSnap.data() : {};
  const getPlan = async (planId) => {
    const snap = await db.collection("subscriptionPlans").doc(planId).get();
    return snap.exists ? snap.data() : null;
  };
  return { limits: await resolveLimits(subs, getPlan, now), subs };
}
