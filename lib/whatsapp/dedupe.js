/**
 * Meta re-delivers a webhook it thinks we missed, sometimes for days. Each
 * inbound message is claimed once in waMessages/{wamid}: `create` fails if
 * the document already exists, so a repeat is recognised and skipped.
 *
 * Documents carry `expiresAt` for a Firestore TTL policy (set up once in the
 * Firebase console: collection group waMessages, field expiresAt).
 */

const MESSAGE_TTL_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;
const ALREADY_EXISTS = 6; // gRPC status code the Admin SDK reports

/**
 * @returns {Promise<boolean>} true if this is the first time we've seen the
 *   message (go ahead and handle it), false if it's a repeat.
 */
export async function claimMessage(db, message, now = Date.now()) {
  const id = typeof message?.id === "string" ? message.id : null;
  if (!id) return true; // nothing to de-duplicate on; handle it
  try {
    await db
      .collection("waMessages")
      .doc(id.replaceAll("/", "_"))
      .create({
        from: message.from ?? null,
        type: message.type ?? null,
        receivedAt: new Date(now),
        expiresAt: new Date(now + MESSAGE_TTL_DAYS * DAY_MS),
      });
    return true;
  } catch (error) {
    if (error?.code === ALREADY_EXISTS || /already exists/i.test(String(error?.message))) return false;
    // Couldn't record it (Firestore trouble): handle the message anyway —
    // answering twice is better than never answering.
    console.error("WhatsApp assistant: couldn't record message id:", error);
    return true;
  }
}

/** Notes what we did with a message (for the admin view). Best-effort. */
export async function recordMessageResult(db, message, result, now = Date.now()) {
  if (typeof message?.id !== "string") return;
  try {
    await db
      .collection("waMessages")
      .doc(message.id.replaceAll("/", "_"))
      .set({ processedAt: new Date(now), result }, { merge: true });
  } catch (error) {
    console.error("WhatsApp assistant: couldn't record message result:", error);
  }
}
