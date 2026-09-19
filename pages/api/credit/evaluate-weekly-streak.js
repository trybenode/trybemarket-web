import { adminDB } from "@/lib/firebaseAdmin";
import { awardCreditOnce } from "@/lib/creditServer";
import { CREDIT_EVENT_TYPES, WEEKLY_STREAK_CREDIT_AMOUNT } from "@/lib/creditConstants";
import { lagosDateKey } from "@/lib/streakServer";

/**
 * Returns the 7 Africa/Lagos date keys for "last week" — yesterday back
 * through 7 days ago — oldest-first, so the last element is the week's
 * start date (used as the idempotency key for the credit award).
 */
function lastSevenDatesEndingYesterday() {
  const dates = [];
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  for (let i = 7; i >= 1; i--) {
    dates.push(lagosDateKey(new Date(now - i * ONE_DAY_MS)));
  }
  return dates;
}

/**
 * GET/POST /api/credit/evaluate-weekly-streak
 *
 * Weekly cron (see vercel.json): finds every user with an `activityDays` doc
 * for all 7 of the past 7 days (see streak-detection-mechanism.md) via a
 * single collectionGroup query, and awards WEEKLY_STREAK_CREDIT_AMOUNT to
 * each — idempotent per calendar week via awardCreditOnce's fixed ledger ID.
 * No partial credit for 6/7 days — confirmed strict per change-answers.md §1.
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
    const targetDates = lastSevenDatesEndingYesterday();
    const weekKey = targetDates[0]; // oldest date = start of the evaluated week

    const snap = await adminDB
      .collectionGroup("activityDays")
      .where("date", "in", targetDates)
      .get();

    const userDates = new Map(); // uid -> Set<dateKey>
    snap.forEach((doc) => {
      const uid = doc.ref.parent.parent.id;
      if (!userDates.has(uid)) userDates.set(uid, new Set());
      userDates.get(uid).add(doc.data().date);
    });

    let awardedCount = 0;
    for (const [uid, dates] of userDates.entries()) {
      if (dates.size === targetDates.length) {
        const result = await awardCreditOnce(uid, {
          ledgerId: `weekly_streak_${weekKey}`,
          amount: WEEKLY_STREAK_CREDIT_AMOUNT,
          type: CREDIT_EVENT_TYPES.WEEKLY_ACTIVE_STREAK,
          referenceId: weekKey,
        });
        if (result.awarded) awardedCount++;
      }
    }

    const result = {
      success: true,
      weekKey,
      usersWithSomeActivity: userDates.size,
      awarded: awardedCount,
      runAt: new Date().toISOString(),
    };

    console.log("Weekly streak evaluation complete:", result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Weekly streak evaluation error:", error);
    return res.status(500).json({ error: "Evaluation failed", details: error.message });
  }
}
