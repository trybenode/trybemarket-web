/**
 * One-time backfill: create a kycMatricClaims/{normalizedMatric} doc for every
 * user who is ALREADY verified, so the one-matric-one-account rule in
 * app/api/kyc-submit/route.js applies to accounts verified before that rule
 * existed (otherwise an old account's matric number could be re-used to
 * verify a second, new account).
 *
 * Never unverifies, deletes, or modifies any user. If several already-verified
 * users share one matric number, the claim goes to whichever was verified
 * first and the rest are REPORTED (not touched) for manual review — those
 * accounts stay verified, they just can't re-run KYC under that matric.
 *
 * Idempotent: skips any claim doc that already exists.
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

// Must match normalize() and the length bounds in app/api/kyc-submit/route.js.
const MIN_LEN = 4;
const MAX_LEN = 40;
function normalize(str) {
  return String(str).toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
}

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

async function run() {
  console.log(`\n=== BACKFILL KYC MATRIC CLAIMS (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const usersSnap = await db.collection("users").where("isVerified", "==", true).get();
  console.log(`Found ${usersSnap.size} verified users.\n`);

  const byMatric = new Map(); // normalizedMatric -> [{ userId, verifiedAtMs }]
  let noKycRecord = 0;
  let noMatric = 0;
  let invalidMatric = 0;

  for (const userDoc of usersSnap.docs) {
    const kycSnap = await db.collection("kycRequests").doc(userDoc.id).get();
    if (!kycSnap.exists) {
      noKycRecord++;
      continue;
    }
    const kyc = kycSnap.data();
    if (!kyc.matricNumber) {
      noMatric++;
      continue;
    }
    const normalized = normalize(kyc.matricNumber);
    if (normalized.length < MIN_LEN || normalized.length > MAX_LEN) {
      invalidMatric++;
      console.log(`  ⚠️  ${userDoc.id}: matric "${kyc.matricNumber}" normalizes to an invalid length — skipped.`);
      continue;
    }
    const bucket = byMatric.get(normalized) || [];
    bucket.push({ userId: userDoc.id, verifiedAtMs: toMillis(kyc.reviewedAt) || toMillis(kyc.submittedAt) });
    byMatric.set(normalized, bucket);
  }

  let toCreate = 0;
  let alreadyClaimed = 0;
  const conflicts = [];

  for (const [normalized, holders] of byMatric) {
    holders.sort((a, b) => a.verifiedAtMs - b.verifiedAtMs);
    const [winner, ...duplicates] = holders;

    if (duplicates.length > 0) {
      conflicts.push({ normalized, winner: winner.userId, duplicates: duplicates.map((d) => d.userId) });
    }

    const claimRef = db.collection("kycMatricClaims").doc(normalized);
    const existing = await claimRef.get();
    if (existing.exists) {
      alreadyClaimed++;
      continue;
    }
    toCreate++;
    if (APPLY) {
      await claimRef.set({
        userId: winner.userId,
        claimedAt: admin.firestore.FieldValue.serverTimestamp(),
        backfilled: true,
      });
    }
  }

  console.log(`${toCreate} claim(s) ${APPLY ? "created" : "would be created"}.`);
  if (alreadyClaimed > 0) console.log(`${alreadyClaimed} already existed (skipped).`);
  if (noKycRecord > 0) console.log(`${noKycRecord} verified user(s) had no kycRequests record (skipped).`);
  if (noMatric > 0) console.log(`${noMatric} verified user(s) had no matric number on record (skipped).`);
  if (invalidMatric > 0) console.log(`${invalidMatric} had an invalid-length matric (skipped, see warnings above).`);

  if (conflicts.length > 0) {
    console.log(`\n⚠️  ${conflicts.length} matric number(s) are shared by multiple ALREADY-verified accounts:`);
    for (const c of conflicts) {
      console.log(`  matric "${c.normalized}": claim goes to ${c.winner}; also verified: ${c.duplicates.join(", ")}`);
    }
    console.log("These accounts were NOT modified. Review them manually.");
  }

  if (!APPLY) console.log("\nDry run only — pass --apply to write these changes.");
  else console.log("\n✅ Backfill complete.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
