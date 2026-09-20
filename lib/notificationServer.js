import { adminDB } from "./firebaseAdmin.js";

/**
 * Server-side resolution for POST /api/notifications/send.
 *
 * That route used to trust every field in the request body — the recipient's
 * email, phone and push token, the sender's name, even the link in the email —
 * and required no login, so anyone could make TrybeMarket email, WhatsApp or
 * push arbitrary content to arbitrary people. Now the caller is the verified
 * signed-in user, and everything else is derived here from Firestore: the
 * caller must be a participant of the conversation, the recipient is the OTHER
 * participant, and their contact details, opt-ins and push token come from
 * their own user document. The body only names the conversation and which
 * channels to try.
 */

export class NotificationError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export const USER_NOTIFICATION_CHANNELS = ["email", "whatsapp", "push"];

// Only these may be requested by a user-facing client. Types such as
// kyc_approved/kyc_rejected are server- or admin-initiated (see /api/notifications/push).
export const USER_NOTIFICATION_TYPES = ["new_message", "new_inquiry", "service_inquiry"];

const MAX_PRODUCT_NAME = 120;

/** Only ever a plain, bounded string — it lands in an email subject/body and a push. */
export function cleanLabel(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.replace(/[\r\n\t]+/g, " ").trim().slice(0, MAX_PRODUCT_NAME);
  return trimmed || fallback;
}

/**
 * @returns {Promise<{ conversationId, senderId, senderName, recipientId, recipient, productName, allowedChannels }>}
 * @throws {NotificationError} 400 bad conversation id / no counterpart, 403 caller isn't a participant, 404 unknown conversation
 */
export async function resolveNotificationContext(senderId, { conversationId, productName }) {
  if (typeof conversationId !== "string" || !conversationId || conversationId.length > 300 || conversationId.includes("/")) {
    throw new NotificationError("Missing or invalid conversationId", 400);
  }

  const convSnap = await adminDB.collection("conversation").doc(conversationId).get();
  if (!convSnap.exists) throw new NotificationError("Conversation not found", 404);
  const conv = convSnap.data();

  const participants = Array.isArray(conv.participants) ? conv.participants : [];
  if (!participants.includes(senderId)) {
    throw new NotificationError("You are not part of this conversation", 403);
  }
  const recipientId = participants.find((p) => p !== senderId);
  if (!recipientId) throw new NotificationError("This conversation has no other participant", 400);

  const [senderSnap, recipientSnap] = await Promise.all([
    adminDB.collection("users").doc(senderId).get(),
    adminDB.collection("users").doc(recipientId).get(),
  ]);
  if (!recipientSnap.exists) throw new NotificationError("Recipient not found", 404);
  const sender = senderSnap.exists ? senderSnap.data() : {};
  const recipient = recipientSnap.data();

  // Same opt-in rules the web client applied before it called the route, now
  // enforced where they can't be skipped.
  const allowedChannels = [];
  if (recipient.emailNotifications !== false && recipient.email) allowedChannels.push("email");
  if (recipient.whatsappNotifications && recipient.phone) allowedChannels.push("whatsapp");
  if (recipient.expoPushToken) allowedChannels.push("push");

  return {
    conversationId,
    senderId,
    senderName: cleanLabel(sender.fullName, "Someone"),
    recipientId,
    recipient: {
      name: cleanLabel(recipient.fullName, "User"),
      email: recipient.email || null,
      phone: recipient.phone || null,
      pushToken: recipient.expoPushToken || null,
    },
    // The listing name recorded when the conversation was created wins; the
    // client's value is only a fallback for older conversations without one.
    productName: cleanLabel(conv.product?.name, cleanLabel(productName, "your listing")),
    allowedChannels,
  };
}
