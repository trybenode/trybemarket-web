/**
 * Notification limits system - Dual tracking approach:
 * 
 * EMAIL: Limit the SENDER (cost control + prevent spam)
 * - Tracks: How many emails has this user SENT today?
 * - Prevents buyers from spamming 50 sellers with emails
 * - Incentivizes upgrades for serious buyers
 * 
 * WHATSAPP: Limit the RECEIVER (cost control + user experience)
 * - Tracks: How many WhatsApps has this user RECEIVED today?
 * - You pay per WhatsApp sent, so cap costs per receiving user
 * - Protects sellers from being bombarded
 * - Incentivizes sellers to upgrade if they want more notifications
 */

import { adminDB } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

// LEGACY: Plan → daily limit mapping (kept as fallback only)
// These values are now read from database (subscriptionPlans collection)
// but kept here for backward compatibility if database read fails
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

const DEFAULT_LIMIT = 5; // Free tier default (fallback only)

/**
 * Cache for database plan lookups (reduces Firestore reads)
 */
const planCacheAdmin = new Map();
const CACHE_TTL_ADMIN = 5 * 60 * 1000; // 5 minutes

/**
 * Get plan from database (Firebase Admin SDK version)
 * @param {string} planId - Plan ID to fetch
 * @returns {Promise<Object|null>} - Plan data or null if not found
 */
async function getPlanFromDatabaseAdmin(planId) {
  // Check cache first
  const cached = planCacheAdmin.get(planId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_ADMIN) {
    return cached.data;
  }

  try {
    const planRef = adminDB.collection("subscriptionPlans").doc(planId);
    const planSnap = await planRef.get();
    
    if (!planSnap.exists) {
      console.warn(`[Notifications] Plan ${planId} not found in database, using hardcoded fallback`);
      return null;
    }

    const plan = { id: planSnap.id, ...planSnap.data() };
    
    // Cache it
    planCacheAdmin.set(planId, { data: plan, timestamp: Date.now() });
    
    return plan;
  } catch (error) {
    console.error(`[Notifications] Error fetching plan ${planId}:`, error);
    return null;
  }
}

/**
 * Get default notification limit from free-tier document
 * @returns {Promise<number>} - Default daily notification limit
 */
async function getDefaultNotificationLimit() {
  try {
    const freeTierDoc = await getPlanFromDatabaseAdmin("free-tier");
    if (freeTierDoc?.limits?.dailyNotifications) {
      return freeTierDoc.limits.dailyNotifications;
    }
    console.warn("[Notifications] free-tier document missing dailyNotifications, using hardcoded default");
    return DEFAULT_LIMIT;
  } catch (error) {
    console.warn("[Notifications] Could not read free-tier notification limit, using hardcoded default:", error.message);
    return DEFAULT_LIMIT;
  }
}

/**
 * Get daily notification limit for a user based on their highest tier plan (DATABASE-DRIVEN)
 * This determines how many notifications the user can SEND per day
 * @param {string} userId - Firestore user ID (the sender)
 * @returns {Promise<number>} - Daily sending limit
 */
export async function getUserDailyLimit(userId) {
  try {
    console.log("[Notifications] Getting notification limit for user:", userId);
    
    // Fetch user's active subscriptions
    const subRef = adminDB.collection("subscriptions").doc(userId);
    const subSnap = await subRef.get();

    // Get default from database
    const defaultLimit = await getDefaultNotificationLimit();

    if (!subSnap.exists) {
      console.log("[Notifications] No subscription found, using default:", defaultLimit);
      return defaultLimit;
    }

    const subData = subSnap.data();
    let maxLimit = defaultLimit;

    // Check bundle first (highest priority)
    if (subData.bundle?.isActive && subData.bundle?.planId) {
      const bundlePlan = await getPlanFromDatabaseAdmin(subData.bundle.planId);
      if (bundlePlan?.limits?.dailyNotifications) {
        const bundleLimit = bundlePlan.limits.dailyNotifications;
        console.log(`[Notifications] Bundle plan ${subData.bundle.planId} limit:`, bundleLimit);
        maxLimit = Math.max(maxLimit, bundleLimit);
      } else {
        // Fallback to hardcoded if database value missing
        const fallbackLimit = PLAN_LIMITS[subData.bundle.planId] || defaultLimit;
        console.warn(`[Notifications] Bundle plan ${subData.bundle.planId} missing dailyNotifications, using fallback:`, fallbackLimit);
        maxLimit = Math.max(maxLimit, fallbackLimit);
      }
    }

    // Check product plan
    if (subData.product?.isActive && subData.product?.planId) {
      const productPlan = await getPlanFromDatabaseAdmin(subData.product.planId);
      if (productPlan?.limits?.dailyNotifications) {
        const productLimit = productPlan.limits.dailyNotifications;
        console.log(`[Notifications] Product plan ${subData.product.planId} limit:`, productLimit);
        maxLimit = Math.max(maxLimit, productLimit);
      } else {
        const fallbackLimit = PLAN_LIMITS[subData.product.planId] || defaultLimit;
        console.warn(`[Notifications] Product plan ${subData.product.planId} missing dailyNotifications, using fallback:`, fallbackLimit);
        maxLimit = Math.max(maxLimit, fallbackLimit);
      }
    }

    // Check service plan
    if (subData.service?.isActive && subData.service?.planId) {
      const servicePlan = await getPlanFromDatabaseAdmin(subData.service.planId);
      if (servicePlan?.limits?.dailyNotifications) {
        const serviceLimit = servicePlan.limits.dailyNotifications;
        console.log(`[Notifications] Service plan ${subData.service.planId} limit:`, serviceLimit);
        maxLimit = Math.max(maxLimit, serviceLimit);
      } else {
        const fallbackLimit = PLAN_LIMITS[subData.service.planId] || defaultLimit;
        console.warn(`[Notifications] Service plan ${subData.service.planId} missing dailyNotifications, using fallback:`, fallbackLimit);
        maxLimit = Math.max(maxLimit, fallbackLimit);
      }
    }

    console.log("[Notifications] Final notification limit:", maxLimit);
    return maxLimit;
  } catch (error) {
    console.error("[Notifications] Error getting user daily limit:", error);
    // Fallback to default
    const fallbackLimit = await getDefaultNotificationLimit();
    return fallbackLimit;
  }
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
function getTodayString() {
  return new Date().toISOString().split("T")[0];
}

/**
 * EMAIL SENDER TRACKING
 * Check if user can SEND an email notification and increment their count
 * @param {string} senderId - User ID of the person sending the message
 * @returns {Promise<{allowed: boolean, remaining: number, limit: number}>}
 */
export async function checkAndIncrementEmailSent(senderId) {
  try {
    console.log("=== Checking EMAIL quota for SENDER:", senderId);
    
    const userRef = adminDB.collection("users").doc(senderId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.log("Sender document doesn't exist:", senderId);
      return { allowed: false, remaining: 0, limit: 0 };
    }

    const userData = userSnap.data();
    const limit = await getUserDailyLimit(senderId);
    const today = getTodayString();

    const emailData = userData.notifications?.emailSent || { dailyCount: 0, lastResetDate: "" };
    let currentCount = emailData.dailyCount || 0;

    // Reset if new day
    if (emailData.lastResetDate !== today) {
      console.log("New day - resetting email sent count from", currentCount, "to 0");
      currentCount = 0;
      await userRef.update({
        "notifications.emailSent.dailyCount": 0,
        "notifications.emailSent.lastResetDate": today,
      });
    }

    // Check limit
    if (currentCount >= limit) {
      console.log("Email send limit reached:", currentCount, ">=", limit);
      return { allowed: false, remaining: 0, limit };
    }

    // Increment
    console.log("Incrementing email sent count from", currentCount, "to", currentCount + 1);
    await userRef.update({
      "notifications.emailSent.dailyCount": FieldValue.increment(1),
      "notifications.emailSent.lastResetDate": today,
    });

    const remaining = limit - currentCount - 1;
    console.log("Email allowed. Remaining:", remaining, "Limit:", limit);
    return { allowed: true, remaining, limit };
  } catch (error) {
    console.error("Error checking email sent quota:", error);
    return { allowed: false, remaining: 0, limit: 0 };
  }
}

/**
 * WHATSAPP RECEIVER TRACKING - CHECK ONLY
 * Check if recipient can RECEIVE a WhatsApp notification WITHOUT incrementing
 * @param {string} recipientId - User ID of the person who will receive the WhatsApp
 * @returns {Promise<{allowed: boolean, remaining: number, limit: number, currentCount: number}>}
 */
export async function checkWhatsAppQuota(recipientId) {
  try {
    console.log("=== Checking WhatsApp quota for RECIPIENT (no increment):", recipientId);
    
    const userRef = adminDB.collection("users").doc(recipientId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.log("Recipient document doesn't exist:", recipientId);
      return { allowed: false, remaining: 0, limit: 0, currentCount: 0 };
    }

    const userData = userSnap.data();
    const limit = await getUserDailyLimit(recipientId);
    const today = getTodayString();

    const whatsappData = userData.notifications?.whatsappReceived || { dailyCount: 0, lastResetDate: "" };
    let currentCount = whatsappData.dailyCount || 0;

    // Reset if new day (but don't save yet)
    if (whatsappData.lastResetDate !== today) {
      console.log("New day detected - count would reset from", currentCount, "to 0");
      currentCount = 0;
    }

    // Check limit
    if (currentCount >= limit) {
      console.log("WhatsApp receive limit would be reached:", currentCount, ">=", limit);
      return { allowed: false, remaining: 0, limit, currentCount };
    }

    const remaining = limit - currentCount - 1; // After hypothetical increment
    console.log("WhatsApp quota check OK. Would have remaining:", remaining, "Limit:", limit);
    return { allowed: true, remaining, limit, currentCount };
  } catch (error) {
    console.error("Error checking WhatsApp quota:", error);
    return { allowed: false, remaining: 0, limit: 0, currentCount: 0 };
  }
}

/**
 * INCREMENT WhatsApp received count (call AFTER successful send)
 * @param {string} recipientId - User ID of the person who received the WhatsApp
 * @returns {Promise<{success: boolean, remaining: number, limit: number}>}
 */
export async function incrementWhatsAppReceived(recipientId) {
  try {
    console.log("=== Incrementing WhatsApp received count for:", recipientId);
    
    const userRef = adminDB.collection("users").doc(recipientId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.log("Recipient document doesn't exist:", recipientId);
      return { success: false, remaining: 0, limit: 0 };
    }

    const userData = userSnap.data();
    const limit = await getUserDailyLimit(recipientId);
    const today = getTodayString();

    const whatsappData = userData.notifications?.whatsappReceived || { dailyCount: 0, lastResetDate: "" };
    let currentCount = whatsappData.dailyCount || 0;

    // Reset if new day
    if (whatsappData.lastResetDate !== today) {
      console.log("New day - resetting WhatsApp received count from", currentCount, "to 0");
      currentCount = 0;
      await userRef.update({
        "notifications.whatsappReceived.dailyCount": 0,
        "notifications.whatsappReceived.lastResetDate": today,
      });
    }

    // Increment
    console.log("Incrementing WhatsApp received count from", currentCount, "to", currentCount + 1);
    await userRef.update({
      "notifications.whatsappReceived.dailyCount": FieldValue.increment(1),
      "notifications.whatsappReceived.lastResetDate": today,
    });

    const remaining = limit - currentCount - 1;
    console.log("WhatsApp incremented. Remaining:", remaining, "Limit:", limit);
    return { success: true, remaining, limit };
  } catch (error) {
    console.error("Error incrementing WhatsApp received:", error);
    return { success: false, remaining: 0, limit: 0 };
  }
}

/**
 * WHATSAPP RECEIVER TRACKING - CHECK AND INCREMENT (DEPRECATED - use separate functions)
 * @deprecated Use checkWhatsAppQuota() then incrementWhatsAppReceived() instead
 * Check if recipient can RECEIVE a WhatsApp notification and increment their count
 * @param {string} recipientId - User ID of the person who will receive the WhatsApp
 * @returns {Promise<{allowed: boolean, remaining: number, limit: number}>}
 */
export async function checkAndIncrementWhatsAppReceived(recipientId) {
  try {
    console.log("=== Checking WhatsApp quota for RECIPIENT:", recipientId);
    
    const userRef = adminDB.collection("users").doc(recipientId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.log("Recipient document doesn't exist:", recipientId);
      return { allowed: false, remaining: 0, limit: 0 };
    }

    const userData = userSnap.data();
    const limit = await getUserDailyLimit(recipientId);
    const today = getTodayString();

    const whatsappData = userData.notifications?.whatsappReceived || { dailyCount: 0, lastResetDate: "" };
    let currentCount = whatsappData.dailyCount || 0;

    // Reset if new day
    if (whatsappData.lastResetDate !== today) {
      console.log("New day - resetting WhatsApp received count from", currentCount, "to 0");
      currentCount = 0;
      await userRef.update({
        "notifications.whatsappReceived.dailyCount": 0,
        "notifications.whatsappReceived.lastResetDate": today,
      });
    }

    // Check limit
    if (currentCount >= limit) {
      console.log("WhatsApp receive limit reached:", currentCount, ">=", limit);
      return { allowed: false, remaining: 0, limit };
    }

    // Increment
    console.log("Incrementing WhatsApp received count from", currentCount, "to", currentCount + 1);
    await userRef.update({
      "notifications.whatsappReceived.dailyCount": FieldValue.increment(1),
      "notifications.whatsappReceived.lastResetDate": today,
    });

    const remaining = limit - currentCount - 1;
    console.log("WhatsApp allowed. Remaining:", remaining, "Limit:", limit);
    return { allowed: true, remaining, limit };
  } catch (error) {
    console.error("Error checking WhatsApp received quota:", error);
    return { allowed: false, remaining: 0, limit: 0 };
  }
}

/**
 * Get user's current notification status for display
 * Returns both email sent (what they control) and WhatsApp received (what they can't control)
 * @param {string} userId - Firestore user ID
 * @returns {Promise<{emailSent: {count, remaining, limit}, whatsappReceived: {count, remaining, limit}}>}
 */
export async function getNotificationStatus(userId) {
  try {
    console.log("=== getNotificationStatus called for userId:", userId);
    
    const userRef = adminDB.collection("users").doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      console.log("User document doesn't exist for:", userId);
      return {
        emailSent: { count: 0, remaining: 0, limit: 0 },
        whatsappReceived: { count: 0, remaining: 0, limit: 0 }
      };
    }

    const userData = userSnap.data();
    const limit = await getUserDailyLimit(userId);
    const today = getTodayString();

    // Email sent status
    const emailData = userData.notifications?.emailSent || { dailyCount: 0, lastResetDate: "" };
    let emailCount = emailData.dailyCount || 0;
    if (emailData.lastResetDate !== today) {
      emailCount = 0;
    }

    // WhatsApp received status
    const whatsappData = userData.notifications?.whatsappReceived || { dailyCount: 0, lastResetDate: "" };
    let whatsappCount = whatsappData.dailyCount || 0;
    if (whatsappData.lastResetDate !== today) {
      whatsappCount = 0;
    }

    console.log("Status - Email sent:", emailCount, "WhatsApp received:", whatsappCount, "Limit:", limit);
    
    return {
      emailSent: {
        count: emailCount,
        remaining: Math.max(0, limit - emailCount),
        limit,
      },
      whatsappReceived: {
        count: whatsappCount,
        remaining: Math.max(0, limit - whatsappCount),
        limit,
      }
    };
  } catch (error) {
    console.error("Error getting notification status:", error);
    return {
      emailSent: { count: 0, remaining: 0, limit: 0 },
      whatsappReceived: { count: 0, remaining: 0, limit: 0 }
    };
  }
}
