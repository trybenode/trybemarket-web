export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { adminAuth } from "@/lib/firebaseAdmin";
import { adminAttributeReferral, CrsaError } from "@/lib/crsaServer";

/**
 * POST /api/admin/crsa/attribute  { email, code, reason }
 *
 * Admin-only: credits an existing student to an ambassador when they were
 * onboarded without the referral link. See adminAttributeReferral.
 */
export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { email, code, reason } = await req.json().catch(() => ({}));
    if (typeof email !== "string" || !email.trim()) {
      return NextResponse.json({ error: "Enter the student's email." }, { status: 400 });
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

    const result = await adminAttributeReferral(target.uid, code, { adminUid: auth.uid, reason });
    return NextResponse.json({ success: true, uid: target.uid, ...result });
  } catch (error) {
    if (error instanceof CrsaError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Error attributing referral:", error);
    return NextResponse.json({ error: "Failed to credit the referral" }, { status: 500 });
  }
}
