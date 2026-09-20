/**
 * Client-side PWA helpers. Browser-only functions guard on `window`/`navigator`
 * so they are safe to import from components that also render on the server.
 */

// Emergency kill switch: NEXT_PUBLIC_PWA_ENABLED=false + a redeploy makes every
// client unregister the service worker and clear its caches on next load.
export const PWA_ENABLED = process.env.NEXT_PUBLIC_PWA_ENABLED !== "false";

// localStorage keys (all reads/writes go through the safe helpers below —
// storage can throw or be empty in private windows and must never break the app).
export const STORAGE_KEYS = {
  installed: "trybe_pwa_installed", // an install was accepted/observed on this device
  visits: "trybe_pwa_visits", // sessions seen, gates the smart prompt
  promptSnoozedUntil: "trybe_pwa_prompt_snoozed_until",
  installRecordedPrefix: "trybe_install_recorded_", // + uid; one server report per device per user
  postSignupInstall: "trybe_post_signup_install", // set when the /install gate sends someone to sign up
};

export const PROMPT_MIN_VISITS = 2;
export const PROMPT_DELAY_MS = 4000;
export const PROMPT_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
export const POST_SIGNUP_FLAG_TTL_MS = 60 * 60 * 1000;

export const SERVICE_WORKER_URL = "/sw.js";
export const CACHE_PREFIX = "trybe-";

/** True when the page is running as an installed app (all platforms, incl. iOS's navigator.standalone). */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  try {
    if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
    if (window.matchMedia?.("(display-mode: fullscreen)").matches) return true;
    if (window.matchMedia?.("(display-mode: minimal-ui)").matches) return true;
  } catch {
    // matchMedia unavailable — fall through to the iOS flag
  }
  return window.navigator?.standalone === true;
}

/** Registers the worker. Production builds only — a dev worker caches stale chunks. */
export async function registerServiceWorker() {
  if (process.env.NODE_ENV !== "production") return null;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" });
  } catch (error) {
    console.warn("Service worker registration failed:", error);
    return null;
  }
}

/** The kill switch's effect: remove every worker for this origin and our caches. */
export async function unregisterServiceWorkers() {
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
    if (typeof caches !== "undefined") {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith(CACHE_PREFIX)).map((n) => caches.delete(n)));
    }
  } catch (error) {
    console.warn("Service worker cleanup failed:", error);
  }
}

export function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // storage unavailable
  }
}

export function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
}

/** "ios" | "android" | "desktop". iPadOS 13+ reports itself as a Mac, hence the touch-points check. */
export function detectPlatform() {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

/**
 * Social-app / webview browsers (Instagram, Facebook, TikTok, WhatsApp, an
 * Android WebView…). They can't install a PWA, so the install page tells the
 * user to reopen the link in Safari or Chrome.
 */
export function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|FB_IAB|Instagram|TikTok|BytedanceWebview|musical_ly|Snapchat|Twitter|LinkedInApp|MicroMessenger|WhatsApp|GSA\/|; wv\)/i.test(ua);
}

export function markInstalledLocally() {
  safeSet(STORAGE_KEYS.installed, "1");
}

export function wasInstalledLocally() {
  return safeGet(STORAGE_KEYS.installed) === "1";
}

/** Remembers that a signed-out visitor was sent to sign up from /install, so home can bring them back once. */
export function setPostSignupInstallFlag() {
  safeSet(STORAGE_KEYS.postSignupInstall, Date.now());
}

/** True once (and clears itself) if the flag is set and fresh. */
export function consumePostSignupInstallFlag() {
  const raw = safeGet(STORAGE_KEYS.postSignupInstall);
  if (!raw) return false;
  safeRemove(STORAGE_KEYS.postSignupInstall);
  const at = Number(raw);
  return Number.isFinite(at) && Date.now() - at < POST_SIGNUP_FLAG_TTL_MS;
}

export function hasPostSignupInstallFlag() {
  const at = Number(safeGet(STORAGE_KEYS.postSignupInstall));
  return Number.isFinite(at) && at > 0 && Date.now() - at < POST_SIGNUP_FLAG_TTL_MS;
}
