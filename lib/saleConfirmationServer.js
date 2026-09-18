import admin from "firebase-admin";
import { adminDB, adminAuth } from "./firebaseAdmin.js";
import {
  CREDIT_EVENT_TYPES,
  CONFIRMED_SALE_CREDIT_AMOUNT,
  CONFIRMED_SALE_DAILY_PAIR_CAP,
  CONFIRMED_SALE_WEEKLY_USER_CAP,
  NEW_ACCOUNT_FLAG_THRESHOLD_DAYS,
  SALE_PENDING_TIMEOUT_MS,
} from "./creditConstants.js";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export class SaleConfirmationError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Derive buyer/seller uids for a conversation doc, whether or not it was
 * created after buyerId/sellerId became explicit fields (utils/messaginghooks.js).
 * Legacy conversations only have `participants` + `product.sellerId`.
 */
function deriveRoles(conv) {
  const sellerId = conv.sellerId || conv.product?.sellerId || null;
  const buyerId = conv.buyerId || (conv.participants || []).find((p) => p !== sellerId) || null;
  return { buyerId, sellerId };
}

function assertParticipant(uid, buyerId, sellerId) {
  if (!buyerId || !sellerId) {
    throw new SaleConfirmationError("Conversation is missing buyer/seller information", 400);
  }
  if (buyerId === sellerId) {
    // Defense in depth — should never happen given how conversations are created.
    throw new SaleConfirmationError("Invalid conversation: buyer and seller are the same user", 400);
  }
  if (uid !== buyerId && uid !== sellerId) {
    throw new SaleConfirmationError("You are not a participant in this conversation", 403);
  }
}

/** Reads a {countToday, dayResetAt} or {confirmedSaleCreditThisWeek, weekResetAt}
 * style counter doc/field-pair and returns the effective current value,
 * treating it as reset if the window has elapsed. Never mutates — callers
 * decide what to write based on the returned `needsReset` flag. */
function readWindowedCounter(data, countField, resetField, windowMs, now) {
  const resetAt = data?.[resetField];
  const elapsed = !resetAt || now.getTime() - resetAt.toDate().getTime() > windowMs;
  return { current: elapsed ? 0 : data?.[countField] || 0, needsReset: elapsed };
}

function logCreditAttemptBlocked(tx, { conversationId, buyerId, sellerId, reason }) {
  tx.set(adminDB.collection("creditAuditLog").doc(), {
    conversationId,
    buyerId,
    sellerId,
    reason,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Flags an account in `moderationFlags` if it just hit the confirmed-sale
 * weekly cap while still new (per NEW_ACCOUNT_FLAG_THRESHOLD_DAYS) — the
 * spec's own example of a signal worth a human look, not just a rate-limit.
 * Best-effort, non-transactional (needs an Auth API call for account age,
 * and doesn't need atomicity with the credit award itself). The flag doc ID
 * is deterministic per user+week so hitting the cap repeatedly in one week
 * doesn't spam duplicate flags.
 */
async function maybeFlagRapidWeeklyCap(uid, weekResetAt) {
  try {
    const authUser = await adminAuth.getUser(uid);
    const createdAt = new Date(authUser.metadata.creationTime);
    const accountAgeMs = Date.now() - createdAt.getTime();
    if (accountAgeMs >= NEW_ACCOUNT_FLAG_THRESHOLD_DAYS * ONE_DAY_MS) return;

    const weekKey = weekResetAt instanceof Date ? weekResetAt.toISOString().slice(0, 10) : String(weekResetAt);
    await adminDB
      .collection("moderationFlags")
      .doc(`${uid}_confirmed_sale_weekly_cap_${weekKey}`)
      .set(
        {
          userId: uid,
          reason: "confirmed_sale_weekly_cap_hit_by_new_account",
          detail: `Hit the ${CONFIRMED_SALE_WEEKLY_USER_CAP}-credit weekly confirmed-sale cap while account was under ${NEW_ACCOUNT_FLAG_THRESHOLD_DAYS} days old.`,
          accountCreatedAt: createdAt,
          resolved: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  } catch (error) {
    console.error("Error checking/writing rapid-cap moderation flag:", error);
  }
}

/**
 * Either party confirms their side of a sale. Awards CONFIRMED_SALE_CREDIT_AMOUNT
 * to both buyer and seller the moment BOTH sides have confirmed — never on a
 * single-sided confirmation. This is the weakest-verified earning event in
 * the system (both-sides-confirm proves agreement, not that money moved), so
 * it's gated by three checks, all-or-nothing per confirmation event:
 *   1. buyerId !== sellerId (enforced earlier, in assertParticipant)
 *   2. CONFIRMED_SALE_DAILY_PAIR_CAP — credit-eligible confirmations per pair/day
 *   3. CONFIRMED_SALE_WEEKLY_USER_CAP — hard per-user weekly ceiling, checked
 *      for BOTH sides; if either would exceed it, neither side is paid
 * Every block is written to creditAuditLog rather than silently skipped.
 * Fully idempotent: re-confirming after "confirmed" is a harmless no-op, and
 * the award itself is keyed by a fixed ledger doc ID per conversation+role so
 * retries/races can't double-pay (verified under concurrent calls).
 */
export async function confirmSale(conversationId, uid) {
  const conversationRef = adminDB.collection("conversation").doc(conversationId);

  const result = await adminDB.runTransaction(async (tx) => {
    const convSnap = await tx.get(conversationRef);
    if (!convSnap.exists) {
      throw new SaleConfirmationError("Conversation not found", 404);
    }
    const conv = convSnap.data();
    const { buyerId, sellerId } = deriveRoles(conv);
    assertParticipant(uid, buyerId, sellerId);

    if (conv.saleStatus === "disputed") {
      throw new SaleConfirmationError("This sale has been disputed and can't be confirmed", 409);
    }
    if (conv.saleStatus === "confirmed") {
      return { saleStatus: "confirmed", creditAwarded: false }; // idempotent no-op, credit already paid
    }

    const isBuyer = uid === buyerId;
    const now = new Date();
    const buyerConfirmedAt = isBuyer ? now : conv.buyerConfirmedAt || null;
    const sellerConfirmedAt = !isBuyer ? now : conv.sellerConfirmedAt || null;
    const bothConfirmed = !!buyerConfirmedAt && !!sellerConfirmedAt;

    // --- All reads must happen before any writes in a Firestore transaction ---
    const buyerUserRef = adminDB.collection("users").doc(buyerId);
    const sellerUserRef = adminDB.collection("users").doc(sellerId);
    let pairRef = null, pairSnap = null;
    let buyerUserSnap = null, sellerUserSnap = null;
    let buyerLedgerRef = null, buyerLedgerSnap = null;
    let sellerLedgerRef = null, sellerLedgerSnap = null;

    if (bothConfirmed) {
      pairRef = buyerUserRef.collection("pairSaleCounts").doc(sellerId);
      pairSnap = await tx.get(pairRef);
      buyerUserSnap = await tx.get(buyerUserRef);
      sellerUserSnap = await tx.get(sellerUserRef);
      buyerLedgerRef = buyerUserRef.collection("creditLedger").doc(`confirmed_sale_${conversationId}_buyer`);
      buyerLedgerSnap = await tx.get(buyerLedgerRef);
      sellerLedgerRef = sellerUserRef.collection("creditLedger").doc(`confirmed_sale_${conversationId}_seller`);
      sellerLedgerSnap = await tx.get(sellerLedgerRef);
    }

    // --- Writes ---
    // confirmedAt marks the exact moment both sides confirmed — used by the
    // monthly Top Seller cron (02-badge-system.md) to scope "this calendar
    // month" without needing to derive it from max(buyerConfirmedAt,
    // sellerConfirmedAt) on every run. Only ever set once, at the transition
    // to "confirmed" (this write only runs when saleStatus wasn't already
    // "confirmed" — guarded above).
    // pendingAt marks the first moment this went "pending" — preserved as-is
    // if already set (conv.pendingAt || now), only stamped fresh the first
    // time. Used by the daily expire-pending-sales cron (03-sale-confirmation
    // .md §6) to reset a sale nobody ever confirmed/disputed back to "none"
    // after 24h, rather than leaving it stuck forever.
    tx.set(
      conversationRef,
      {
        buyerId,
        sellerId,
        saleStatus: bothConfirmed ? "confirmed" : "pending",
        buyerConfirmedAt,
        sellerConfirmedAt,
        ...(bothConfirmed ? { confirmedAt: now } : { pendingAt: conv.pendingAt || now }),
      },
      { merge: true }
    );

    let creditAwarded = false;
    let buyerWeekResetAt = null;
    let sellerWeekResetAt = null;
    let buyerHitWeeklyCap = false;
    let sellerHitWeeklyCap = false;

    if (bothConfirmed) {
      // Check 2: per-pair daily cap
      const pairCounter = readWindowedCounter(pairSnap.exists ? pairSnap.data() : null, "countToday", "dayResetAt", ONE_DAY_MS, now);
      const underPairCap = pairCounter.current < CONFIRMED_SALE_DAILY_PAIR_CAP;

      if (!underPairCap) {
        logCreditAttemptBlocked(tx, { conversationId, buyerId, sellerId, reason: "per_pair_daily_cap" });
      } else {
        // Check 3: weekly per-user cap, both sides
        const buyerWeek = readWindowedCounter(buyerUserSnap.data(), "confirmedSaleCreditThisWeek", "weekResetAt", SEVEN_DAYS_MS, now);
        const sellerWeek = readWindowedCounter(sellerUserSnap.data(), "confirmedSaleCreditThisWeek", "weekResetAt", SEVEN_DAYS_MS, now);
        const buyerUnderCap = buyerWeek.current + CONFIRMED_SALE_CREDIT_AMOUNT <= CONFIRMED_SALE_WEEKLY_USER_CAP;
        const sellerUnderCap = sellerWeek.current + CONFIRMED_SALE_CREDIT_AMOUNT <= CONFIRMED_SALE_WEEKLY_USER_CAP;

        if (!buyerUnderCap || !sellerUnderCap) {
          logCreditAttemptBlocked(tx, { conversationId, buyerId, sellerId, reason: "weekly_user_cap" });
        } else {
          buyerWeekResetAt = buyerWeek.needsReset ? now : buyerUserSnap.data().weekResetAt.toDate();
          sellerWeekResetAt = sellerWeek.needsReset ? now : sellerUserSnap.data().weekResetAt.toDate();
          buyerHitWeeklyCap = buyerWeek.current + CONFIRMED_SALE_CREDIT_AMOUNT >= CONFIRMED_SALE_WEEKLY_USER_CAP;
          sellerHitWeeklyCap = sellerWeek.current + CONFIRMED_SALE_CREDIT_AMOUNT >= CONFIRMED_SALE_WEEKLY_USER_CAP;

          if (!buyerLedgerSnap.exists) {
            tx.set(buyerLedgerRef, {
              amount: CONFIRMED_SALE_CREDIT_AMOUNT,
              type: CREDIT_EVENT_TYPES.CONFIRMED_SALE,
              referenceId: conversationId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.set(
              buyerUserRef,
              {
                creditBalance: admin.firestore.FieldValue.increment(CONFIRMED_SALE_CREDIT_AMOUNT),
                confirmedSaleCreditThisWeek: buyerWeek.current + CONFIRMED_SALE_CREDIT_AMOUNT,
                weekResetAt: buyerWeekResetAt,
              },
              { merge: true }
            );
          }
          if (!sellerLedgerSnap.exists) {
            tx.set(sellerLedgerRef, {
              amount: CONFIRMED_SALE_CREDIT_AMOUNT,
              type: CREDIT_EVENT_TYPES.CONFIRMED_SALE,
              referenceId: conversationId,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.set(
              sellerUserRef,
              {
                creditBalance: admin.firestore.FieldValue.increment(CONFIRMED_SALE_CREDIT_AMOUNT),
                confirmedSaleCreditThisWeek: sellerWeek.current + CONFIRMED_SALE_CREDIT_AMOUNT,
                weekResetAt: sellerWeekResetAt,
              },
              { merge: true }
            );
          }
          tx.set(
            pairRef,
            { countToday: pairCounter.current + 1, dayResetAt: pairCounter.needsReset ? now : pairSnap.data().dayResetAt.toDate() },
            { merge: true }
          );
          creditAwarded = true;
        }
      }
    }

    return {
      saleStatus: bothConfirmed ? "confirmed" : "pending",
      creditAwarded,
      buyerId,
      sellerId,
      buyerHitWeeklyCap,
      sellerHitWeeklyCap,
      buyerWeekResetAt,
      sellerWeekResetAt,
    };
  });

  // Flagging is best-effort and non-transactional (needs an Auth API call) —
  // deliberately outside the transaction above.
  if (result.creditAwarded) {
    if (result.buyerHitWeeklyCap) await maybeFlagRapidWeeklyCap(result.buyerId, result.buyerWeekResetAt);
    if (result.sellerHitWeeklyCap) await maybeFlagRapidWeeklyCap(result.sellerId, result.sellerWeekResetAt);
  }

  return { saleStatus: result.saleStatus, creditAwarded: result.creditAwarded };
}

/**
 * Either party disputes a sale before it's confirmed. Once a sale is
 * "confirmed" the credit has already paid out — Phase 1 (per
 * 03-sale-confirmation.md §6) has no automated clawback, so disputing a
 * confirmed sale is refused; it needs manual admin review instead.
 */
export async function disputeSale(conversationId, uid, reason) {
  const conversationRef = adminDB.collection("conversation").doc(conversationId);

  return adminDB.runTransaction(async (tx) => {
    const convSnap = await tx.get(conversationRef);
    if (!convSnap.exists) {
      throw new SaleConfirmationError("Conversation not found", 404);
    }
    const conv = convSnap.data();
    const { buyerId, sellerId } = deriveRoles(conv);
    assertParticipant(uid, buyerId, sellerId);

    if (conv.saleStatus === "confirmed") {
      throw new SaleConfirmationError(
        "This sale is already confirmed and can't be disputed automatically — contact support",
        409
      );
    }
    if (conv.saleStatus === "disputed") {
      return { saleStatus: "disputed" }; // idempotent no-op
    }

    tx.set(
      conversationRef,
      {
        buyerId,
        sellerId,
        saleStatus: "disputed",
        disputedBy: uid === buyerId ? "buyer" : "seller",
        disputedAt: new Date(),
        disputeReason: reason || null,
      },
      { merge: true }
    );

    return { saleStatus: "disputed" };
  });
}

/**
 * Either party flags the conversation as a pending sale, prompting the other
 * side to confirm. Purely a status flip — never touches credit or the
 * confirmation timestamps, so it carries none of confirmSale's abuse surface.
 */
export async function markSalePending(conversationId, uid) {
  const conversationRef = adminDB.collection("conversation").doc(conversationId);

  return adminDB.runTransaction(async (tx) => {
    const convSnap = await tx.get(conversationRef);
    if (!convSnap.exists) {
      throw new SaleConfirmationError("Conversation not found", 404);
    }
    const conv = convSnap.data();
    const { buyerId, sellerId } = deriveRoles(conv);
    assertParticipant(uid, buyerId, sellerId);

    if (!conv.saleStatus || conv.saleStatus === "none") {
      tx.set(conversationRef, { buyerId, sellerId, saleStatus: "pending", pendingAt: new Date() }, { merge: true });
      return { saleStatus: "pending" };
    }
    return { saleStatus: conv.saleStatus }; // idempotent no-op for pending/confirmed/disputed
  });
}

/**
 * Daily-cron path (03-sale-confirmation.md §6): resets a conversation stuck
 * at saleStatus "pending" for longer than SALE_PENDING_TIMEOUT_MS back to
 * "none", clearing buyerConfirmedAt/sellerConfirmedAt/pendingAt too — not
 * just saleStatus — so a stale one-sided confirmation from the expired
 * attempt can't silently complete a *later*, unrelated pending cycle on the
 * same conversation. No credit implication (nothing is ever awarded before
 * both sides confirm), purely to stop the "confirm sale?" prompt from
 * sitting there forever.
 *
 * Re-reads and re-checks status/age inside the transaction rather than
 * trusting the cron's query snapshot, so a race with a party confirming or
 * disputing in between can't incorrectly wipe a sale that just resolved.
 */
export async function expirePendingSale(conversationId) {
  const conversationRef = adminDB.collection("conversation").doc(conversationId);

  return adminDB.runTransaction(async (tx) => {
    const convSnap = await tx.get(conversationRef);
    if (!convSnap.exists) {
      return { expired: false, reason: "not_found" };
    }
    const conv = convSnap.data();
    if (conv.saleStatus !== "pending") {
      return { expired: false, reason: `status_is_${conv.saleStatus || "none"}` };
    }
    const pendingSince = conv.pendingAt?.toDate?.() ?? null;
    if (!pendingSince || Date.now() - pendingSince.getTime() < SALE_PENDING_TIMEOUT_MS) {
      return { expired: false, reason: "not_yet_stale" };
    }

    tx.set(
      conversationRef,
      {
        saleStatus: "none",
        buyerConfirmedAt: admin.firestore.FieldValue.delete(),
        sellerConfirmedAt: admin.firestore.FieldValue.delete(),
        pendingAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true }
    );
    return { expired: true };
  });
}
