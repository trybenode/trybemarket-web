/**
 * Sorts a WhatsApp webhook payload into the work it contains. Pure, so the
 * webhook's steps can be tested (tests/whatsapp/webhook.test.mjs).
 *
 * @returns {{
 *   messages: object[],                         every inbound message, in order
 *   stopRequests: string[],                     wa_ids that asked to stop promotions
 *   preferences: { waId: string, enabled: boolean }[],   marketing preference changes Meta reports
 *   statuses: object[],                         delivery statuses for messages we sent
 * }}
 */
import { parseInbound } from "./parse.js";

export function collectWebhookWork(payload) {
  const work = { messages: [], stopRequests: [], preferences: [], statuses: [] };
  for (const entry of payload?.entry || []) {
    for (const change of entry?.changes || []) {
      const value = change?.value || {};

      for (const message of value.messages || []) {
        if (!message || typeof message !== "object") continue;
        work.messages.push(message);
        if (parseInbound(message).type === "stop" && message.from) work.stopRequests.push(String(message.from));
      }

      for (const pref of value.user_preferences || []) {
        if (pref?.category !== "marketing_messages" || !pref.wa_id) continue;
        if (pref.value === "stop") work.preferences.push({ waId: String(pref.wa_id), enabled: false });
        if (pref.value === "resume") work.preferences.push({ waId: String(pref.wa_id), enabled: true });
      }

      for (const status of value.statuses || []) {
        if (status?.id && status.status) work.statuses.push(status);
      }
    }
  }
  return work;
}
