/**
 * Pure "how many consecutive paid months" logic — no Firestore imports, so
 * both client code (lib/subscriptionStore.js) and server code
 * (lib/subscriptionEligibilityServer.js) share one implementation instead
 * of two copies that could drift apart.
 */

/**
 * Reads the effective date off a subscriptionPayments doc — createdAt
 * (Timestamp, added after 2026-09-18) if present, else the legacy verifiedAt
 * ISO string. Both the client and Admin SDK's Timestamp classes implement
 * .toDate(), so this works identically for either caller.
 */
export function extractPaymentDate(data) {
  if (data?.createdAt?.toDate) {
    const d = data.createdAt.toDate();
    if (!isNaN(d.getTime())) return d;
  }
  if (data?.verifiedAt) {
    const d = new Date(data.verifiedAt);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Counts an unbroken run of distinct calendar months with at least one
 * successful payment, walking backward from the most recent paid month.
 * Deliberately NOT the number of payment documents — a maintenance plan's
 * "requires 3 paid months" is meant to reward sustained, month-over-month
 * subscribing, not 3 purchases made in a single day (the bug this fixes:
 * getUserPaidMonthsCount previously just returned snapshot.size).
 */
export function countConsecutivePaidMonths(paymentDates) {
  const monthKeys = new Set(
    (paymentDates || [])
      .filter((d) => d instanceof Date && !isNaN(d.getTime()))
      .map(monthKey)
  );
  if (monthKeys.size === 0) return 0;

  const latestKey = [...monthKeys].sort().at(-1);
  const [latestYear, latestMonth] = latestKey.split("-").map(Number);

  let count = 0;
  const cursor = new Date(latestYear, latestMonth - 1, 1);
  while (monthKeys.has(monthKey(cursor))) {
    count++;
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return count;
}
