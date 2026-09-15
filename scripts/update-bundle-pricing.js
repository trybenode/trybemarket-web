/**
 * Fix quarterly/yearly bundle pricing so they no longer undercut the monthly bundle.
 *
 * Neither bundle_quarterly nor bundle_yearly exist yet in Firestore's subscriptionPlans
 * collection (the Bundles tab only renders category "bundle", so today only bundle_premium
 * is purchasable). This creates both as new docs. The old discounts_yearly doc (category:
 * "discount") is unrelated legacy data and is left untouched.
 *
 * Old target math: quarterly ₦3,000 (~60% off monthly-equivalent), yearly ₦10,000 (~67% off)
 * New: quarterly ₦6,000 (20% off monthly-equivalent), yearly ₦21,000 (30% off)
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

// Matches the bundle_premium doc schema already live in Firestore.
const NEW_PLANS = {
  bundle_quarterly: {
    name: "Quarterly Bundle",
    category: "bundle",
    type: "bundle",
    price: 6000,
    cycle: "quarterly",
    durationMonths: 3,
    includes: ["product_premium", "service_premium"],
    eligibility: { requiresPaidMonths: 0 },
    visibility: { featured: true },
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    limits: { dailyNotifications: 20 },
    features: [
      "3 months of Premium Bundle",
      "Save ₦1,500 vs monthly",
      "Premium Products + Services",
      "All premium features for 3 months",
      "20 email & WhatsApp notifications per day",
    ],
  },
  bundle_yearly: {
    name: "Yearly Bundle",
    category: "bundle",
    type: "bundle",
    price: 21000,
    cycle: "yearly",
    durationMonths: 12,
    includes: ["product_premium", "service_premium"],
    eligibility: { requiresPaidMonths: 0 },
    visibility: { featured: true },
    active: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    limits: { dailyNotifications: 20 },
    features: [
      "12 months of Premium Bundle",
      "Save ₦9,000 vs monthly",
      "Premium Products + Services",
      "All premium features for 1 year",
      "Best value plan",
      "20 email & WhatsApp notifications per day",
    ],
  },
};

// bundle_premium is live in Firestore but is missing this field, so
// getUserLimits() can never resolve its product/service limits and silently
// falls back to free-tier caps for every bundle subscriber.
const BUNDLE_PREMIUM_INCLUDES = ["product_premium", "service_premium"];

async function run() {
  console.log(`\n=== CREATE QUARTERLY/YEARLY BUNDLE PLANS (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const plansRef = db.collection("subscriptionPlans");
  const batch = db.batch();
  let writes = 0;

  for (const [planId, planData] of Object.entries(NEW_PLANS)) {
    const docRef = plansRef.doc(planId);
    const snap = await docRef.get();

    if (snap.exists) {
      console.log(`⚠️  ${planId} already exists in Firestore, skipping (won't overwrite)`);
      console.log(`   current: ${JSON.stringify(snap.data())}\n`);
      continue;
    }

    console.log(`📋 ${planData.name} (${planId}) — new doc`);
    console.log(`   price: ₦${planData.price.toLocaleString()}, cycle: ${planData.cycle}`);
    console.log(`   features: ${JSON.stringify(planData.features)}\n`);

    batch.set(docRef, planData);
    writes++;
  }

  console.log(`\n=== FIX MISSING "includes" ON bundle_premium ===\n`);
  const premiumRef = plansRef.doc("bundle_premium");
  const premiumSnap = await premiumRef.get();

  if (!premiumSnap.exists) {
    console.log("⚠️  bundle_premium not found in Firestore, skipping");
  } else if (premiumSnap.data().includes) {
    console.log(`bundle_premium already has includes: ${JSON.stringify(premiumSnap.data().includes)}, skipping`);
  } else {
    console.log(`📋 bundle_premium — adding includes: ${JSON.stringify(BUNDLE_PREMIUM_INCLUDES)}\n`);
    batch.update(premiumRef, { includes: BUNDLE_PREMIUM_INCLUDES });
    writes++;
  }

  if (writes === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (!APPLY) {
    console.log(`Dry run complete. Re-run with --apply to write these ${writes} change(s) to Firestore.`);
    return;
  }

  await batch.commit();
  console.log(`✅ Wrote ${writes} change(s) to Firestore.`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error creating bundle plans:", err);
    process.exit(1);
  });

