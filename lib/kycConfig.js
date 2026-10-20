import { adminDB } from "./firebaseAdmin.js";

/**
 * KYC settings an admin can change without a deploy (Firestore config/kyc —
 * readable by signed-in users, writable by admins; see firestore.rules).
 * The session rolls over each year, and portal auto-pass is switched on once
 * enough reviewed screenshots show the OCR agrees with the admins.
 */
export const KYC_CONFIG_DEFAULTS = Object.freeze({
  currentSession: "2026/2027",
  portalAutopass: false,
  // Once auto-pass is on, this many passing screenshots still go to review first.
  portalAutopassReviewFirst: 20,
  provisionalDays: 365,
  pausedPlanLapseDays: 90,
});

const CACHE_MS = 60 * 1000;
let cached = null;
let cachedAt = 0;

/** The KYC config with defaults for anything unset. Cached for a minute. */
export async function getKycConfig() {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  let stored = {};
  try {
    const snap = await adminDB.collection("config").doc("kyc").get();
    stored = snap.exists ? snap.data() : {};
  } catch (error) {
    console.error("Couldn't read config/kyc — using defaults:", error);
  }
  const config = { ...KYC_CONFIG_DEFAULTS };
  for (const key of Object.keys(KYC_CONFIG_DEFAULTS)) {
    if (stored[key] !== undefined && typeof stored[key] === typeof KYC_CONFIG_DEFAULTS[key]) config[key] = stored[key];
  }
  if (!/^\d{4}\/\d{4}$/.test(config.currentSession)) config.currentSession = KYC_CONFIG_DEFAULTS.currentSession;
  cached = Object.freeze(config);
  cachedAt = Date.now();
  return cached;
}
