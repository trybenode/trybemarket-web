import { checkAndIncrementEmailSent, checkWhatsAppQuota, incrementWhatsAppReceived } from "@/lib/notifications";
import { sendWhatsAppNotification } from "@/lib/whatsapp";
import { sendExpoPushNotification, buildPushContent } from "@/lib/pushNotification";
import { newMessageTemplate } from "@/emails/newMessageTemplate";
import { adminDB } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { requireAuth } from "@/lib/verifyRequestAuth";
import {
  NotificationError,
  USER_NOTIFICATION_CHANNELS,
  USER_NOTIFICATION_TYPES,
  resolveNotificationContext,
} from "@/lib/notificationServer";
import { RESEND_FROM } from "@/lib/kycEmail";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Message notifications (email / WhatsApp / push) for a new chat message.
 *
 * Requires a signed-in caller (Authorization: Bearer <Firebase ID token>) who
 * is a participant of `conversationId`. The recipient, every contact detail,
 * the sender's name and the chat link are derived server-side — see
 * lib/notificationServer.js. The body may only carry:
 *   conversationId   required
 *   channels         optional subset of ["email","whatsapp","push"]; each is still
 *                    subject to the recipient's opt-ins
 *   productName      optional fallback label for conversations with no product recorded
 *   notificationType optional, one of new_message | new_inquiry | service_inquiry
 * Anything else in the body (userId, recipientId, recipientEmail, recipientPhone,
 * recipientPushToken, senderName, chatLink, ...) is ignored.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const userId = auth.uid; // SENDER — for the email quota

    let context;
    try {
      context = await resolveNotificationContext(userId, body);
    } catch (error) {
      if (error instanceof NotificationError) {
        return Response.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    const {
      conversationId,
      senderName,
      recipientId,
      recipient,
      productName,
      allowedChannels,
    } = context;
    const recipientName = recipient.name;
    const recipientEmail = recipient.email;
    const recipientPhone = recipient.phone;
    const recipientPushToken = recipient.pushToken;
    const chatLink = `${new URL(req.url).origin}/chat/${conversationId}`;
    const notificationType = USER_NOTIFICATION_TYPES.includes(body.notificationType)
      ? body.notificationType
      : "new_message";

    // Requested channels, restricted to known ones the recipient allows.
    const requested = Array.isArray(body.channels) ? body.channels : [];
    const channels = requested.filter(
      (c) => USER_NOTIFICATION_CHANNELS.includes(c) && allowedChannels.includes(c)
    );

    const results = {};
    let successCount = 0;
    let emailRemaining = 0;
    let emailLimit = 0;
    let whatsappRemaining = 0;
    let whatsappLimit = 0;
    let emailLimitReached = false;

    // ─── PUSH NOTIFICATION (no quota, runs in parallel) ───
    const pushPromise = (async () => {
      if (!channels?.includes("push") || !recipientPushToken) {
        console.log("[PUSH] Skipped: push not in channels or no token provided");
        return;
      }

      
      const pushType = notificationType;
      const { title, body, data } = buildPushContent(pushType, {
        senderName,
        productName,
        conversationId,
      });

      const pushResult = await sendExpoPushNotification({
        pushToken: recipientPushToken,
        title,
        body,
        data,
      });

      results.push = pushResult.success;

      if (pushResult.success) {
        successCount++;
        console.log("[PUSH] Delivered successfully. Ticket:", pushResult.id);
      } else {
        console.error("[PUSH] Failed:", pushResult.error);

        // If token is stale, remove it from Firestore
        if (pushResult.shouldRemoveToken && recipientId) {
          try {
            const recipientRef = adminDB.collection("users").doc(recipientId);
            await recipientRef.update({
              expoPushToken: FieldValue.delete(),
              pushTokenUpdatedAt: FieldValue.delete(),
            });
            console.log("[PUSH] Removed stale push token for user:", recipientId);
          } catch (cleanupError) {
            console.error("[PUSH] Failed to remove stale token:", cleanupError);
          }
        }
      }
    })();

    // ─── EMAIL (check SENDER's limit) ───
    if (channels?.includes("email") && recipientEmail) {
      console.log("Checking email quota for sender:", userId);
      const emailCheck = await checkAndIncrementEmailSent(userId);

      emailRemaining = emailCheck.remaining;
      emailLimit = emailCheck.limit;

      if (!emailCheck.allowed) {
        console.log(`Email blocked for sender ${userId}: daily limit (${emailCheck.limit}) reached`);
        results.email = false;
        results.emailBlocked = true;
        emailLimitReached = true;
      } else {
        console.log("Email quota OK. Sending message notification email.");
        try {
          const emailResult = await resend.emails.send({
            from: RESEND_FROM,
            to: recipientEmail,
            subject: `📩 New message about ${productName || "your listing"}`,
            html: newMessageTemplate({ senderName, productName, chatLink }),
          });
          results.email = !!emailResult.data;
          if (results.email) successCount++;
          console.log("Email sent:", emailResult);
        } catch (error) {
          console.error("Email send failed:", error);
          results.email = false;
        }
      }
    }

    // ─── WHATSAPP (check RECIPIENT's limit) ───
    if (channels?.includes("whatsapp") && recipientPhone && recipientId) {
      console.log("Checking WhatsApp quota for recipient:", recipientId);
      const whatsappCheck = await checkWhatsAppQuota(recipientId);

      if (!whatsappCheck.allowed) {
        console.log(`WhatsApp blocked for recipient ${recipientId}: daily limit (${whatsappCheck.limit}) reached`);
        results.whatsapp = false;
        results.whatsappBlocked = true;
        results.whatsappBlockReason = "Recipient has reached their daily WhatsApp limit";
        whatsappRemaining = whatsappCheck.remaining;
        whatsappLimit = whatsappCheck.limit;
      } else {
        console.log("WhatsApp quota OK. Attempting to send.");

        const sendSuccess = await sendWhatsAppNotification({
          recipientPhone,
          recipientName,
          senderName,
          chatId: conversationId,
        });

        results.whatsapp = sendSuccess;

        if (sendSuccess) {
          console.log("WhatsApp sent successfully, incrementing counter...");
          const incrementResult = await incrementWhatsAppReceived(recipientId);
          whatsappRemaining = incrementResult.remaining;
          whatsappLimit = incrementResult.limit;
          successCount++;
        } else {
          console.log("WhatsApp send failed, NOT incrementing counter");
          whatsappRemaining = whatsappCheck.remaining;
          whatsappLimit = whatsappCheck.limit;
        }
      }
    }

    // Wait for push notification to finish (it runs in parallel with email/whatsapp)
    await pushPromise;

    // Update recipient's lastNotifiedAt if any notification was sent successfully
    if (successCount > 0 && recipientId) {
      try {
        const recipientRef = adminDB.collection("users").doc(recipientId);
        await recipientRef.update({
          lastNotifiedAt: FieldValue.serverTimestamp()
        });
        console.log("Updated lastNotifiedAt for recipient:", recipientId);
      } catch (error) {
        console.error("Error updating lastNotifiedAt:", error);
      }
    }

    const response = {
      success: successCount > 0,
      results,
      emailSent: {
        remaining: emailRemaining,
        limit: emailLimit
      },
      whatsappReceived: {
        remaining: whatsappRemaining,
        limit: whatsappLimit
      }
    };

    console.log("=== Notification API Response:", response);

    // If ONLY email was requested and it's blocked, return 429
    // But if WhatsApp or push sent successfully, return 200 (partial success)
    if (emailLimitReached && !results.whatsapp && !results.push) {
      return Response.json(
        {
          ...response,
          reason: "email_limit_reached",
        },
        { status: 429 }
      );
    }

    return Response.json(response);
  } catch (error) {
    console.error("Notification route error:", error);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
