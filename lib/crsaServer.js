import admin from "firebase-admin";
import crypto from "crypto";
import { adminDB, adminAuth } from "./firebaseAdmin.js";
import { awardBadgeOnce } from "./badgeServer.js";
import { BADGE_KEYS } from "./badgeConstants.js";
import {
  REFERRAL_CODE_ALPHABET,
  REFERRAL_CODE_LENGTH,
  REFERRAL_ATTACH_WINDOW_MS,
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
