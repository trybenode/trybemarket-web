/**
 * One-time migration for 07-ranking-unification.md §9: computes rankScore,
 * searchKeywords, and a freshly-re-derived sellerTier for every existing
 * products/services document, based on each seller's REAL current
 * subscription — not whatever (possibly client-set, pre-this-fix)
 * sellerTier value is already stored.
 *
 * Must run before the new orderBy('rankScore', ...) queries go live, so no
 * listing is ever ordered against a missing rankScore by accident (Firestore
 * excludes docs missing an orderBy field from range-ordered results
 * entirely — an unmigrated listing would just silently vanish from
 * homepage/category/search until this runs).
 *
 * Defaults to a dry run. Pass --apply to actually write to Firestore.
 */

import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config({ path: ".env" });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();
const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 400;

const TIER_WEIGHTS = { vip: 2000, premium: 1000, free: 0 };
const VIP_TAG_BONUS = 200;
const BOOST_BONUS = 500;

function toDateSafe(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.toMillis === "function") return new Date(value.toMillis());
  if (value._seconds !== undefined) return new Date(value._seconds * 1000);
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  return new Date(value);
}

function isActiveSub(sub) {
  if (!sub?.isActive) return false;
  if (!sub.expiryDate) return true;
  const expiry = toDateSafe(sub.expiryDate);
  return !expiry || expiry.getTime() > Date.now();
}

function tierFromPlanId(planId) {
  if (!planId) return "free";
  if (planId.endsWith("_vip")) return "vip";
  if (planId.endsWith("_premium")) return "premium";
  return "free";
}

function computeSellerTier(subscriptions, category) {
  let tier = "free";
  const direct = subscriptions?.[category];
  if (isActiveSub(direct)) tier = tierFromPlanId(direct.planId);
  const bundle = subscriptions?.bundle;
  if (isActiveSub(bundle) && TIER_WEIGHTS.premium > TIER_WEIGHTS[tier]) tier = "premium";
  return tier;
}

function computeRankScore({ sellerTier, isVip, isBoosted, boostEndDate }) {
  const tierWeight = TIER_WEIGHTS[sellerTier] ?? 0;
  const vipTagBonus = isVip ? VIP_TAG_BONUS : 0;
  const boostExpiry = toDateSafe(boostEndDate);
  const boostActive = !!isBoosted && !!boostExpiry && boostExpiry.getTime() > Date.now();
  const boostBonus = boostActive ? BOOST_BONUS : 0;
  return tierWeight + vipTagBonus + boostBonus;
}

function tokenizeText(text) {
  if (!text) return [];
  const tokens = String(text).toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 2);
  return [...new Set(tokens)];
}

function computeSearchKeywords({ name, description, categoryId }) {
  return tokenizeText([name, description, categoryId].filter(Boolean).join(" "));
}

async function backfillCollection(collectionName, category) {
  console.log(`\n--- ${collectionName} ---`);
  const snap = await db.collection(collectionName).get();
  console.log(`Found ${snap.size} documents.`);

  const subsCache = new Map(); // userId -> subscriptions data (avoid re-fetching per doc)
  let updated = 0;

  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const docSnap of chunk) {
      const data = docSnap.data();
      const ownerId = data.userId || data.sellerId;

      let subs = {};
      if (ownerId) {
        if (subsCache.has(ownerId)) {
          subs = subsCache.get(ownerId);
        } else {
          const subSnap = await db.collection("subscriptions").doc(ownerId).get();
          subs = subSnap.exists ? subSnap.data() : {};
          subsCache.set(ownerId, subs);
        }
      }

      const sellerTier = computeSellerTier(subs, category);
      const rankScore = computeRankScore({
        sellerTier,
        isVip: data.isVip,
        isBoosted: data.isBoosted,
        boostEndDate: data.boostEndDate,
      });
      const searchKeywords = computeSearchKeywords({
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
      });

      if (APPLY) {
        batch.update(docSnap.ref, { sellerTier, rankScore, searchKeywords });
      }
      updated++;
    }

    if (APPLY) {
      await batch.commit();
      console.log(`Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} docs)`);
    }
  }

  console.log(`${updated} ${collectionName} documents ${APPLY ? "updated" : "would be updated"}.`);
}

async function run() {
  console.log(`\n=== BACKFILL RANK SCORES (${APPLY ? "APPLY" : "DRY RUN"}) ===`);
  await backfillCollection("products", "product");
  await backfillCollection("services", "service");
  console.log(APPLY ? "\n✅ Backfill complete." : "\nDry run only — pass --apply to write these changes.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
