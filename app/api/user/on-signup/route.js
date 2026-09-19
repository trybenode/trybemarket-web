export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { maybeAwardFoundingMember } from "@/lib/badgeServer";
import { attachReferral } from "@/lib/crsaServer";

/**
 * Called once right after a new user doc is created (both signup paths in
 * app/signup/page.jsx, the Google path in app/login/page.jsx, plus the
 * fallback auto-create in context/UserContext.jsx for any other auth method).
 *
 * Awards Founding Member, and attaches a CRSA referral code if the client
 * captured one from a ?ref= link. Never trust the client to report "I just
 * signed up," so identity comes from the verified token and every referral
 * condition (account age, unverified, not self, active member, not already
 * attributed) is re-checked server-side in attachReferral — the body only
 * carries the code the client says it arrived with. Safe to call more than
 * once per user: both operations are idempotent.
 *
 * Referral problems never fail this request — signup must not depend on them.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const result = await maybeAwardFoundingMember(auth.uid);

    let referral = { attached: false };
    if (body?.ref) {
      try {
        const attachResult = await attachReferral(auth.uid, body.ref);
        referral = { attached: attachResult.attached };
        if (!attachResult.attached) {
          // Reason is logged, not returned — no need to tell a client which
          // codes exist or why one was refused.
          console.log("Referral not attached:", attachResult.reason);
        }
      } catch (referralError) {
        console.error("Error attaching referral:", referralError);
      }
    }

    return NextResponse.json({ success: true, ...result, referral });
  } catch (error) {
    console.error("Error checking Founding Member badge:", error);
    return NextResponse.json(
      { error: "Failed to check Founding Member badge", details: error.message },
      { status: 500 }
    );
  }
}
