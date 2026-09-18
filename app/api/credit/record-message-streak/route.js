export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { recordQualifyingExchange } from "@/lib/streakServer";

/**
 * Fire-and-forget target called right after a message send succeeds
 * (utils/messaginghooks.js) — never awaited/blocking on the client side.
 * Derives the sender from the verified ID token, never a client-supplied
 * uid, since this feeds a credit-earning signal.
 */
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

    await recordQualifyingExchange(conversationId, auth.uid);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording streak activity:", error);
    return NextResponse.json({ error: "Failed to record activity" }, { status: 500 });
  }
}
