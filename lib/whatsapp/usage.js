/**
 * Reply caps for the WhatsApp assistant (09-whatsapp-assistant.md §5.6).
 * Every reply we send is a billed WhatsApp message, so each one is reserved
 * here first:
 *
 *   - a per-number DAILY cap from the sender's plan (5 Free, 10 Premium,
 *     20 VIP / Premium Bundle), in waUsage/{phone}_{YYYYMMDD}. The day is the
 *     Lagos day — "resets at midnight" means midnight in Lagos.
 *   - a MONTHLY budget for the whole assistant (Meta's free allowance), in
 *     waBudget/{YYYYMM}. When it's used up, new searches and check-ins get no
 *     reply until the 1st; confirmations still go out.
 *
 * Both are server-only collections updated in ONE transaction, so two
 * messages arriving together can't both take the last reply. (The older
 * notification counters on the user record are read-then-write and reset at
 * UTC midnight; they're separate and unchanged.)
 *
 * `db` is passed in (the Admin Firestore in production, a small fake in
 * tests/whatsapp/), so this file has no Firebase import.
 */

export const REPLY_KINDS = {
  SEARCH: "search", // a search result
  CHECKIN: "checkin", // my listings / messages / views
  HELP: "help", // help, or a nudge after "hi"
  UNSUPPORTED: "unsupported", // "I can't read photos yet" — at most once a day
  SIGNUP: "signup", // "search is for members" — at most once a day per number
  CONFIRMATION: "confirmation", // STOP and link confirmations, error replies: never counted or blocked
};

const COUNTED = new Set([REPLY_KINDS.SEARCH, REPLY_KINDS.CHECKIN, REPLY_KINDS.HELP, REPLY_KINDS.UNSUPPORTED]);
const USAGE_TTL_DAYS = 40;
const DAY_MS = 24 * 60 * 60 * 1000;

const lagosParts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });

/** "20261111" for the Lagos day containing `now`. */
export function lagosDayKey(now = Date.now()) {
  return lagosParts.format(new Date(now)).replaceAll("-", "");
}

/** "202611" for the Lagos month containing `now`. */
export function lagosMonthKey(now = Date.now()) {
  return lagosDayKey(now).slice(0, 6);
}

/**
 * Decides one reply. Pure: given today's usage for the number, the month's
 * total and the limits, says whether to send and what to record.
 *
 * @returns {{ send: boolean, as: "reply"|"cap_notice"|null, reason: string|null,
 *   usage: object, budgetReplies: number }}
 *   `as: "cap_notice"` means: don't send the reply that was asked for — send
 *   the one-time "daily limit reached" message instead.
 */
export function decideReply({ kind, usage = {}, dailyLimit, budgetReplies = 0, budgetLimit }) {
  const next = {
    replies: usage.replies || 0,
    signupReplies: usage.signupReplies || 0,
    capNoticeSent: usage.capNoticeSent === true,
    unsupportedNoticeSent: usage.unsupportedNoticeSent === true,
  };
  const refuse = (reason) => ({ send: false, as: null, reason, usage: next, budgetReplies });
  const allow = (as = "reply") => ({ send: true, as, reason: null, usage: next, budgetReplies: budgetReplies + 1 });

  if (kind === REPLY_KINDS.CONFIRMATION) return allow();

  // Everything else is new work, which pauses once the month's budget is spent.
  if (budgetReplies >= budgetLimit) return refuse("monthly_budget");

  if (kind === REPLY_KINDS.SIGNUP) {
    if (next.signupReplies >= 1) return refuse("signup_already_sent");
    next.signupReplies += 1;
    return allow();
  }

  if (!COUNTED.has(kind)) return refuse("unknown_kind");

  if (next.replies >= dailyLimit) {
    if (next.capNoticeSent) return refuse("daily_cap");
    next.capNoticeSent = true;
    return allow("cap_notice");
  }
  if (kind === REPLY_KINDS.UNSUPPORTED) {
    if (next.unsupportedNoticeSent) return refuse("unsupported_already_sent");
    next.unsupportedNoticeSent = true;
  }
  next.replies += 1;
  return allow();
}

const usageRef = (db, phone, now) => db.collection("waUsage").doc(`${phone}_${lagosDayKey(now)}`);
const budgetRef = (db, now) => db.collection("waBudget").doc(lagosMonthKey(now));

/**
 * Reserves one reply for `phone` (transactional). Call before sending; if the
 * send then fails, hand the result to releaseReply.
 *
 * @param {object} options
 * @param {string} options.kind       one of REPLY_KINDS
 * @param {number} options.dailyLimit the sender's plan limit
 * @param {number} options.budgetLimit the month's reply budget
 * @param {number} options.alertAt    month total at which the team is alerted (once)
 * @returns {Promise<{ send, as, reason, alert: boolean, monthReplies: number, reservation: object|null }>}
 *   `alert` is true on the one reply that crosses `alertAt`.
 */
export async function reserveReply(db, { phone, uid = null, kind, dailyLimit, budgetLimit, alertAt, now = Date.now() }) {
  const uRef = usageRef(db, phone, now);
  const bRef = budgetRef(db, now);
  return db.runTransaction(async (tx) => {
    const [uSnap, bSnap] = [await tx.get(uRef), await tx.get(bRef)];
    const usage = uSnap.exists ? uSnap.data() : {};
    const budget = bSnap.exists ? bSnap.data() : {};
    const decision = decideReply({ kind, usage, dailyLimit, budgetReplies: budget.replies || 0, budgetLimit });
    if (!decision.send) {
      return { send: false, as: null, reason: decision.reason, alert: false, monthReplies: budget.replies || 0, reservation: null };
    }

    const alert = !budget.alertSentAt && decision.budgetReplies >= alertAt;
    tx.set(
      uRef,
      { phone, uid, date: lagosDayKey(now), ...decision.usage, updatedAt: new Date(now), expiresAt: new Date(now + USAGE_TTL_DAYS * DAY_MS) },
      { merge: true }
    );
    tx.set(
      bRef,
      { month: lagosMonthKey(now), replies: decision.budgetReplies, updatedAt: new Date(now), ...(alert ? { alertSentAt: new Date(now) } : {}) },
      { merge: true }
    );
    return {
      send: true,
      as: decision.as,
      reason: null,
      alert,
      monthReplies: decision.budgetReplies,
      // What to give back if the message never left: the daily count only for
      // a counted reply (a cap notice or confirmation didn't use one).
      reservation: { phone, now, countedDaily: decision.as === "reply" && COUNTED.has(kind) },
    };
  });
}

/** Gives a reservation back after a failed send. Best-effort; never throws. */
export async function releaseReply(db, reservation) {
  if (!reservation) return;
  const uRef = usageRef(db, reservation.phone, reservation.now);
  const bRef = budgetRef(db, reservation.now);
  try {
    await db.runTransaction(async (tx) => {
      const [uSnap, bSnap] = [await tx.get(uRef), await tx.get(bRef)];
      if (reservation.countedDaily && uSnap.exists) {
        tx.set(uRef, { replies: Math.max(0, (uSnap.data().replies || 0) - 1) }, { merge: true });
      }
      if (bSnap.exists) {
        tx.set(bRef, { replies: Math.max(0, (bSnap.data().replies || 0) - 1) }, { merge: true });
      }
    });
  } catch (error) {
    console.error("WhatsApp assistant: couldn't release a reply reservation:", error);
  }
}
