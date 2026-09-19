import { adminDB } from "@/lib/firebaseAdmin";
import { voidPendingSpend } from "@/lib/creditSpendServer";

/**
 * GET/POST /api/credit/expire-pending-spends
 *
 * Backstop for reservations abandoned entirely (user never returns to
 * retry, so lib/creditSpendServer.js's lazy per-user expiry check in
 * reserveCredit never fires for them) — credit-spending-security-checklist.md
 * §5. The common case is already handled inline at reserve time; this just
 * ensures nothing sits locked against a balance indefinitely if the user
 * never comes back.
 *
 * Only ever queries the single-field `status == "pending"` equality (no
 * composite index needed) and filters expiry in memory — pending
 * reservations should be a small working set at any moment, not the full
 * history, since resolved ones move out of "pending".
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
    const snap = await adminDB.collection("pendingSpends").where("status", "==", "pending").get();
    const now = Date.now();

    let voidedCount = 0;
    for (const doc of snap.docs) {
      const expiresAtMs = doc.data().expiresAt?.toMillis?.() ?? 0;
      if (expiresAtMs < now) {
        const result = await voidPendingSpend(doc.id, { reason: "expired_cron" });
        if (result.voided) voidedCount++;
      }
    }

    const result = { success: true, checked: snap.size, voided: voidedCount, runAt: new Date().toISOString() };
    console.log("Pending spend expiry sweep complete:", result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Pending spend expiry error:", error);
    return res.status(500).json({ error: "Expiry sweep failed", details: error.message });
  }
}
