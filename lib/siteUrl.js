/**
 * The public address of the web app — the single place every absolute link
 * (metadata, sitemap, canonical URLs, links inside emails, the payment
 * callback, the referral-link fallback) is built from.
 *
 * The official address is https://trybemarket.online, and that is the default.
 * To point a deployment at a different address — for example the Vercel test
 * domain while trybemarket.online isn't active — set NEXT_PUBLIC_SITE_URL in
 * that deployment's environment (no code change). NEXT_PUBLIC_BASE_URL, which
 * the payment callback used to read on its own, is still honoured as a
 * fallback so existing deployments behave exactly as before. Pure and
 * dependency-free so client code, server code and email templates can all
 * import it.
 *
 * Email ADDRESSES (contact@trybemarket.online, the Resend "from" sender) are a
 * separate matter: they depend on the mail domain being verified, not on where
 * the website lives, and are deliberately not derived from this.
 */
export const DEFAULT_SITE_URL = "https://trybemarket.online";

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  DEFAULT_SITE_URL
).replace(/\/+$/, "");

/** "trybemarket.online" — for display text. */
export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");
