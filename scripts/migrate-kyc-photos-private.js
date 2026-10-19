/**
 * One-time migration: make every existing KYC photo private.
 *
 * KYC photos were uploaded with an unsigned preset to PUBLIC Cloudinary URLs
 * (anyone with a link could open a student's ID). New uploads are private
 * (lib/kycPhotos.js); this converts the existing ones — every asset in the
 * KycUploads folder — to authenticated delivery, and gives each KYC request a
 * `photos` map ({ front, back } -> { publicId, version }) that the app and the
 * admin app read.
 *
 * It's the one hard-to-undo step, so it's reversible:
 *   node scripts/migrate-kyc-photos-private.js
 *       dry run (default): lists what would change, writes nothing
 *   node scripts/migrate-kyc-photos-private.js --apply
 *       writes a backup file FIRST, then converts the assets and ADDS `photos`
 *       to each request. The old frontID/backID URL fields are left in place
 *       (a later cleanup removes them once everything is checked).
 *   node scripts/migrate-kyc-photos-private.js --revert <backup.json>
 *       turns the assets in the backup back to public and removes the
 *       `photos` entries this migration added — restoring the old state.
 *
 * Needs NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
 * CLOUDINARY_API_SECRET and the Firebase Admin env vars in .env.
 */
import fs from "fs";
import admin from "firebase-admin";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";

dotenv.config({ path: ".env" });

const {
  NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
  NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: CLOUD,
  CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET,
} = process.env;
if (!CLOUD || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  console.error("Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    clientEmail: FIREBASE_CLIENT_EMAIL,
    privateKey: FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
cloudinary.config({ cloud_name: CLOUD, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });

const db = admin.firestore();
const ASSET_FOLDER = "KycUploads";
const LEGACY_FIELDS = { frontID: "front", backID: "back" };
// Cloudinary's Admin API is rate-limited per hour; go gently.
const PAUSE_MS = 300;
const pause = () => new Promise((r) => setTimeout(r, PAUSE_MS));

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const REVERT = args.includes("--revert");
const revertFile = REVERT ? args[args.indexOf("--revert") + 1] : null;

/** public_id and version of a public delivery URL from our cloud, or null. */
function parseLegacyUrl(url) {
  const match = new RegExp(
    `^https://res\\.cloudinary\\.com/${CLOUD}/image/upload/(?:v(\\d+)/)?(.+)\\.(jpg|jpeg|png|gif|webp)$`,
    "i"
  ).exec(String(url || ""));
  return match ? { publicId: decodeURIComponent(match[2]), version: match[1] ? Number(match[1]) : null } : null;
}

async function listFolderAssets() {
  const assets = [];
  let cursor;
  do {
    const page = await cloudinary.api.resources_by_asset_folder(ASSET_FOLDER, {
      max_results: 500,
      ...(cursor ? { next_cursor: cursor } : {}),
    });
    assets.push(...page.resources);
    cursor = page.next_cursor;
    if (cursor) await pause();
  } while (cursor);
  return assets;
}

async function plan() {
  const assets = await listFolderAssets();
  const publicAssets = new Map(
    assets.filter((a) => a.type === "upload").map((a) => [a.public_id, a])
  );

  const requests = await db.collection("kycRequests").get();
  const references = []; // { requestId, slot, field, oldUrl, publicId, version }
  const unparsed = [];
  for (const doc of requests.docs) {
    const data = doc.data();
    for (const [field, slot] of Object.entries(LEGACY_FIELDS)) {
      if (!data[field] || data.photos?.[slot]) continue;
      const parsed = parseLegacyUrl(data[field]);
      if (!parsed) {
        unparsed.push({ requestId: doc.id, field, url: data[field] });
        continue;
      }
      references.push({ requestId: doc.id, slot, field, oldUrl: data[field], ...parsed });
    }
  }

  // Every public asset in the folder is converted, referenced or not; plus any
  // referenced public asset that sits outside the folder.
  const toConvert = new Map(publicAssets);
  for (const ref of references) {
    if (!toConvert.has(ref.publicId)) toConvert.set(ref.publicId, { public_id: ref.publicId, version: ref.version });
  }
  return { assets, publicAssets, requests, references, unparsed, toConvert };
}

async function dryRunOrApply() {
  const { assets, publicAssets, requests, references, unparsed, toConvert } = await plan();
  const referenced = new Set(references.map((r) => r.publicId));
  console.log(`\n=== MAKE KYC PHOTOS PRIVATE (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);
  console.log(`Assets in ${ASSET_FOLDER}: ${assets.length} (${publicAssets.size} public)`);
  console.log(`KYC requests: ${requests.size}; photo URLs to move into \`photos\`: ${references.length}`);
  console.log(`Assets to make private: ${toConvert.size} (${[...toConvert.keys()].filter((id) => !referenced.has(id)).length} not referenced by any request)`);
  if (unparsed.length) {
    console.log(`\nURLs not recognised (left as they are):`);
    unparsed.forEach((u) => console.log(`  ${u.requestId} ${u.field}: ${u.url}`));
  }

  if (!APPLY) {
    console.log("\nDry run — nothing changed. Re-run with --apply to convert.");
    return;
  }

  // Backup FIRST: nothing changes until it's on disk.
  const backupPath = `kyc-photo-migration-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  const backup = {
    createdAt: new Date().toISOString(),
    cloud: CLOUD,
    assets: [...toConvert.values()].map((a) => ({
      publicId: a.public_id,
      fromType: "upload",
      toType: "authenticated",
      version: a.version ?? null,
    })),
    requests: references.map(({ requestId, slot, field, oldUrl, publicId, version }) => ({
      requestId, slot, field, oldUrl, publicId, version,
    })),
  };
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
  const fd = fs.openSync(backupPath, "r");
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  console.log(`\nBackup written: ${backupPath} — keep a copy somewhere other than this machine.`);

  const newVersions = new Map();
  let converted = 0;
  for (const publicId of toConvert.keys()) {
    const result = await cloudinary.uploader.rename(publicId, publicId, {
      type: "upload",
      to_type: "authenticated",
      invalidate: true,
    });
    newVersions.set(publicId, result.version);
    converted++;
    if (converted % 10 === 0) console.log(`  ${converted}/${toConvert.size} made private`);
    await pause();
  }
  console.log(`Assets made private: ${converted}`);

  let updated = 0;
  for (const ref of references) {
    await db.collection("kycRequests").doc(ref.requestId).update({
      [`photos.${ref.slot}`]: { publicId: ref.publicId, version: newVersions.get(ref.publicId) ?? ref.version },
    });
    updated++;
  }
  console.log(`KYC request photos added: ${updated} (old frontID/backID fields kept)`);
  console.log(`\nDone. To undo: node scripts/migrate-kyc-photos-private.js --revert ${backupPath}`);
}

async function revert() {
  if (!revertFile || !fs.existsSync(revertFile)) {
    console.error("Usage: --revert <backup.json>");
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(revertFile, "utf8"));
  if (backup.cloud !== CLOUD) {
    console.error(`Backup is for cloud ${backup.cloud}, not ${CLOUD}`);
    process.exit(1);
  }
  console.log(`\n=== REVERT KYC PHOTO MIGRATION (${revertFile}) ===\n`);

  let restored = 0;
  for (const asset of backup.assets) {
    try {
      await cloudinary.uploader.rename(asset.publicId, asset.publicId, {
        type: asset.toType,
        to_type: asset.fromType,
        invalidate: true,
      });
      restored++;
    } catch (error) {
      console.error(`  ${asset.publicId}: ${error.message}`);
    }
    await pause();
  }
  console.log(`Assets made public again: ${restored}/${backup.assets.length}`);

  let cleared = 0;
  for (const ref of backup.requests) {
    const docRef = db.collection("kycRequests").doc(ref.requestId);
    const snap = await docRef.get();
    // Only remove what the migration added — a photo from a newer submission stays.
    if (snap.exists && snap.data().photos?.[ref.slot]?.publicId === ref.publicId) {
      await docRef.update({ [`photos.${ref.slot}`]: admin.firestore.FieldValue.delete() });
      cleared++;
    }
  }
  console.log(`KYC request photos removed: ${cleared} (frontID/backID were never touched)`);
}

(REVERT ? revert() : dryRunOrApply())
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
