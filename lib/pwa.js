/**
 * Client-side PWA helpers. Browser-only functions guard on `window`/`navigator`
 * so they are safe to import from components that also render on the server.
 */

// Emergency kill switch: NEXT_PUBLIC_PWA_ENABLED=false + a redeploy makes every
// client unregister the service worker and clear its caches on next load.
export const PWA_ENABLED = process.env.NEXT_PUBLIC_PWA_ENABLED !== "false";

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
