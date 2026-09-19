export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { maybeAwardFoundingMember } from "@/lib/badgeServer";

/**
 * Called once right after a new user doc is created (both signup paths in
 * app/signup/page.jsx, plus the fallback auto-create in context/UserContext.jsx
 * for any other auth method). Only awards Founding Member — never trust the
 * client to report "I just signed up," so this derives everything from the
 * verified token and the server-side running counter, not from the request
 * body. Safe to call more than once per user: maybeAwardFoundingMember is
 * idempotent by the badge doc's existence.
 */
export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const result = await maybeAwardFoundingMember(auth.uid);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Error checking Founding Member badge:", error);
    return NextResponse.json(
      { error: "Failed to check Founding Member badge", details: error.message },
      { status: 500 }
    );
  }
}
