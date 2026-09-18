import { adminDB } from "@/lib/firebaseAdmin";
import { awardBadgeOnce } from "@/lib/badgeServer";
import { BADGE_KEYS } from "@/lib/badgeConstants";

/**
 * Returns the previous calendar month's [start, end) range and its
 * "YYYY-MM" periodKey — this cron is meant to run early in a new month and
 * crown whoever won the month that just finished.
 */
function previousMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
  return { start, end, periodKey };
}

/**
 * GET/POST /api/badges/evaluate-top-seller
 *
 * Monthly cron (02-badge-system.md §3, §4: "must be re-evaluated on a
 * schedule... so results are consistent for all users at the same time" —
 * not computed on-demand per profile view). Counts conversation docs with
 * saleStatus === "confirmed" and confirmedAt in the previous calendar month,
 * grouped by sellerId, and awards the top_seller badge to whoever has the
 * highest count — ties all win (spec doesn't call for a single winner
 * specifically, and picking one arbitrarily among tied sellers would be
 * less fair than crowning all of them).
 *
 * Idempotent per month via awardBadgeOnce's period-scoped doc ID
 * (top_seller_YYYY-MM) — re-running for a month that's already been
 * evaluated is a safe no-op for sellers who already have that period's badge.
 *
 * Protected by Authorization: Bearer <CRON_SECRET>
 */
export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set");
    return res.status(500).json({ error: "Server misconfiguration" });
  }

  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { start, end, periodKey } = previousMonthRange();

    const snap = await adminDB
      .collection("conversation")
      .where("saleStatus", "==", "confirmed")
      .where("confirmedAt", ">=", start)
      .where("confirmedAt", "<", end)
      .get();

    const countBySeller = new Map();
    snap.forEach((doc) => {
      const sellerId = doc.data().sellerId;
      if (!sellerId) return;
      countBySeller.set(sellerId, (countBySeller.get(sellerId) || 0) + 1);
    });

    let maxCount = 0;
    for (const count of countBySeller.values()) {
      if (count > maxCount) maxCount = count;
    }

    const topSellers = maxCount > 0
      ? [...countBySeller.entries()].filter(([, count]) => count === maxCount).map(([sellerId]) => sellerId)
      : [];

    let awardedCount = 0;
    for (const sellerId of topSellers) {
      const result = await awardBadgeOnce(sellerId, {
        docId: `top_seller_${periodKey}`,
        badgeKey: BADGE_KEYS.TOP_SELLER,
        periodKey,
      });
      if (result.awarded) awardedCount++;
    }

    const result = {
      success: true,
      periodKey,
      sellersEvaluated: countBySeller.size,
      maxConfirmedSales: maxCount,
      topSellerCount: topSellers.length,
      awarded: awardedCount,
      runAt: new Date().toISOString(),
    };

    console.log("Top Seller evaluation complete:", result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Top Seller evaluation error:", error);
    return res.status(500).json({ error: "Evaluation failed", details: error.message });
  }
}
