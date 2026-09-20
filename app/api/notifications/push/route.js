/**
 * Push Notification API
 *
 * Dedicated endpoint for sending push notifications for all event types.
 * Used by: admin dashboard (KYC updates), cron jobs (reminders),
 * and any service that needs to push-notify a user.
 * REQUIRES an admin ID token or the CRON_SECRET bearer — see authorize() below.
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
import crypto from "crypto";
import { requireAdmin } from "@/lib/requireAdmin";

/**
 * Callers are trusted server-side actors only: an admin (verified ID token +
 * membership in `admins`) or a cron/service holding CRON_SECRET. This endpoint
 * accepts a raw push token and custom title/body, so left open it could push
 * any text to any device. User-triggered chat notifications go through
 * /api/notifications/send instead, which derives everything from the conversation.
 */
async function authorize(req) {
  const header = req.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && header.startsWith("Bearer ")) {
    const given = Buffer.from(header.slice(7));
    const expected = Buffer.from(cronSecret);
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return { ok: true };
  }
  const admin = await requireAdmin(req);
  return admin.error ? { error: admin.error, status: admin.status } : { ok: true };
}

export async function POST(req) {
  const access = await authorize(req);
  if (access.error) {
    return Response.json({ success: false, error: access.error }, { status: access.status });
  }

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
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
