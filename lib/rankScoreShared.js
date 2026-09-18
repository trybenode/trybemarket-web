/**
 * Pure ranking logic shared between server code (lib/rankScoreServer.js,
 * Admin SDK) and client code (components/SearchBar.jsx) — no Firestore
 * imports of any kind here, so this is safe to bundle into either.
 * See 07-ranking-unification.md.
 */

import { TIER_WEIGHTS, VIP_TAG_BONUS, BOOST_BONUS } from "./rankScoreConstants.js";

function toDateSafe(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.toMillis === "function") return new Date(value.toMillis());
  if (value._seconds !== undefined) return new Date(value._seconds * 1000);
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  return new Date(value);
}

/** rankScore = tierWeight + vipTagBonus + boostBonus — 07-ranking-unification.md §3. */
export function computeRankScore({ sellerTier, isVip, isBoosted, boostEndDate }) {
  const tierWeight = TIER_WEIGHTS[sellerTier] ?? 0;
  const vipTagBonus = isVip ? VIP_TAG_BONUS : 0;
  const boostExpiry = toDateSafe(boostEndDate);
  const boostActive = !!isBoosted && !!boostExpiry && boostExpiry.getTime() > Date.now();
  const boostBonus = boostActive ? BOOST_BONUS : 0;
  return tierWeight + vipTagBonus + boostBonus;
}

/**
 * "Good enough for now" tokenizer (07-ranking-unification.md §6) — lowercase,
 * split on non-alphanumeric, drop tokens under 2 chars, dedupe.
 */
export function tokenizeText(text) {
  if (!text) return [];
  const tokens = String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  return [...new Set(tokens)];
}

export function computeSearchKeywords({ name, description, categoryId }) {
  return tokenizeText([name, description, categoryId].filter(Boolean).join(" "));
}
