export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { reserveCredit, CreditSpendError } from "@/lib/creditSpendServer";

/**
 * POST /api/credit/spend/reserve  { itemId, applyCredit: boolean }
 *
 * Called at checkout initiation, before any Paystack popup. Never accepts a
 * client-supplied amount, category, or cap — itemId is the only input, and
 * the server looks up the real plan/price/cap from Firestore itself
 * (credit-spending-security-checklist.md §4). If applyCredit is true and
 * some credit is eligible, decrements the caller's balance immediately and
 * returns a reference for the (possibly discounted, possibly zero) Paystack
 * charge; if fully covered, the purchase is already fulfilled by the time
 * this returns and no Paystack step is needed at all.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { itemId, applyCredit } = await req.json();
    const result = await reserveCredit(auth.uid, { itemId, applyCredit: !!applyCredit });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof CreditSpendError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error reserving credit spend:", error);
    return NextResponse.json({ error: "Failed to reserve credit", details: error.message }, { status: 500 });
  }
}
