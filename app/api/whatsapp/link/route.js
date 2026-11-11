export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";
import { requireAuth } from "@/lib/verifyRequestAuth";
import { businessNumber, isAssistantEnabled } from "@/lib/whatsapp/config";
import { createLinkCode, findLinkedPhone, maskPhone, unlinkAccount } from "@/lib/whatsapp/link";

/**
 * Connecting the signed-in student's WhatsApp number to their account
 * (09-whatsapp-assistant.md §5.1). The number itself only ever lives in the
 * server-only waLinks collection; this route returns it masked.
 *
 *   GET     → { available, linked, number }       number is "•••• 5678" or null
 *   POST    → { code, url, expiresAt }            url opens WhatsApp with "LINK <code>" typed in
 *   DELETE  → { linked: false }                   disconnects
 *
 * `available` is false while the assistant is switched off (WA_ENABLED) or the
 * business number isn't configured — the app then hides the Connect card.
 */

const available = () => isAssistantEnabled() && businessNumber() !== null;

export async function GET(req) {
  const auth = await requireAuth(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const phone = await findLinkedPhone(adminDB, auth.uid);
    return NextResponse.json({ available: available(), linked: !!phone, number: phone ? maskPhone(phone) : null });
  } catch (error) {
    console.error("WhatsApp link status failed:", error);
    return NextResponse.json({ error: "Couldn't check your WhatsApp connection" }, { status: 500 });
  }
}

export async function POST(req) {
  const auth = await requireAuth(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!available()) {
    return NextResponse.json({ error: "TrybeMarket on WhatsApp isn't available yet." }, { status: 503 });
  }
  try {
    const { code, expiresAt } = await createLinkCode(adminDB, auth.uid);
    const url = `https://wa.me/${businessNumber()}?text=${encodeURIComponent(`LINK ${code}`)}`;
    return NextResponse.json({ code, url, expiresAt });
  } catch (error) {
    console.error("WhatsApp link code failed:", error);
    return NextResponse.json({ error: "Couldn't start connecting. Please try again." }, { status: 500 });
  }
}

export async function DELETE(req) {
  const auth = await requireAuth(req);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    await unlinkAccount(adminDB, auth.uid);
    return NextResponse.json({ linked: false });
  } catch (error) {
    console.error("WhatsApp unlink failed:", error);
    return NextResponse.json({ error: "Couldn't disconnect. Please try again." }, { status: 500 });
  }
}
