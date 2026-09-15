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
    // console.log("=== WhatsApp Send Attempt ===");
    // console.log("Phone Number ID:", PHONE_NUMBER_ID ? "✓ Set" : "✗ Missing");
    // console.log("Access Token:", ACCESS_TOKEN ? "✓ Set (length:" + (ACCESS_TOKEN?.length || 0) + ")" : "✗ Missing");
    // console.log("Template Name:", TEMPLATE_NAME);
    // console.log("Recipient Phone:", recipientPhone);
    // console.log("Recipient Name:", recipientName);
    // console.log("Sender Name:", senderName);
    // console.log("Chat ID:", chatId);
    
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.error("❌ WhatsApp credentials not configured");
      console.error("Missing:", {
        PHONE_NUMBER_ID: !PHONE_NUMBER_ID,
        ACCESS_TOKEN: !ACCESS_TOKEN
      });
      return false;
    }
    
    if (!TEMPLATE_NAME || TEMPLATE_NAME === "") {
      console.error("❌ Template name is empty! Check WHATSAPP_NEW_MESSAGE_TEMPLATE in .env");
      return false;
    }

    // Validate phone number format (Nigerian: 234XXXXXXXXXX)
    // Phone should already be in international format from database
    if (!recipientPhone || !recipientPhone.startsWith("234")) {
      console.error("❌ Invalid phone number format. Expected 234XXXXXXXXXX, got:", recipientPhone);
      return false;
    }
    
    // console.log("✓ Phone number format valid");

    const apiUrl = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;
    // console.log("API URL:", apiUrl);
    
    const requestBody = {
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
              {
                type: "text",
                parameter_name: "customer_name", // Required for "Name" type variables
                text: recipientName
              }
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              { type: "text", text: chatId }, // Dynamic URL parameter
            ],
          },
        ],
      },
    };
    
    // console.log("Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      apiUrl,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    // console.log("WhatsApp API Response Status:", response.status);
    
    if (!response.ok) {
      const error = await response.json();
      console.error("❌ WhatsApp API error response:", JSON.stringify(error, null, 2));
      return false;
    }

    const result = await response.json();
    // console.log("✅ WhatsApp sent successfully:", result);
    return true;
  } catch (error) {
    console.error("❌ WhatsApp send failed with exception:", error);
    return false;
  }
}

/**
 * Send WhatsApp notification for a shop profile view (premium/VIP sellers only)
 * Requires its own approved Meta template — see WHATSAPP_SHOP_VIEW_TEMPLATE.
 * No-ops (returns false) until that env var is set, since reusing the
 * "new_message" template would show factually wrong text.
 * @param {Object} params
 * @param {string} params.recipientPhone - Phone number in format "2348012345678"
 * @param {string} params.recipientName - Name of the shop owner
 * @param {string} params.sellerId - Seller's user ID, used to build the shop link
 * @returns {Promise<boolean>} - Success status
 */
export async function sendShopViewWhatsAppNotification({
  recipientPhone,
  recipientName,
  sellerId,
}) {
  const SHOP_VIEW_TEMPLATE_NAME = process.env.WHATSAPP_SHOP_VIEW_TEMPLATE;

  if (!SHOP_VIEW_TEMPLATE_NAME) {
    console.warn(
      "⚠️ WHATSAPP_SHOP_VIEW_TEMPLATE not set — skipping shop-view WhatsApp send until a template is approved in Meta Business Suite."
    );
    return false;
  }

  try {
    if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
      console.error("❌ WhatsApp credentials not configured");
      return false;
    }

    if (!recipientPhone || !recipientPhone.startsWith("234")) {
      console.error("❌ Invalid phone number format. Expected 234XXXXXXXXXX, got:", recipientPhone);
      return false;
    }

    const apiUrl = `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`;

    const requestBody = {
      messaging_product: "whatsapp",
      to: recipientPhone,
      type: "template",
      template: {
        name: SHOP_VIEW_TEMPLATE_NAME,
        language: { code: "en" },
        components: [
          {
            type: "body",
            parameters: [
              {
                type: "text",
                parameter_name: "customer_name",
                text: recipientName,
              },
            ],
          },
          {
            type: "button",
            sub_type: "url",
            index: 0,
            parameters: [
              { type: "text", text: sellerId }, // Dynamic URL parameter -> /shop/{sellerId}
            ],
          },
        ],
      },
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("❌ WhatsApp shop-view API error response:", JSON.stringify(error, null, 2));
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ WhatsApp shop-view send failed with exception:", error);
    return false;
  }
}

