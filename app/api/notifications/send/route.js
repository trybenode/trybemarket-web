import {checkAndIncrementEmailSent, checkWhatsAppQuota, incrementWhatsAppReceived } from "@/lib/notifications";
import { sendWhatsAppNotification } from "@/lib/whatsapp";
import { newMessageTemplate } from "@/emails/newMessageTemplate";
import { adminDB } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import {Expo} from "expo-server-sdk";


const resend = new Resend(process.env.RESEND_API_KEY);
const expo = new Expo();

export async function POST(req) {
  try {
    const {
      userId,           // SENDER's Firestore user ID (for email limit checking)
      recipientId,      // RECIPIENT's Firestore user ID (for WhatsApp limit checking)
      recipientPhone,   // "2348012345678"
      recipientEmail,   // "user@example.com"
      recipientName,
      recipientPushToken, // Expo push token for recipient (optional)
      senderName,
      productName,
      chatLink,
      conversationId,
      channels,         // ["whatsapp", "email"] — which channels to use
    } = await req.json();

    console.log("Unified notification API called:", { userId, recipientId, channels });

    if (!userId || !recipientName || !senderName || !conversationId) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const results = {};
    let successCount = 0;
    let emailRemaining = 0;
    let emailLimit = 0;
    let whatsappRemaining = 0;
    let whatsappLimit = 0;
    let emailLimitReached = false;

    // Send Email (check SENDER's limit)
    if (channels?.includes("email") && recipientEmail) {
      // console.log("Checking email quota for sender:", userId);
      const emailCheck = await checkAndIncrementEmailSent(userId);
      
      emailRemaining = emailCheck.remaining;
      emailLimit = emailCheck.limit;
      
      if (!emailCheck.allowed) {
        console.log(`Email blocked for sender ${userId} — daily limit (${emailCheck.limit}) reached`);
        results.email = false;
        results.emailBlocked = true;
        emailLimitReached = true;
        // Don't return 429 yet - still check WhatsApp
      } else {
        console.log(`Email quota OK. Sending to: ${recipientEmail}`);
        try {
          const emailResult = await resend.emails.send({
            from: "Trybe Market <noreply@trybenode.space>",
            to: recipientEmail,
            subject: ` New message about ${productName || "your listing"}`,
            html: newMessageTemplate({ senderName, productName, chatLink }),
          });
          results.email = !!emailResult.data;
          if (results.email) successCount++;
          // console.log("Email sent:", emailResult);
        } catch (error) {
          // console.error("Email send failed:", error);
          results.email = false;
        }
      }
    }

    // Send WhatsApp (check RECIPIENT's limit)
    if (channels?.includes("whatsapp") && recipientPhone && recipientId) {
      console.log("Checking WhatsApp quota for recipient:", recipientId);
      const whatsappCheck = await checkWhatsAppQuota(recipientId);
      
      if (!whatsappCheck.allowed) {
        console.log(`WhatsApp blocked for recipient ${recipientId} — daily limit (${whatsappCheck.limit}) reached`);
        // Don't return 429 - recipient hitting their limit doesn't block the sender
        // Just skip sending WhatsApp but continue
        results.whatsapp = false;
        results.whatsappBlocked = true;
        results.whatsappBlockReason = "Recipient has reached their daily WhatsApp limit";
        whatsappRemaining = whatsappCheck.remaining;
        whatsappLimit = whatsappCheck.limit;
      } else {
        console.log(`WhatsApp quota OK. Attempting to send to: ${recipientPhone}`);
        
        // Try to send WhatsApp
        const sendSuccess = await sendWhatsAppNotification({
          recipientPhone,
          recipientName,
          senderName,
          chatId: conversationId,
        });
        
        results.whatsapp = sendSuccess;
        
        if (sendSuccess) {
          // Only increment counter if send was successful
          console.log("WhatsApp sent successfully, incrementing counter...");
          const incrementResult = await incrementWhatsAppReceived(recipientId);
          whatsappRemaining = incrementResult.remaining;
          whatsappLimit = incrementResult.limit;
          successCount++;
        } else {
          // Send failed, don't increment counter
          console.log("WhatsApp send failed, NOT incrementing counter");
          whatsappRemaining = whatsappCheck.remaining;
          whatsappLimit = whatsappCheck.limit;
        }
      }
    }

        if (channels?.includes("push") && recipientPushToken) {
      if (!Expo.isExpoPushToken(recipientPushToken)) {
        console.warn("Invalid Expo push token:", recipientPushToken);
        results.push = false;
        results.pushError = "Invalid push token";
      } else {
        try {
          const messages = [
            {
              to: recipientPushToken,
              sound: "default",
              title: senderName,
              body: `New message about ${productName || "your listing"}`,
              data: { chatId: conversationId }, // used by app to navigate to chat
              channelId: "messages",            // matches Android channel in mobile
              badge: 1,
            },
          ];

          const chunks = expo.chunkPushNotifications(messages);

          for (const chunk of chunks) {
            const receipts = await expo.sendPushNotificationsAsync(chunk);

            for (const receipt of receipts) {
              if (receipt.status === "error") {
                console.error("Push receipt error:", receipt.message, receipt.details);

                // Clean up stale token from Firestore
                if (receipt.details?.error === "DeviceNotRegistered") {
                  try {
                    await adminDB.collection("users").doc(recipientId).update({
                      expoPushToken: FieldValue.delete(),
                    });
                    console.log("Removed stale push token for:", recipientId);
                  } catch (e) {
                    console.error("Failed to remove stale token:", e);
                  }
                }

                results.push = false;
              } else {
                results.push = true;
                successCount++;
              }
            }
          }
        } catch (error) {
          console.error("Push send failed:", error);
          results.push = false;
        }
      }
    }

     

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
        // Don't fail the request if this update fails
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
    // But if WhatsApp sent successfully, return 200 (partial success)
    if (emailLimitReached && !results.whatsapp) {
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
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
