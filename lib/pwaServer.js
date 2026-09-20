import admin from "firebase-admin";
import { adminDB } from "./firebaseAdmin.js";
import { prepareInstallCount, applyInstallCount } from "./crsaServer.js";

/**
 * App-install recording. The client reports "this signed-in user is running the
 * installed app" (components/PwaBootstrap.jsx); nothing here is verified beyond
 * identity, which is why an install only counts toward an ambassador's stats
 * for a KYC-verified referral (see prepareInstallCount in lib/crsaServer.js).
 *
 *   pwaInstalls/{uid}  { installedAt, platform, source, countedForCrsa }
 */

export const INSTALL_PLATFORMS = ["ios", "android", "desktop"];
export const INSTALL_SOURCES = ["standalone", "appinstalled"];

/** Client input is only ever an allow-listed label; anything else is stored as "unknown". */
export function sanitizeInstallField(value, allowed) {
  return typeof value === "string" && allowed.includes(value) ? value : "unknown";
}

/**
 * Idempotent: the first call creates pwaInstalls/{uid}; later calls change
 * nothing about the record. Each call still re-attempts the ambassador count —
 * cheap, and safe because the install marker doc guards it — so an install
 * whose count was skipped earlier (e.g. the referrer was inactive then) is
 * picked up once it becomes countable.
 *
 * @returns {{ recorded: boolean, counted: boolean }} recorded = first time seen, counted = added to an ambassador's installs this call
 */
export async function recordInstall(uid, { platform, source } = {}) {
  const pwaRef = adminDB.collection("pwaInstalls").doc(uid);

  return adminDB.runTransaction(async (tx) => {
    // All reads first.
    const pwaSnap = await tx.get(pwaRef);
    const plan = await prepareInstallCount(tx, uid);

    if (!pwaSnap.exists) {
      tx.set(pwaRef, {
        installedAt: admin.firestore.FieldValue.serverTimestamp(),
        platform: sanitizeInstallField(platform, INSTALL_PLATFORMS),
        source: sanitizeInstallField(source, INSTALL_SOURCES),
        countedForCrsa: !!plan,
      });
    } else if (plan) {
      tx.update(pwaRef, { countedForCrsa: true });
    }
    if (plan) applyInstallCount(tx, plan);

    return { recorded: !pwaSnap.exists, counted: !!plan };
  });
}
