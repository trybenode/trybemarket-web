export const runtime = "nodejs";

import crypto from "crypto";
import { NextResponse } from "next/server";
import { adminDB } from "@/lib/firebaseAdmin";

/**
 * WhatsApp Cloud API webhook (08-campaign-messaging.md §7.2).
 *
 * Configure in the Meta app: WhatsApp → Configuration → Webhook
 *   Callback URL:  https://trybemarket.online/api/whatsapp/webhook
 *   Verify token:  the value of WHATSAPP_WEBHOOK_VERIFY_TOKEN
 *   Subscribe to:  messages, user_preferences
 * and set WHATSAPP_APP_SECRET (App settings → Basic → App secret) so every
 * POST can be checked against Meta's signature.
 *
 * Handles:
 *  - Promotional opt-out: the "Stop promotions" button, a STOP reply, or a
 *    marketing "stop" preference → users.whatsappMarketing = false.
 *    A marketing "resume" preference turns it back on.
 *  - Delivery status (sent / delivered / read / failed) for messages the
 *    admin app's campaigns record in whatsappMessages/{messageId}.
 *
 * Always answers 200 for a correctly signed request, even if handling part of
 * it failed (logged): Meta retries non-200 responses for days.
 */

// GET: Meta's one-time verification handshake when the webhook is saved.
export async function GET(req) {
  const params = new URL(req.url).searchParams;
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (
    expected &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === expected
  ) {
    return new NextResponse(params.get("hub.challenge") || "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

function hasValidSignature(rawBody, header) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  );
  const given = Buffer.from(header);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

const STOP_WORDS = new Set(["STOP", "STOP PROMOTIONS", "UNSUBSCRIBE"]);

// Is this incoming message a request to stop promotional messages?
function isStopRequest(message) {
  const text =
    message.type === "button" ? message.button?.text :
    message.type === "interactive" ? message.interactive?.button_reply?.title :
    message.type === "text" ? message.text?.body :
    null;
  return typeof text === "string" && STOP_WORDS.has(text.trim().toUpperCase());
}

// wa_id is the number with country code and no "+", the same format as users.phone.
async function setWhatsappMarketing(waId, enabled, source) {
  if (!waId) return 0;
  const snap = await adminDB.collection("users").where("phone", "==", String(waId)).get();
  const now = new Date().toISOString();
  await Promise.all(
    snap.docs.map((doc) =>
      doc.ref.update(
        enabled
          ? { whatsappMarketing: true, whatsappMarketingAt: now, whatsappMarketingSource: source }
          : { whatsappMarketing: false, whatsappMarketingOptOutAt: now, whatsappMarketingOptOutSource: source }
      )
    )
  );
  return snap.size;
}

const STATUS_RANK = { sent: 1, delivered: 2, read: 3 };

// Records a delivery status for a message a campaign sent. Statuses can
// arrive out of order, so a later "delivered" never overwrites "read";
// "failed" always wins.
async function recordStatus(status) {
  const ref = adminDB.collection("whatsappMessages").doc(String(status.id));
  await adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return; // not a campaign message
    const current = snap.data().status;
    const next = status.status;
    const isNewer =
      next === "failed" ||
      (current !== "failed" && (STATUS_RANK[next] || 0) > (STATUS_RANK[current] || 0));
    if (!isNewer) return;

    const update = {
      status: next,
      [`statusAt.${next}`]: status.timestamp
        ? new Date(Number(status.timestamp) * 1000).toISOString()
        : new Date().toISOString(),
      ...(next === "failed" && status.errors?.[0]
        ? { error: `${status.errors[0].code}: ${status.errors[0].title || status.errors[0].message || ""}`.trim() }
        : {}),
    };
    tx.update(ref, update);

    const { campaignId, uid } = snap.data();
    if (campaignId && uid) {
      tx.set(
        adminDB.collection("campaigns").doc(campaignId).collection("recipients").doc(uid),
        { whatsapp: { status: next, ...(update.error ? { error: update.error } : {}) } },
        { merge: true }
      );
    }
  });
}

export async function POST(req) {
  const rawBody = await req.text();
  if (!hasValidSignature(rawBody, req.headers.get("x-hub-signature-256"))) {
    if (!process.env.WHATSAPP_APP_SECRET) console.error("WhatsApp webhook: WHATSAPP_APP_SECRET is not set");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const tasks = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};

      for (const message of value.messages || []) {
        if (isStopRequest(message)) {
          tasks.push(setWhatsappMarketing(message.from, false, "whatsapp_stop"));
        }
      }

      // Marketing message preference changes Meta reports on its own
      for (const pref of value.user_preferences || []) {
        if (pref.category !== "marketing_messages") continue;
        if (pref.value === "stop") tasks.push(setWhatsappMarketing(pref.wa_id, false, "whatsapp_preferences"));
        if (pref.value === "resume") tasks.push(setWhatsappMarketing(pref.wa_id, true, "whatsapp_preferences"));
      }

      for (const status of value.statuses || []) {
        if (status.id && status.status) tasks.push(recordStatus(status));
      }
    }
  }

  const results = await Promise.allSettled(tasks);
  results
    .filter((r) => r.status === "rejected")
    .forEach((r) => console.error("WhatsApp webhook task failed:", r.reason));

  return NextResponse.json({ received: true });
}
