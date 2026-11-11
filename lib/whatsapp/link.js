/**
 * Connecting a WhatsApp number to a TrybeMarket account
 * (09-whatsapp-assistant.md §5.1).
 *
 *   1. Signed in to the app, the student taps Connect: createLinkCode makes a
 *      6-character code (15 minutes, single use) in waLinkCodes/{code}.
 *   2. The app opens WhatsApp with "LINK ABC234" typed in. The student sends it.
 *   3. The webhook calls redeemLinkCode with the code and the SENDER's number
 *      (which WhatsApp vouches for): waLinks/{phone} = { uid, linkedAt, optInAt }.
 *
 * The number is never written to users/{uid} — user records are publicly
 * readable. The only thing added there is `whatsappLinked: true`. waLinks,
 * waLinkCodes and waLinkAudit have no client rules, so they're server-only.
 *
 * A number connects to one account, and an account to one number: connecting
 * a new number (which needs an app login, for the code) replaces the old one.
 *
 * `db` is passed in, so this file has no Firebase import.
 */
import crypto from "crypto";
import { LINK_CODE_ALPHABET, LINK_CODE_LENGTH } from "./parse.js";

export const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const CODE_RETENTION_MS = 24 * 60 * 60 * 1000; // then the TTL policy may delete it
const PHONE_PATTERN = /^\d{8,15}$/;

function randomCode() {
  let code = "";
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_CODE_ALPHABET[crypto.randomInt(LINK_CODE_ALPHABET.length)];
  }
  return code;
}

/** A new code for `uid`. @returns {Promise<{ code: string, expiresAt: number }>} */
export async function createLinkCode(db, uid, { now = Date.now(), generate = randomCode } = {}) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generate();
    try {
      await db.collection("waLinkCodes").doc(code).create({
        uid,
        createdAt: new Date(now),
        expiresAtMs: now + LINK_CODE_TTL_MS,
        usedAt: null,
        expiresAt: new Date(now + CODE_RETENTION_MS), // for the Firestore TTL policy
      });
      return { code, expiresAt: now + LINK_CODE_TTL_MS };
    } catch (error) {
      if (error?.code !== 6 && !/already exists/i.test(String(error?.message))) throw error;
      // that code is taken — try another
    }
  }
  throw new Error("Couldn't create a link code");
}

/**
 * Redeems a code sent from `phone`.
 * @returns {Promise<{ status: "linked"|"invalid"|"expired"|"used"|"taken", uid?: string }>}
 *   taken: the number is already connected to a different account.
 */
export async function redeemLinkCode(db, { code, phone, now = Date.now() }) {
  if (!code || !PHONE_PATTERN.test(String(phone))) return { status: "invalid" };
  const codeRef = db.collection("waLinkCodes").doc(code);
  const linkRef = db.collection("waLinks").doc(String(phone));

  return db.runTransaction(async (tx) => {
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists) return { status: "invalid" };
    const { uid, usedAt, usedBy, expiresAtMs } = codeSnap.data();

    const linkSnap = await tx.get(linkRef);
    const linkedUid = linkSnap.exists ? linkSnap.data().uid : null;

    if (usedAt) {
      // The same message delivered twice (or tapped twice): still connected.
      return usedBy === String(phone) && linkedUid === uid ? { status: "linked", uid } : { status: "used" };
    }
    if (now > expiresAtMs) return { status: "expired" };
    if (linkedUid && linkedUid !== uid) return { status: "taken" };

    // One number per account: drop any other number this account had connected.
    const previous = await tx.get(db.collection("waLinks").where("uid", "==", uid));
    const replaced = previous.docs.filter((doc) => doc.id !== String(phone));
    replaced.forEach((doc) => tx.delete(doc.ref));

    const at = new Date(now);
    tx.set(linkRef, { uid, linkedAt: at, optInAt: at });
    tx.update(codeRef, { usedAt: at, usedBy: String(phone) });
    tx.set(db.collection("users").doc(uid), { whatsappLinked: true }, { merge: true });
    tx.set(db.collection("waLinkAudit").doc(), {
      uid,
      phone: String(phone),
      action: replaced.length ? "relinked" : "linked",
      replaced: replaced.map((doc) => doc.id),
      at,
    });
    return { status: "linked", uid };
  });
}

/** Disconnects whatever number `uid` has connected. @returns {Promise<boolean>} whether there was one */
export async function unlinkAccount(db, uid, { now = Date.now(), by = "user" } = {}) {
  return db.runTransaction(async (tx) => {
    const links = await tx.get(db.collection("waLinks").where("uid", "==", uid));
    links.docs.forEach((doc) => tx.delete(doc.ref));
    tx.set(db.collection("users").doc(uid), { whatsappLinked: false }, { merge: true });
    if (!links.empty) {
      tx.set(db.collection("waLinkAudit").doc(), {
        uid,
        phone: links.docs[0].id,
        action: "unlinked",
        by,
        at: new Date(now),
      });
    }
    return !links.empty;
  });
}

/** The account a number is connected to, or null. */
export async function findLinkedUid(db, phone) {
  if (!PHONE_PATTERN.test(String(phone))) return null;
  const snap = await db.collection("waLinks").doc(String(phone)).get();
  return snap.exists ? snap.data().uid : null;
}

/** The number an account has connected, or null. */
export async function findLinkedPhone(db, uid) {
  const snap = await db.collection("waLinks").where("uid", "==", uid).get();
  return snap.empty ? null : snap.docs[0].id;
}

/** "•••• 5678" — enough to recognise your own number, nothing more. */
export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 4 ? `•••• ${digits.slice(-4)}` : "••••";
}
