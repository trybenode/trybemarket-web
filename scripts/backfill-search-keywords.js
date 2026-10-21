/**
 * Recomputes searchKeywords for every product and service with the current
 * rules (lib/rankScoreShared.js computeSearchKeywords): whole words, plus the
 * leading parts of the name/brand/category/subcategory words, plus the
 * subcategories and brand themselves. Only searchKeywords is written — rank,
 * tier and everything else are left alone. Safe to run more than once.
 *
 * Defaults to a dry run. Pass --apply to write.
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import { computeSearchKeywords } from "../lib/rankScoreShared.js";

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

const sameKeywords = (a = [], b = []) => a.length === b.length && a.every((k, i) => k === b[i]);

async function backfill(collectionName) {
  const snap = await db.collection(collectionName).get();
  const changes = [];
  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const searchKeywords = computeSearchKeywords({
      name: data.name,
      description: data.description,
      categoryId: data.categoryId,
      subcategory: data.subcategory,
      brand: data.brand,
    });
    if (!sameKeywords(data.searchKeywords, searchKeywords)) {
      changes.push({ ref: docSnap.ref, name: data.name, before: data.searchKeywords?.length ?? 0, searchKeywords });
    }
  }
  console.log(`\n${collectionName}: ${snap.size} listings, ${changes.length} to update`);
  changes.slice(0, 5).forEach((c) => console.log(`  ${c.name}: ${c.before} → ${c.searchKeywords.length} keywords`));
  const largest = changes.reduce((max, c) => Math.max(max, c.searchKeywords.length), 0);
  console.log(`  largest keyword list: ${largest}`);

  if (!APPLY) return;
  for (let i = 0; i < changes.length; i += BATCH_SIZE) {
    const batch = db.batch();
    changes.slice(i, i + BATCH_SIZE).forEach((c) => batch.update(c.ref, { searchKeywords: c.searchKeywords }));
    await batch.commit();
  }
  console.log(`  updated ${changes.length}`);
}

console.log(APPLY ? "APPLYING" : "DRY RUN — pass --apply to write");
await backfill("products");
await backfill("services");
process.exit(0);
