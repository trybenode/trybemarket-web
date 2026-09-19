import { adminDB } from "./firebaseAdmin.js";
import { computeSellerTier } from "./sellerTier.js";
import { computeRankScore, computeSearchKeywords, tokenizeText } from "./rankScoreShared.js";

export { computeRankScore, computeSearchKeywords, tokenizeText };

export class RankScoreError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function toDateSafe(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.toMillis === "function") return new Date(value.toMillis());
  if (value._seconds !== undefined) return new Date(value._seconds * 1000);
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  return new Date(value);
}

const COLLECTION_BY_TYPE = { product: "products", service: "services" };

/**
 * Re-reads a product/service doc's CURRENT state server-side and writes a
 * fresh sellerTier + rankScore + searchKeywords — the single recompute path
 * called from every trigger (VIP toggle, boost apply/expire, tier sync, and
 * a general post-edit call from the upload/edit forms).
 *
 * sellerTier is independently re-derived from the owner's real
 * subscriptions/{uid} doc every time, never trusted from whatever's already
 * stored on the listing — that field used to be client-writable (no
 * firestore.rules restriction existed on it before this), so trusting it
 * here would have let a seller self-assign "vip" tier and inflate their own
 * rankScore. This makes every recompute call self-healing regardless of
 * what a stale or previously-manipulated sellerTier field says.
 *
 * rankShuffleSeed (the in-tier fairness rotation, see rankScoreShared.js) is
 * PRESERVED across ordinary recompute calls — it only gets generated once,
 * the first time an item has none (a brand-new listing, or a legacy one from
 * before this feature). It is deliberately NOT rerolled on every call: this
 * function runs on every plain edit-form save (see product-upload/
 * service-upload), so rerolling here would let a seller resave repeatedly
 * to fish for a better random position — the exact kind of manipulation
 * this whole ranking system exists to prevent. Only passing
 * { reroll: true } — done exclusively by the daily reshuffle cron
 * (pages/api/listing/reshuffle-rank-scores.js) — assigns a fresh seed.
 */
export async function recomputeRankForItem(itemType, itemId, { reroll = false } = {}) {
  const collectionName = COLLECTION_BY_TYPE[itemType];
  if (!collectionName) {
    throw new RankScoreError(`Invalid itemType: ${itemType}`, 400);
  }

  const ref = adminDB.collection(collectionName).doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new RankScoreError("Item not found", 404);
  }
  const data = snap.data();

  const ownerId = data.userId || data.sellerId;
  let sellerTier = "free";
  if (ownerId) {
    const subSnap = await adminDB.collection("subscriptions").doc(ownerId).get();
    const subs = subSnap.exists ? subSnap.data() : {};
    sellerTier = computeSellerTier(subs, itemType);
  }

  const existingSeed = data.rankShuffleSeed;
  const hasValidSeed = typeof existingSeed === "number" && existingSeed >= 0 && existingSeed < 1;
  const rankShuffleSeed = reroll || !hasValidSeed ? Math.random() : existingSeed;

  const rankScore = computeRankScore({
    sellerTier,
    isVip: data.isVip,
    isBoosted: data.isBoosted,
    boostEndDate: data.boostEndDate,
    shuffleSeed: rankShuffleSeed,
  });
  const searchKeywords = computeSearchKeywords({
    name: data.name,
    description: data.description,
    categoryId: data.categoryId,
  });

  await ref.update({ sellerTier, rankScore, searchKeywords, rankShuffleSeed });
  return { sellerTier, rankScore, searchKeywords, rankShuffleSeed };
}

/**
 * Server-side VIP tag cap enforcement (07-ranking-unification.md §7) — the
 * UI hiding the toggle once a seller hits their cap was never a real
 * boundary; this is. Counts the seller's current isVip listings in the SAME
 * category (products and services have separate vipTags limits) and rejects
 * the write if it would exceed their plan's cap.
 */
export async function setVipTag(uid, itemType, itemId, desiredIsVip) {
  const collectionName = COLLECTION_BY_TYPE[itemType];
  if (!collectionName) {
    throw new RankScoreError(`Invalid itemType: ${itemType}`, 400);
  }

  const ref = adminDB.collection(collectionName).doc(itemId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new RankScoreError("Item not found", 404);
  }
  const item = snap.data();
  if (item.userId !== uid && item.sellerId !== uid) {
    throw new RankScoreError("You do not own this item", 403);
  }

  if (desiredIsVip && !item.isVip) {
    const cap = await getUserVipTagLimit(uid, itemType);
    if (cap <= 0) {
      throw new RankScoreError("Your plan does not include VIP tags", 403);
    }
    const currentSnap = await adminDB
      .collection(collectionName)
      .where("userId", "==", uid)
      .where("isVip", "==", true)
      .get();
    // Exclude this item itself in case it's already counted (shouldn't be,
    // since we only reach here when it isn't currently VIP, but defensive).
    const currentCount = currentSnap.docs.filter((d) => d.id !== itemId).length;
    if (currentCount >= cap) {
      throw new RankScoreError(
        `You've used all ${cap} of your VIP tags on this plan — remove one first or upgrade`,
        403
      );
    }
  }

  await ref.update({ isVip: !!desiredIsVip });
  const { rankScore } = await recomputeRankForItem(itemType, itemId);
  return { isVip: !!desiredIsVip, rankScore };
}

/**
 * Admin-SDK lookup of a user's vipTags cap for a category — mirrors
 * lib/subscriptionStore.js's getUserLimits, but that uses the client SDK
 * (subject to firestore.rules and requiring a client auth context), so it
 * can't be reused directly from a server route. Duplicates the lookup
 * shape, not the trust model.
 */
async function getUserVipTagLimit(userId, itemType) {
  const category = itemType === "product" ? "product" : "service";
  const subSnap = await adminDB.collection("subscriptions").doc(userId).get();
  const subs = subSnap.exists ? subSnap.data() : {};

  const isActive = (sub) => {
    if (!sub?.isActive) return false;
    if (!sub.expiryDate) return true;
    const expiry = toDateSafe(sub.expiryDate);
    return !expiry || expiry.getTime() > Date.now();
  };

  let planId = null;
  if (isActive(subs.bundle)) {
    const bundleDoc = await adminDB.collection("subscriptionPlans").doc(subs.bundle.planId).get();
    const includes = bundleDoc.exists ? bundleDoc.data().includes || [] : [];
    planId = includes.find((id) => id.startsWith(`${category}_`)) || null;
  }
  if (!planId && isActive(subs[category])) {
    planId = subs[category].planId;
  }
  if (!planId) return 0;

  const planDoc = await adminDB.collection("subscriptionPlans").doc(planId).get();
  return planDoc.exists ? planDoc.data().limits?.vipTags || 0 : 0;
}
