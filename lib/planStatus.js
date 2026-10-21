/**
 * Whether a subscription plan entitles its owner to its benefits RIGHT NOW —
 * the one rule every entitlement check uses: notification limits, ranking
 * tier, VIP-tag caps, shop-view alerts, upload limits.
 *
 * A plan counts only while it's marked active AND its expiryDate hasn't
 * passed. The nightly job (pages/api/subscription/cleanup-expired-vip.js)
 * later flips isActive off and strips VIP tags, but entitlement never waits
 * for it: if that job is late or failing, an expired plan still stops
 * counting the moment it expires.
 *
 * Pure (no Firestore import), so client and server code share it.
 */

/**
 * A plan's expiryDate in milliseconds — stored as a Firestore Timestamp, its
 * serialized { seconds } / { _seconds } shape, a Date, a number or an ISO
 * string, depending on how the plan was bought or resumed. Null if missing
 * or unreadable.
 */
export function planExpiryMs(plan) {
  const value = plan?.expiryDate;
  if (value == null || value === "") return null;
  let ms;
  if (typeof value.toMillis === "function") ms = value.toMillis();
  else if (typeof value.toDate === "function") ms = value.toDate().getTime();
  else if (typeof value.seconds === "number") ms = value.seconds * 1000;
  else if (typeof value._seconds === "number") ms = value._seconds * 1000;
  else if (value instanceof Date) ms = value.getTime();
  else if (typeof value === "number") ms = value;
  else ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Active and not yet expired. Plans without an expiryDate (the free and
 * maintenance entries) count while marked active; an expiryDate that can't
 * be read counts as expired rather than as forever.
 */
export function isPlanActive(plan, now = Date.now()) {
  if (!plan?.isActive) return false;
  if (plan.expiryDate == null || plan.expiryDate === "") return true;
  const expiry = planExpiryMs(plan);
  return expiry !== null && expiry > now;
}
