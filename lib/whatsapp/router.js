/**
 * Decides what one inbound WhatsApp message gets back
 * (09-whatsapp-assistant.md §6). Called by the webhook after the message has
 * been de-duplicated and the 200 has gone out.
 *
 * Who can do what:
 *   anyone                 STOP (confirmation), LINK <code>
 *   registered students    help, search                    — a connected number,
 *                          or a number on exactly one profile (search only)
 *   connected sellers      my listings / messages / views
 *   everyone else          one "members only" reply a day, then silence
 *
 * `deps` are passed in so this can be tested without WhatsApp or Firestore
 * (production wiring: lib/whatsapp/adapter.js):
 *   db, now, sendText, notifyTeam, budgetLimit, alertAt   see send.js
 *   replies        buildReplies(siteUrl)
 *   identify       (phone) → { kind: "linked"|"profile"|"unregistered", uid, dailyLimit }
 *   handlers       { search?, command? } — features present in this build:
 *                    search({ query, sender })  → reply text
 *                    command({ name, sender })  → reply text
 *   searchOpen     open mode: unregistered numbers may search (off at launch)
 */
import { redeemLinkCode } from "./link.js";
import { parseInbound } from "./parse.js";
import { sendReply } from "./send.js";
import { REPLY_KINDS } from "./usage.js";

// A message this old was re-delivered long after the fact; a reply now would
// only confuse (and the 24-hour window may be closing).
export const STALE_AFTER_MS = 15 * 60 * 1000;
const PHONE_PATTERN = /^\d{8,15}$/;

/**
 * @returns {Promise<string>} what happened, for waMessages/{wamid}.result
 */
export async function handleInbound(message, deps) {
  const phone = String(message?.from ?? "");
  if (!PHONE_PATTERN.test(phone)) return "ignored:no_sender";
  if (message.group_id || message.context?.group_id) return "ignored:group";

  const sentAt = Number(message.timestamp) * 1000;
  if (Number.isFinite(sentAt) && deps.now() - sentAt > STALE_AFTER_MS) return "ignored:stale";

  const intent = parseInbound(message);
  if (intent.type === "empty") return "ignored:empty";

  const { replies } = deps;
  const reply = async (sender, kind, body, label, capNotice = replies.capReached()) => {
    const outcome = await sendReply({ ...deps, capNotice }, sender, kind, body);
    return outcome.sent ? `${label}:${outcome.as}` : `${label}:not_sent:${outcome.reason}`;
  };
  const anyone = { phone, uid: null, dailyLimit: 0 };

  // --- Open to any number ---------------------------------------------------
  if (intent.type === "stop") {
    // The opt-out itself is recorded by the webhook, as before; this only confirms it.
    return reply(anyone, REPLY_KINDS.CONFIRMATION, replies.stopped(), "stop");
  }

  if (intent.type === "link") {
    const result = intent.code ? await redeemLinkCode(deps.db, { code: intent.code, phone, now: deps.now() }) : { status: "invalid" };
    const body = {
      linked: replies.linked,
      invalid: replies.linkInvalid,
      expired: replies.linkExpired,
      used: replies.linkUsed,
      taken: replies.linkTaken,
    }[result.status]();
    return reply({ ...anyone, uid: result.uid ?? null }, REPLY_KINDS.CONFIRMATION, body, `link:${result.status}`);
  }

  // --- Everything else depends on who is asking -----------------------------
  const who = await deps.identify(phone);
  const sender = { phone, uid: who.uid ?? null, dailyLimit: who.dailyLimit ?? 0 };
  const features = { search: !!deps.handlers?.search, checkins: !!deps.handlers?.command, linked: who.kind === "linked" };

  if (who.kind === "unregistered") {
    if (deps.searchOpen && intent.type === "search" && deps.handlers?.searchOpen) {
      // Open mode: a few searches a day, then the sign-up prompt instead of "limit reached".
      const body = await deps.handlers.searchOpen({ query: intent.query, sender });
      return reply(sender, REPLY_KINDS.SEARCH, body, "search_open", replies.membersOnly());
    }
    return reply(sender, REPLY_KINDS.SIGNUP, replies.membersOnly(), "members_only");
  }

  switch (intent.type) {
    case "help":
      return reply(sender, REPLY_KINDS.HELP, replies.help(features), "help");
    case "greeting":
      return reply(sender, REPLY_KINDS.HELP, replies.greeting(features), "greeting");
    case "unsupported":
      return reply(sender, REPLY_KINDS.UNSUPPORTED, replies.unsupported(), `unsupported:${intent.messageType}`);
    case "command":
      if (!deps.handlers?.command) return reply(sender, REPLY_KINDS.HELP, replies.help(features), "help");
      // Private numbers: connected sellers only — a profile-number match isn't proof of ownership.
      if (who.kind !== "linked") return reply(sender, REPLY_KINDS.HELP, replies.needsLink(), "needs_link");
      return reply(sender, REPLY_KINDS.CHECKIN, await deps.handlers.command({ name: intent.name, sender }), `command:${intent.name}`);
    case "search":
      if (!deps.handlers?.search) return reply(sender, REPLY_KINDS.HELP, replies.help(features), "help");
      return reply(sender, REPLY_KINDS.SEARCH, await deps.handlers.search({ query: intent.query, sender }), "search");
    default:
      return "ignored:unknown";
  }
}
