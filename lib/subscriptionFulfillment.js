import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { computeSellerTier } from "./sellerTier.js";
import { computeRankScore } from "./rankScoreServer.js";

export class SubscriptionPaymentError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Shared "what happens when a plan is successfully paid for" logic — used by
 * both the existing full-price flow (pages/api/subscription/verify-payment.js)
 * and the new credit-assisted flow (lib/creditSpendServer.js), so there is
 * exactly one place that activates a subscription or mints a boost credit.
 * Callers are responsible for having already verified the payment amount.
 */

export function calculateExpiryDate(cycle = "monthly", durationMonths = 1) {
  const date = new Date();

  if (cycle === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else if (cycle === "quarterly") {
    date.setMonth(date.getMonth() + 3);
  } else if (cycle === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  } else if (cycle === "one-time") {
    const durationDays = Number(durationMonths) * 30;
    date.setDate(date.getDate() + (Number.isFinite(durationDays) ? durationDays : 30));
  } else if (durationMonths) {
    date.setMonth(date.getMonth() + Number(durationMonths));
  }

  return date.toISOString();
}

export async function fulfillPlanPurchase(userId, plan, reference) {
  const now = new Date().toISOString();
  const expiryDate = calculateExpiryDate(plan.cycle, plan.durationMonths || 1);
  const subscriptionData = {
    planId: plan.id,
    planName: plan.name,
    category: plan.category,
    amount: plan.price,
    isActive: true,
    subscribedAt: now,
    expiryDate,
    features: plan.features || [],
    limits: plan.limits || {},
    paymentReference: reference,
    autoRenew: false,
  };

  const subscriptionUpdate =
    plan.category === "bundle" ? { bundle: subscriptionData } : { [plan.category]: subscriptionData };

  await adminDB.collection("subscriptions").doc(userId).set(subscriptionUpdate, { merge: true });

  await adminDB.collection("users").doc(userId).set(
    {
      notifications: {
        emailSent: { dailyCount: 0, lastResetDate: now.split("T")[0] },
        whatsappReceived: { dailyCount: 0, lastResetDate: now.split("T")[0] },
      },
    },
    { merge: true }
  );

  // createdAt is only set the first time this reference is written — this
  // function can legitimately run twice for the same reference (the webhook
  // and the client-facing verify endpoint can both call it for one payment;
  // see credit-spending-security-checklist.md #2's note on this route's
  // weaker idempotency guarantee), and a repeat call must not bump the
  // sort-order timestamp the transactions feed (lib/transactionHistoryServer
  // .js) relies on.
  const paymentRef = adminDB.collection("subscriptionPayments").doc(reference);
  const existingPaymentSnap = await paymentRef.get();
  await paymentRef.set(
    {
      userId,
      planId: plan.id,
      category: plan.category,
      amount: plan.price,
      reference,
      status: "success",
      verifiedAt: now,
      ...(existingPaymentSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );

  // Boost plans are one-time, single-use purchases: record an unused credit
  // that /api/boost/apply-boost consumes when the seller picks an item,
  // instead of granting free boosts off the "boost" category alone.
  if (plan.category === "boost") {
    await adminDB.collection("boostCredits").doc(reference).set(
      {
        userId,
        planId: plan.id,
        tier: plan.type || plan.id,
        durationDays: plan.limits?.durationDays || 7,
        reference,
        status: "unused",
        createdAt: new Date(),
      },
      { merge: true }
    );
  }

  await syncSellerTierAdmin(userId);

  return { subscriptionData };
}

/**
 * Every reference in this codebase is deterministically generated
 * client-side as `${uid}-${timestamp}` (plain flow, app/subscription/page.jsx)
 * or `cs_${uid}_${timestamp}` (credit-assisted flow, lib/creditSpendServer
 * .js's reserveCredit). A literal prefix+separator check — not a
 * split-and-compare, which would misfire if a uid itself ever contained a
 * hyphen — confirms a caller-supplied reference actually belongs to the
 * caller before anything gets written under it.
 */
function referenceBelongsToUser(reference, userId) {
  return reference.startsWith(`${userId}-`) || reference.startsWith(`cs_${userId}_`);
}

/**
 * Logs a failed/cancelled subscription payment attempt — closes a gap where
 * only successful payments ever left a Firestore record (see
 * fulfillPlanPurchase above), so a "cancelled or declined" attempt on the
 * plain checkout flow was previously invisible everywhere, including the
 * transactions history page (lib/transactionHistoryServer.js).
 *
 * Both call sites (pages/api/subscription/verify-payment.js's failure
 * branches, and app/api/subscription/log-failed-payment/route.js) trust a
 * client-supplied reference — this is where that trust is checked, once,
 * rather than duplicated per call site.
 */
export async function logFailedSubscriptionPayment({ userId, reference, planId, reason }) {
  if (!referenceBelongsToUser(reference, userId)) {
    throw new SubscriptionPaymentError("This reference does not belong to you", 403);
  }

  const paymentRef = adminDB.collection("subscriptionPayments").doc(reference);
  const existingSnap = await paymentRef.get();
  if (existingSnap.exists) {
    const existing = existingSnap.data();
    // Defense in depth beyond the prefix check above, in case a future
    // reference format doesn't embed the uid.
    if (existing.userId && existing.userId !== userId) {
      throw new SubscriptionPaymentError("This reference does not belong to you", 403);
    }
    // Never downgrade a real success into a "failed" row — e.g. the
    // popup's onClose firing after onSuccess already resolved, or a race
    // between this call and the webhook/verify path.
    if (existing.status === "success") {
      return { logged: false, reason: "already_success" };
    }
  }

  const planDoc = planId ? await adminDB.collection("subscriptionPlans").doc(planId).get() : null;
  const plan = planDoc?.exists ? planDoc.data() : null;

  await paymentRef.set(
    {
      userId,
      planId: planId || null,
      category: plan?.category || null,
      amount: plan?.price ?? null,
      reference,
      status: "failed",
      reason,
      ...(existingSnap.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
    },
    { merge: true }
  );

  return { logged: true };
}

/**
 * Admin-SDK counterpart to lib/subscriptionStore.js's syncSellerTier —
 * re-stamps sellerTier on all of a user's products/services after a payment.
 */
export async function syncSellerTierAdmin(userId) {
  try {
    const subSnap = await adminDB.collection("subscriptions").doc(userId).get();
    const subs = subSnap.exists ? subSnap.data() : {};
    const productTier = computeSellerTier(subs, "product");
    const serviceTier = computeSellerTier(subs, "service");

    const [productsSnap, servicesSnap] = await Promise.all([
      adminDB.collection("products").where("userId", "==", userId).get(),
      adminDB.collection("services").where("userId", "==", userId).get(),
    ]);

    if (productsSnap.empty && servicesSnap.empty) return;

    const batch = adminDB.batch();
    // rankScore's tierWeight component changes whenever sellerTier does —
    // recompute it here too rather than waiting for some other trigger
    // (07-ranking-unification.md §5), using each doc's own current
    // isVip/isBoosted/boostEndDate state, which this pass doesn't touch.
    // rankShuffleSeed is preserved (self-healed if missing) rather than
    // rerolled — a tier sync shouldn't also reshuffle in-tier position; see
    // the reroll comment on lib/rankScoreServer.js's recomputeRankForItem.
    productsSnap.forEach((d) => {
      const data = d.data();
      const rankShuffleSeed = typeof data.rankShuffleSeed === "number" ? data.rankShuffleSeed : Math.random();
      batch.update(d.ref, {
        sellerTier: productTier,
        rankScore: computeRankScore({ sellerTier: productTier, isVip: data.isVip, isBoosted: data.isBoosted, boostEndDate: data.boostEndDate, shuffleSeed: rankShuffleSeed }),
        rankShuffleSeed,
      });
    });
    servicesSnap.forEach((d) => {
      const data = d.data();
      const rankShuffleSeed = typeof data.rankShuffleSeed === "number" ? data.rankShuffleSeed : Math.random();
      batch.update(d.ref, {
        sellerTier: serviceTier,
        rankScore: computeRankScore({ sellerTier: serviceTier, isVip: data.isVip, isBoosted: data.isBoosted, boostEndDate: data.boostEndDate, shuffleSeed: rankShuffleSeed }),
        rankShuffleSeed,
      });
    });
    await batch.commit();
  } catch (error) {
    console.error("Error syncing seller tier (admin):", error);
  }
}
