/**
 * The one-message replies to a connected seller's check-ins
 * (09-whatsapp-assistant.md §5.3): "my listings", "messages", "views".
 * Always a short summary with a link — never a list of items, and no codes
 * or stock commands to learn. Pure; the numbers come from checkins.js.
 */

const utm = "utm_source=whatsapp&utm_medium=assistant";
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** A name as we'll show it: first word only, no WhatsApp formatting, kept short. */
function firstName(name) {
  const word = String(name ?? "").replace(/[*_~`\n\r]+/g, " ").trim().split(/\s+/)[0] || "";
  return word.slice(0, 20);
}

/** "Ada", "Ada and Tolu", "Ada, Tolu and 2 more" */
function nameList(names, total) {
  const shown = names.map(firstName).filter(Boolean).slice(0, 2);
  const more = total - shown.length;
  if (shown.length === 0) return "";
  if (more > 0) return `${shown.join(", ")} and ${more} more`;
  return shown.length === 2 ? `${shown[0]} and ${shown[1]}` : shown[0];
}

export function buildCheckinReplies(siteUrl) {
  const site = String(siteUrl).replace(/\/+$/, "");
  return {
    /** @param {{ products: number, services: number, held: number, latest: string|null }} summary */
    listings: ({ products, services, held, latest }) => {
      const live = products + services;
      const onHold = held > 0 ? ` ${plural(held, "listing")} on hold — see My Shop.` : "";
      if (live === 0) {
        return `You have no live listings yet.${onHold} Add one: ${site}/upload?${utm}`;
      }
      const breakdown = products && services ? ` (${plural(products, "product")}, ${plural(services, "service")})` : "";
      const newest = latest ? ` Latest: ${String(latest).replace(/[*_~`\n\r]+/g, " ").trim().slice(0, 50)}.` : "";
      return `You have ${plural(live, "live listing")}${breakdown}.${newest}${onHold} Manage them: ${site}/my-shop?${utm}`;
    },

    /** @param {{ unread: number, from: string[] }} summary  `from`: names of people with unread chats */
    messages: ({ unread, from }) => {
      if (unread === 0) return `No unread chats — you're all caught up. ${site}/messages?${utm}`;
      const who = nameList(from, unread);
      return `${plural(unread, "unread chat")}${who ? ` — from ${who}` : ""}. Reply: ${site}/messages?${utm}`;
    },

    /**
     * Everyone gets today's views; Premium, VIP and Bundle sellers also get
     * the week (total and day by day).
     * @param {{ today: number, week: { label: string, count: number }[]|null }} summary
     */
    views: ({ today, week }) => {
      const todayLine = `Your shop had ${plural(today, "view")} today.`;
      if (!week) return `${todayLine} See your week with Premium: ${site}/subscription?${utm}`;
      const total = week.reduce((sum, day) => sum + day.count, 0);
      return `${todayLine} Last 7 days: ${total} (${week.map((day) => `${day.label} ${day.count}`).join(" · ")}).`;
    },
  };
}
