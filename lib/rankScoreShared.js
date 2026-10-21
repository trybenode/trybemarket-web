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

/**
 * rankScore = tierWeight + vipTagBonus + boostBonus + shuffleFraction —
 * 07-ranking-unification.md §3, extended for fair rotation within a tier.
 *
 * shuffleFraction is always in [0, 1) — strictly smaller than the smallest
 * bonus above (VIP_TAG_BONUS=200) — so it can only ever break ties between
 * listings that are otherwise equal (same tier, same VIP/boost state); it
 * can never lift a listing across a tier or bonus boundary. This function
 * stays pure/deterministic on purpose: it never generates the random value
 * itself (that would make a resave-to-reroll exploit possible wherever this
 * gets called from a user-triggered recompute) — callers own the seed's
 * lifecycle (lib/rankScoreServer.js's recomputeRankForItem persists it and
 * only rerolls it from the daily reshuffle cron).
 */
export function computeRankScore({ sellerTier, isVip, isBoosted, boostEndDate, shuffleSeed }) {
  const tierWeight = TIER_WEIGHTS[sellerTier] ?? 0;
  const vipTagBonus = isVip ? VIP_TAG_BONUS : 0;
  const boostExpiry = toDateSafe(boostEndDate);
  const boostActive = !!isBoosted && !!boostExpiry && boostExpiry.getTime() > Date.now();
  const boostBonus = boostActive ? BOOST_BONUS : 0;
  const shuffleFraction =
    typeof shuffleSeed === "number" && shuffleSeed >= 0 && shuffleSeed < 1 ? shuffleSeed : 0;
  return tierWeight + vipTagBonus + boostBonus + shuffleFraction;
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

// Leading parts shorter than this aren't indexed — "ma" would match half the catalogue.
export const MIN_PREFIX_LENGTH = 3;

function prefixesOf(token) {
  const prefixes = [];
  for (let n = MIN_PREFIX_LENGTH; n < token.length; n++) prefixes.push(token.slice(0, n));
  return prefixes;
}

/**
 * A listing's searchKeywords. The title-like fields — name, brand, category
 * and subcategories — are indexed as whole words AND every leading part of
 * 3+ letters, so "ijebu" finds "Ijebufix" and "laptop" finds a listing in
 * "Laptops". The description is indexed as whole words only: the leading
 * parts of every description word would match far too much.
 */
export function computeSearchKeywords({ name, description, categoryId, subcategory, brand }) {
  const subcategories = Array.isArray(subcategory) ? subcategory : [subcategory];
  const title = tokenizeText([name, brand, categoryId, ...subcategories].filter(Boolean).join(" "));
  return [...new Set([...title, ...title.flatMap(prefixesOf), ...tokenizeText(description)])];
}

/**
 * The forms of a searched word that count as a match: the word itself and
 * its singular ("laptops" → "laptop", "boxes" → "box", "watches" → "watch"),
 * so searching a plural finds a listing that uses the singular. Only these
 * simple English plurals — "shoes" becomes "shoe", never "sho" (which would
 * match "shorts").
 */
export function searchVariants(token) {
  const variants = [token];
  if (/(x|z|ch|sh|ss)es$/.test(token)) variants.push(token.slice(0, -2));
  else if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) variants.push(token.slice(0, -1));
  return [...new Set(variants)];
}

/** Whether a listing's searchKeywords match every searched word (in any of its forms). */
export function matchesAllTokens(searchKeywords, tokens) {
  const keywords = new Set(searchKeywords || []);
  return tokens.every((token) => searchVariants(token).some((variant) => keywords.has(variant)));
}
