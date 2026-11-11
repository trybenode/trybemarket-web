/**
 * The one-message reply to a WhatsApp search (09-whatsapp-assistant.md §5.4):
 * a count and a link that opens the site with the search already filled in.
 * Pure. Never includes a seller's name or contact — chatting happens on the site.
 */

const MAX_SHOWN = 40;

/** The searched words as we'll show them back: one line, no WhatsApp formatting characters. */
export function displayQuery(query) {
  const clean = String(query ?? "")
    .replace(/[*_~`"“”\n\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > MAX_SHOWN ? `${clean.slice(0, MAX_SHOWN - 1).trim()}…` : clean;
}

/** https://trybemarket.online/?q=bracelet&utm_source=whatsapp&utm_medium=assistant */
export function searchUrl(siteUrl, query) {
  const q = String(query ?? "").replace(/\s+/g, " ").trim();
  return `${String(siteUrl).replace(/\/+$/, "")}/?q=${encodeURIComponent(q)}&utm_source=whatsapp&utm_medium=assistant`;
}

/**
 * @param {object} result
 * @param {string} result.query
 * @param {number} result.count
 * @param {boolean} result.capped   the count reached the search limit: say "60+"
 * @param {boolean} result.searchable  false when the message had nothing to search for
 * @param {string|null} result.signupUrl  open mode: appended so a non-member can join
 */
export function buildSearchReply({ siteUrl, query, count, capped, searchable = true, signupUrl = null }) {
  const join = signupUrl ? `\nJoin free to chat with sellers: ${signupUrl}` : "";
  if (!searchable) return `Send an item name to search, e.g. *bracelet*.${join}`;
  const shown = displayQuery(query);
  if (count === 0) return `None yet for “${shown}”. Try another word.${join}`;
  const amount = capped ? `${count}+ results` : count === 1 ? "1 result" : `${count} results`;
  return `${amount} for “${shown}” on TrybeMarket. See ${count === 1 ? "it" : "them"}: ${searchUrl(siteUrl, query)}${join}`;
}
