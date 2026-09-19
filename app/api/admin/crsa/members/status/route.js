export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { setMemberActive, CrsaError } from "@/lib/crsaServer";

/**
 * POST /api/admin/crsa/members/status  { uid, active: boolean }
 *
 * Admin-only: deactivates or reactivates a CRSA member. Deactivating removes
 * their CRSA Member badge and stops NEW referrals from attaching to or being
 * counted for their code; counts already earned are kept.
 */
export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { uid, active } = await req.json();
    if (typeof uid !== "string" || !uid || typeof active !== "boolean") {
      return NextResponse.json({ error: "uid (string) and active (boolean) are required" }, { status: 400 });
    }
    const result = await setMemberActive(uid, active);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof CrsaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error updating CRSA member status:", error);
    return NextResponse.json({ error: "Failed to update CRSA member" }, { status: 500 });
  }
}
