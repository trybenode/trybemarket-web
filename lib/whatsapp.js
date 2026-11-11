/**
 * WhatsApp Business API utility for sending notifications
 */

import { requireSendConfig } from "./whatsapp/config.js";

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


/**
 * Send a plain text reply — the WhatsApp assistant's only way of talking
 * (09-whatsapp-assistant.md). Free-form text is allowed only within 24 hours
 * of the person's last message to us, which is always the case for a reply.
 *
 * Unlike the template senders above, this refuses to run without
 * WHATSAPP_PHONE_NUMBER_ID — it never falls back to the test number.
 * Callers go through lib/whatsapp/send.js, which checks the reply caps first.
 *
 * @param {Object} params
 * @param {string} params.to - Number with country code, digits only (e.g. "2348012345678")
 * @param {string} params.body - The message text
 * @param {{ id: string, title: string }[]} [params.buttons] - Up to three quick-reply
 *   buttons shown under the message (titles up to 20 characters). A tap comes
 *   back to the webhook as an interactive message carrying the button's id.
 *   Still one message, billed the same as plain text.
 * @returns {Promise<{ ok: boolean, messageId: string|null, error: string|null }>}
 */
export async function sendWhatsAppText({ to, body, buttons = null }) {
  let config;
  try {
    config = requireSendConfig();
  } catch (error) {
    console.error(error.message);
    return { ok: false, messageId: null, error: "not_configured" };
  }
  try {
    const response = await fetch(`${config.apiUrl}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        ...(buttons?.length
          ? {
              type: "interactive",
              interactive: {
                type: "button",
                body: { text: body },
                action: {
                  buttons: buttons.slice(0, 3).map((button) => ({
                    type: "reply",
                    reply: { id: button.id, title: button.title.slice(0, 20) },
                  })),
                },
              },
            }
          : { type: "text", text: { preview_url: false, body } }),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = result?.error ? `${result.error.code}: ${result.error.message}` : `HTTP ${response.status}`;
      console.error("WhatsApp text send failed:", reason);
      // If WhatsApp won't take the buttons, the words alone still answer the person.
      if (buttons?.length) return sendWhatsAppText({ to, body });
      return { ok: false, messageId: null, error: reason };
    }
    return { ok: true, messageId: result?.messages?.[0]?.id ?? null, error: null };
  } catch (error) {
    console.error("WhatsApp text send failed:", error);
    return { ok: false, messageId: null, error: String(error?.message || error) };
  }
}
