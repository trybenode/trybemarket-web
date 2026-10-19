import { adminDB } from "./firebaseAdmin.js";
import { isKycCleared } from "./kycAccess.js";
import { extractPaymentDate, countConsecutivePaidMonths } from "./planEligibilityShared.js";

export class SubscriptionEligibilityError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

/** Admin-SDK counterpart to lib/subscriptionStore.js's getUserPaidMonthsCount. */
export async function getUserPaidMonthsCountAdmin(userId, category) {
  const snap = await adminDB
    .collection("subscriptionPayments")
    .where("userId", "==", userId)
    .where("category", "==", category)
    .where("status", "==", "success")
    .get();
  const dates = snap.docs.map((d) => extractPaymentDate(d.data())).filter(Boolean);
  return countConsecutivePaidMonths(dates);
}

/**
 * Subscribing requires KYC — enforced here, not just by the subscription page
 * disabling its button (any client could call the purchase routes directly).
 * Called before payment (reserveCredit, /api/subscription/precheck) and at the
 * final purchase gate (assertPlanEligibilityAdmin, via verify-payment).
 */
export async function assertKycVerifiedAdmin(userId) {
  const userSnap = await adminDB.collection("users").doc(userId).get();
  if (!isKycCleared(userSnap.exists ? userSnap.data() : null)) {
    throw new SubscriptionEligibilityError("Complete KYC verification before subscribing.");
  }
}

/**
 * Server-side enforcement of KYC and of a plan's requiresPaidMonths gate — the client
 * hiding "Subscribe Now" for an ineligible plan was never a real boundary
 * (same pattern as the VIP-tag cap and isVip/sellerTier fixes earlier this
 * cycle). Called from pages/api/subscription/verify-payment.js, the one
 * real purchase-finalization path for plans with this gate today
 * (maintenance plans aren't in CREDIT_SPEND_CAPS, so they can't reach the
 * credit-assisted flow at all).
 */
export async function assertPlanEligibilityAdmin(userId, plan) {
  await assertKycVerifiedAdmin(userId);
  if (!plan.eligibility?.requiresPaidMonths) return;
  const paidMonths = await getUserPaidMonthsCountAdmin(userId, plan.category);
  if (paidMonths < plan.eligibility.requiresPaidMonths) {
    throw new SubscriptionEligibilityError(
      `This plan requires ${plan.eligibility.requiresPaidMonths} consecutive paid months — you have ${paidMonths}.`
    );
  }
}
