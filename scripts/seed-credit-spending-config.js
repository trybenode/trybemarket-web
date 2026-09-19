/**
 * Seeds config/creditSpending — the kill switch checked by
 * lib/creditSpendServer.js's isCreditSpendingEnabled() at the point of
 * checkout initiation (credit-spending-security-checklist.md §7).
 *
 * Defaults to { enabled: false } — a missing OR freshly-seeded config doc
 * means credit spending stays OFF until someone deliberately flips it on
 * (e.g. via the Firebase console, or a future admin UI). Won't overwrite an
 * existing doc, so re-running this after the flag has been turned on is safe.
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

async function run() {
  console.log(`\n=== SEED config/creditSpending (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const ref = db.collection("config").doc("creditSpending");
  const snap = await ref.get();

  if (snap.exists) {
    console.log(`⚠️  config/creditSpending already exists: ${JSON.stringify(snap.data())}`);
    console.log("Not overwriting — use the Firebase console to change it.");
    return;
  }

  console.log("Would create config/creditSpending with { enabled: false }");
  if (APPLY) {
    await ref.set({ enabled: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log("✅ Created, credit spending is OFF by default.");
  } else {
    console.log("\nDry run only — pass --apply to write this change.");
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
