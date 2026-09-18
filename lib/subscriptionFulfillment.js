import { adminDB } from "./firebaseAdmin.js";
import { computeSellerTier } from "./sellerTier.js";

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

  await adminDB.collection("subscriptionPayments").doc(reference).set(
    {
      userId,
      planId: plan.id,
      category: plan.category,
      amount: plan.price,
      reference,
      status: "success",
      verifiedAt: now,
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
    productsSnap.forEach((d) => batch.update(d.ref, { sellerTier: productTier }));
    servicesSnap.forEach((d) => batch.update(d.ref, { sellerTier: serviceTier }));
    await batch.commit();
  } catch (error) {
    console.error("Error syncing seller tier (admin):", error);
  }
}
