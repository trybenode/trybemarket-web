export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { disputeSale, SaleConfirmationError } from "@/lib/saleConfirmationServer";

export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { conversationId, reason } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    const result = await disputeSale(conversationId, auth.uid, reason);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof SaleConfirmationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error disputing sale:", error);
    return NextResponse.json({ error: "Failed to dispute sale", details: error.message }, { status: 500 });
  }
}
