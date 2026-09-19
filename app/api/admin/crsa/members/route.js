export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { adminAuth } from "@/lib/firebaseAdmin";
import { createOrReactivateMember, CrsaError } from "@/lib/crsaServer";
import { buildReferralLink } from "@/lib/crsaConstants";

/**
 * POST /api/admin/crsa/members  { email }
 *
 * Admin-only: makes the user with that email a CRSA member (or reactivates a
 * deactivated one, keeping their existing referral code). Idempotent. There is
 * no other admin tool in the app, so this is the only way members get added.
 */
export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { email } = await req.json();
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    let target;
    try {
      target = await adminAuth.getUserByEmail(email.trim().toLowerCase());
    } catch (lookupError) {
      if (lookupError.code === "auth/user-not-found") {
        return NextResponse.json({ error: "No account found with that email" }, { status: 404 });
      }
      throw lookupError;
    }

    const member = await createOrReactivateMember(auth.uid, target.uid);
    return NextResponse.json({
      success: true,
      uid: member.uid,
      referralCode: member.referralCode,
      referralLink: buildReferralLink(member.referralCode),
      created: member.created,
      reactivated: member.reactivated,
    });
  } catch (error) {
    if (error instanceof CrsaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error adding CRSA member:", error);
    return NextResponse.json({ error: "Failed to add CRSA member" }, { status: 500 });
  }
}
