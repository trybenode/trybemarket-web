/**
 * Notification limits system for email + WhatsApp combined
 * Limits control how many notifications a user can SEND per day (cost control for Resend/WhatsApp API)
 * Limits are per user per day, shared across both channels
 */

import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, increment } from "firebase/firestore";

// Plan → daily limit mapping (from your subscription plans)
const PLAN_LIMITS = {
  // Product plans
  product_free: 5,
  product_maintenance: 5,
  product_premium: 10,
  product_vip: 20,
  
  // Service plans
  service_free: 5,
  service_maintenance: 5,
  service_premium: 10,
  service_vip: 20,
  
  // Bundle plans
  bundle_premium: 20,
  bundle_quarterly: 20,
  bundle_yearly: 20,
  
  // Boost plans default to free tier
  boost_7days_basic: 5,
  boost_7days_premium: 5,
  boost_7days_vip: 5,
};

const DEFAULT_LIMIT = 5; // Free tier default

/**
 * Get daily notification limit for a user based on their highest tier plan
 * This determines how many notifications the user can SEND per day
 * @param {string} userId - Firestore user ID (the sender)
 * @returns {Promise<number>} - Daily sending limit
 */
export async function getUserDailyLimit(userId) {
  try {
    // Fetch user's active subscriptions
    const subRef = doc(db, "subscriptions", userId);
    const subSnap = await getDoc(subRef);

    if (!subSnap.exists()) {
      return DEFAULT_LIMIT; // No subscription = free tier
    }

    const subData = subSnap.data();
    let maxLimit = DEFAULT_LIMIT;

    // Check bundle first (highest priority)
    if (subData.bundle?.isActive && subData.bundle?.planId) {
      const bundleLimit = PLAN_LIMITS[subData.bundle.planId] || DEFAULT_LIMIT;
      maxLimit = Math.max(maxLimit, bundleLimit);
    }

    // Check product plan
    if (subData.product?.isActive && subData.product?.planId) {
      const productLimit = PLAN_LIMITS[subData.product.planId] || DEFAULT_LIMIT;
      maxLimit = Math.max(maxLimit, productLimit);
    }

    // Check service plan
    if (subData.service?.isActive && subData.service?.planId) {
      const serviceLimit = PLAN_LIMITS[subData.service.planId] || DEFAULT_LIMIT;
      maxLimit = Math.max(maxLimit, serviceLimit);
    }

    return maxLimit;
  } catch (error) {
    console.error("Error getting user daily limit:", error);
    return DEFAULT_LIMIT;
  }
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Check if user can SEND a notification (cost control), and increment their count
 * Resets counter if it's a new day
 * @param {string} userId - Firestore user ID (the sender triggering the notification)
 * @returns {Promise<{allowed: boolean, remaining: number, limit: number}>}
 */
export async function checkAndIncrementNotificationCount(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { allowed: false, remaining: 0, limit: 0 };
    }

    const userData = userSnap.data();
    const limit = await getUserDailyLimit(userId);
    const today = getTodayString();

    const notifData = userData.notifications || { dailyCount: 0, lastResetDate: "" };
    const lastResetDate = notifData.lastResetDate || "";

    // Reset count if it's a new day
    let currentCount = notifData.dailyCount || 0;
    if (lastResetDate !== today) {
      currentCount = 0;
      await updateDoc(userRef, {
        "notifications.dailyCount": 0,
        "notifications.lastResetDate": today,
      });
    }

    // Check if limit reached
    if (currentCount >= limit) {
      return { allowed: false, remaining: 0, limit };
    }

    // Increment count
    await updateDoc(userRef, {
      "notifications.dailyCount": increment(1),
      "notifications.lastResetDate": today,
    });

    return { allowed: true, remaining: limit - currentCount - 1, limit };
  } catch (error) {
    console.error("Error checking notification count:", error);
    return { allowed: false, remaining: 0, limit: 0 };
  }
}

/**
 * Get user's current notification sending status without incrementing
 * Used to display how many notifications the user can still send today
 * @param {string} userId - Firestore user ID (the sender)
 * @returns {Promise<{count: number, remaining: number, limit: number}>}
 */
export async function getNotificationStatus(userId) {
  try {
    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return { count: 0, remaining: 0, limit: 0 };
    }

    const userData = userSnap.data();
    const limit = await getUserDailyLimit(userId);
    const today = getTodayString();

    const notifData = userData.notifications || { dailyCount: 0, lastResetDate: "" };
    const lastResetDate = notifData.lastResetDate || "";

    // Reset count if it's a new day
    let currentCount = notifData.dailyCount || 0;
    if (lastResetDate !== today) {
      currentCount = 0;
    }

    return {
      count: currentCount,
      remaining: Math.max(0, limit - currentCount),
      limit,
    };
  } catch (error) {
    console.error("Error getting notification status:", error);
    return { count: 0, remaining: 0, limit: 0 };
  }
}
