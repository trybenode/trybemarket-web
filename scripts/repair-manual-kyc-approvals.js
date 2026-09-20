/**
 * One-time repair: KYC requests that an admin approved through the OLD admin
 * app flow — which only wrote kycRequests.status from the browser and never
 * set users.isVerified — left the student shown as "Verified" while getting no
 * verified status, no 150 App Credit, no Verified Student badge, and no
 * one-matric-one-account claim. This runs each stuck request through the same
 * lib/kycServer.js finalizeKyc transaction an OCR approval uses, so they end up
 * exactly as if they had been approved properly.
 *
 * Safe by construction:
 *  - Every award is idempotent (fixed-ID docs), so re-running is a no-op.
 *  - A request is SKIPPED, never rejected, if: there is no user account behind
 *    it, the matric number is missing/invalid, or the matric is already claimed
 *    by a DIFFERENT user or shared by another stuck request. (Passing such a
 *    row to finalizeKyc would flip an admin-approved request to "rejected".)
 *  - Statuses with stray whitespace ("verified\n") are matched and normalized.
 *  - No email is sent (these students were told they were approved long ago).
 *  - The original reviewedAt is preserved as originalReviewedAt.
 *
 * Defaults to a dry run. Pass --apply to actually write to Firestore.
 */

// Must be the FIRST import: ESM evaluates imports in order, and lib/kycServer.js
// (via lib/firebaseAdmin.js) initializes Firebase from the environment on load.
import "dotenv/config";
import admin from "firebase-admin";
import { finalizeKyc, normalizeMatric, isValidNormalizedMatric, KYC_CREDIT_AMOUNT } from "../lib/kycServer.js";

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
const looksVerified = (status) => /verified|approved/i.test(String(status));

async function run() {
  console.log(`\n=== REPAIR MANUAL KYC APPROVALS (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const requests = (await db.collection("kycRequests").get()).docs.filter((d) => looksVerified(d.data().status));
  const stuck = [];
  for (const doc of requests) {
    const userSnap = await db.collection("users").doc(doc.id).get();
    if (userSnap.exists && userSnap.data().isVerified === true) continue; // already fine
    stuck.push({ id: doc.id, kyc: doc.data(), userExists: userSnap.exists });
  }

  const matricUse = new Map();
  for (const row of stuck) {
    row.matric = row.kyc.matricNumber ? normalizeMatric(row.kyc.matricNumber) : "";
    if (row.matric) matricUse.set(row.matric, [...(matricUse.get(row.matric) || []), row.id]);
  }

  let credited = 0;
  const skipped = [];
  for (const row of stuck) {
    const problems = [];
    if (!row.userExists) problems.push("no user account");
    if (!isValidNormalizedMatric(row.matric)) problems.push("missing/invalid matric");
    else {
      const claim = await db.collection("kycMatricClaims").doc(row.matric).get();
      if (claim.exists && claim.data().userId !== row.id) problems.push(`matric already claimed by ${claim.data().userId}`);
      if (matricUse.get(row.matric).length > 1) problems.push("matric shared with another stuck request");
    }

    if (problems.length) {
      skipped.push({ id: row.id, problems });
      console.log(`  SKIP  ${row.id}: ${problems.join("; ")}`);
      continue;
    }

    console.log(`  ${APPLY ? "FIX " : "would fix"}  ${row.id} (${row.kyc.fullName ?? "?"})`);
    if (APPLY) {
      const kycRef = db.collection("kycRequests").doc(row.id);
      if (row.kyc.reviewedAt) await kycRef.update({ originalReviewedAt: row.kyc.reviewedAt });
      const result = await finalizeKyc(row.id, {
        ocrStatus: "verified",
        matricNumber: row.kyc.matricNumber,
        reviewedBy: row.kyc.reviewedBy || "system:manual-approval-repair",
      });
      if (result.status !== "verified") throw new Error(`Unexpected non-verified result for ${row.id}: ${JSON.stringify(result)}`);
    }
    credited++;
  }

  console.log(`\n${credited} request(s) ${APPLY ? "repaired" : "would be repaired"} (${credited} x ${KYC_CREDIT_AMOUNT} = ${credited * KYC_CREDIT_AMOUNT} credits).`);
  console.log(`${skipped.length} skipped (left untouched, need a manual look).`);
  if (!APPLY) console.log("\nDry run only — pass --apply to write these changes.");
  else console.log("\n✅ Repair complete.");
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Repair failed:", error);
    process.exit(1);
  });
