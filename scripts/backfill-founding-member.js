/**
 * One-time backfill: award the Founding Member badge to every EXISTING user
 * unconditionally, then initialize counters/foundingMember.total to that
 * count so future signups (app/api/user/on-signup) continue counting toward
 * the 300-user cap from there. See change-answers.md §4.
 *
 * Idempotent guard: refuses to run if counters/foundingMember already
 * exists, since re-running would re-count users who already have the badge
 * and push the counter (and therefore the cap) past where it should be.
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
const BATCH_SIZE = 450; // stay under Firestore's 500-op batch limit

async function run() {
  console.log(`\n=== BACKFILL FOUNDING MEMBER BADGE (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const counterRef = db.collection("counters").doc("foundingMember");
  const counterSnap = await counterRef.get();
  if (counterSnap.exists) {
    console.log(
      `⚠️  counters/foundingMember already exists (total: ${counterSnap.data().total}). ` +
        `This script has already run — aborting to avoid double-counting.`
    );
    return;
  }

  const usersSnap = await db.collection("users").get();
  const totalUsers = usersSnap.size;
  console.log(`Found ${totalUsers} existing users.\n`);

  let awarded = 0;
  let alreadyHadBadge = 0;
  const docs = usersSnap.docs;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const userDoc of chunk) {
      const badgeRef = userDoc.ref.collection("badges").doc("founding_member");
      const existing = await badgeRef.get();
      if (existing.exists) {
        alreadyHadBadge++;
        continue;
      }
      awarded++;
      if (APPLY) {
        batch.set(badgeRef, {
          badgeKey: "founding_member",
          awardedAt: admin.firestore.FieldValue.serverTimestamp(),
          periodKey: null,
        });
      }
    }

    if (APPLY) {
      await batch.commit();
      console.log(`Committed batch ${i / BATCH_SIZE + 1} (${chunk.length} users checked)`);
    }
  }

  console.log(`\n${awarded} users would be newly awarded Founding Member.`);
  if (alreadyHadBadge > 0) {
    console.log(`${alreadyHadBadge} already had the badge (skipped).`);
  }

  if (APPLY) {
    await counterRef.set({ total: totalUsers });
    console.log(`\ncounters/foundingMember.total set to ${totalUsers}.`);
    console.log("✅ Backfill complete.");
  } else {
    console.log(`\ncounters/foundingMember.total would be set to ${totalUsers}.`);
    console.log("\nDry run only — pass --apply to write these changes.");
  }
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
