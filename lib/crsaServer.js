import admin from "firebase-admin";
import crypto from "crypto";
import { adminDB, adminAuth } from "./firebaseAdmin.js";
import { awardBadgeOnce } from "./badgeServer.js";
import { BADGE_KEYS } from "./badgeConstants.js";
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REFERRAL_ATTACH_WINDOW_MS,
  REFERRAL_VELOCITY_FLAG_THRESHOLD,
  REFERRAL_VELOCITY_WINDOW_MS,
  normalizeReferralCode,
} from "./crsaConstants.js";

/**
 * CRSA (Course Rep Student Ambassador) referral program — 04-crsa-affiliate-
 * program.md. Everything here runs server-side (Admin SDK); none of these
 * collections are client-writable (see firestore.rules):
 *
 *   crsaMembers/{uid}                       { referralCode, joinedAt, active, addedBy, deactivatedAt? }
 *   crsaCodes/{code}                        { uid }   — atomic code uniqueness + O(1) code->uid lookup
 *   crsaStats/{uid}                         { kycCompletions, installs, updatedAt }
 *   crsaStats/{uid}/referrals/{referredUid} { countedAt }   — fixed-ID idempotency marker
 *   users/{uid}.referredBy                  the referral CODE used at signup (server-set only)
 *
 * NOT part of the App Credit system: no credit is earned through any of it.
 */

export class CrsaError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function generateReferralCode() {
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_ALPHABET[crypto.randomInt(REFERRAL_CODE_ALPHABET.length)];
  }
  return code;
}

const MAX_CODE_ATTEMPTS = 8;

// --- Membership ------------------------------------------------------------

/**
 * Adds a user as a CRSA member, or reactivates a previously deactivated one
 * (keeping the SAME referral code, so links they already shared keep
 * working). Idempotent: calling it for an already-active member is a no-op.
 *
 * The referral code is claimed in the same transaction as the member doc
 * (crsaCodes/{code}), so two concurrent adds can never end up sharing a code.
 */
export async function createOrReactivateMember(adminUid, targetUid) {
  const userSnap = await adminDB.collection("users").doc(targetUid).get();
  if (!userSnap.exists) {
    throw new CrsaError("User not found", 404);
  }

  const memberRef = adminDB.collection("crsaMembers").doc(targetUid);
  const statsRef = adminDB.collection("crsaStats").doc(targetUid);

  let outcome = null;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !outcome; attempt++) {
    const candidateCode = generateReferralCode();
    const codeRef = adminDB.collection("crsaCodes").doc(candidateCode);

    outcome = await adminDB.runTransaction(async (tx) => {
      const memberSnap = await tx.get(memberRef);

      if (memberSnap.exists) {
        const existing = memberSnap.data();
        if (existing.active) {
          return { created: false, reactivated: false, referralCode: existing.referralCode };
        }
        tx.update(memberRef, { active: true, deactivatedAt: admin.firestore.FieldValue.delete() });
        return { created: false, reactivated: true, referralCode: existing.referralCode };
      }

      const [codeSnap, statsSnap] = await Promise.all([tx.get(codeRef), tx.get(statsRef)]);
      if (codeSnap.exists) return null; // collision — retry with a new code

      tx.set(memberRef, {
        referralCode: candidateCode,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        active: true,
        addedBy: adminUid,
      });
      tx.set(codeRef, { uid: targetUid });
      if (!statsSnap.exists) {
        tx.set(statsRef, {
          kycCompletions: 0,
          installs: 0,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      return { created: true, reactivated: false, referralCode: candidateCode };
    });
  }

  if (!outcome) {
    throw new CrsaError("Could not allocate a unique referral code — please retry", 503);
  }

  // Idempotent by the badge doc's existence (lib/badgeServer.js).
  await awardBadgeOnce(targetUid, { badgeKey: BADGE_KEYS.CRSA_MEMBER });

  return { uid: targetUid, active: true, ...outcome };
}

/** Deactivates/reactivates an existing member. Deactivating removes the badge. */
export async function setMemberActive(uid, active) {
  const memberRef = adminDB.collection("crsaMembers").doc(uid);
  const memberSnap = await memberRef.get();
  if (!memberSnap.exists) {
    throw new CrsaError("CRSA member not found", 404);
  }

  await memberRef.update(
    active
      ? { active: true, deactivatedAt: admin.firestore.FieldValue.delete() }
      : { active: false, deactivatedAt: admin.firestore.FieldValue.serverTimestamp() }
  );

  const badgeRef = adminDB.collection("users").doc(uid).collection("badges").doc(BADGE_KEYS.CRSA_MEMBER);
  if (active) {
    await awardBadgeOnce(uid, { badgeKey: BADGE_KEYS.CRSA_MEMBER });
  } else {
    await badgeRef.delete();
  }

  return { uid, active, referralCode: memberSnap.data().referralCode };
}

// --- Attribution -----------------------------------------------------------

/**
 * Attaches a referral code to a NEW user (users/{uid}.referredBy). Called
 * from /api/user/on-signup with the code the client captured from ?ref=.
 * Nothing about the request is trusted beyond "this signed-in user says they
 * arrived via code X" — every condition is checked here against server-side
 * state, so a code can't be attached to an existing/verified account, to
 * yourself, to a deactivated member, or twice.
 *
 * Never throws for an ordinary refusal — returns { attached: false, reason }
 * so signup itself is never affected by referral problems.
 */
export async function attachReferral(uid, rawCode) {
  const code = normalizeReferralCode(rawCode);
  if (!code) return { attached: false, reason: "invalid_code" };

  const userRef = adminDB.collection("users").doc(uid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { attached: false, reason: "user_not_found" };
  const user = userSnap.data();
  if (user.referredBy) return { attached: false, reason: "already_attributed" };
  if (user.isVerified) return { attached: false, reason: "already_verified" };

  // Age is read from Firebase Auth itself, never from anything client-supplied.
  const authUser = await adminAuth.getUser(uid);
  const accountAgeMs = Date.now() - new Date(authUser.metadata.creationTime).getTime();
  if (accountAgeMs > REFERRAL_ATTACH_WINDOW_MS) return { attached: false, reason: "account_too_old" };

  const codeSnap = await adminDB.collection("crsaCodes").doc(code).get();
  if (!codeSnap.exists) return { attached: false, reason: "unknown_code" };
  const referrerUid = codeSnap.data().uid;
  if (referrerUid === uid) return { attached: false, reason: "self_referral" };

  const memberSnap = await adminDB.collection("crsaMembers").doc(referrerUid).get();
  if (!memberSnap.exists || !memberSnap.data().active) return { attached: false, reason: "inactive_member" };

  // Re-check inside a transaction so two concurrent calls can't both write.
  const attached = await adminDB.runTransaction(async (tx) => {
    const fresh = await tx.get(userRef);
    if (!fresh.exists || fresh.data().referredBy || fresh.data().isVerified) return false;
    tx.update(userRef, { referredBy: code });
    return true;
  });

  return attached ? { attached: true, referrerUid } : { attached: false, reason: "already_attributed" };
}

// --- Counting (the primary stat: referred users who complete KYC) ---------

/**
 * Phase 1 of counting a referred user's KYC completion — READS ONLY, called
 * from lib/kycServer.js's verification transaction after the outcome is
 * known but before its first write (Firestore requires every read in a
 * transaction to precede every write, hence the prepare/apply split).
 *
 * Returns a plan for applyReferralKycCount, or null if nothing should be
 * counted: no referral, unknown code, self-referral (also blocked at attach
 * time — defense in depth), referrer not an ACTIVE member at the moment of
 * KYC, or this user already counted. The marker doc
 * (crsaStats/{referrer}/referrals/{referred}) is the idempotency key, the
 * same "fixed doc ID IS the already-happened check" pattern as
 * awardCreditOnce/awardBadgeOnce — a resubmission or concurrent duplicate
 * verification can never count twice.
 */
export async function prepareReferralKycCount(tx, userId) {
  const userSnap = await tx.get(adminDB.collection("users").doc(userId));
  const referredBy = userSnap.exists ? userSnap.data().referredBy : null;
  if (!referredBy) return null;

  const codeSnap = await tx.get(adminDB.collection("crsaCodes").doc(referredBy));
  if (!codeSnap.exists) return null;
  const referrerUid = codeSnap.data().uid;
  if (referrerUid === userId) return null;

  const memberRef = adminDB.collection("crsaMembers").doc(referrerUid);
  const statsRef = adminDB.collection("crsaStats").doc(referrerUid);
  const markerRef = statsRef.collection("referrals").doc(userId);
  const [memberSnap, statsSnap, markerSnap] = await Promise.all([
    tx.get(memberRef),
    tx.get(statsRef),
    tx.get(markerRef),
  ]);
  if (!memberSnap.exists || !memberSnap.data().active) return null;
  if (markerSnap.exists) return null;

  return { referrerUid, referredBy, statsRef, markerRef, statsExists: statsSnap.exists };
}

/** Phase 2 — WRITES ONLY, given a non-null plan from prepareReferralKycCount. */
export function applyReferralKycCount(tx, plan) {
  tx.set(plan.markerRef, {
    countedAt: admin.firestore.FieldValue.serverTimestamp(),
    referralCode: plan.referredBy,
  });
  if (plan.statsExists) {
    tx.update(plan.statsRef, {
      kycCompletions: admin.firestore.FieldValue.increment(1),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } else {
    // Shouldn't happen (stats are created with the member), but a missing doc
    // must not leave a stats row with no `installs` field — the leaderboard's
    // ordering would silently drop it.
    tx.set(plan.statsRef, {
      kycCompletions: 1,
      installs: 0,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Best-effort, non-transactional (like maybeFlagRapidWeeklyCap in
 * lib/saleConfirmationServer.js): many of one ambassador's referrals
 * completing KYC in a short window is the signature of fake-account
 * farming, so it earns a moderationFlags entry for a human to look at. It
 * NEVER blocks or reverses a count. The flag doc ID is deterministic per
 * referrer per day, so crossing the threshold repeatedly doesn't spam flags.
 */
export async function maybeFlagReferralVelocity(referrerUid) {
  try {
    const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - REFERRAL_VELOCITY_WINDOW_MS);
    const recent = await adminDB
      .collection("crsaStats")
      .doc(referrerUid)
      .collection("referrals")
      .where("countedAt", ">=", cutoff)
      .get();
    if (recent.size < REFERRAL_VELOCITY_FLAG_THRESHOLD) return { flagged: false, recentCount: recent.size };

    const dayKey = new Date().toISOString().slice(0, 10);
    await adminDB
      .collection("moderationFlags")
      .doc(`${referrerUid}_crsa_referral_velocity_${dayKey}`)
      .set(
        {
          userId: referrerUid,
          reason: "crsa_referral_kyc_velocity",
          detail: `${recent.size} referred users completed KYC within 24h (threshold ${REFERRAL_VELOCITY_FLAG_THRESHOLD}).`,
          resolved: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return { flagged: true, recentCount: recent.size };
  } catch (error) {
    console.error("Error checking CRSA referral velocity:", error);
    return { flagged: false, recentCount: 0 };
  }
}

// --- Leaderboard -----------------------------------------------------------

// A personal-scale program (course reps, not the whole user base): a generous
// fixed window keeps this one indexed query + one batched join, no pagination.
const LEADERBOARD_FETCH_LIMIT = 200;

/**
 * Ranked CRSA leaderboard — kycCompletions desc, installs desc (the spec's
 * "+ installs as a secondary metric"). A LIVE query rather than a periodic
 * aggregate: counters are incremented transactionally in
 * prepare/applyReferralKycCount, so the stats docs are always current and
 * there is nothing to recompute.
 *
 * Needs a composite index on crsaStats (kycCompletions desc, installs desc).
 *
 * Two audiences, deliberately different shapes:
 *  - admin: every member (active or not) with uid/code/active — this doubles
 *    as the members table on /admin/crsa.
 *  - member: only ACTIVE members, name + counts only — no uids, codes, or
 *    deactivated members, since it exposes other ambassadors' numbers.
 *
 * Equal (kycCompletions, installs) share a rank.
 */
export async function getLeaderboard({ forAdmin, viewerUid = null }) {
  const statsSnap = await adminDB
    .collection("crsaStats")
    .orderBy("kycCompletions", "desc")
    .orderBy("installs", "desc")
    .limit(LEADERBOARD_FETCH_LIMIT)
    .get();

  const uids = statsSnap.docs.map((d) => d.id);
  if (uids.length === 0) return [];

  const memberRefs = uids.map((uid) => adminDB.collection("crsaMembers").doc(uid));
  const userRefs = uids.map((uid) => adminDB.collection("users").doc(uid));
  const [memberSnaps, userSnaps] = await Promise.all([
    adminDB.getAll(...memberRefs),
    adminDB.getAll(...userRefs),
  ]);

  const rows = [];
  statsSnap.docs.forEach((statsDoc, i) => {
    const member = memberSnaps[i].exists ? memberSnaps[i].data() : null;
    if (!member) return; // stats without a member doc (shouldn't happen) — skip
    if (!forAdmin && !member.active) return;

    const stats = statsDoc.data();
    const user = userSnaps[i].exists ? userSnaps[i].data() : {};
    const row = {
      fullName: user.fullName || "Unnamed",
      kycCompletions: stats.kycCompletions || 0,
      installs: stats.installs || 0,
    };
    if (forAdmin) {
      row.uid = statsDoc.id;
      row.referralCode = member.referralCode;
      row.active = !!member.active;
    } else {
      row.isYou = statsDoc.id === viewerUid;
    }
    rows.push(row);
  });

  let rank = 0;
  let prev = null;
  rows.forEach((row, idx) => {
    const key = `${row.kycCompletions}:${row.installs}`;
    if (key !== prev) {
      rank = idx + 1;
      prev = key;
    }
    row.rank = rank;
  });

  return rows;
}
