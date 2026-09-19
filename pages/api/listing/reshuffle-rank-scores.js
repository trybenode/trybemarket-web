import { adminDB } from "@/lib/firebaseAdmin";
import { recomputeRankForItem } from "@/lib/rankScoreServer";

/**
 * GET/POST /api/listing/reshuffle-rank-scores
 *
 * Daily cron — the only path allowed to reroll rankShuffleSeed (see the
 * comment on recomputeRankForItem in lib/rankScoreServer.js). Firestore has
 * no query-time random ordering, so instead of shuffling at read time this
 * gives every product/service a fresh random in-tier tiebreaker once a day,
 * on a schedule nobody can trigger themselves — rotating which Free-tier (or
 * same-tier) listings surface first without ever letting a paid tier/VIP/
 * boost be outranked by a lower one (the shuffle fraction is always < the
 * smallest bonus, so it can only break ties within an otherwise-equal tier).
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
    let reshuffled = 0;
    let failed = 0;

    for (const [itemType, collectionName] of [["product", "products"], ["service", "services"]]) {
      const snap = await adminDB.collection(collectionName).get();

      // Small-scale marketplace today — a plain per-doc loop is plenty fast.
      // Chunked so a future much larger catalog doesn't fire thousands of
      // concurrent transactions at once.
      const CHUNK_SIZE = 50;
      for (let i = 0; i < snap.docs.length; i += CHUNK_SIZE) {
        const chunk = snap.docs.slice(i, i + CHUNK_SIZE);
        const results = await Promise.allSettled(
          chunk.map((doc) => recomputeRankForItem(itemType, doc.id, { reroll: true }))
        );
        for (const result of results) {
          if (result.status === "fulfilled") reshuffled++;
          else {
            failed++;
            console.error("Reshuffle failed for a listing:", result.reason);
          }
        }
      }
    }

    const result = { success: true, reshuffled, failed, runAt: new Date().toISOString() };
    console.log("Rank score reshuffle complete:", result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Rank score reshuffle error:", error);
    return res.status(500).json({ error: "Reshuffle failed", details: error.message });
  }
}
