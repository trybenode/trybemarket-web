import { adminDB } from "@/lib/firebaseAdmin";
import { expirePendingSale } from "@/lib/saleConfirmationServer";
import { SALE_PENDING_TIMEOUT_MS } from "@/lib/creditConstants";

/**
 * GET/POST /api/sale/expire-pending
 *
 * Daily sweep (03-sale-confirmation.md §6, previously an unresolved open
 * question) — resets any conversation stuck at saleStatus "pending" for over
 * SALE_PENDING_TIMEOUT_MS (24h) back to "none" so the "confirm sale?" prompt
 * doesn't sit there forever when neither side ever confirms or disputes.
 * Purely a UX cleanup: no credit is ever awarded on a single-sided
 * confirmation, so this has no earning-side abuse surface.
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
    const cutoff = new Date(Date.now() - SALE_PENDING_TIMEOUT_MS);
    const snap = await adminDB
      .collection("conversation")
      .where("saleStatus", "==", "pending")
      .where("pendingAt", "<", cutoff)
      .get();

    let expiredCount = 0;
    for (const doc of snap.docs) {
      const result = await expirePendingSale(doc.id);
      if (result.expired) expiredCount++;
    }

    const result = { success: true, expired: expiredCount, checked: snap.size, runAt: new Date().toISOString() };
    console.log("Pending-sale expiry sweep complete:", result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Pending-sale expiry sweep error:", error);
    return res.status(500).json({ error: "Expiry sweep failed", details: error.message });
  }
}
