import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { toMillis } from "./kycAccess.js";

/**
 * Holding a seller's listings and pausing their plans while their KYC isn't
 * cleared — a provisional deadline passing (reason "kyc_expired") or an admin
 * revoking KYC ("kyc_revoked") — and undoing both when they clear KYC again.
 *
 * Listings: there's no availability field on products/services, and ~15
 * places read them, so a held listing MOVES to heldListings (server-only; the
 * owner can read their own — see firestore.rules) and comes back under the
 * same ID. Nothing else has to filter it out, and the seller can't un-hold it.
 *
 * Boosts pause with the listing: the remaining boost time is recorded on hold
 * and resumed on release, unless the listing was held longer than the lapse
 * window, in which case the boost lapses (as paused plans do).
 *
 * Plans (subscriptions/{uid}, one-off purchases with an expiry date): a pause
 * sets isActive false and stores the time left, so every reader of plans
 * (renewal reminders, VIP cleanup, seller tier, ranking, shop views) treats
 * it as inactive. Resume restores the time left. A plan paused longer than the
 * lapse window lapses.
 *
 * Everything here is idempotent and batched — safe to retry or run twice.
 */

const LISTING_COLLECTIONS = ["products", "services"];
const PLAN_KEYS = ["product", "service", "bundle"];
const BATCH_LIMIT = 400;
const DAY_MS = 24 * 60 * 60 * 1000;
const BOOST_FIELDS = ["isBoosted", "boostStartDate", "boostEndDate", "boostPlanId", "boostTier"];

export const HOLD_REASONS = Object.freeze({ EXPIRED: "kyc_expired", REVOKED: "kyc_revoked" });

async function commitInBatches(operations) {
  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const batch = adminDB.batch();
    operations.slice(i, i + BATCH_LIMIT).forEach((op) => op(batch));
    await batch.commit();
  }
}

/** Moves all of a user's products and services into heldListings. Returns how many. */
export async function holdListings(userId, reason) {
  const now = Date.now();
  const operations = [];
  for (const collection of LISTING_COLLECTIONS) {
    const snap = await adminDB.collection(collection).where("userId", "==", userId).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      const boostEnd = toMillis(data.boostEndDate);
      const heldRef = adminDB.collection("heldListings").doc(`${collection}_${doc.id}`);
      operations.push((batch) => {
        batch.set(heldRef, {
          collection,
          listingId: doc.id,
          userId,
          reason,
          heldAt: admin.firestore.Timestamp.fromMillis(now),
          boostRemainingMs: data.isBoosted && boostEnd && boostEnd > now ? boostEnd - now : null,
          data,
        });
        batch.delete(doc.ref);
      });
    }
  }
  await commitInBatches(operations);
  return operations.length;
}

/**
 * Puts all of a user's held listings back under their original IDs. A paused
 * boost resumes with the time it had left, unless the listing was held longer
 * than `lapseDays`, in which case the boost lapses. Returns how many.
 */
export async function releaseKycHold(userId, { lapseDays = 90 } = {}) {
  const now = Date.now();
  const snap = await adminDB.collection("heldListings").where("userId", "==", userId).get();
  const operations = snap.docs.map((held) => (batch) => {
    const { collection, listingId, heldAt, boostRemainingMs, data } = held.data();
    const restored = { ...data };
    if (boostRemainingMs) {
      const heldForMs = now - (toMillis(heldAt) ?? now);
      if (heldForMs <= lapseDays * DAY_MS) {
        restored.boostEndDate = admin.firestore.Timestamp.fromMillis(now + boostRemainingMs);
      } else {
        BOOST_FIELDS.forEach((field) => delete restored[field]);
        restored.isBoosted = false;
      }
    }
    batch.set(adminDB.collection(collection).doc(listingId), restored);
    batch.delete(held.ref);
  });
  await commitInBatches(operations);
  return operations.length;
}

/** Pauses every active plan the user has. Returns the plan keys paused. */
export async function pausePlans(userId, reason) {
  const ref = adminDB.collection("subscriptions").doc(userId);
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return [];
    const now = Date.now();
    const updates = {};
    const paused = [];
    for (const key of PLAN_KEYS) {
      const plan = snap.data()[key];
      const expiry = toMillis(plan?.expiryDate);
      if (!plan?.isActive || !expiry || expiry <= now || plan.pausedAt) continue;
      updates[`${key}.isActive`] = false;
      updates[`${key}.pausedAt`] = now;
      updates[`${key}.remainingMs`] = expiry - now;
      updates[`${key}.pausedReason`] = reason;
      // Resume writes the new expiry back in the same form this plan used.
      updates[`${key}.expiryFormat`] = typeof plan.expiryDate === "string" ? "iso" : "timestamp";
      paused.push(key);
    }
    if (paused.length) tx.update(ref, updates);
    return paused;
  });
}

/** Resumes every paused (not lapsed) plan with the time it had left. Returns the keys resumed. */
export async function resumePlans(userId) {
  const ref = adminDB.collection("subscriptions").doc(userId);
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return [];
    const now = Date.now();
    const del = admin.firestore.FieldValue.delete();
    const updates = {};
    const resumed = [];
    for (const key of PLAN_KEYS) {
      const plan = snap.data()[key];
      if (!plan?.pausedAt || plan.lapsedAt) continue;
      const newExpiry = now + (plan.remainingMs || 0);
      updates[`${key}.isActive`] = true;
      updates[`${key}.expiryDate`] =
        plan.expiryFormat === "iso" ? new Date(newExpiry).toISOString() : admin.firestore.Timestamp.fromMillis(newExpiry);
      for (const field of ["pausedAt", "remainingMs", "pausedReason", "expiryFormat"]) updates[`${key}.${field}`] = del;
      resumed.push(key);
    }
    if (resumed.length) tx.update(ref, updates);
    return resumed;
  });
}

/** Lapses plans paused for longer than `lapseDays` (they stay inactive for good). Returns the keys lapsed. */
export async function lapsePausedPlans(userId, { lapseDays = 90 } = {}) {
  const ref = adminDB.collection("subscriptions").doc(userId);
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return [];
    const now = Date.now();
    const updates = {};
    const lapsed = [];
    for (const key of PLAN_KEYS) {
      const plan = snap.data()[key];
      if (!plan?.pausedAt || plan.lapsedAt || now - plan.pausedAt <= lapseDays * DAY_MS) continue;
      updates[`${key}.lapsedAt`] = now;
      updates[`${key}.remainingMs`] = admin.firestore.FieldValue.delete();
      lapsed.push(key);
    }
    if (lapsed.length) tx.update(ref, updates);
    return lapsed;
  });
}
