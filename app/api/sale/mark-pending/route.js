export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { markSalePending, SaleConfirmationError } from "@/lib/saleConfirmationServer";

export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { conversationId } = await req.json();
    if (!conversationId) {
      return NextResponse.json({ error: "conversationId is required" }, { status: 400 });
    }

    const result = await markSalePending(conversationId, auth.uid);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof SaleConfirmationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error marking sale pending:", error);
    return NextResponse.json({ error: "Failed to mark sale pending", details: error.message }, { status: 500 });
  }
}
