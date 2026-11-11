/**
 * Listing search on the server — the same logic the website's search box
 * runs in the browser (components/SearchBar.jsx), built from the same pure
 * helpers in lib/rankScoreShared.js, so a count given over WhatsApp matches
 * what the site shows:
 *
 *   1. query `searchKeywords` for the longest searched word (in any of its
 *      forms), best-ranked first, up to SEARCH_LIMIT listings
 *   2. keep the ones that match every searched word
 *
 * Like the site it looks at the top SEARCH_LIMIT candidates only, so a count
 * that reaches the limit means "that many or more". Held listings live in
 * `heldListings`, not `products`, so they're never counted. All schools, like
 * the site today.
 *
 * `fetchCandidates(variants, limit)` is passed in so the matching can be
 * tested without Firestore; searchProducts() wires it to the database.
 */
import { matchesAllTokens, searchVariants, tokenizeText } from "./rankScoreShared.js";

export const SEARCH_LIMIT = 60;

/**
 * @returns {Promise<{ tokens: string[], count: number, capped: boolean }>}
 *   tokens is empty when the query has nothing searchable in it;
 *   capped is true when the count reached SEARCH_LIMIT (there may be more).
 */
export async function countMatches(query, fetchCandidates, limit = SEARCH_LIMIT) {
  const tokens = tokenizeText(query);
  if (tokens.length === 0) return { tokens, count: 0, capped: false };
  const anchor = [...tokens].sort((a, b) => b.length - a.length)[0];
  const candidates = await fetchCandidates(searchVariants(anchor), limit);
  const count = candidates.filter((keywords) => matchesAllTokens(keywords, tokens)).length;
  return { tokens, count, capped: count >= limit };
}

/** Live products matching `query`. Reads at most SEARCH_LIMIT documents (only their searchKeywords). */
export async function searchProducts(query) {
  const { adminDB } = await import("./firebaseAdmin.js");
  return countMatches(query, async (variants, limit) => {
    const snap = await adminDB
      .collection("products")
      .where("searchKeywords", "array-contains-any", variants)
      .orderBy("rankScore", "desc")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .select("searchKeywords")
      .get();
    return snap.docs.map((doc) => doc.data().searchKeywords || []);
  });
}
