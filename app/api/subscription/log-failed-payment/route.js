export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { logFailedSubscriptionPayment, SubscriptionPaymentError } from "@/lib/subscriptionFulfillment";

/**
 * POST /api/subscription/log-failed-payment  { reference, planId }
 *
 * The plain (non-credit) checkout flow never calls the server at all when a
 * Paystack popup is closed without success — verify-payment.js only ever
 * runs on the success path, so a cancelled/declined attempt left zero trace
 * anywhere. This is the server round-trip app/subscription/page.jsx's
 * handlePaymentClose now makes for that case, so the transactions history
 * page has something to show.
 *
 * userId always comes from the verified ID token, never the request body —
 * logFailedSubscriptionPayment then checks the client-supplied reference
 * actually belongs to that uid before writing anything under it.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { reference, planId } = await req.json();
    if (!reference) {
      return NextResponse.json({ error: "reference is required" }, { status: 400 });
    }
    const result = await logFailedSubscriptionPayment({
      userId: auth.uid,
      reference,
      planId,
      reason: "cancelled_by_user",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof SubscriptionPaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error logging failed payment:", error);
    return NextResponse.json({ error: "Failed to log payment attempt", details: error.message }, { status: 500 });
  }
}
