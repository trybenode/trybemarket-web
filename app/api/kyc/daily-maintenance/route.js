// app/api/kyc/daily-maintenance/route.js
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { runKycMaintenance } from "@/lib/kycMaintenance";
import { sendKycEmail, resolveKycRecipient } from "@/lib/kycEmail";

/**
 * GET|POST /api/kyc/daily-maintenance — the daily KYC job (vercel.json cron):
 * expire provisional students past their deadline (hold listings, pause
 * plans, email), re-hold anything a failed expiry or revoke left live, give
 * back anything a cleared student still has held or paused, lapse plans
 * paused too long, and send the deadline reminders. See lib/kycMaintenance.js.
 *
 * Protected by Authorization: Bearer <CRON_SECRET> (Vercel Cron sends it).
 */
async function handler(req) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runKycMaintenance({
      sendEmail: async ({ userId, kind, daysLeft, expiresAt }) => {
        const email = await resolveKycRecipient(userId);
        if (!email) return;
        const user = (await adminDB.collection("users").doc(userId).get()).data() || {};
        await sendKycEmail({ email, fullName: user.fullName || "there", status: kind, daysLeft, expiresAt });
      },
    });
    const result = { success: true, ...summary, runAt: new Date().toISOString() };
    console.log("KYC daily maintenance complete:", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (error) {
    console.error("KYC daily maintenance failed:", error);
    return NextResponse.json({ error: "KYC maintenance failed", details: error.message }, { status: 500 });
  }
}

export const GET = handler;
export const POST = handler;
