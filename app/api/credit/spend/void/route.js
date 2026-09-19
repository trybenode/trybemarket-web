export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { voidPendingSpend, CreditSpendError } from "@/lib/creditSpendServer";

/**
 * POST /api/credit/spend/void  { reference }
 *
 * Lets a seller cancel their own in-flight reservation immediately —
 * e.g. the Paystack popup was closed or the card was declined — instead of
 * waiting up to PENDING_SPEND_TIMEOUT_MS for the lazy-expiry path in
 * reserveCredit or the daily expire-pending-spends cron to release it.
 * Without this, both the credit and the "one active reservation" slot stay
 * stuck for up to 30 minutes after any failed/abandoned checkout.
 *
 * expectedUserId is enforced inside voidPendingSpend's own transaction —
 * this route never trusts the reference alone to prove ownership.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { reference } = await req.json();
    if (!reference) {
      return NextResponse.json({ error: "reference is required" }, { status: 400 });
    }
    const result = await voidPendingSpend(reference, { reason: "client_cancelled", expectedUserId: auth.uid });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof CreditSpendError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error voiding credit spend reservation:", error);
    return NextResponse.json({ error: "Failed to cancel checkout", details: error.message }, { status: 500 });
  }
}
