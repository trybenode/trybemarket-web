/**
 * One-time backfill: stamps sellerTier onto every existing product/service
 * based on its owner's current subscription, so the new ranking boost applies
 * immediately instead of waiting for each seller's next payment or edit.
 *
 * Defaults to a dry run. Pass --apply to actually write to Firestore.
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import { computeSellerTier } from "../lib/sellerTier.js";

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

async function backfillCollection(collectionName, category, tierByUserId) {
  const snap = await db.collection(collectionName).get();
  const batches = [];
  let batch = db.batch();
  let opsInBatch = 0;
  let changed = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const tier = tierByUserId.get(data.userId) ?? "free";
    if (data.sellerTier === tier) continue; // already correct, skip write

    batch.update(doc.ref, { sellerTier: tier });
    opsInBatch++;
    changed++;

    if (opsInBatch >= 400) {
      batches.push(batch);
      batch = db.batch();
      opsInBatch = 0;
    }
  }
  if (opsInBatch > 0) batches.push(batch);

  console.log(`${collectionName}: ${changed} doc(s) need sellerTier update (${snap.size} total)`);

  if (APPLY) {
    for (const b of batches) await b.commit();
  }

  return changed;
}

async function run() {
  console.log(`\n=== BACKFILL sellerTier (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const subsSnap = await db.collection("subscriptions").get();
  const productTierByUserId = new Map();
  const serviceTierByUserId = new Map();

  subsSnap.forEach((doc) => {
    const subs = doc.data();
    productTierByUserId.set(doc.id, computeSellerTier(subs, "product"));
    serviceTierByUserId.set(doc.id, computeSellerTier(subs, "service"));
  });

  const productsChanged = await backfillCollection("products", "product", productTierByUserId);
  const servicesChanged = await backfillCollection("services", "service", serviceTierByUserId);

  if (!APPLY) {
    console.log(`\nDry run complete. Re-run with --apply to write ${productsChanged + servicesChanged} change(s) to Firestore.`);
  } else {
    console.log(`\n✅ Backfilled ${productsChanged} product(s) and ${servicesChanged} service(s).`);
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error backfilling sellerTier:", err);
    process.exit(1);
  });
