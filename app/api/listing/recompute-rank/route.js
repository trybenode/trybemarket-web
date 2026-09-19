export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { recomputeRankForItem, RankScoreError } from "@/lib/rankScoreServer";

/**
 * POST /api/listing/recompute-rank  { itemId, itemType }
 *
 * Fire-and-forget target called after any product/service create or edit
 * (name/description/category change) — 07-ranking-unification.md §5. Always
 * re-derives rankScore/searchKeywords from the item's actual current stored
 * state server-side; never accepts a client-supplied score. Safe to call for
 * any item regardless of who calls it — it can't be used to set anything
 * other than what's already true, so this only requires being signed in,
 * not ownership of the item (e.g. this also gets called by the boost/VIP/
 * tier-sync triggers, and is safe as a general "resync" endpoint).
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { itemId, itemType } = await req.json();
    if (!itemId || !["product", "service"].includes(itemType)) {
      return NextResponse.json({ error: "Missing or invalid itemId/itemType" }, { status: 400 });
    }

    const result = await recomputeRankForItem(itemType, itemId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof RankScoreError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error recomputing rank score:", error);
    return NextResponse.json({ error: "Failed to recompute rank", details: error.message }, { status: 500 });
  }
}
