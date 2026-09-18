import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";

// Africa/Lagos (WAT) is a fixed UTC+1 offset year-round — no DST to account
// for — so a plain millisecond shift is sufficient, no timezone library
// needed. See streak-detection-mechanism.md §3: this is a deliberate,
// uniform-for-everyone choice, not per-user local time.
const LAGOS_OFFSET_MS = 60 * 60 * 1000;

export function lagosDateKey(date = new Date()) {
  return new Date(date.getTime() + LAGOS_OFFSET_MS).toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Records the streak side-effect of a message send: detects whether this
 * send is a genuine reply (the immediately preceding message in this
 * conversation was from the OTHER participant), and if so marks today as a
 * qualifying activity day for BOTH participants. Always updates
 * lastMessageSenderId regardless, so the next send can make the same check.
 *
 * Per streak-detection-mechanism.md §1: real-time, not retrospective. A
 * presence-only marker (no count) so multiple qualifying replies in one day
 * are harmless no-ops after the first — see §2.
 *
 * Deliberately tolerant of failure: called fire-and-forget from the actual
 * message-send path (utils/messaginghooks.js) and must never be allowed to
 * block or fail a real message send — callers wrap this in .catch(), not await.
 */
export async function recordQualifyingExchange(conversationId, senderUid) {
  const conversationRef = adminDB.collection("conversation").doc(conversationId);

  await adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(conversationRef);
    if (!snap.exists) return;

    const data = snap.data();
    const participants = data.participants || [];
    if (!participants.includes(senderUid)) return; // not actually a participant — ignore

    const lastSenderId = data.lastMessageSenderId || null;
    const isGenuineReply = !!lastSenderId && lastSenderId !== senderUid;

    if (isGenuineReply) {
      const dateKey = lagosDateKey();
      const otherParticipant = participants.find((p) => p !== senderUid) || null;

      tx.set(
        adminDB.collection("users").doc(senderUid).collection("activityDays").doc(dateKey),
        { date: dateKey, markedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
      if (otherParticipant) {
        tx.set(
          adminDB.collection("users").doc(otherParticipant).collection("activityDays").doc(dateKey),
          { date: dateKey, markedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      }
    }

    tx.set(conversationRef, { lastMessageSenderId: senderUid }, { merge: true });
  });
}
