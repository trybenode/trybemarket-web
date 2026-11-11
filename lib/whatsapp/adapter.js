/**
 * The assistant's connection to TrybeMarket: the only file in lib/whatsapp/
 * that knows about our database, plans and email. Everything else in the
 * folder takes these as `deps`, so the assistant could be lifted into another
 * product by writing a different adapter.
 */
import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";
import { adminDB } from "../firebaseAdmin.js";
import { RESEND_FROM } from "../kycEmail.js";
import { getDefaultNotificationLimit, getUserDailyLimit } from "../notifications.js";
import { searchProducts } from "../searchServer.js";
import { computeSellerTier } from "../sellerTier.js";
import { SITE_URL } from "../siteUrl.js";
import { sendWhatsAppText } from "../whatsapp.js";
import { buildCheckinReplies } from "./checkinReplies.js";
import { listingSummary, unreadSummary, viewsSummary } from "./checkins.js";
import { BUDGET_ALERT_SHARE, isSearchOpen, monthlyReplyBudget } from "./config.js";
import { findLinkedUid } from "./link.js";
import { buildReplies } from "./replies.js";
import { buildSearchReply } from "./searchReply.js";

const ALERT_TO = process.env.WA_ALERT_EMAIL || process.env.KYC_NOTIFY_EMAIL || "trybenode@gmail.com";
// Open mode: how many searches a day a number that isn't registered gets.
const OPEN_MODE_DAILY_SEARCHES = 3;
const SIGNUP_URL = `${SITE_URL}/signup?utm_source=whatsapp&utm_medium=assistant`;

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
  return { kind: "unregistered", uid: null, dailyLimit: isSearchOpen() ? OPEN_MODE_DAILY_SEARCHES : 0 };
}

/**
 * Records a search in `events`, in the same shape the website writes
 * (utils/analytics.js), so WhatsApp searches — and above all the ones that
 * found nothing — show up in the admin demand-gap view. campus_id holds the
 * school NAME there, so it's the searcher's school. Best-effort.
 */
async function logSearch({ query, count, uid }) {
  try {
    const user = uid ? (await adminDB.collection("users").doc(uid).get()).data() : null;
    const campus = user?.selectedUniversity || null;
    await adminDB.collection("events").add({
      event_type: "SEARCH_PERFORMED",
      user_id: uid || null,
      entity_id: null,
      entity_type: "search",
      campus_id: campus,
      source: "whatsapp",
      metadata: {
        query: query.trim().toLowerCase(),
        results_count: count,
        has_results: count > 0,
        campus_id: campus,
        session_id: null,
        source: "whatsapp",
      },
      timestamp: FieldValue.serverTimestamp(),
      created_at: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("WhatsApp assistant: couldn't log a search:", error);
  }
}

/** Runs a search and writes the one-message reply. `signupUrl` is added in open mode. */
async function searchReply({ query, sender }, signupUrl = null) {
  const { tokens, count, capped } = await searchProducts(query);
  const searchable = tokens.length > 0;
  if (searchable) await logSearch({ query, count, uid: sender.uid });
  return buildSearchReply({ siteUrl: SITE_URL, query, count, capped, searchable, signupUrl });
}

const checkinReplies = buildCheckinReplies(SITE_URL);

/** Premium, VIP or Bundle on either side (products or services) — the same rule ranking uses. */
async function hasPaidPlan(uid) {
  const snap = await adminDB.collection("subscriptions").doc(uid).get();
  const subs = snap.exists ? snap.data() : {};
  return computeSellerTier(subs, "product") !== "free" || computeSellerTier(subs, "service") !== "free";
}

/** A connected seller's check-in: one summary message. `sender.uid` is the linked account. */
async function checkinReply({ name, sender }) {
  const uid = sender.uid;
  if (name === "listings") return checkinReplies.listings(await listingSummary(adminDB, uid));
  if (name === "messages") return checkinReplies.messages(await unreadSummary(adminDB, uid));
  // views: today's total for everyone; the week for sellers on a paid plan
  return checkinReplies.views(await viewsSummary(adminDB, uid, { detailed: await hasPaidPlan(uid) }));
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
    handlers: {
      search: (request) => searchReply(request),
      searchOpen: (request) => searchReply(request, SIGNUP_URL),
      command: (request) => checkinReply(request),
    },
  };
}
