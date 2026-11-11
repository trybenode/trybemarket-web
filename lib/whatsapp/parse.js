/**
 * Reads one inbound WhatsApp message and says what the sender wants. Pure —
 * no I/O — and deterministic, so it's tested against a table of real-looking
 * messages (tests/whatsapp/parse.test.mjs). Nothing a sender writes is ever
 * treated as an instruction beyond these fixed shapes.
 *
 * Intents:
 *   { type: "stop" }                      STOP / "Stop promotions" / UNSUBSCRIBE
 *   { type: "link", code }                "LINK ABC123" (sent from the app's Connect button)
 *   { type: "help" }                      help, menu, ?
 *   { type: "greeting" }                  hi, hello, good morning…
 *   { type: "command", name }             "listings" | "messages" | "views"
 *   { type: "search", query }             any other text — an item to look for
 *   { type: "unsupported", messageType }  photos, voice notes, stickers… (not read yet)
 *   { type: "empty" }                     nothing usable
 */

export const LINK_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I/L
export const LINK_CODE_LENGTH = 6;
const LINK_PATTERN = new RegExp(`^LINK[\\s:]*([${LINK_CODE_ALPHABET}]{${LINK_CODE_LENGTH}})$`);

export const MAX_SEARCH_LENGTH = 60;

const STOP_WORDS = new Set(["STOP", "STOP PROMOTIONS", "UNSUBSCRIBE"]);
const HELP_WORDS = new Set(["HELP", "MENU", "?", "COMMANDS", "START"]);
const GREETINGS = new Set([
  "HI", "HII", "HIII", "HELLO", "HEY", "HEYY", "YO", "SUP", "HOWDY", "HOW FAR", "XUP", "WASSUP",
  "GOOD MORNING", "GOOD AFTERNOON", "GOOD EVENING", "GOOD DAY", "MORNING", "AFTERNOON", "EVENING",
  "THANKS", "THANK YOU", "OK", "OKAY",
]);
const COMMANDS = new Map([
  ["MY LISTINGS", "listings"], ["LISTINGS", "listings"], ["MY LISTING", "listings"], ["MY ITEMS", "listings"], ["MY SHOP", "listings"],
  ["MESSAGES", "messages"], ["MY MESSAGES", "messages"], ["MESSAGE", "messages"], ["CHATS", "messages"], ["MY CHATS", "messages"], ["UNREAD", "messages"],
  ["VIEWS", "views"], ["MY VIEWS", "views"], ["SHOP VIEWS", "views"], ["VIEW", "views"],
]);

/** The text a message carries, whichever way WhatsApp delivered it — or null. */
export function messageText(message) {
  if (!message || typeof message !== "object") return null;
  const text =
    message.type === "text" ? message.text?.body :
    message.type === "button" ? message.button?.text :
    message.type === "interactive" ? message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title :
    null;
  return typeof text === "string" ? text : null;
}

// Uppercased, trimmed, inner whitespace collapsed, wrapping punctuation dropped.
function normalize(text) {
  return text
    .normalize("NFKC")
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s*_~"'“”‘’.!,]+|[\s*_~"'“”‘’.!,]+$/g, "")
    .toUpperCase();
}

export function parseInbound(message) {
  const text = messageText(message);
  if (text === null) {
    return message?.type ? { type: "unsupported", messageType: String(message.type) } : { type: "empty" };
  }
  const normalized = normalize(text);
  if (!normalized) return { type: "empty" };

  if (STOP_WORDS.has(normalized)) return { type: "stop" };

  const link = LINK_PATTERN.exec(normalized);
  if (link) return { type: "link", code: link[1] };
  // "LINK" with a code that can't be one of ours: say so rather than search for it.
  if (/^LINK\b/.test(normalized)) return { type: "link", code: null };

  if (HELP_WORDS.has(normalized)) return { type: "help" };
  if (GREETINGS.has(normalized)) return { type: "greeting" };
  if (COMMANDS.has(normalized)) return { type: "command", name: COMMANDS.get(normalized) };

  // Anything else is something to search for. Keep the sender's own words
  // (trimmed and cut to a sane length); the search tokenizer does the rest.
  const query = text.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, MAX_SEARCH_LENGTH).trim();
  return /[\p{L}\p{N}]/u.test(query) ? { type: "search", query } : { type: "empty" };
}
