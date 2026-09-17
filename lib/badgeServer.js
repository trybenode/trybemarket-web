import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { BADGE_KEYS, FOUNDING_MEMBER_USER_CAP } from "./badgeConstants.js";

/**
 * Awards a one-time (non-monthly) badge exactly once per user, regardless of
 * how many times this is called — same structural idempotency pattern as
 * lib/creditServer.js's awardCreditOnce: the badge doc's ID IS the "already
 * awarded" check, read inside a transaction before any write.
 */
export async function awardBadgeOnce(userId, badgeKey) {
  const badgeRef = adminDB.collection("users").doc(userId).collection("badges").doc(badgeKey);

  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(badgeRef);
    if (snap.exists) {
      return { awarded: false };
    }
    tx.set(badgeRef, {
      badgeKey,
      awardedAt: admin.firestore.FieldValue.serverTimestamp(),
      periodKey: null,
    });
    return { awarded: true };
  });
}

/**
 * Founding Member: awarded to new signups until the platform's cumulative
 * user count reaches FOUNDING_MEMBER_USER_CAP (change-answers.md §4). The
 * counter only increments once per user (guarded by the badge doc's
 * existence, same as awardBadgeOnce) so retried/duplicate calls for the same
 * user can't burn through the cap early.
 */
export async function maybeAwardFoundingMember(userId) {
  const badgeRef = adminDB.collection("users").doc(userId).collection("badges").doc(BADGE_KEYS.FOUNDING_MEMBER);
  const counterRef = adminDB.collection("counters").doc("foundingMember");

  return adminDB.runTransaction(async (tx) => {
    const [badgeSnap, counterSnap] = await Promise.all([tx.get(badgeRef), tx.get(counterRef)]);
    if (badgeSnap.exists) {
      return { awarded: false, reason: "already_awarded" };
    }

    const currentTotal = counterSnap.exists ? counterSnap.data().total || 0 : 0;
    if (currentTotal >= FOUNDING_MEMBER_USER_CAP) {
      return { awarded: false, reason: "cap_reached" };
    }

    tx.set(counterRef, { total: currentTotal + 1 }, { merge: true });
    tx.set(badgeRef, {
      badgeKey: BADGE_KEYS.FOUNDING_MEMBER,
      awardedAt: admin.firestore.FieldValue.serverTimestamp(),
      periodKey: null,
    });

    return { awarded: true, totalAfter: currentTotal + 1 };
  });
}
