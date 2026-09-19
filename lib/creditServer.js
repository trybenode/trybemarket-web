import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { CREDIT_EVENT_TYPES } from "./creditConstants.js";

export { CREDIT_EVENT_TYPES };

/**
 * Award credit for a ONE-TIME event (e.g. KYC completion) exactly once per
 * user, no matter how many times this is called — including concurrent or
 * retried calls.
 *
 * Idempotency is structural, not flag-based: the ledger entry's document ID
 * IS the event key. A Firestore transaction reads that fixed-ID doc first;
 * if it already exists, the award is skipped entirely (read-before-write
 * inside a transaction gives Firestore's optimistic-concurrency retry the
 * chance to catch a concurrent duplicate, so two simultaneous calls can't
 * both "win").
 *
 * Call this only from trusted server code (Admin SDK) that has already
 * independently verified the event happened — never from a client-supplied
 * signal.
 */
export async function awardCreditOnce(userId, { ledgerId, amount, type, referenceId = null }) {
  if (!userId || !ledgerId || !amount || amount <= 0 || !type) {
    throw new Error("awardCreditOnce: userId, ledgerId, a positive amount, and type are required");
  }

  const userRef = adminDB.collection("users").doc(userId);
  const ledgerRef = userRef.collection("creditLedger").doc(ledgerId);

  return adminDB.runTransaction(async (tx) => {
    const ledgerSnap = await tx.get(ledgerRef); // reads must precede writes in a Firestore transaction

    if (ledgerSnap.exists) {
      return { awarded: false, reason: "already_awarded" };
    }

    tx.set(ledgerRef, {
      amount,
      type,
      referenceId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(
      userRef,
      { creditBalance: admin.firestore.FieldValue.increment(amount) },
      { merge: true }
    );

    return { awarded: true };
  });
}

/**
 * Manual balance correction by an admin — e.g. resolving a support ticket,
 * reversing a flagged spend_amount_mismatch, or a one-off goodwill credit.
 * Always requires a non-empty reason (credit-spending-security-checklist.md
 * §9): admin_adjustment ledger entries are worthless as an audit trail
 * without one, so this throws rather than defaulting it. Caller
 * (app/api/credit/admin-adjust) is responsible for verifying the actor is
 * actually an admin before calling this — this function does not check that
 * itself, since it has no notion of "who is calling."
 */
export async function adminAdjustCredit(userId, amount, reason, adjustedByAdminUid) {
  if (!userId || !amount || amount === 0) {
    throw new Error("adminAdjustCredit: userId and a non-zero amount are required");
  }
  if (!reason || !reason.trim()) {
    throw new Error("adminAdjustCredit: a reason is required");
  }

  const userRef = adminDB.collection("users").doc(userId);
  const ledgerRef = userRef.collection("creditLedger").doc();

  await adminDB.runTransaction(async (tx) => {
    tx.set(ledgerRef, {
      amount,
      type: CREDIT_EVENT_TYPES.ADMIN_ADJUSTMENT,
      referenceId: null,
      reason: reason.trim(),
      adjustedBy: adjustedByAdminUid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(userRef, { creditBalance: admin.firestore.FieldValue.increment(amount) }, { merge: true });
  });

  return { ledgerId: ledgerRef.id };
}
