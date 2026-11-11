/**
 * Switches and required settings for the WhatsApp assistant
 * (09-whatsapp-assistant.md). Read at call time, never cached at import, so a
 * changed environment variable takes effect on the next request.
 *
 *   WA_ENABLED=true                 the kill switch — anything else and the
 *                                   assistant stays silent (the webhook keeps
 *                                   doing its older jobs: STOP, delivery status)
 *   WA_SEARCH_OPEN=true             open mode: anyone may search (off at launch)
 *   WA_MONTHLY_REPLY_BUDGET=1000    replies a month before new searches and
 *                                   check-ins pause (Meta's free allowance)
 *   WHATSAPP_BUSINESS_NUMBER        the number students message, digits only
 *                                   with country code (e.g. 2348012345678) —
 *                                   used for the wa.me link when connecting
 *   WHATSAPP_PHONE_NUMBER_ID,       required to send; there is deliberately no
 *   WHATSAPP_ACCESS_TOKEN           fallback ID here
 */

export const DEFAULT_MONTHLY_REPLY_BUDGET = 1000;
/** Share of the monthly budget at which the team is alerted. */
export const BUDGET_ALERT_SHARE = 0.8;

export function isAssistantEnabled(env = process.env) {
  return env.WA_ENABLED === "true";
}

export function isSearchOpen(env = process.env) {
  return env.WA_SEARCH_OPEN === "true";
}

export function monthlyReplyBudget(env = process.env) {
  const value = Number(env.WA_MONTHLY_REPLY_BUDGET);
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_MONTHLY_REPLY_BUDGET;
}

/** The business number for wa.me links, digits only — or null if it isn't set properly. */
export function businessNumber(env = process.env) {
  const digits = String(env.WHATSAPP_BUSINESS_NUMBER || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** What the sender needs; throws rather than fall back to a test number. */
export function requireSendConfig(env = process.env) {
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) {
    throw new Error("WhatsApp assistant: WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN must be set");
  }
  return {
    phoneNumberId,
    accessToken,
    apiUrl: (env.WHATSAPP_API_URL || "https://graph.facebook.com/v22.0").replace(/\/$/, ""),
  };
}
