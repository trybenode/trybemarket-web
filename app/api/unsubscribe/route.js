export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { isValidUnsubscribeToken } from "@/lib/unsubscribe";

/**
 * POST /api/unsubscribe?u=<uid>&t=<token>
 *
 * Turns promotional email off (or back on) for one user, authorised by the
 * signed token from the email's link — no login, since people click it from
 * their inbox (08-campaign-messaging.md §7.1). Two callers:
 *
 *  - The /unsubscribe page: JSON body { action: "unsubscribe" | "resubscribe" }.
 *  - Gmail/Yahoo "one-click unsubscribe" (RFC 8058): the mail provider POSTs
 *    `List-Unsubscribe=One-Click` as a form to the URL in the email's
 *    List-Unsubscribe header. u and t come from the query string.
 *
 * Only affects promotional email. Transactional email (KYC results, delisting
 * notices) is unaffected.
 */
export async function POST(req) {
  const url = new URL(req.url);
  const contentType = req.headers.get("content-type") || "";

  let uid = url.searchParams.get("u");
  let token = url.searchParams.get("t");
  let action = "unsubscribe";
  let source = "one_click";

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => ({}));
    uid = body.u || uid;
    token = body.t || token;
    action = body.action === "resubscribe" ? "resubscribe" : "unsubscribe";
    source = "unsubscribe_page";
  }

  if (!isValidUnsubscribeToken(uid, token)) {
    return NextResponse.json({ error: "This unsubscribe link isn't valid." }, { status: 400 });
  }

  try {
    const userRef = adminDB.collection("users").doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "This account no longer exists." }, { status: 404 });
    }

    const now = new Date().toISOString();
    await userRef.update(
      action === "unsubscribe"
        ? { marketingEmailOptOut: true, marketingEmailOptOutAt: now, marketingEmailOptOutSource: source }
        : { marketingEmailOptOut: false, marketingEmailResubscribedAt: now }
    );

    return NextResponse.json({ success: true, optedOut: action === "unsubscribe" });
  } catch (error) {
    console.error("Unsubscribe failed:", error);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
