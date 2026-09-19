export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { getTransactionHistory } from "@/lib/transactionHistoryServer";

/**
 * GET /api/transactions?cursor=&pageSize=
 *
 * Unified money/credit history for the signed-in seller — merges
 * creditLedger, pendingSpends, subscriptionPayments, and boostCredits,
 * grouped by shared reference so one real purchase shows as one row (see
 * lib/transactionHistoryServer.js). pendingSpends is Admin-SDK-only under
 * firestore.rules, so this server-side endpoint is the only way to include
 * it in a single feed — there's no client-SDK equivalent.
 */
export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get("cursor") || null;
    const pageSizeParam = Number(searchParams.get("pageSize"));
    const pageSize = Number.isFinite(pageSizeParam) && pageSizeParam > 0 && pageSizeParam <= 50 ? pageSizeParam : 20;

    const result = await getTransactionHistory(auth.uid, { cursor, pageSize });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    return NextResponse.json({ error: "Failed to fetch transaction history", details: error.message }, { status: 500 });
  }
}
