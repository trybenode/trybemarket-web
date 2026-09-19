export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { adminAdjustCredit } from "@/lib/creditServer";

/**
 * POST /api/credit/admin-adjust  { userId, amount, reason }
 *
 * Restricted to admin-role accounts, enforced server-side (not just hidden
 * in the UI) — credit-spending-security-checklist.md §9. Mirrors the
 * isAdmin() check already used in firestore.rules (exists(admins/{uid})),
 * done here via Admin SDK since this is a server route, not a client write.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminDoc = await adminDB.collection("admins").doc(auth.uid).get();
  if (!adminDoc.exists) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const { userId, amount, reason } = await req.json();
    if (!userId || typeof amount !== "number" || amount === 0) {
      return NextResponse.json({ error: "userId and a non-zero numeric amount are required" }, { status: 400 });
    }
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ error: "A reason is required" }, { status: 400 });
    }

    const result = await adminAdjustCredit(userId, amount, reason, auth.uid);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error applying admin credit adjustment:", error);
    return NextResponse.json({ error: "Failed to apply adjustment", details: error.message }, { status: 500 });
  }
}
