/**
 * Seeds the badges/{badgeId} catalog (static metadata used for display —
 * see 02-badge-system.md §2). The unblocked Phase-1 badges per
 * change-answers.md §4 (Verified Student, Founding Member, Top Seller) plus
 * CRSA Member, now that CRSA membership tracking exists
 * (04-crsa-affiliate-program.md). Safe Trader is intentionally omitted — it
 * is still blocked on the "Pay with TrybeMarket" escrow feature.
 *
 * Won't overwrite an existing catalog doc. Defaults to a dry run; pass
 * --apply to actually write to Firestore.
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

const BADGES = {
  verified_student: {
    key: "verified_student",
    name: "Verified Student",
    description: "Completed student ID verification (KYC).",
    tier: "phase_1",
    refreshCadence: "one_time",
  },
  founding_member: {
    key: "founding_member",
    name: "Founding Member",
    description: "One of TrybeMarket's first 300 users.",
    tier: "phase_1",
    refreshCadence: "one_time",
  },
  top_seller: {
    key: "top_seller",
    name: "Top Seller",
    description: "Highest confirmed-sale count this month.",
    tier: "phase_1",
    refreshCadence: "monthly",
  },
  crsa_member: {
    key: "crsa_member",
    name: "CRSA Member",
    description: "Course Rep Student Ambassador.",
    tier: "phase_1",
    refreshCadence: "one_time",
  },
};

async function run() {
  console.log(`\n=== SEED BADGES CATALOG (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const badgesRef = db.collection("badges");

  for (const [badgeId, data] of Object.entries(BADGES)) {
    const docRef = badgesRef.doc(badgeId);
    const snap = await docRef.get();

    if (snap.exists) {
      console.log(`⚠️  ${badgeId} already exists, skipping (won't overwrite)`);
      continue;
    }

    console.log(`📋 ${data.name} (${badgeId}) — new doc`);
    if (APPLY) {
      await docRef.set(data);
    }
  }

  console.log(APPLY ? "\n✅ Catalog seeded." : "\nDry run only — pass --apply to write these changes.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exit(1);
  });
