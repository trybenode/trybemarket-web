export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { setVipTag, RankScoreError } from "@/lib/rankScoreServer";

/**
 * POST /api/listing/set-vip-tag  { itemId, itemType, isVip }
 *
 * The ONLY way isVip can be set to true — firestore.rules blocks it from
 * direct client writes (07-ranking-unification.md §7). Enforces the
 * seller's plan cap server-side (the UI hiding the toggle was never a real
 * boundary) and recomputes rankScore in the same call.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { itemId, itemType, isVip } = await req.json();
    if (!itemId || !["product", "service"].includes(itemType)) {
      return NextResponse.json({ error: "Missing or invalid itemId/itemType" }, { status: 400 });
    }

    const result = await setVipTag(auth.uid, itemType, itemId, !!isVip);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof RankScoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error setting VIP tag:", error);
    return NextResponse.json({ error: "Failed to set VIP tag", details: error.message }, { status: 500 });
  }
}
