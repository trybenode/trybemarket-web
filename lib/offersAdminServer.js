import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import {
  GrantError, MAX_BOOSTS_PER_GIFT, applyPromotion, grantBoosts, grantPlan,
  loadGrantablePlan, validDays, verifiedStudentsInOrder,
} from "./planGrantServer.js";

/**
 * Admin actions behind /api/admin/offers/* (09-offers.md), called from the
 * admin app's Offers page through its relay. The rules live in
 * lib/planGrantServer.js; this file validates input and shapes responses.
 */

// Per request: the admin app's relay waits ~15s, and each grant is a
// transaction plus a ranking re-sync. The Offers page sends bigger gifts in
// chunks of this size.
export const MAX_GIFT_RECIPIENTS = 25;

export async function adminName(uid) {
  const snap = await adminDB.collection("admins").doc(uid).get();
  const d = snap.exists ? snap.data() : {};
  return d.name || d.displayName || d.email || "Admin";
}

const tsIso = (v) => (v?.toDate ? v.toDate().toISOString() : v || null);

export async function getOffersOverview() {
  const [plansSnap, promosSnap, grantsSnap] = await Promise.all([
    adminDB.collection("subscriptionPlans").get(),
    adminDB.collection("promotions").orderBy("createdAt", "desc").limit(50).get(),
    adminDB.collection("planGrants").orderBy("createdAt", "desc").limit(50).get(),
  ]);

  const plans = plansSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => ["product", "service", "bundle"].includes(p.category) && Number(p.price) > 0 && !p.id.endsWith("_free"))
    .map((p) => ({ id: p.id, name: p.name, category: p.category, price: p.price, cycle: p.cycle }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.price - b.price);

  const grantDocs = grantsSnap.docs;
  const users = grantDocs.length
    ? await adminDB.getAll(...[...new Set(grantDocs.map((d) => d.data().uid))].map((uid) => adminDB.collection("users").doc(uid)))
    : [];
  const userInfo = Object.fromEntries(users.map((u) => [u.id, u.exists ? { name: u.data().fullName || "", email: u.data().email || "", school: u.data().selectedUniversity || "" } : {}]));

  return {
    plans,
    promotions: promosSnap.docs.map((d) => {
      const p = d.data();
      return { id: d.id, ...p, createdAt: tsIso(p.createdAt) };
    }),
    grants: grantDocs.map((d) => {
      const g = d.data();
      return {
        id: d.id,
        uid: g.uid,
        user: userInfo[g.uid] || {},
        kind: g.kind,
        planId: g.planId || null,
        planName: g.planName || null,
        action: g.action || null,
        durationDays: g.durationDays,
        count: g.count || null,
        expiresAt: g.expiresAt || null,
        source: g.source || {},
        status: g.status,
        createdAt: tsIso(g.createdAt),
        revokedAt: tsIso(g.revokedAt),
      };
    }),
  };
}

/** Gift a plan or boosts to a list of users. Returns per-user results and totals. */
export async function giftToUsers({ userIds, kind, planId, durationDays, boostCount, note }, { adminUid }) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : []).filter((id) => typeof id === "string" && id))];
  if (ids.length === 0) throw new GrantError("Choose at least one person.");
  if (ids.length > MAX_GIFT_RECIPIENTS) throw new GrantError(`At most ${MAX_GIFT_RECIPIENTS} people per gift.`);

  const days = validDays(durationDays);
  const source = { type: "gift", adminUid, adminName: await adminName(adminUid), note: String(note || "").slice(0, 200) };
  let plan = null;
  let count = 0;
  if (kind === "plan") {
    plan = await loadGrantablePlan(planId);
  } else if (kind === "boost") {
    count = Number(boostCount);
    if (!Number.isInteger(count) || count < 1 || count > MAX_BOOSTS_PER_GIFT) {
      throw new GrantError(`Give between 1 and ${MAX_BOOSTS_PER_GIFT} boosts.`);
    }
  } else {
    throw new GrantError("Choose what to give.");
  }

  const results = [];
  for (const uid of ids) {
    try {
      const r = kind === "plan"
        ? await grantPlan(uid, { plan, durationDays: days, source })
        : await grantBoosts(uid, { count, durationDays: days, source });
      results.push({ uid, ...r });
    } catch (error) {
      console.error(`Gift to ${uid} failed:`, error);
      results.push({ uid, status: "failed", reason: "Something went wrong" });
    }
  }
  const tally = (s) => results.filter((r) => r.status === s).length;
  return { results, granted: tally("granted"), extended: tally("extended"), skipped: tally("skipped"), failed: tally("failed") };
}

export async function createPromotion({ name, school, planId, durationDays, cap }, { adminUid }) {
  const promoName = String(name || "").trim().slice(0, 100);
  if (!promoName) throw new GrantError("Give the promotion a name.");
  const schoolName = String(school || "").trim();
  if (!schoolName) throw new GrantError("Choose a school.");
  const limit = Number(cap);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100000) throw new GrantError("The number of spots must be a whole number above 0.");
  const plan = await loadGrantablePlan(planId);
  const days = validDays(durationDays);

  const ref = adminDB.collection("promotions").doc();
  await ref.set({
    name: promoName,
    school: schoolName,
    planId: plan.id,
    planName: plan.name,
    durationDays: days,
    cap: limit,
    granted: 0,
    status: "active",
    trigger: "kyc_verified",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: { uid: adminUid, name: await adminName(adminUid) },
  });
  return { id: ref.id };
}

/**
 * Gives a promotion to students already verified at its school, earliest
 * first, until it's full. Handles at most `maxAttempts` new students per
 * call (people already handled are skipped quickly) and says whether more
 * remain — the Offers page calls it again until `remaining` is false.
 */
export async function applyPromotionToVerified(promotionId, { maxAttempts = 8 } = {}) {
  const snap = await adminDB.collection("promotions").doc(promotionId).get();
  if (!snap.exists) throw new GrantError("Promotion not found.", 404);
  const promo = snap.data();
  if (promo.status !== "active") throw new GrantError(`The promotion is ${promo.status}.`);

  const students = await verifiedStudentsInOrder(promo.school);
  const summary = { checked: 0, granted: 0, extended: 0, skipped: 0, already: 0, full: false, remaining: false };
  let attempts = 0;
  for (const { uid } of students) {
    if (attempts >= maxAttempts) { summary.remaining = true; break; }
    const r = await applyPromotion(promotionId, uid, { school: promo.school });
    summary.checked++;
    if (r.status === "full") { summary.full = true; break; }
    if (r.status in summary) summary[r.status]++;
    if (r.status !== "already") attempts++;
  }
  return summary;
}

export async function updatePromotion(promotionId, { action, cap }) {
  const ref = adminDB.collection("promotions").doc(promotionId);
  return adminDB.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new GrantError("Promotion not found.", 404);
    const p = snap.data();
    if (action === "pause") {
      if (p.status !== "active") throw new GrantError(`Only an active promotion can be paused (it's ${p.status}).`);
      tx.update(ref, { status: "paused" });
    } else if (action === "resume") {
      if (p.status !== "paused") throw new GrantError(`Only a paused promotion can be resumed (it's ${p.status}).`);
      tx.update(ref, { status: (p.granted || 0) >= p.cap ? "full" : "active" });
    } else if (action === "end") {
      tx.update(ref, { status: "ended" });
    } else if (action === "setCap") {
      const limit = Number(cap);
      if (!Number.isInteger(limit) || limit < (p.granted || 0)) {
        throw new GrantError(`Spots can't go below the ${p.granted || 0} already given.`);
      }
      const status = p.status === "full" && limit > (p.granted || 0) ? "active" : p.status === "active" && limit <= (p.granted || 0) ? "full" : p.status;
      tx.update(ref, { cap: limit, status });
    } else {
      throw new GrantError("Unknown action.");
    }
    return { ok: true };
  });
}
