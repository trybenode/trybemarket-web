export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { commitPendingSpend, CreditSpendError } from "@/lib/creditSpendServer";

/**
 * POST /api/credit/spend/verify  { reference }
 *
 * Client-triggered fallback for immediate UI feedback after the Paystack
 * popup's onSuccess fires — mirrors pages/api/subscription/verify-payment.js's
 * pattern of re-verifying directly with Paystack's API rather than trusting
 * the client's claim of success. The webhook (app/api/paystack/webhook) is
 * the authoritative committer for cases where this call never fires (tab
 * closed, network drop); both call the same idempotent commitPendingSpend,
 * so whichever arrives first wins and the other is a safe no-op.
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

    const pendingSnap = await adminDB.collection("pendingSpends").doc(reference).get();
    if (!pendingSnap.exists) {
      return NextResponse.json({ error: "Unknown reservation" }, { status: 404 });
    }
    if (pendingSnap.data().userId !== auth.uid) {
      return NextResponse.json({ error: "This reservation does not belong to you" }, { status: 403 });
    }

    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecretKey) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 500 });
    }

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${paystackSecretKey}` },
    });
    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data.status !== "success") {
      return NextResponse.json(
        { error: "Payment verification failed", details: verifyData.message },
        { status: 400 }
      );
    }

    const result = await commitPendingSpend(reference, { paidAmountKobo: verifyData.data.amount });
    if (!result.committed && result.reason !== `already_committed`) {
      return NextResponse.json({ error: `Could not finalize purchase (${result.reason})` }, { status: 409 });
    }

    return NextResponse.json({ success: true, committed: true });
  } catch (error) {
    if (error instanceof CreditSpendError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error verifying credit spend:", error);
    return NextResponse.json({ error: "Failed to verify payment", details: error.message }, { status: 500 });
  }
}
