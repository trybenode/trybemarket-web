/**
 * Everything the assistant says, in one place. Pure — the site address is
 * passed in. Every reply is ONE short message (each is billed), with no
 * "anything else?" follow-ups, and never contains a seller's name or contact.
 */

const withUtm = (url) => `${url}${url.includes("?") ? "&" : "?"}utm_source=whatsapp&utm_medium=assistant`;

export function buildReplies(siteUrl) {
  const site = String(siteUrl).replace(/\/+$/, "");
  const connectLink = withUtm(`${site}/edit-profile`);

  return {
    /** `features`: which of { search, checkins } are switched on in this build. */
    help: ({ search = false, checkins = false, linked = false } = {}) =>
      [
        "*TrybeMarket on WhatsApp*",
        "",
        search ? "🔎 Send an item name to search, e.g. *bracelet*" : null,
        checkins && linked ? "🛍️ Your shop: *my listings*, *messages*, *views*" : null,
        checkins && !linked ? `🛍️ Sellers: connect your account to check your shop here — ${connectLink}` : null,
        !search && !checkins ? "More is coming here soon." : null,
        "",
        "Send *stop* to stop promotions.",
      ]
        .filter((line) => line !== null)
        .join("\n"),

    greeting: ({ search = false } = {}) =>
      search ? "Hi 👋 Send an item name to search, e.g. *bracelet*. Or send *help*." : "Hi 👋 Send *help* to see what you can do here.",

    linked: () => "Connected ✅ This number is now linked to your TrybeMarket account. Send *help* to see what you can do here.",
    linkInvalid: () => `That code didn't work. Get a new one in the app: Profile & Settings → Connect WhatsApp. ${connectLink}`,
    linkExpired: () => `That code has expired (they last 15 minutes). Get a new one in the app: Profile & Settings → Connect WhatsApp. ${connectLink}`,
    linkUsed: () => `That code has already been used. Get a new one in the app: Profile & Settings → Connect WhatsApp. ${connectLink}`,
    linkTaken: () => "This number is already connected to another TrybeMarket account. Disconnect it there first (Profile & Settings → WhatsApp), then try again.",

    needsLink: () => `That's for connected sellers. Connect your TrybeMarket account first: Profile & Settings → Connect WhatsApp. ${connectLink}`,

    stopped: () => "Done — you won't get promotions from TrybeMarket on WhatsApp. You can still message us here anytime.",

    capReached: () => "Daily limit reached. It resets at midnight.",

    membersOnly: () => `WhatsApp search is for TrybeMarket members. Join free: ${withUtm(`${site}/signup`)}`,

    unsupported: () => "I can only read text for now. Send *help* to see what you can do here.",

    error: () => "Something went wrong on our side. Please try again in a moment.",
  };
}
