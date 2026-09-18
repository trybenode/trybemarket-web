import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { fulfillPlanPurchase } from "./subscriptionFulfillment.js";
import {
  CREDIT_EVENT_TYPES,
  CREDIT_SPEND_CAPS,
  PENDING_SPEND_TIMEOUT_MS,
  SPEND_RATE_LIMIT_MAX_ATTEMPTS,
  SPEND_RATE_LIMIT_WINDOW_MS,
} from "./creditConstants.js";

export class CreditSpendError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// --- §7 Kill switch -------------------------------------------------------

/**
 * config/creditSpending.enabled — checked at the point of checkout
 * initiation (reserveCredit), not just documented. Defaults to disabled:
 * a missing config doc is treated as OFF, not ON, so this feature is safe
 * by default until explicitly turned on.
 */
export async function isCreditSpendingEnabled() {
  const snap = await adminDB.collection("config").doc("creditSpending").get();
  return snap.exists && snap.data().enabled === true;
}

// --- §10 Rate limiting ------------------------------------------------------

async function checkAndConsumeRateLimit(uid) {
  const limitRef = adminDB.collection("users").doc(uid).collection("rateLimits").doc("creditSpend");

  await adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(limitRef);
    const now = Date.now();
    const data = snap.exists ? snap.data() : null;
    const windowStart = data?.windowStart?.toMillis?.() ?? 0;
    const windowElapsed = now - windowStart > SPEND_RATE_LIMIT_WINDOW_MS;

    if (windowElapsed) {
      tx.set(limitRef, { windowStart: admin.firestore.Timestamp.now(), count: 1 });
      return;
    }

    const count = data.count || 0;
    if (count >= SPEND_RATE_LIMIT_MAX_ATTEMPTS) {
      throw new CreditSpendError("Too many checkout attempts — please wait a moment and try again", 429);
    }
    tx.update(limitRef, { count: count + 1 });
  });
}

// --- Cap resolution (§4: never trust a client-supplied cap/amount) --------

function resolveCapPercent(plan) {
  const capKey = plan.category === "boost" ? "boost" : plan.id;
  return CREDIT_SPEND_CAPS[capKey];
}

function spendLedgerType(plan) {
  return plan.category === "boost" ? CREDIT_EVENT_TYPES.SPEND_BOOST : CREDIT_EVENT_TYPES.SPEND_PREMIUM_PLAN;
}

// --- §5 Reservation lifecycle: lazy per-user expiry ------------------------

// --- Reserve ----------------------------------------------------------------

/**
 * Reserves credit against a plan purchase. Never trusts a client-supplied
 * amount or category (§4) — itemId is validated against the real
 * subscriptionPlans catalog, and the cap/price are read from Firestore.
 * Reservation pessimistically decrements creditBalance immediately, inside
 * one transaction, so two concurrent reserves for the same user can't both
 * succeed against a balance that only covers one (§3).
 *
 * Only one active reservation per user at a time (a `users/{uid}` pointer,
 * not a query) — prevents double-reserving across two simultaneous
 * checkouts and lets expiry be checked with a single doc read instead of a
 * composite-index query. A stale (expired, never resolved) pointer is voided
 * inline here (§5's "lazy" expiry), folded into the SAME transaction as an
 * absolute balance computed in-memory — deliberately not two separate writes
 * to the user doc (one for the void-refund, one for the new deduction),
 * since composing two FieldValue.increment() calls on the same document
 * within one transaction isn't a guarantee worth relying on.
 */
export async function reserveCredit(uid, { itemId, applyCredit }) {
  if (!(await isCreditSpendingEnabled())) {
    throw new CreditSpendError("Credit redemption is currently unavailable", 503);
  }

  if (!itemId) {
    throw new CreditSpendError("itemId is required", 400);
  }

  const planSnap = await adminDB.collection("subscriptionPlans").doc(itemId).get();
  if (!planSnap.exists) {
    throw new CreditSpendError("Unknown plan", 400);
  }
  const plan = { id: planSnap.id, ...planSnap.data() };

  if (!applyCredit) {
    return { applyCredit: false };
  }

  const capPercent = resolveCapPercent(plan);
  if (!capPercent) {
    throw new CreditSpendError("This plan is not eligible for credit redemption", 400);
  }

  await checkAndConsumeRateLimit(uid);

  const price = plan.price;
  const maxCreditCoverage = Math.floor(price * capPercent);
  const reference = `cs_${uid}_${Date.now()}`;
  const userRef = adminDB.collection("users").doc(uid);
  const pendingRef = adminDB.collection("pendingSpends").doc(reference);

  const result = await adminDB.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    const userData = userSnap.data() || {};
    let currentBalance = userData.creditBalance || 0;
    let expiredPending = null; // { ref, ledgerRef }

    const activeRef = userData.activePendingSpendRef;
    if (activeRef) {
      const activeSnap = await tx.get(adminDB.collection("pendingSpends").doc(activeRef));
      if (activeSnap.exists && activeSnap.data().status === "pending") {
        const expiresAtMs = activeSnap.data().expiresAt?.toMillis?.() ?? 0;
        if (expiresAtMs > Date.now()) {
          throw new CreditSpendError("You already have a checkout in progress — complete or cancel it first", 409);
        }
        // Expired and never resolved — fold its refund into this transaction.
        currentBalance += activeSnap.data().creditApplied;
        expiredPending = {
          ref: activeSnap.ref,
          ledgerRef: userRef.collection("creditLedger").doc(`spend_${activeRef}`),
        };
      }
    }

    const creditToApply = Math.min(currentBalance, maxCreditCoverage);
    const now = admin.firestore.FieldValue.serverTimestamp();

    if (creditToApply <= 0) {
      // Still need to commit the expired-void's effect even with nothing new to reserve.
      if (expiredPending) {
        tx.set(expiredPending.ref, { status: "voided", voidedAt: now, voidReason: "expired_lazy" }, { merge: true });
        tx.set(expiredPending.ledgerRef, { status: "voided" }, { merge: true });
        tx.set(userRef, { creditBalance: currentBalance, activePendingSpendRef: null }, { merge: true });
      }
      return { applyCredit: false, reason: "no_eligible_credit" };
    }

    const remainingAmount = price - creditToApply;
    const finalBalance = currentBalance - creditToApply;
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + PENDING_SPEND_TIMEOUT_MS);

    if (expiredPending) {
      tx.set(expiredPending.ref, { status: "voided", voidedAt: now, voidReason: "expired_lazy" }, { merge: true });
      tx.set(expiredPending.ledgerRef, { status: "voided" }, { merge: true });
    }

    tx.set(pendingRef, {
      userId: uid,
      itemId,
      planSnapshot: plan,
      price,
      creditApplied: creditToApply,
      remainingAmount,
      status: "pending",
      createdAt: now,
      expiresAt,
    });
    tx.set(userRef.collection("creditLedger").doc(`spend_${reference}`), {
      amount: -creditToApply,
      type: spendLedgerType(plan),
      referenceId: reference,
      status: "pending",
      createdAt: now,
    });
    // Single write to userRef — an absolute value, not increment(), since
    // currentBalance was already reconciled (including any expired-void
    // refund) from the one read at the top of this transaction.
    tx.set(userRef, { creditBalance: finalBalance, activePendingSpendRef: reference }, { merge: true });

    return {
      applyCredit: true,
      reference,
      price,
      creditApplied: creditToApply,
      remainingAmount,
      fullyCovered: remainingAmount === 0,
    };
  });

  // §6: the 100%-covered path goes through the exact same reserve→commit
  // pipeline as a real transaction — it's just that "commit" happens
  // immediately instead of waiting on a Paystack webhook, since there's no
  // card being charged. Strict equality (not <=) so a rounding edge case
  // can never slip a partial-coverage case through as a free skip.
  if (result.applyCredit && result.fullyCovered) {
    await commitPendingSpend(result.reference, { skipPaystackVerification: true });
  }

  return result;
}

// --- Commit (called by webhook AND the client-triggered fallback verify) --

/**
 * Idempotent: re-running for an already-committed or already-voided
 * reference is a safe no-op (§2) — both the webhook and the client-facing
 * verify endpoint call this same function, so duplicate delivery (Paystack
 * retries, or both paths firing for the same payment) can't double-fulfill.
 */
export async function commitPendingSpend(reference, { paidAmountKobo = null, skipPaystackVerification = false } = {}) {
  const pendingRef = adminDB.collection("pendingSpends").doc(reference);

  const result = await adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(pendingRef);
    if (!snap.exists) {
      return { committed: false, reason: "not_found" };
    }
    const pending = snap.data();
    if (pending.status !== "pending") {
      return { committed: false, reason: `already_${pending.status}` };
    }

    if (!skipPaystackVerification) {
      const paidAmount = paidAmountKobo / 100;
      if (paidAmount !== pending.remainingAmount) {
        // Suspicious, not simply "failed" — leave it for manual review rather
        // than auto-voiding (which would refund credit for a payment that
        // may still be real, just mismatched) or auto-committing.
        tx.set(pendingRef, { status: "flagged", flagReason: "amount_mismatch", paidAmount }, { merge: true });
        tx.set(
          adminDB.collection("users").doc(pending.userId).collection("creditLedger").doc(`spend_${reference}`),
          { status: "flagged" },
          { merge: true }
        );
        tx.set(adminDB.collection("creditAuditLog").doc(), {
          userId: pending.userId,
          reference,
          reason: "spend_amount_mismatch",
          detail: { expected: pending.remainingAmount, paid: paidAmount },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { committed: false, reason: "amount_mismatch" };
      }
    }

    tx.set(pendingRef, { status: "committed", committedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    tx.set(
      adminDB.collection("users").doc(pending.userId).collection("creditLedger").doc(`spend_${reference}`),
      { status: "committed" },
      { merge: true }
    );
    tx.set(
      adminDB.collection("users").doc(pending.userId),
      { activePendingSpendRef: admin.firestore.FieldValue.delete() },
      { merge: true }
    );

    return { committed: true, pending };
  });

  if (result.committed) {
    const plan = { id: result.pending.itemId, ...result.pending.planSnapshot };
    await fulfillPlanPurchase(result.pending.userId, plan, reference);
  }

  return result;
}

// --- Void (used by the expiry cron, the client cancel/fail path, and safe
// to call manually/admin) --------------------------------------------------

/**
 * expectedUserId, when passed (the client-triggered cancel path), enforces
 * that the caller only voids their OWN reservation — checked inside the same
 * transaction as the read, not as a separate pre-check, so there's no gap to
 * race. The cron (no expectedUserId) trusts any reference since it's server
 * -initiated off a plain collection scan, not client input.
 */
export async function voidPendingSpend(reference, { reason = "expired", expectedUserId = null } = {}) {
  const pendingRef = adminDB.collection("pendingSpends").doc(reference);

  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(pendingRef);
    if (!snap.exists || snap.data().status !== "pending") {
      return { voided: false, reason: "not_found_or_resolved" };
    }
    const pending = snap.data();
    if (expectedUserId && pending.userId !== expectedUserId) {
      throw new CreditSpendError("You do not own this checkout", 403);
    }

    tx.set(pendingRef, { status: "voided", voidedAt: admin.firestore.FieldValue.serverTimestamp(), voidReason: reason }, { merge: true });
    tx.set(
      adminDB.collection("users").doc(pending.userId).collection("creditLedger").doc(`spend_${reference}`),
      { status: "voided" },
      { merge: true }
    );
    tx.set(
      adminDB.collection("users").doc(pending.userId),
      {
        creditBalance: admin.firestore.FieldValue.increment(pending.creditApplied),
        activePendingSpendRef: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );

    return { voided: true };
  });
}
