/**
 * Push Notification API
 *
 * Dedicated endpoint for sending push notifications for all event types.
 * Used by: admin dashboard (KYC updates), cron jobs (reminders),
 * and any service that needs to push-notify a user.
 *
 * POST /api/notifications/push
 *
 * Body:
 * {
 *   recipientId: string,        // Firestore user ID (fetches token from DB)
 *   -- OR --
 *   recipientPushToken: string,  // Direct Expo push token
 *
 *   type: string,               // "new_message" | "kyc_approved" | "kyc_rejected" | "new_review" | "order_update"
 *   title?: string,             // Custom title (overrides type-based default)
 *   body?: string,              // Custom body (overrides type-based default)
 *   data?: object,              // Custom data payload for deep linking
 *   senderName?: string,        // Context for message templates
 *   productName?: string,       // Context for message templates
 *   conversationId?: string,    // For chat-related deep links
 * }
 */

import { sendExpoPushNotification, buildPushContent } from "@/lib/pushNotification";
import { adminDB } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req) {
  try {
    const {
      recipientId,
      recipientPushToken,
      type = "general",
      title: customTitle,
      body: customBody,
      data: customData,
      senderName,
      productName,
      serviceName,
      conversationId,
    } = await req.json();

    // Resolve the push token
    let pushToken = recipientPushToken;

    if (!pushToken && recipientId) {
      // Fetch token from Firestore
      const userRef = adminDB.collection("users").doc(recipientId);
      const userSnap = await userRef.get();

      if (!userSnap.exists) {
        return Response.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }

      pushToken = userSnap.data().expoPushToken;

      if (!pushToken) {
        return Response.json(
          { success: false, error: "User has no push token registered" },
          { status: 400 }
        );
      }
    }

    if (!pushToken) {
      return Response.json(
        { success: false, error: "No push token provided or resolvable" },
        { status: 400 }
      );
    }

    // Build notification content
    let title, body, data;

    if (customTitle && customBody) {
      // Use custom content
      title = customTitle;
      body = customBody;
      data = customData || { type };
    } else {
      // Use type-based template
      const content = buildPushContent(type, {
        senderName,
        productName,
        serviceName,
        conversationId,
      });
      title = customTitle || content.title;
      body = customBody || content.body;
      data = { ...content.data, ...customData };
    }

    // Send the push notification
    const result = await sendExpoPushNotification({
      pushToken,
      title,
      body,
      data,
    });

    // Clean up stale tokens
    if (result.shouldRemoveToken && recipientId) {
      try {
        await adminDB.collection("users").doc(recipientId).update({
          expoPushToken: FieldValue.delete(),
          pushTokenUpdatedAt: FieldValue.delete(),
        });
        console.log("[PUSH API] Removed stale token for:", recipientId);
      } catch (err) {
        console.error("[PUSH API] Failed to clean stale token:", err);
      }
    }

    return Response.json({
      success: result.success,
      ticketId: result.id || null,
      error: result.error || null,
    });
  } catch (error) {
    console.error("[PUSH API] Error:", error);
    return Response.json(
      { success: false, error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
