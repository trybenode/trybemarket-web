/**
 * The assistant's connection to TrybeMarket: the only file in lib/whatsapp/
 * that knows about our database, plans and email. Everything else in the
 * folder takes these as `deps`, so the assistant could be lifted into another
 * product by writing a different adapter.
 */
import { Resend } from "resend";
import { adminDB } from "../firebaseAdmin.js";
import { RESEND_FROM } from "../kycEmail.js";
import { getDefaultNotificationLimit, getUserDailyLimit } from "../notifications.js";
import { SITE_URL } from "../siteUrl.js";
import { sendWhatsAppText } from "../whatsapp.js";
import { BUDGET_ALERT_SHARE, isSearchOpen, monthlyReplyBudget } from "./config.js";
import { findLinkedUid } from "./link.js";
import { buildReplies } from "./replies.js";

const ALERT_TO = process.env.WA_ALERT_EMAIL || process.env.KYC_NOTIFY_EMAIL || "trybenode@gmail.com";

/**
 * Who is this number?
 *   linked        connected through the app (waLinks) — may use seller features
 *   profile       on exactly one profile (typed in, unverified) — search only.
 *                 On several profiles it still counts as registered, with the
 *                 Free limit and no account attached.
 *   unregistered  neither
 */
async function identify(phone) {
  const linkedUid = await findLinkedUid(adminDB, phone);
  if (linkedUid) return { kind: "linked", uid: linkedUid, dailyLimit: await getUserDailyLimit(linkedUid) };

  const profiles = await adminDB.collection("users").where("phone", "==", phone).limit(2).get();
  if (profiles.size === 1) {
    const uid = profiles.docs[0].id;
    return { kind: "profile", uid, dailyLimit: await getUserDailyLimit(uid) };
  }
  if (profiles.size > 1) return { kind: "profile", uid: null, dailyLimit: await getDefaultNotificationLimit() };
  return { kind: "unregistered", uid: null, dailyLimit: 0 };
}

/** Emails the team once, when the month's replies reach the alert level. */
async function notifyTeam({ monthReplies, budgetLimit }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const result = await resend.emails.send({
    from: RESEND_FROM,
    to: [ALERT_TO],
    subject: `WhatsApp assistant: ${monthReplies} of ${budgetLimit} replies used this month`,
    html: `
      <p>The WhatsApp assistant has sent <strong>${monthReplies}</strong> replies this month.</p>
      <p>At <strong>${budgetLimit}</strong>, new searches and seller check-ins stop getting replies until the 1st
      (link and STOP confirmations still go out). To raise the limit, set <code>WA_MONTHLY_REPLY_BUDGET</code>;
      to switch the assistant off, set <code>WA_ENABLED</code> to anything but <code>true</code>.</p>
    `,
  });
  if (result?.error) throw new Error(result.error.message || "Resend rejected the email");
}

/** Everything lib/whatsapp/router.js needs, wired to TrybeMarket. */
export function createAssistantDeps() {
  const budgetLimit = monthlyReplyBudget();
  return {
    db: adminDB,
    now: () => Date.now(),
    sendText: sendWhatsAppText,
    notifyTeam,
    budgetLimit,
    alertAt: Math.floor(budgetLimit * BUDGET_ALERT_SHARE),
    replies: buildReplies(SITE_URL),
    identify,
    searchOpen: isSearchOpen(),
    handlers: {},
  };
}
