/**
 * Read-only export of the subscriptionPlans collection to a local JSON file.
 * Run before any destructive write to this collection.
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";

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

async function run() {
  const snapshot = await db.collection("subscriptionPlans").get();
  const plans = {};
  snapshot.forEach((doc) => {
    plans[doc.id] = doc.data();
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = `scripts/backups/subscriptionPlans-${timestamp}.json`;
  fs.mkdirSync("scripts/backups", { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(plans, null, 2));

  console.log(`✅ Backed up ${snapshot.size} plan(s) to ${outPath}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error backing up subscriptionPlans:", err);
    process.exit(1);
  });
