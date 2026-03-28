import { checkAndIncrementNotificationCount } from "@/lib/notifications";
import { sendWhatsAppNotification } from "@/lib/whatsapp";
import { newMessageTemplate } from "@/emails/newMessageTemplate";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const {
      userId,           // SENDER's Firestore user ID (whose daily limit to check)
      recipientPhone,   // "2348012345678"
      recipientEmail,   // "user@example.com"
      recipientName,
      senderName,
      productName,
      chatLink,
      conversationId,
      channels,         // ["whatsapp", "email"] — which channels to use
    } = await req.json();

    console.log("Unified notification API called:", { userId, channels });

    if (!userId || !recipientName || !senderName || !conversationId) {
      return Response.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check daily limit (shared across all channels)
    const { allowed, remaining, limit } = await checkAndIncrementNotificationCount(userId);

    if (!allowed) {
      console.log(`Notification blocked for user ${userId} — daily limit (${limit}) reached`);
      return Response.json(
        { 
          success: false, 
          reason: "daily_limit_reached",
          limit,
          remaining: 0 
        },
        { status: 429 }
      );
    }

    console.log(`Notification allowed. Remaining: ${remaining}/${limit}`);

    const results = {};
    let successCount = 0;

    // Send WhatsApp
    if (channels?.includes("whatsapp") && recipientPhone) {
      console.log("Sending WhatsApp to:", recipientPhone);
      results.whatsapp = await sendWhatsAppNotification({
        recipientPhone,
        recipientName,
        senderName,
        chatId: conversationId,
      });
      if (results.whatsapp) successCount++;
    }

    // Send Email
    if (channels?.includes("email") && recipientEmail) {
      console.log("Sending email to:", recipientEmail);
      try {
        const emailResult = await resend.emails.send({
          from: "Trybe Market <noreply@trybenode.space>",
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

    return Response.json({
      success: successCount > 0,
      results,
      remaining,
      limit,
    });
  } catch (error) {
    console.error("Notification route error:", error);
    return Response.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
