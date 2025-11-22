import { doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

/**
 * SUBSCRIPTION PLANS - Match subscriptionPlan.js structure
 */
export const SUBSCRIPTION_PLANS = {
  // PRODUCT PLANS
  product_free: {
    id: "product_free",
    name: "Freemium",
    category: "product",
    type: "free",
    price: 0,
    features: [
      "Post up to 3 products",
      "Messaging with buyers",
      "Public shop profile",
      "Profile view count",
      "Access to all basic platform features",
    ],
    limits: { maxProducts: 3, vipTags: 0 },
    eligibility: { requiresPaidMonths: 0 },
    visibility: { featured: false, searchBoost: false },
    cycle: "monthly",
  },
  product_premium: {
    id: "product_premium",
    name: "Premium Products",
    category: "product",
    type: "premium",
    price: 1200,
    features: [
      "Unlimited product listings",
      "Shareable shop link",
      "Basic shop analytics",
      "Premium seller badge",
      "2 VIP-tagged products",
      "Access to TrybeFair",
    ],
    limits: { maxProducts: 9999, vipTags: 2 },
    eligibility: { requiresPaidMonths: 0 },
    visibility: { featured: false, searchBoost: true },
    cycle: "monthly",
  },
  product_vip: {
    id: "product_vip",
    name: "VIP Products",
    category: "product",
    type: "vip",
    price: 1700,
    features: [
      "Everything in Premium",
      "5 VIP-tagged products",
      "Featured product placements",
      "Priority search ranking",
    ],
    limits: { maxProducts: 9999, vipTags: 5 },
    eligibility: { requiresPaidMonths: 0 },
    visibility: { featured: true, searchBoost: true },
    cycle: "monthly",
  },
  product_maintenance: {
    id: "product_maintenance",
    name: "Products Maintenance",
    category: "product",
    type: "maintenance",
    price: 700,
    features: ["Keeps products active", "No VIP or analytics perks"],
    limits: { maxProducts: 9999, vipTags: 0 },
    eligibility: { requiresPaidMonths: 3 },
    visibility: { featured: false },
    cycle: "monthly",
    requiresNote: true,
  },

  // SERVICE PLANS
  service_free: {
    id: "service_free",
    name: "Freemium",
    category: "service",
    type: "free",
    price: 0,
    features: [
      "1 service listing",
      "Messaging",
      "Public shop profile",
      "Profile view count",
      "All basic features",
    ],
    limits: { maxServices: 1 },
    eligibility: { requiresPaidMonths: 0 },
    visibility: { featured: false },
    cycle: "monthly",
  },
  service_premium: {
    id: "service_premium",
    name: "Premium Services",
    category: "service",
    type: "premium",
    price: 1400,
    features: [
      "2 service listings",
      "Shareable shop link",
      "Premium service provider badge",
      "Shop analytics",
      "Service Boost",
      "TrybeFair access",
    ],
    limits: { maxServices: 2 },
    eligibility: { requiresPaidMonths: 0 },
    visibility: { featured: false, searchBoost: true },
    cycle: "monthly",
  },
  service_vip: {
    id: "service_vip",
    name: "VIP Services",
    category: "service",
    type: "vip",
    price: 2000,
    features: [
      "Up to 5 services",
      "VIP badge",
      "1 VIP-tagged service",
      "Featured service placement",
    ],
    limits: { maxServices: 5, vipTags: 1 },
    eligibility: { requiresPaidMonths: 0 },
    visibility: { featured: true, searchBoost: true },
    cycle: "monthly",
  },
  service_maintenance: {
    id: "service_maintenance",
    name: "Services Maintenance",
    category: "service",
    type: "maintenance",
    price: 700,
    features: ["Keeps services active", "No premium perks"],
    limits: { maxServices: 5 },
    eligibility: { requiresPaidMonths: 3 },
    visibility: { featured: false },
    cycle: "monthly",
    requiresNote: true,
  },

  // BUNDLE PLAN
  bundle_premium: {
    id: "bundle_premium",
    name: "Premium Bundle",
    category: "bundle",
    type: "bundle",
    price: 2500,
    features: [
      "Premium Products plan included",
      "Premium Services plan included",
      "Save ₦100 monthly",
      "All premium features",
    ],
    eligibility: { requiresPaidMonths: 0 },
    visibility: { featured: true },
    cycle: "monthly",
    includes: ["product_premium", "service_premium"],
  },
};

/**
 * Get plans by category
 */
export function getPlansByCategory(category) {
  return Object.values(SUBSCRIPTION_PLANS).filter(
    (plan) => plan.category === category
  );
}

/**
 * Get a specific plan by ID
 */
export function getPlanById(planId) {
  return SUBSCRIPTION_PLANS[planId] || null;
}

/**
 * Calculate expiry date based on plan cycle
 */
export function calculateExpiryDate(cycle = "monthly") {
  const date = new Date();
  if (cycle === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else if (cycle === "yearly") {
    date.setFullYear(date.getFullYear() + 1);
  }
  return date;
}

/**
 * Check if user is eligible for a plan
 */
export async function checkPlanEligibility(userId, planId) {
  const plan = getPlanById(planId);
  if (!plan) {
    return { eligible: false, reason: "Plan not found" };
  }

  // Free plans are always eligible
  if (plan.price === 0) {
    return { eligible: true };
  }

  // Check if maintenance plan requires paid months
  if (plan.eligibility?.requiresPaidMonths > 0) {
    const paidMonthsCount = await getUserPaidMonthsCount(userId, plan.category);
    if (paidMonthsCount < plan.eligibility.requiresPaidMonths) {
      return {
        eligible: false,
        reason: `You need ${plan.eligibility.requiresPaidMonths} paid months to access this plan. You have ${paidMonthsCount}.`,
      };
    }
  }

  return { eligible: true };
}

/**
 * Count user's paid months in a category
 */
export async function getUserPaidMonthsCount(userId, category) {
  try {
    const paymentsRef = collection(db, "subscriptionPayments");
    const q = query(
      paymentsRef,
      where("userId", "==", userId),
      where("category", "==", category),
      where("status", "==", "success")
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch (error) {
    console.error("Error counting paid months:", error);
    return 0;
  }
}

/**
 * Get user's active subscriptions
 */
export async function getUserSubscriptions(userId) {
  try {
    const subRef = doc(db, "subscriptions", userId);
    const subSnap = await getDoc(subRef);

    if (!subSnap.exists()) {
      return {
        product: { planId: "product_free", isActive: true },
        service: { planId: "service_free", isActive: true },
      };
    }

    const data = subSnap.data();
    return {
      product: data.product || { planId: "product_free", isActive: true },
      service: data.service || { planId: "service_free", isActive: true },
      bundle: data.bundle || null,
    };
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    throw error;
  }
}

/**
 * Check if subscription is active and not expired
 */
export function isSubscriptionActive(subscription) {
  if (!subscription || !subscription.isActive) return false;
  if (!subscription.expiryDate) return false;

  const now = new Date();
  const expiry = subscription.expiryDate.toDate
    ? subscription.expiryDate.toDate()
    : new Date(subscription.expiryDate);

  return now < expiry;
}

/**
 * Get user's current limits based on active plans
 */
export async function getUserLimits(userId) {
  try {
    const subs = await getUserSubscriptions(userId);
    
    let productLimits = { maxProducts: 3, vipTags: 0 };
    let serviceLimits = { maxServices: 1 };

    // Check bundle first
    if (subs.bundle && isSubscriptionActive(subs.bundle)) {
      const bundlePlan = getPlanById(subs.bundle.planId);
      if (bundlePlan?.includes) {
        const productPlan = getPlanById(bundlePlan.includes[0]);
        const servicePlan = getPlanById(bundlePlan.includes[1]);
        productLimits = productPlan?.limits || productLimits;
        serviceLimits = servicePlan?.limits || serviceLimits;
      }
    } else {
      // Check individual plans
      if (subs.product && isSubscriptionActive(subs.product)) {
        const plan = getPlanById(subs.product.planId);
        productLimits = plan?.limits || productLimits;
      }
      if (subs.service && isSubscriptionActive(subs.service)) {
        const plan = getPlanById(subs.service.planId);
        serviceLimits = plan?.limits || serviceLimits;
      }
    }

    return {
      ...productLimits,
      ...serviceLimits,
    };
  } catch (error) {
    console.error("Error getting user limits:", error);
    return { maxProducts: 3, vipTags: 0, maxServices: 1 };
  }
}

/**
 * Activate subscription after successful payment
 */
export async function activateSubscription(userId, planId, paymentReference) {
  try {
    const plan = getPlanById(planId);
    if (!plan) throw new Error("Invalid plan ID");

    const subRef = doc(db, "subscriptions", userId);
    const expiryDate = calculateExpiryDate(plan.cycle);

    const subscriptionData = {
      planId: planId,
      planName: plan.name,
      category: plan.category,
      amount: plan.price,
      isActive: true,
      subscribedAt: serverTimestamp(),
      expiryDate: expiryDate,
      features: plan.features,
      limits: plan.limits || {},
      paymentReference: paymentReference,
      autoRenew: false,
    };

    // Update the specific category in the subscription document
    if (plan.category === "bundle") {
      await setDoc(subRef, { bundle: subscriptionData }, { merge: true });
    } else {
      await setDoc(
        subRef,
        { [plan.category]: subscriptionData },
        { merge: true }
      );
    }

    // Record payment
    const paymentRef = doc(collection(db, "subscriptionPayments"));
    await setDoc(paymentRef, {
      userId: userId,
      planId: planId,
      category: plan.category,
      amount: plan.price,
      reference: paymentReference,
      status: "success",
      createdAt: serverTimestamp(),
    });

    return { success: true, subscription: subscriptionData };
  } catch (error) {
    console.error("Error activating subscription:", error);
    throw error;
  }
}

/**
 * Cancel subscription (set to inactive but keep data)
 */
export async function cancelSubscription(userId, category) {
  try {
    const subRef = doc(db, "subscriptions", userId);
    await updateDoc(subRef, {
      [`${category}.isActive`]: false,
      [`${category}.cancelledAt`]: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    throw error;
  }
}
