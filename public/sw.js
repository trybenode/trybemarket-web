/*
 * TrybeMarket service worker.
 *
 * Deliberately small. It exists so the app is installable and shows a branded
 * screen offline — NOT to make the app work offline. Nothing user-specific is
 * ever stored: HTML is never cached, and API / Firebase / payment traffic is
 * never touched.
 *
 * Only three kinds of request are handled; every other request falls through
 * to the browser untouched (no respondWith), which is what makes the bypass
 * list below safe by construction rather than by a blocklist that could go
 * stale:
 *   1. Same-origin page navigations  network-first, /offline.html if the network fails
 *   2. /_next/static/*               cache-first (hashed filenames, immutable)
 *   3. res.cloudinary.com images     stale-while-revalidate, capped
 *
 * Never handled (explicitly excluded even where they'd otherwise match):
 * non-GET, /api/*, Next RSC/prefetch requests, /__/ (Firebase auth handler),
 * and every cross-origin host except Cloudinary images — Firestore, Firebase
 * Auth/Storage, Paystack, Google/GA, the Cloudinary upload API, Vercel insights.
 *
 * Emergency exit: set NEXT_PUBLIC_PWA_ENABLED=false and redeploy — the app
 * then unregisters this worker and clears its caches (components/PwaBootstrap.jsx).
 */

const VERSION = "v1";
const SHELL_CACHE = `trybe-shell-${VERSION}`;
const STATIC_CACHE = `trybe-static-${VERSION}`;
const IMAGE_CACHE = `trybe-images-${VERSION}`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, IMAGE_CACHE];

const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icons/icon-512.png"];
const MAX_IMAGE_ENTRIES = 60;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("trybe-") && !CURRENT_CACHES.includes(name))
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isRscRequest(request, url) {
  return (
    url.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1"
  );
}

function isNavigation(request, url) {
  return (
    request.mode === "navigate" &&
    url.origin === self.location.origin &&
    !url.pathname.startsWith("/api/") &&
    !url.pathname.startsWith("/__/")
  );
}

function isStaticAsset(url) {
  return url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
}

function isCloudinaryImage(request, url) {
  return (
    url.hostname === "res.cloudinary.com" &&
    request.destination === "image" &&
    url.pathname.includes("/image/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isRscRequest(request, url)) return;

  if (isNavigation(request, url)) {
    event.respondWith(networkFirstNavigation(request));
  } else if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (isCloudinaryImage(request, url)) {
    event.respondWith(staleWhileRevalidateImage(event));
  }
});

// Falls back to the offline page only when the network itself fails (a
// rejected fetch). A 404/500 from the server is a real answer and is returned.
async function networkFirstNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cached = await caches.match(OFFLINE_URL);
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// <img> loads are no-cors, which yields opaque responses whose cache quota
// cost is heavily padded. Re-request with CORS (Cloudinary allows it) so the
// stored copy is a normal response; if that fails, just serve the original
// request uncached.
async function fetchCorsImage(request) {
  const response = await fetch(new Request(request.url, { mode: "cors", credentials: "omit" }));
  if (!response.ok) throw new Error(`image ${response.status}`);
  return response;
}

async function staleWhileRevalidateImage(event) {
  const { request } = event;
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request.url);

  const refresh = fetchCorsImage(request)
    .then(async (response) => {
      await cache.put(request.url, response.clone());
      await trimCache(cache, MAX_IMAGE_ENTRIES);
      return response;
    })
    .catch(() => null);

  if (cached) {
    // Keep the worker alive long enough to finish refreshing in the background.
    event.waitUntil(refresh);
    return cached;
  }
  return (await refresh) || fetch(request);
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const excess = keys.length - maxEntries;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]); // oldest first
}
