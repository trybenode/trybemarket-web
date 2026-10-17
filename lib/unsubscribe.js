import crypto from "crypto";

/**
 * Signed unsubscribe links for promotional email (08-campaign-messaging.md §7.1).
 *
 * The admin app builds https://trybemarket.online/unsubscribe?u=<uid>&t=<token>
 * with the same secret and the same HMAC, and this side verifies it. The token
 * is unguessable, needs no login, and only works for the uid it was made for.
 * UNSUBSCRIBE_SECRET must be identical in both Vercel projects.
 *
 * Server-only (uses the secret).
 */

function getSecret() {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET is not set");
  return secret;
}

export function createUnsubscribeToken(uid) {
  return crypto.createHmac("sha256", getSecret()).update(`unsubscribe:${uid}`).digest("base64url");
}

export function isValidUnsubscribeToken(uid, token) {
  if (typeof uid !== "string" || typeof token !== "string" || !uid || !token) return false;
  // Firestore doc IDs can't contain "/", and Auth uids are at most 128 chars.
  if (uid.length > 128 || uid.includes("/")) return false;
  const expected = Buffer.from(createUnsubscribeToken(uid));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}
