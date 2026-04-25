/**
 * Expo Push Notification Service
 *
 * Sends push notifications to mobile app users via Expo's Push API.
 * Uses direct HTTP calls to https://exp.host/--/api/v2/push/send
 * No additional dependencies required.
 *
 * Token format: ExponentPushToken[xxxxxxxxxxxxx]
 *
 * @see https://docs.expo.dev/push-notifications/sending-notifications/
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

/**
 * Validate an Expo push token format
 * @param {string} token - The push token to validate
 * @returns {boolean} Whether the token is a valid Expo push token
 */
function isValidExpoPushToken(token) {
  if (!token || typeof token !== "string") return false;
  return token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[");
}

/**
 * Send a push notification via Expo's Push API
 *
 * @param {Object} params - Notification parameters
 * @param {string} params.pushToken - Recipient's Expo push token
 * @param {string} params.title - Notification title
 * @param {string} params.body - Notification body text
 * @param {Object} [params.data] - Custom data payload (for deep linking)
 * @param {string} [params.sound] - Sound to play ("default" or null)
 * @param {string} [params.channelId] - Android notification channel ID
 * @param {number} [params.badge] - iOS badge count
 * @param {string} [params.priority] - "default", "normal", or "high"
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function sendExpoPushNotification({
  pushToken,
  title,
  body,
  data = {},
  sound = "default",
  channelId = "messages",
  badge,
  priority = "high",
}) {
  // Validate token
  if (!isValidExpoPushToken(pushToken)) {
    console.warn("[PUSH] Invalid Expo push token:", pushToken?.substring(0, 30));
    return { success: false, error: "Invalid push token format" };
  }

  // Build the push message
  const message = {
    to: pushToken,
    title,
    body,
    data,
    sound,
    channelId,
    priority,
  };

  if (badge !== undefined) {
    message.badge = badge;
  }

  console.log("[PUSH] Sending notification:", {
    to: pushToken.substring(0, 30) + "...",
    title,
    body: body.substring(0, 50) + (body.length > 50 ? "..." : ""),
  });

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("[PUSH] Expo API error:", response.status, result);
      return {
        success: false,
        error: result?.errors?.[0]?.message || `HTTP ${response.status}`,
      };
    }

    // Expo returns { data: { status, id, message, details } }
    const ticket = result.data;

    if (ticket?.status === "ok") {
      console.log("[PUSH] Sent successfully. Ticket ID:", ticket.id);
      return { success: true, id: ticket.id };
    }

    // Handle known error types
    if (ticket?.status === "error") {
      const errorMessage = ticket.message || "Unknown push error";
      const errorDetails = ticket.details?.error;

      console.error("[PUSH] Push failed:", errorMessage, errorDetails);

      // DeviceNotRegistered means the token is stale
      if (errorDetails === "DeviceNotRegistered") {
        return {
          success: false,
          error: "DeviceNotRegistered",
          shouldRemoveToken: true,
        };
      }

      return { success: false, error: errorMessage };
    }

    return { success: false, error: "Unexpected response format" };
  } catch (error) {
    console.error("[PUSH] Network error:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notifications to multiple recipients (batched)
 * Expo supports up to 100 notifications per request
 *
 * @param {Array<Object>} notifications - Array of notification objects (same params as sendExpoPushNotification)
 * @returns {Promise<Array<{success: boolean, id?: string, error?: string}>>}
 */
export async function sendBatchPushNotifications(notifications) {
  if (!notifications || notifications.length === 0) {
    return [];
  }

  // Filter out invalid tokens
  const validNotifications = notifications.filter((n) =>
    isValidExpoPushToken(n.pushToken)
  );

  if (validNotifications.length === 0) {
    console.warn("[PUSH] No valid push tokens in batch");
    return notifications.map(() => ({
      success: false,
      error: "Invalid push token",
    }));
  }

  // Build messages array
  const messages = validNotifications.map((n) => ({
    to: n.pushToken,
    title: n.title,
    body: n.body,
    data: n.data || {},
    sound: n.sound || "default",
    channelId: n.channelId || "messages",
    priority: n.priority || "high",
  }));

  // Chunk into batches of 100 (Expo limit)
  const BATCH_SIZE = 100;
  const results = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE) {
    const chunk = messages.slice(i, i + BATCH_SIZE);

    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(chunk),
      });

      const result = await response.json();
      const tickets = Array.isArray(result.data) ? result.data : [result.data];

      tickets.forEach((ticket) => {
        if (ticket?.status === "ok") {
          results.push({ success: true, id: ticket.id });
        } else {
          results.push({
            success: false,
            error: ticket?.message || "Push failed",
            shouldRemoveToken: ticket?.details?.error === "DeviceNotRegistered",
          });
        }
      });
    } catch (error) {
      console.error("[PUSH] Batch send error:", error.message);
      chunk.forEach(() => {
        results.push({ success: false, error: error.message });
      });
    }
  }

  return results;
}

/**
 * Build push notification content for different event types
 * @param {string} type - Notification type
 * @param {Object} params - Context parameters
 * @returns {{ title: string, body: string, data: Object }}
 */
export function buildPushContent(type, params = {}) {
  const { senderName, productName, conversationId, serviceName } = params;

  switch (type) {
    case "new_message":
      return {
        title: `${senderName || "Someone"} sent you a message`,
        body: productName
          ? `About "${productName}"`
          : "You have a new message",
        data: {
          type: "new_message",
          chatId: conversationId,
        },
      };

    case "new_inquiry":
      return {
        title: `New inquiry from ${senderName || "a buyer"}`,
        body: productName
          ? `Interested in "${productName}"`
          : "Someone is interested in your listing",
        data: {
          type: "new_inquiry",
          chatId: conversationId,
        },
      };

    case "service_inquiry":
      return {
        title: `${senderName || "Someone"} wants to book your service`,
        body: serviceName
          ? `Inquiry about "${serviceName}"`
          : "You have a new service inquiry",
        data: {
          type: "service_inquiry",
          chatId: conversationId,
        },
      };

    case "kyc_approved":
      return {
        title: "Verification approved!",
        body: "Your identity has been verified. You now have a verified seller badge.",
        data: { type: "kyc_approved" },
      };

    case "kyc_rejected":
      return {
        title: "Verification update",
        body: "Your verification needs attention. Please check the details and resubmit.",
        data: { type: "kyc_rejected" },
      };

    case "new_review":
      return {
        title: "You got a new review!",
        body: `${senderName || "A buyer"} left a review on your profile.`,
        data: { type: "new_review" },
      };

    case "order_update":
      return {
        title: "Order update",
        body: productName
          ? `Update on your order for "${productName}"`
          : "There's an update on your order",
        data: {
          type: "order_update",
          chatId: conversationId,
        },
      };

    default:
      return {
        title: "TrybeMarket",
        body: "You have a new notification",
        data: { type: type || "general" },
      };
  }
}
