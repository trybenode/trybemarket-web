/**
 * The one way the assistant sends a reply: reserve it against the caps
 * (lib/whatsapp/usage.js), send it, and give the reservation back if the
 * send failed. Nothing is sent when the caps say no.
 *
 * `deps` are passed in (production wiring is lib/whatsapp/adapter.js):
 *   db           Admin Firestore
 *   sendText     ({ to, body, buttons? }) → { ok }   buttons: [{ id, title }], up to three
 *   notifyTeam   ({ monthReplies, budgetLimit }) → void   (monthly alert)
 *   budgetLimit  replies a month
 *   alertAt      month total at which to alert
 *   capNotice    the "daily limit reached" text
 *   now          () → ms
 */
import { releaseReply, reserveReply } from "./usage.js";

/**
 * @param {{ phone: string, uid?: string|null, dailyLimit: number }} sender
 * @param {string} kind  one of REPLY_KINDS
 * @param {string} body
 * @param {{ buttons?: { id: string, title: string }[]|null }} [options]  quick-reply buttons under the message
 * @returns {Promise<{ sent: boolean, as: "reply"|"cap_notice"|null, reason: string|null }>}
 */
export async function sendReply(deps, sender, kind, body, { buttons = null } = {}) {
  const reserved = await reserveReply(deps.db, {
    phone: sender.phone,
    uid: sender.uid ?? null,
    kind,
    dailyLimit: sender.dailyLimit,
    budgetLimit: deps.budgetLimit,
    alertAt: deps.alertAt,
    now: deps.now(),
  });
  if (!reserved.send) return { sent: false, as: null, reason: reserved.reason };

  // The "limit reached" notice replaces the reply, so it carries no buttons.
  const isNotice = reserved.as === "cap_notice";
  const result = await deps.sendText({
    to: sender.phone,
    body: isNotice ? deps.capNotice : body,
    ...(buttons && !isNotice ? { buttons } : {}),
  });
  if (!result?.ok) {
    await releaseReply(deps.db, reserved.reservation);
    return { sent: false, as: null, reason: "send_failed" };
  }
  if (reserved.alert) {
    // Never let a failed alert email affect the reply that was just sent.
    Promise.resolve()
      .then(() => deps.notifyTeam({ monthReplies: reserved.monthReplies, budgetLimit: deps.budgetLimit }))
      .catch((error) => console.error("WhatsApp assistant: budget alert failed:", error));
  }
  return { sent: true, as: reserved.as, reason: null };
}
