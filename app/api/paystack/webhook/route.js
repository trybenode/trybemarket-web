export const runtime = "nodejs";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { commitPendingSpend } from "@/lib/creditSpendServer";

/**
 * POST /api/paystack/webhook
 *
 * Authoritative commit trigger for credit-assisted checkouts
 * (credit-spending-security-checklist.md §1) — verifies Paystack's HMAC-SHA512
 * signature over the raw request body before trusting anything in it. A
 * request that fails verification is rejected with zero side effects: the
 * signature check happens before the body is even parsed.
 *
 * Paystack's secret key must never be exposed to any client bundle — it's
 * only ever read here from a server-side env var (PAYSTACK_SECRET_KEY),
 * the same one used server-side elsewhere in this app.
 *
 * commitPendingSpend is a no-op for any reference that isn't a credit-spend
 * reservation (e.g. this event is for a regular full-price subscription/boost
 * payment, which that flow already handles via its own client-triggered
 * verify) — so this webhook is safe to receive events for payments it has
 * nothing to do with.
 */
export async function POST(req) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    console.error("PAYSTACK_SECRET_KEY is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-paystack-signature") || "";

  const expectedHash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");

  const expectedBuf = Buffer.from(expectedHash, "hex");
  const receivedBuf = Buffer.from(signatureHeader, "hex");
  const validSignature =
    expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

  if (!validSignature) {
    console.error("Paystack webhook: invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    if (event.event === "charge.success") {
      const { reference, amount } = event.data;
      const result = await commitPendingSpend(reference, { paidAmountKobo: amount });
      console.log("Paystack webhook processed charge.success:", { reference, result });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    // Signature is already verified at this point — a processing failure
    // here is safe to let Paystack retry, since commitPendingSpend is
    // idempotent either way.
    console.error("Error processing Paystack webhook:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
