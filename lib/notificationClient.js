import { auth } from "@/lib/firebase";

/**
 * Calls POST /api/notifications/send as the signed-in user. The server derives
 * the recipient, their contact details, the sender's name and the chat link
 * from the conversation, so only the conversation and the wanted channels are
 * sent. Resolves to the fetch Response (callers read 429 email_limit_reached
 * from it); rejects if nobody is signed in or the request fails.
 */
export async function sendMessageNotification({ conversationId, channels, productName }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const idToken = await user.getIdToken();
  return fetch("/api/notifications/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ conversationId, channels, productName }),
  });
}
