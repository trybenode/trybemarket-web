import { adminDB } from "./firebaseAdmin.js";

// Bounded recent window fetched per source collection — this is a personal,
// per-user history (not a global feed), so an in-memory merge/sort/paginate
// over a generous window is simpler and plenty adequate at this scale,
// rather than building true cross-collection cursor pagination. Known v1
// tradeoff: a user with more than this many records in any single source
// within the lookback would see gaps deep in their history — acceptable for
// how small per-user transaction volume realistically is here.
const PER_SOURCE_FETCH_LIMIT = 200;

function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/**
 * Internal statuses (pending/committed/voided/flagged/failed/success) are
 * implementation detail, not user-facing language — "flagged" in particular
 * must never leak "amount_mismatch" jargon to the seller.
 */
function mapPurchaseStatus(rawStatus) {
  switch (rawStatus) {
    case "pending":
      return "In progress";
    case "committed":
    case "success":
      return "Completed";
    case "voided":
      return "Cancelled";
    case "flagged":
      return "Under review";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

async function fetchCreditLedger(uid) {
  const snap = await adminDB
    .collection("users")
    .doc(uid)
    .collection("creditLedger")
    .orderBy("createdAt", "desc")
    .limit(PER_SOURCE_FETCH_LIMIT)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      source: "credit_ledger",
      groupKey: d.referenceId || doc.id,
      createdAtMs: toMillis(d.createdAt),
      raw: { id: doc.id, ...d },
    };
  });
}

async function fetchPendingSpends(uid) {
  const snap = await adminDB
    .collection("pendingSpends")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(PER_SOURCE_FETCH_LIMIT)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      source: "pending_spend",
      groupKey: doc.id,
      createdAtMs: toMillis(d.createdAt),
      raw: { id: doc.id, ...d },
    };
  });
}

async function fetchSubscriptionPayments(uid) {
  const snap = await adminDB
    .collection("subscriptionPayments")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(PER_SOURCE_FETCH_LIMIT)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      source: "subscription_payment",
      groupKey: d.reference || doc.id,
      // Legacy docs (written before createdAt existed) fall back to the
      // ISO-string verifiedAt so they still sort correctly.
      createdAtMs: toMillis(d.createdAt) ?? toMillis(d.verifiedAt),
      raw: { id: doc.id, ...d },
    };
  });
}

async function fetchBoostCredits(uid) {
  const snap = await adminDB
    .collection("boostCredits")
    .where("userId", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(PER_SOURCE_FETCH_LIMIT)
    .get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    return {
      source: "boost_credit",
      groupKey: d.reference || doc.id,
      createdAtMs: toMillis(d.createdAt),
      raw: { id: doc.id, ...d },
    };
  });
}

/**
 * One real-world purchase can leave up to four raw docs sharing the same
 * reference — a credit-assisted boost buy writes to pendingSpends,
 * creditLedger (the spend entry), subscriptionPayments (once the remainder
 * clears, if any), and boostCredits. Showing each raw doc as its own row
 * would display one purchase as 2-4 duplicate-looking entries, so records
 * are grouped by that shared reference (falling back to a ledger entry's own
 * doc id for earn events, which have no reference and are always solo).
 */
function synthesizeRow(groupKey, records) {
  const pendingSpend = records.find((r) => r.source === "pending_spend");
  const subPayment = records.find((r) => r.source === "subscription_payment");
  const boostCredit = records.find((r) => r.source === "boost_credit");
  const ledgerEntry = records.find((r) => r.source === "credit_ledger");

  const createdAtMs = Math.max(...records.map((r) => r.createdAtMs || 0)) || null;

  if (pendingSpend) {
    const plan = pendingSpend.raw.planSnapshot || {};
    return {
      id: groupKey,
      kind: "purchase",
      title: plan.name || pendingSpend.raw.itemId,
      category: plan.category || null,
      status: mapPurchaseStatus(pendingSpend.raw.status),
      // The Naira side actually charged is remainingAmount, NEVER the full
      // plan price — subPayment.raw.amount (when present) is always the full
      // price regardless of how much credit covered, and would overstate
      // what was actually paid if shown directly.
      nairaAmount: pendingSpend.raw.remainingAmount ?? 0,
      creditApplied: pendingSpend.raw.creditApplied ?? 0,
      totalPrice: pendingSpend.raw.price ?? null,
      boostStatus: boostCredit?.raw.status || null,
      createdAtMs,
    };
  }

  if (subPayment) {
    return {
      id: groupKey,
      kind: "purchase",
      title: subPayment.raw.planId,
      category: subPayment.raw.category || null,
      status: mapPurchaseStatus(subPayment.raw.status),
      nairaAmount: subPayment.raw.amount ?? 0,
      creditApplied: 0,
      totalPrice: subPayment.raw.amount ?? null,
      boostStatus: boostCredit?.raw.status || null,
      createdAtMs,
    };
  }

  if (boostCredit) {
    // Defensive fallback — fulfillPlanPurchase always writes boostCredits
    // alongside subscriptionPayments, so this shouldn't normally be reached.
    // A boostCredits doc only ever exists because a payment already
    // succeeded (nothing else creates one), so the purchase itself is
    // "Completed" regardless of whether the credit has been used yet —
    // boostStatus (unused/used) is the separate, correct place for that.
    return {
      id: groupKey,
      kind: "purchase",
      title: boostCredit.raw.tier || boostCredit.raw.planId,
      category: "boost",
      status: mapPurchaseStatus("success"),
      nairaAmount: 0,
      creditApplied: 0,
      totalPrice: null,
      boostStatus: boostCredit.raw.status,
      createdAtMs,
    };
  }

  // Standalone credit-earning event: KYC bonus, confirmed sale, weekly
  // streak, or an admin adjustment — none of these correlate to a purchase.
  return {
    id: groupKey,
    kind: "credit_event",
    type: ledgerEntry.raw.type,
    reason: ledgerEntry.raw.reason || null,
    ledgerAmount: ledgerEntry.raw.amount,
    status: "Completed",
    createdAtMs,
  };
}

function encodeCursor(offset) {
  return Buffer.from(String(offset), "utf8").toString("base64");
}

function decodeCursor(cursor) {
  if (!cursor) return 0;
  const parsed = Number(Buffer.from(cursor, "base64").toString("utf8"));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function getTransactionHistory(uid, { cursor = null, pageSize = 20 } = {}) {
  const [ledgerRecords, pendingSpendRecords, paymentRecords, boostRecords] = await Promise.all([
    fetchCreditLedger(uid),
    fetchPendingSpends(uid),
    fetchSubscriptionPayments(uid),
    fetchBoostCredits(uid),
  ]);

  const grouped = new Map();
  for (const record of [...ledgerRecords, ...pendingSpendRecords, ...paymentRecords, ...boostRecords]) {
    const bucket = grouped.get(record.groupKey) || [];
    bucket.push(record);
    grouped.set(record.groupKey, bucket);
  }

  const rows = [...grouped.entries()]
    .map(([groupKey, records]) => synthesizeRow(groupKey, records))
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));

  const offset = decodeCursor(cursor);
  const page = rows.slice(offset, offset + pageSize).map((row) => ({
    ...row,
    createdAtISO: row.createdAtMs ? new Date(row.createdAtMs).toISOString() : null,
  }));
  const nextOffset = offset + pageSize;
  const hasMore = nextOffset < rows.length;

  return {
    entries: page,
    cursor: hasMore ? encodeCursor(nextOffset) : null,
    hasMore,
  };
}
