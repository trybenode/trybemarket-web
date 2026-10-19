// app/api/subscription/precheck/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { assertPlanEligibilityAdmin, SubscriptionEligibilityError } from "@/lib/subscriptionEligibilityServer";

/**
 * POST /api/subscription/precheck  { planId }
 *
 * Runs the server-side purchase gates — KYC, and a plan's paid-months
 * requirement — BEFORE the subscription page opens Paystack, so an ineligible
 * user is stopped before paying rather than declined after (verify-payment
 * runs the same gates as the final check, but by then Paystack has the money).
 * Credit-assisted checkouts get the same check in /api/credit/spend/reserve.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const planId = typeof body.planId === "string" ? body.planId : "";
  if (!planId) {
    return NextResponse.json({ error: "planId is required" }, { status: 400 });
  }

  try {
    const planSnap = await adminDB.collection("subscriptionPlans").doc(planId).get();
    if (!planSnap.exists) {
      return NextResponse.json({ error: "Unknown plan" }, { status: 400 });
    }
    await assertPlanEligibilityAdmin(auth.uid, { id: planSnap.id, ...planSnap.data() });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SubscriptionEligibilityError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error checking subscription eligibility:", error);
    return NextResponse.json({ error: "Couldn't check this plan — please try again." }, { status: 500 });
  }
}
