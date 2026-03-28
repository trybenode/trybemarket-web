/**
 * WhatsApp Business API utility for sending notifications
 */

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || "https://graph.facebook.com/v22.0";
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "1117077824813339"; // Default for testing, should be set in production
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const TEMPLATE_NAME = process.env.WHATSAPP_NEW_MESSAGE_TEMPLATE || "new_message";

/**
 * Send WhatsApp notification for new message
 * @param {Object} params
 * @param {string} params.recipientPhone - Phone number in format "2348012345678" (no + or spaces)
 * @param {string} params.recipientName - Name of the recipient
 * @param {string} params.senderName - Name of the message sender
 * @param {string} params.chatId - Conversation ID for the chat link
 * @returns {Promise<boolean>} - Success status
 */
export async function sendWhatsAppNotification({
  recipientPhone,
  recipientName,
  senderName,
  chatId,
}) {
  try {
    console.log("=== WhatsApp Send Attempt ===");
    console.log("Phone Number ID:", PHONE_NUMBER_ID ? "✓ Set" : "✗ Missing");
    console.log("Access Token:", ACCESS_TOKEN ? "✓ Set" : "✗ Missing");
    console.log("Template Name:", TEMPLATE_NAME);
    console.log("Recipient Phone:", recipientPhone);
    console.log("Recipient Name:", recipientName);
    console.log("Sender Name:", senderName);
    console.log("Chat ID:", chatId);
    
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.error("❌ WhatsApp credentials not configured");
      console.error("Missing:", {
        PHONE_NUMBER_ID: !PHONE_NUMBER_ID,
        ACCESS_TOKEN: !ACCESS_TOKEN
      });
      return false;
    }

    // Validate phone number format (Nigerian: 234XXXXXXXXXX)
    // Phone should already be in international format from database
    if (!recipientPhone || !recipientPhone.startsWith("234")) {
      console.error("❌ Invalid phone number format. Expected 234XXXXXXXXXX, got:", recipientPhone);
      return false;
    }
    
    console.log("✓ Phone number format valid");

    console.log("✓ Phone number format valid");

    const apiUrl = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;
    console.log("API URL:", apiUrl);

    const response = await fetch(
      apiUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipientPhone,
          type: "template",
          template: {
            name: TEMPLATE_NAME,
            language: { code: "en" },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: senderName }, // Only 1 parameter - sender name
                ],
              },
              {
                type: "button",
                sub_type: "url",
                index: "0",
                parameters: [
                  { type: "text", text: chatId },
                ],
              },
            ],
          },
        }),
      }
    );

    console.log("WhatsApp API Response Status:", response.status);
    
    if (!response.ok) {
      const error = await response.json();
      console.error("❌ WhatsApp API error response:", JSON.stringify(error, null, 2));
      return false;
    }

    const result = await response.json();
    console.log("✅ WhatsApp sent successfully:", result);
    return true;
  } catch (error) {
    console.error("❌ WhatsApp send failed with exception:", error);
    return false;
  }
}
