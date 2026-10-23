import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { syncSellerTierAdmin } from "./subscriptionFulfillment.js";
import { isPlanActive, planExpiryMs } from "./planStatus.js";
import { notifyPlanGrant } from "./planGrantNotify.js";

/**
 * Free plans and boosts given by TrybeMarket (09-offers.md): admin gifts and
 * automatic promotions ("the first N students to verify KYC at school X").
 *
 * A granted plan is a normal subscriptions/{uid}.{slot} entry, so every
 * entitlement check, the KYC pause/resume (lib/kycHold.js) and the nightly
 * expiry job treat it exactly like a paid one. It never writes
 * subscriptionPayments — a free grant isn't revenue, and must not count as a
 * "paid month" for Maintenance-plan eligibility.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_GRANT_DAYS = 366;
export const MAX_BOOSTS_PER_GIFT = 10;

export class GrantError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const grantsRef = () => adminDB.collection("planGrants");
const promotionsRef = () => adminDB.collection("promotions");

// Higher = better. Bundles count as premium (they grant premium-level product + service).
function tierRank(planId) {
  if (!planId) return 0;
  if (planId.endsWith("_vip")) return 2;
  if (planId.endsWith("_premium") || planId.startsWith("bundle_")) return 1;
  return 0;
}

const slotFor = (plan) => (plan.category === "bundle" ? "bundle" : plan.category);

// Freemium entries ("product_free", "Freemium", "free-tier") are what everyone
// has anyway — a gift replaces them rather than being blocked by them.
const isFreePlan = (plan) => !plan?.planId || /(_free|^freemium$|^free-tier$)/i.test(plan.planId);
const hasPaidPlan = (plan, now) => isPlanActive(plan, now) && !isFreePlan(plan);

/** A plan that can be given away: an existing, paid product/service/bundle plan. */
export async function loadGrantablePlan(planId) {
  if (typeof planId !== "string" || !planId) throw new GrantError("Choose a plan.");
  const snap = await adminDB.collection("subscriptionPlans").doc(planId).get();
  if (!snap.exists) throw new GrantError(`Plan "${planId}" doesn't exist.`);
  const plan = { id: snap.id, ...snap.data() };
  if (!["product", "service", "bundle"].includes(plan.category)) {
    throw new GrantError(`"${plan.name}" can't be given as a plan (category ${plan.category}).`);
  }
  if (!(Number(plan.price) > 0) || plan.id.endsWith("_free") || plan.type === "free") {
    throw new GrantError(`"${plan.name}" is already free.`);
  }
  return plan;
}

export function validDays(value) {
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > MAX_GRANT_DAYS) {
    throw new GrantError(`Duration must be a whole number of days between 1 and ${MAX_GRANT_DAYS}.`);
  }
  return days;
}

/**
 * What granting `plan` for `durationMs` does to a user's subscriptions
 * (09-offers.md §3). Pure, so it can be tested without Firestore.
 * @returns {{ action: "granted" | "extended" | "skipped", reason?, slot, expiryMs? }}
 */
export function decidePlanGrant(subs, plan, durationMs, now = Date.now()) {
  const slot = slotFor(plan);
  const current = subs?.[slot];

  if (current?.pausedAt && !current.lapsedAt) {
    return { action: "skipped", slot, reason: "Their plan is paused until they re-verify KYC" };
  }
  // A bundle overrides individual plans for limits, so it must not sit on top of a VIP plan...
  if (slot === "bundle") {
    for (const key of ["product", "service"]) {
      if (hasPaidPlan(subs?.[key], now) && tierRank(subs[key].planId) > tierRank(plan.id)) {
        return { action: "skipped", slot, reason: `They already have a better ${key} plan (${subs[key].planName || subs[key].planId})` };
      }
    }
  } else if (hasPaidPlan(subs?.bundle, now)) {
    // ...and a product/service gift under an active bundle would do nothing.
    return { action: "skipped", slot, reason: "They already have an active bundle" };
  }

  if (hasPaidPlan(current, now)) {
    if (current.planId === plan.id) {
      return { action: "extended", slot, expiryMs: (planExpiryMs(current) || now) + durationMs };
    }
    return { action: "skipped", slot, reason: `They already have an active ${current.planName || current.planId} plan` };
  }
  return { action: "granted", slot, expiryMs: now + durationMs };
}

/**
 * Gives one user a plan for `durationDays`. Returns
 * { status: "granted" | "extended" | "skipped", grantId?, reason?, expiresAt? }.
 */
export async function grantPlan(uid, { plan, durationDays, source }) {
  const durationMs = durationDays * DAY_MS;
  const subRef = adminDB.collection("subscriptions").doc(uid);
  const grantRef = grantsRef().doc();

  const result = await adminDB.runTransaction(async (tx) => {
    const [subSnap, userSnap] = await Promise.all([tx.get(subRef), tx.get(adminDB.collection("users").doc(uid))]);
    if (!userSnap.exists) return { status: "skipped", reason: "No such user" };

    const now = Date.now();
    const subs = subSnap.exists ? subSnap.data() : {};
    const decision = decidePlanGrant(subs, plan, durationMs, now);
    if (decision.action === "skipped") return { status: "skipped", reason: decision.reason };

    const { slot } = decision;
    const nowIso = new Date(now).toISOString();
    if (decision.action === "extended") {
      // Keep the expiry in the form this plan already uses.
      const current = subs[slot];
      const expiry = typeof current.expiryDate === "string"
        ? new Date(decision.expiryMs).toISOString()
        : admin.firestore.Timestamp.fromMillis(decision.expiryMs);
      tx.update(subRef, { [`${slot}.expiryDate`]: expiry, [`${slot}.lastGrantId`]: grantRef.id });
    } else {
      tx.set(subRef, {
        [slot]: {
          planId: plan.id,
          planName: plan.name,
          category: plan.category,
          amount: 0,
          isActive: true,
          subscribedAt: nowIso,
          expiryDate: new Date(decision.expiryMs).toISOString(),
          features: plan.features || [],
          limits: plan.limits || {},
          paymentReference: null,
          autoRenew: false,
          grantId: grantRef.id,
        },
      }, { merge: true });
    }

    tx.set(grantRef, {
      uid,
      kind: "plan",
      planId: plan.id,
      planName: plan.name,
      slot,
      durationDays,
      action: decision.action,
      expiresAt: new Date(decision.expiryMs).toISOString(),
      source,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { status: decision.action, grantId: grantRef.id, expiresAt: new Date(decision.expiryMs).toISOString() };
  });

  // Ranking follows the new tier. Best-effort, like after a purchase.
  if (result.status !== "skipped") await syncSellerTierAdmin(uid);
  return result;
}

/** Gives one user `count` unused boost credits, each lasting `durationDays` once applied. */
export async function grantBoosts(uid, { count, durationDays, source }) {
  const userSnap = await adminDB.collection("users").doc(uid).get();
  if (!userSnap.exists) return { status: "skipped", reason: "No such user" };

  const grantRef = grantsRef().doc();
  const creditIds = Array.from({ length: count }, (_, i) => `${grantRef.id}_${i + 1}`);
  const batch = adminDB.batch();
  for (const creditId of creditIds) {
    batch.set(adminDB.collection("boostCredits").doc(creditId), {
      userId: uid,
      planId: "boost_7days",
      tier: "gift",
      durationDays,
      reference: creditId,
      status: "unused",
      grantId: grantRef.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  batch.set(grantRef, {
    uid,
    kind: "boost",
    count,
    durationDays,
    creditIds,
    source,
    status: "active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { status: "granted", grantId: grantRef.id };
}

/**
 * Takes back a grant. Plans: a granted entry ends now; an extension is
 * removed (never earlier than now). Only touched while the subscription
 * still carries this grant — a plan the user has since bought is left alone.
 * Boosts: unused credits are cancelled; used ones can't be taken back.
 */
export async function revokeGrant(grantId, { adminUid }) {
  const grantRef = grantsRef().doc(String(grantId));
  const outcome = await adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(grantRef);
    if (!snap.exists) throw new GrantError("Gift not found.", 404);
    const grant = snap.data();
    if (grant.status !== "active") throw new GrantError("This gift was already revoked.");
    const now = Date.now();
    const revoked = { status: "revoked", revokedAt: admin.firestore.FieldValue.serverTimestamp(), revokedBy: adminUid };

    if (grant.kind === "boost") {
      const creditSnaps = await Promise.all(grant.creditIds.map(id => tx.get(adminDB.collection("boostCredits").doc(id))));
      let cancelled = 0;
      for (const credit of creditSnaps) {
        if (credit.exists && credit.data().status === "unused") {
          tx.update(credit.ref, { status: "revoked", revokedAt: admin.firestore.FieldValue.serverTimestamp() });
          cancelled++;
        }
      }
      tx.update(grantRef, { ...revoked, cancelledCredits: cancelled });
      return { uid: grant.uid, kind: "boost", cancelled, alreadyUsed: grant.creditIds.length - cancelled };
    }

    const subRef = adminDB.collection("subscriptions").doc(grant.uid);
    const subSnap = await tx.get(subRef);
    const entry = subSnap.exists ? subSnap.data()[grant.slot] : null;
    let changed = false;
    if (entry && grant.action === "granted" && entry.grantId === grantId) {
      tx.update(subRef, {
        [`${grant.slot}.isActive`]: false,
        [`${grant.slot}.expiryDate`]: new Date(now).toISOString(),
        [`${grant.slot}.revokedAt`]: new Date(now).toISOString(),
      });
      changed = true;
    } else if (entry && grant.action === "extended" && entry.planId === grant.planId) {
      const expiryMs = Math.max(now, (planExpiryMs(entry) || now) - grant.durationDays * DAY_MS);
      tx.update(subRef, {
        [`${grant.slot}.expiryDate`]: typeof entry.expiryDate === "string"
          ? new Date(expiryMs).toISOString()
          : admin.firestore.Timestamp.fromMillis(expiryMs),
      });
      changed = true;
    }
    tx.update(grantRef, revoked);
    return { uid: grant.uid, kind: "plan", planChanged: changed };
  });

  if (outcome.kind === "plan" && outcome.planChanged) await syncSellerTierAdmin(outcome.uid);
  return outcome;
}

// ─────────────────────────────────────────
// PROMOTIONS
// ─────────────────────────────────────────

/**
 * Applies one promotion to one user, if they qualify and a spot is left.
 * A spot is reserved in a transaction first (so the cap is never exceeded),
 * then released if the plan grant is skipped. Idempotent per user via
 * promotionGrants/{promotionId}_{uid}.
 * Returns { status: "granted" | "extended" | "skipped" | "not_eligible" | "full" | "already", reason? }.
 */
export async function applyPromotion(promotionId, uid, { school } = {}) {
  const promoRef = promotionsRef().doc(promotionId);
  const markerRef = adminDB.collection("promotionGrants").doc(`${promotionId}_${uid}`);

  const reserved = await adminDB.runTransaction(async (tx) => {
    const [promoSnap, markerSnap] = await Promise.all([tx.get(promoRef), tx.get(markerRef)]);
    if (!promoSnap.exists) return { status: "not_eligible", reason: "Promotion not found" };
    const promo = promoSnap.data();
    if (markerSnap.exists) return { status: "already" };
    if (school !== promo.school) return { status: "not_eligible", reason: "Different school" };
    if (promo.status === "full" || (promo.status === "active" && (promo.granted || 0) >= promo.cap)) {
      if (promo.status === "active") tx.update(promoRef, { status: "full" });
      return { status: "full" };
    }
    if (promo.status !== "active") return { status: "not_eligible", reason: `Promotion is ${promo.status}` };
    const granted = (promo.granted || 0) + 1;
    tx.update(promoRef, { granted, ...(granted >= promo.cap ? { status: "full" } : {}) });
    tx.set(markerRef, { promotionId, uid, status: "reserved", at: admin.firestore.FieldValue.serverTimestamp() });
    return { status: "reserved", promo };
  });
  if (reserved.status !== "reserved") return reserved;

  const { promo } = reserved;
  let result;
  let plan = null;
  try {
    plan = await loadGrantablePlan(promo.planId);
    result = await grantPlan(uid, {
      plan,
      durationDays: promo.durationDays,
      source: { type: "promotion", promotionId, promotionName: promo.name },
    });
  } catch (error) {
    result = { status: "skipped", reason: error.message || "Grant failed" };
  }

  if (result.status === "skipped") {
    // Give the spot back: someone who didn't get the plan shouldn't use one up.
    await adminDB.runTransaction(async (tx) => {
      const snap = await tx.get(promoRef);
      const data = snap.data();
      tx.update(promoRef, {
        granted: Math.max(0, (data.granted || 1) - 1),
        ...(data.status === "full" ? { status: "active" } : {}),
      });
      tx.set(markerRef, { promotionId, uid, status: "skipped", reason: result.reason, at: admin.firestore.FieldValue.serverTimestamp() });
    });
    return result;
  }
  await markerRef.set({ promotionId, uid, status: "granted", grantId: result.grantId, at: admin.firestore.FieldValue.serverTimestamp() });

  // Tell them (email, and WhatsApp if they have alerts on). Best-effort, and
  // only here — after their one marker is written — so nobody is told twice.
  const notified = await notifyPlanGrant(uid, {
    plan, durationDays: promo.durationDays, expiresAt: result.expiresAt, action: result.status,
  });
  await markerRef.update({ notified }).catch(() => {});
  return { ...result, notified };
}

/**
 * Called after a student's KYC is fully verified (lib/kycServer.js
 * finalizeKyc). Applies every active KYC-triggered promotion for their
 * school. Never throws — KYC must not depend on promotions.
 */
export async function maybeGrantPromotions(uid) {
  try {
    const userSnap = await adminDB.collection("users").doc(uid).get();
    const school = userSnap.exists ? userSnap.data().selectedUniversity : null;
    if (!school) return [];
    const promos = await promotionsRef().where("status", "==", "active").get();
    const results = [];
    for (const doc of promos.docs) {
      const promo = doc.data();
      if (promo.trigger !== "kyc_verified" || promo.school !== school) continue;
      results.push({ promotionId: doc.id, ...(await applyPromotion(doc.id, uid, { school })) });
    }
    return results;
  } catch (error) {
    console.error(`Promotions: couldn't check ${uid}:`, error);
    return [];
  }
}

/**
 * Students already fully verified at the promotion's school, earliest
 * verification first — so "the first N to verify" includes people who
 * verified before the promotion existed.
 */
export async function verifiedStudentsInOrder(school) {
  const [usersSnap, kycSnap] = await Promise.all([
    adminDB.collection("users").where("selectedUniversity", "==", school).get(),
    adminDB.collection("kycRequests").where("status", "==", "verified").get(),
  ]);
  const verifiedAt = new Map();
  kycSnap.forEach((doc) => {
    const d = doc.data();
    const when = d.reviewedAt || d.updatedAt || d.submittedAt;
    const ms = when?.toMillis ? when.toMillis() : when ? Date.parse(when) : null;
    if (d.userId) verifiedAt.set(d.userId, Number.isFinite(ms) ? ms : Number.MAX_SAFE_INTEGER);
  });
  return usersSnap.docs
    .filter((doc) => doc.data().isVerified === true && doc.data().kycLevel !== "provisional")
    .map((doc) => ({ uid: doc.id, verifiedAtMs: verifiedAt.get(doc.id) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.verifiedAtMs - b.verifiedAtMs);
}
