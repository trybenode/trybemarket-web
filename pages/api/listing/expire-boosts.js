import { adminDB } from "@/lib/firebaseAdmin";
import { computeRankScore } from "@/lib/rankScoreServer";

/**
 * GET/POST /api/listing/expire-boosts
 *
 * Daily sweep (matches the existing cleanup-expired-vip cadence — see
 * 07-ranking-unification.md §10, "may or may not matter" on tighter accuracy;
 * a boost expiring up to 24h late isn't worth a more complex schedule for
 * now) that clears isBoosted on products/services whose boostEndDate has
 * passed and recomputes rankScore to drop the boostBonus. Read-time expiry
 * checking was deliberately avoided per the spec — this is the one place
 * expiry is decided, not every surface re-deriving it independently.
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
    const now = new Date();
    let expiredCount = 0;

    for (const collectionName of ["products", "services"]) {
      const snap = await adminDB
        .collection(collectionName)
        .where("isBoosted", "==", true)
        .where("boostEndDate", "<", now)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        const rankShuffleSeed = typeof data.rankShuffleSeed === "number" ? data.rankShuffleSeed : Math.random();
        const rankScore = computeRankScore({
          sellerTier: data.sellerTier,
          isVip: data.isVip,
          isBoosted: false,
          boostEndDate: data.boostEndDate,
          shuffleSeed: rankShuffleSeed,
        });
        await doc.ref.update({ isBoosted: false, rankScore, rankShuffleSeed });
        expiredCount++;
      }
    }

    const result = { success: true, expired: expiredCount, runAt: new Date().toISOString() };
    console.log("Boost expiry sweep complete:", result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Boost expiry sweep error:", error);
    return res.status(500).json({ error: "Expiry sweep failed", details: error.message });
  }
}
