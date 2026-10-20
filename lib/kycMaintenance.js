import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { isKycCleared, isProvisionalActive, toMillis } from "./kycAccess.js";
import { getKycConfig } from "./kycConfig.js";
import { HOLD_REASONS, holdListings, lapsePausedPlans, pausePlans, releaseKycHold, resumePlans } from "./kycHold.js";

/**
 * The daily KYC job (app/api/kyc/daily-maintenance). Every step is idempotent —
 * running it twice, or after a failed run, changes nothing it already did.
 *
 *  1. Expire: a provisional student past their deadline gets their listings
 *     held (kyc_expired), their plans paused, kycExpiredAt set, and one email.
 *     (The rules already stop new listings the moment the deadline passes;
 *     this does the rest within a day.) Already-expired students are re-held
 *     too, which catches a hold that failed part-way.
 *  2. Revoked: a revoked student's listings and plans are held/paused again —
 *     revoke does it immediately; this catches a failure.
 *  3. Reconcile: anyone cleared again (upgraded or re-approved) with held
 *     listings or paused plans gets them back — the decision does it
 *     immediately; this catches a failure.
 *  4. Lapse: plans paused longer than pausedPlanLapseDays lapse.
 *  5. Reminders: 90, 30, 14 and 3 days before the deadline, once each, saying
 *     listings will become unavailable and the plan paused — they may lose
 *     their subscription — unless they verify with a student ID.
 *
 * `sendEmail({ userId, kind, daysLeft?, expiresAt })` is passed in so the job
 * can be tested without sending email.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const REMINDER_DAYS = [90, 30, 14, 3];

/** Days until the deadline, rounded up (a deadline later today is 1 day). */
export function daysUntil(expiresAtMs, now) {
  return Math.ceil((expiresAtMs - now) / DAY_MS);
}

/**
 * Which reminder (if any) is due: the SMALLEST threshold the student is
 * within that hasn't been sent — so a missed run sends one reminder, not a
 * backlog. Returns null when nothing is due.
 */
export function dueReminder(daysLeft, alreadySent) {
  if (daysLeft <= 0) return null; // the expiry email covers the day itself
  const due = REMINDER_DAYS.filter((d) => daysLeft <= d && !alreadySent.includes(d));
  return due.length ? Math.min(...due) : null;
}

export async function runKycMaintenance({ now = Date.now(), sendEmail }) {
  const config = await getKycConfig();
  const summary = { expired: 0, rehold: 0, revokedRehold: 0, reconciled: 0, lapsed: 0, reminders: 0, errors: [] };
  const note = (step, userId, error) => {
    console.error(`KYC maintenance (${step}) failed for ${userId}:`, error);
    summary.errors.push({ step, userId, message: String(error?.message || error).slice(0, 200) });
  };

  // 1. Expire provisional students past their deadline. Only provisional
  //    students carry provisionalExpiresAt (it's cleared on upgrade and on
  //    revoke), so a single-field range query finds them.
  const pastDeadline = await adminDB
    .collection("users")
    .where("provisionalExpiresAt", "<=", admin.firestore.Timestamp.fromMillis(now))
    .get();
  for (const doc of pastDeadline.docs) {
    const user = doc.data();
    if (user.kycLevel !== "provisional" || user.isVerified === true) continue;
    try {
      // Mark it first, in a transaction, so a concurrent run can't double-email.
      const firstTime = await adminDB.runTransaction(async (tx) => {
        const fresh = (await tx.get(doc.ref)).data() || {};
        if (fresh.kycLevel !== "provisional" || isProvisionalActive(fresh, now) || fresh.kycExpiredAt) return false;
        tx.update(doc.ref, { kycExpiredAt: admin.firestore.Timestamp.fromMillis(now) });
        return true;
      });
      const held = await holdListings(doc.id, HOLD_REASONS.EXPIRED, { now });
      await pausePlans(doc.id, HOLD_REASONS.EXPIRED, { now });
      if (firstTime) {
        summary.expired++;
        await sendEmail({ userId: doc.id, kind: "expired", expiresAt: toMillis(user.provisionalExpiresAt) }).catch((e) =>
          note("expiry email", doc.id, e)
        );
      } else if (held) {
        summary.rehold++;
      }
    } catch (error) {
      note("expire", doc.id, error);
    }
  }

  // 2. Revoked students: hold anything a failed revoke left live.
  const revoked = await adminDB.collection("users").where("kycRevokedAt", ">", admin.firestore.Timestamp.fromMillis(0)).get();
  for (const doc of revoked.docs) {
    if (isKycCleared(doc.data(), now)) continue;
    try {
      const held = await holdListings(doc.id, HOLD_REASONS.REVOKED, { now });
      await pausePlans(doc.id, HOLD_REASONS.REVOKED, { now });
      if (held) summary.revokedRehold++;
    } catch (error) {
      note("revoked", doc.id, error);
    }
  }

  // 3. Reconcile: cleared again but still holding listings or paused plans.
  const candidates = new Set();
  (await adminDB.collection("heldListings").select("userId").get()).docs.forEach((d) => candidates.add(d.data().userId));
  const subscriptions = await adminDB.collection("subscriptions").get();
  const pausedPlanUsers = subscriptions.docs
    .filter((d) => Object.values(d.data()).some((plan) => plan && typeof plan === "object" && plan.pausedAt && !plan.lapsedAt))
    .map((d) => d.id);
  pausedPlanUsers.forEach((id) => candidates.add(id));
  for (const userId of candidates) {
    try {
      const user = (await adminDB.collection("users").doc(userId).get()).data();
      if (!isKycCleared(user, now)) continue;
      const released = await releaseKycHold(userId, { lapseDays: config.pausedPlanLapseDays, now });
      const resumed = await resumePlans(userId, { now });
      if (released || resumed.length) summary.reconciled++;
    } catch (error) {
      note("reconcile", userId, error);
    }
  }

  // 4. Lapse plans paused too long.
  for (const userId of pausedPlanUsers) {
    try {
      const lapsed = await lapsePausedPlans(userId, { lapseDays: config.pausedPlanLapseDays, now });
      summary.lapsed += lapsed.length;
    } catch (error) {
      note("lapse", userId, error);
    }
  }

  // 5. Reminders for provisional students within 90 days of their deadline.
  const upcoming = await adminDB
    .collection("users")
    .where("provisionalExpiresAt", ">", admin.firestore.Timestamp.fromMillis(now))
    .where("provisionalExpiresAt", "<=", admin.firestore.Timestamp.fromMillis(now + Math.max(...REMINDER_DAYS) * DAY_MS))
    .get();
  for (const doc of upcoming.docs) {
    const user = doc.data();
    if (user.kycLevel !== "provisional" || user.isVerified === true) continue;
    const expiresAt = toMillis(user.provisionalExpiresAt);
    try {
      const reminder = await claimReminder(doc.id, expiresAt, daysUntil(expiresAt, now));
      if (!reminder) continue;
      try {
        await sendEmail({ userId: doc.id, kind: "reminder", daysLeft: daysUntil(expiresAt, now), expiresAt });
        summary.reminders++;
      } catch (error) {
        await releaseReminder(doc.id, reminder); // let tomorrow's run retry
        throw error;
      }
    } catch (error) {
      note("reminder", doc.id, error);
    }
  }

  return summary;
}

/**
 * Claims the due reminder in kycReminders/{uid} (server-only), so it's sent at
 * most once. The record is tied to the deadline: a re-approval with a new
 * deadline starts the reminders afresh. Returns the threshold claimed, or null.
 */
async function claimReminder(userId, expiresAt, daysLeft) {
  const ref = adminDB.collection("kycReminders").doc(userId);
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const record = snap.exists && snap.data().forExpiresAt === expiresAt ? snap.data() : { forExpiresAt: expiresAt, sent: [] };
    const due = dueReminder(daysLeft, record.sent);
    if (due === null) return null;
    // Every larger threshold counts as sent too — they're past.
    const sent = [...new Set([...record.sent, ...REMINDER_DAYS.filter((d) => d >= due)])].sort((a, b) => b - a);
    tx.set(ref, { forExpiresAt: expiresAt, sent, lastSentAt: admin.firestore.FieldValue.serverTimestamp() });
    return due;
  });
}

async function releaseReminder(userId, threshold) {
  const ref = adminDB.collection("kycReminders").doc(userId);
  await ref.update({ sent: admin.firestore.FieldValue.arrayRemove(threshold) }).catch(() => {});
}
