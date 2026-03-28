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
    const subRef = adminDB.collection("subscriptions").doc(userId);
    const subSnap = await subRef.get();

    if (!subSnap.exists) {
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
 * WHATSAPP RECEIVER TRACKING
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
