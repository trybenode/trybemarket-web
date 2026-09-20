import { normalizeReferralCode } from "./crsaConstants.js";

export const PWA_THEME_COLOR = "#2563eb";
export const PWA_BACKGROUND_COLOR = "#ffffff";

/**
 * The one web app manifest, shared by app/manifest.js (the default, served at
 * /manifest.webmanifest) and app/pwa-manifest/route.js (the same manifest with
 * a referral code baked into start_url).
 *
 * The ref variant exists because an installed iOS app has storage separate
 * from Safari, so a ?ref= captured in Safari is invisible to the installed
 * app. Baking the code into start_url means the installed app opens with it in
 * its own URL, where the global ReferralCapture stores it. `id` stays "/" so
 * both variants are the same app identity. The code is re-validated here and
 * anything that isn't a well-formed code is dropped, so a crafted ?ref= can't
 * inject arbitrary text into start_url.
 */
export function buildManifest({ ref } = {}) {
  const code = normalizeReferralCode(ref);
  const startUrl = code ? `/?source=pwa&ref=${code}` : "/?source=pwa";

  return {
    id: "/",
    name: "TrybeMarket",
    short_name: "TrybeMarket",
    description: "Buy, sell and hire services on campus.",
    start_url: startUrl,
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: PWA_BACKGROUND_COLOR,
    theme_color: PWA_THEME_COLOR,
    categories: ["shopping", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Explore Services", url: "/explore-services?source=pwa" },
      { name: "My Shop", url: "/my-shop?source=pwa" },
      { name: "Messages", url: "/messages?source=pwa" },
      { name: "Sell", url: "/upload?source=pwa" },
    ].map((s) => ({ ...s, icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }] })),
  };
}
