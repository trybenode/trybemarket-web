import { adminDB, adminAuth } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { subscriptionReminderTemplate } from "@/emails/subscriptionReminderTemplate";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * What a user loses when each plan expires.
 * Used to populate the reminder email body.
 */
const PLAN_LOSSES = {
  product_premium: [
    "Unlimited listings will revert to 3",
    "Premium seller badge removed",
    "2 VIP-tagged products removed",
    "Search boost disabled",
    "Access to TrybeFair removed",
  ],
  product_vip: [
    "5 VIP-tagged products removed",
    "VIP seller badge removed",
    "Featured product placements removed",
    "Priority search ranking removed",
  ],
  product_maintenance: ["All product listings will be deactivated"],
  service_premium: [
    "2 service listings revert to 1",
    "Premium service badge removed",
    "Shop analytics disabled",
    "Service boost removed",
    "Access to TrybeFair removed",
  ],
  service_vip: [
    "VIP service badge removed",
    "VIP-tagged service removed",
    "Featured service placement removed",
  ],
  service_maintenance: ["All service listings will be deactivated"],
  bundle_premium: [
    "Unlimited product listings revert to 3",
    "All VIP-tagged products removed",
    "Premium seller badges removed",
    "All service boost features removed",
  ],
  bundle_quarterly: [
    "Unlimited product listings revert to 3",
    "All VIP-tagged products removed",
    "Premium seller badges removed",
    "All service boost features removed",
  ],
  bundle_yearly: [
    "Unlimited product listings revert to 3",
    "All VIP-tagged products removed",
    "Premium seller badges removed",
    "All service boost features removed",
  ],
};

const PLAN_NAMES = {
  product_free: "Freemium Products",
  product_premium: "Premium Products",
  product_vip: "VIP Products",
  product_maintenance: "Products Maintenance",
  service_free: "Freemium Services",
  service_premium: "Premium Services",
  service_vip: "VIP Services",
  service_maintenance: "Services Maintenance",
  bundle_premium: "Premium Bundle",
  bundle_quarterly: "Quarterly Bundle",
  bundle_yearly: "Yearly Bundle",
};

/** Days before expiry to send reminders. Sorted descending so we always
 *  process the earliest-applicable unsent reminder first. */
const REMINDER_THRESHOLDS = [7, 3, 1];

function parseExpiryDate(expiryDate) {
  if (!expiryDate) return null;
  if (typeof expiryDate?.toDate === "function") return expiryDate.toDate();
  if (typeof expiryDate?.toMillis === "function") return new Date(expiryDate.toMillis());
  if (expiryDate?._seconds !== undefined) return new Date(expiryDate._seconds * 1000);
  if (expiryDate?.seconds !== undefined) return new Date(expiryDate.seconds * 1000);
  return new Date(expiryDate);
}

function getDaysUntilExpiry(expiryDate) {
  const expiry = parseExpiryDate(expiryDate);
  if (!expiry || isNaN(expiry.getTime())) return null;
  const msLeft = expiry.getTime() - Date.now();
  return Math.ceil(msLeft / (1000 * 60 * 60 * 24));
}

/**
 * GET  /api/subscription/send-renewal-reminders  — Vercel cron trigger
 * POST /api/subscription/send-renewal-reminders  — manual trigger
 *
 * Scans all subscriptions, finds active plans expiring within 7 days,
 * and sends a reminder email at the 7-day, 3-day, and 1-day marks.
 * Each reminder is sent only once (tracked via remindersSent array on the plan).
 *
 * Protected by: Authorization: Bearer <CRON_SECRET>
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
    const subsSnapshot = await adminDB.collection("subscriptions").get();

    let emailsSent = 0;
    let emailsFailed = 0;
    const skipped = [];

    for (const subDoc of subsSnapshot.docs) {
      const data = subDoc.data();
      const userId = subDoc.id;

      const planEntries = [
        { key: "product", plan: data.product },
        { key: "service", plan: data.service },
        { key: "bundle", plan: data.bundle },
      ];

      for (const { key, plan } of planEntries) {
        // Only process active paid plans with a known planId
        if (!plan?.isActive || !plan?.expiryDate || !plan?.planId) continue;
        // Skip free plans — nothing to remind about losing
        if (plan.planId.endsWith("_free")) continue;

        const daysLeft = getDaysUntilExpiry(plan.expiryDate);
        // Outside the reminder window (too far away or already expired)
        if (daysLeft === null || daysLeft <= 0 || daysLeft > 7) continue;

        const remindersSent = Array.isArray(plan.remindersSent) ? plan.remindersSent : [];

        // Find the highest applicable unsent threshold
        let targetThreshold = null;
        for (const threshold of REMINDER_THRESHOLDS) {
          if (daysLeft > threshold) continue;          // daysLeft is within this window
          if (remindersSent.includes(`${threshold}day`)) continue; // already sent
          targetThreshold = threshold;
          break; // send the largest applicable unsent reminder
        }

        if (targetThreshold === null) continue; // all applicable reminders already sent

        // Fetch user email from Firebase Auth
        let userEmail, userName;
        try {
          const userRecord = await adminAuth.getUser(userId);
          userEmail = userRecord.email;
          userName = userRecord.displayName || "TrybeMarket Seller";
        } catch (authErr) {
          console.error(`Auth lookup failed for ${userId}:`, authErr.message);
          skipped.push({ userId, reason: "auth_lookup_failed" });
          continue;
        }

        if (!userEmail) {
          skipped.push({ userId, reason: "no_email" });
          continue;
        }

        const planName = PLAN_NAMES[plan.planId] || plan.planId;
        const losses = PLAN_LOSSES[plan.planId] || ["Subscription perks will be removed"];
        const expiry = parseExpiryDate(plan.expiryDate);
        const formattedExpiry = expiry.toLocaleDateString("en-NG", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        try {
          await resend.emails.send({
            from: "Trybe Market <contact@trybemarket.online>",
            to: userEmail,
            subject: `⚠️ Your ${planName} plan expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
            html: subscriptionReminderTemplate({
              name: userName,
              planName,
              daysLeft,
              formattedExpiry,
              losses,
              renewUrl: "https://trybemarket.online/subscription",
            }),
          });

          // Mark this reminder as sent so it won't fire again
          await subDoc.ref.update({
            [`${key}.remindersSent`]: FieldValue.arrayUnion(`${targetThreshold}day`),
          });

          emailsSent++;
        } catch (emailErr) {
          console.error(`Email failed for user ${userId} plan ${key}:`, emailErr.message);
          emailsFailed++;
        }
      }
    }

    const result = {
      success: true,
      emailsSent,
      emailsFailed,
      skipped: skipped.length,
      runAt: new Date().toISOString(),
    };

    console.log("Renewal reminders complete:", result);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Renewal reminder job error:", error);
    return res.status(500).json({ error: "Reminder job failed", details: error.message });
  }
}
