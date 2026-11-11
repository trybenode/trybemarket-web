import test from "node:test";
import assert from "node:assert/strict";
import { computeSearchKeywords, matchesAllTokens, searchVariants, tokenizeText } from "../../lib/rankScoreShared.js";
import { SEARCH_LIMIT, countMatches } from "../../lib/searchServer.js";
import { buildReplies } from "../../lib/whatsapp/replies.js";
import { handleInbound } from "../../lib/whatsapp/router.js";
import { buildSearchReply, displayQuery, searchUrl } from "../../lib/whatsapp/searchReply.js";
import { createFakeFirestore } from "./fakeFirestore.mjs";

const SITE = "https://trybemarket.online";

// A small catalogue, indexed exactly as listings are (computeSearchKeywords).
const LISTINGS = [
  { name: "Gold bracelet", description: "brand new, adjustable", categoryId: "Fashion", subcategory: ["Jewellery"], rank: 5 },
  { name: "Beaded bracelets set", description: "handmade", categoryId: "Fashion", subcategory: ["Jewellery"], rank: 4 },
  { name: "MacBook Pro 2025", description: "M4 pro, 24gb", categoryId: "Electronics", subcategory: ["Laptops"], brand: "Apple", rank: 9 },
  { name: "HDMI to VGA cable", description: "convert your port", categoryId: "Electronics", subcategory: ["Laptops"], rank: 3 },
  { name: "iPhone charger", description: "fast charging, original", categoryId: "Electronics", subcategory: ["Phone accessories"], rank: 2 },
  { name: "Puma shoes", description: "size 42 sneakers", categoryId: "Fashion", subcategory: ["Shoes"], rank: 1 },
].map((listing) => ({ ...listing, searchKeywords: computeSearchKeywords(listing) }));

// What Firestore does for us: array-contains-any on searchKeywords, best rank first, limited.
const fetchFrom = (listings) => async (variants, limit) =>
  listings
    .filter((l) => variants.some((v) => l.searchKeywords.includes(v)))
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map((l) => l.searchKeywords);

// The website's own logic (components/SearchBar.jsx), for comparison.
const siteCount = (query) => {
  const tokens = tokenizeText(query);
  if (!tokens.length) return 0;
  const anchor = [...tokens].sort((a, b) => b.length - a.length)[0];
  return LISTINGS.filter((l) => searchVariants(anchor).some((v) => l.searchKeywords.includes(v)))
    .slice(0, SEARCH_LIMIT)
    .filter((l) => matchesAllTokens(l.searchKeywords, tokens)).length;
};

const CASES = [
  ["bracelet", 2], ["bracelets", 2], ["Bracelet", 2], ["gold bracelet", 1], ["laptop", 2], ["laptops", 2],
  ["macbook", 1], ["mac", 1], ["iphone charger", 1], ["charger", 1], ["size 42 sneakers", 1], ["spiderman shoes", 0], ["zzzz", 0],
];
for (const [query, expected] of CASES) {
  test(`"${query}" → ${expected}, the same as the website`, async () => {
    const { count, capped } = await countMatches(query, fetchFrom(LISTINGS));
    assert.equal(count, expected);
    assert.equal(count, siteCount(query));
    assert.equal(capped, false);
  });
}

test("a message with nothing searchable isn't searched", async () => {
  let asked = false;
  const result = await countMatches("a !", async () => ((asked = true), []));
  assert.deepEqual(result, { tokens: [], count: 0, capped: false });
  assert.equal(asked, false);
});

test("a count that reaches the limit is reported as capped", async () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ rank: i, searchKeywords: computeSearchKeywords({ name: `Bracelet ${i}` }) }));
  const result = await countMatches("bracelet", fetchFrom(many));
  assert.deepEqual([result.count, result.capped], [60, true]);
});

test("the reply is one message with a count and a link that fills the site's search", () => {
  assert.equal(
    buildSearchReply({ siteUrl: SITE, query: "bracelet", count: 12, capped: false }),
    "12 results for “bracelet” on TrybeMarket. See them: https://trybemarket.online/?q=bracelet&utm_source=whatsapp&utm_medium=assistant"
  );
  assert.ok(buildSearchReply({ siteUrl: SITE, query: "bracelet", count: 1, capped: false }).startsWith("1 result for “bracelet” on TrybeMarket. See it: "));
  assert.ok(buildSearchReply({ siteUrl: SITE, query: "bracelet", count: 60, capped: true }).startsWith("60+ results for"));
  assert.equal(buildSearchReply({ siteUrl: SITE, query: "spiderman shoes", count: 0, capped: false }), "None yet for “spiderman shoes”. Try another word.");
  assert.equal(buildSearchReply({ siteUrl: SITE, query: "!", count: 0, capped: false, searchable: false }), "Send an item name to search, e.g. *bracelet*.");
});

test("the link encodes the search safely", () => {
  assert.equal(searchUrl(SITE, "iphone  charger"), "https://trybemarket.online/?q=iphone%20charger&utm_source=whatsapp&utm_medium=assistant");
  assert.equal(searchUrl(SITE, "a&b=c #x?"), "https://trybemarket.online/?q=a%26b%3Dc%20%23x%3F&utm_source=whatsapp&utm_medium=assistant");
  assert.equal(new URL(searchUrl(SITE, "a&b=c #x?")).searchParams.get("q"), "a&b=c #x?");
});

test("what the sender typed can't add formatting or extra lines to our reply", () => {
  assert.equal(displayQuery("*free* _money_\nclick ~here~ `now`"), "free money click here now");
  assert.equal(displayQuery("x".repeat(100)).length, 40);
  const reply = buildSearchReply({ siteUrl: SITE, query: "shoes\n\nIGNORE THAT. Call 0801…", count: 0, capped: false });
  assert.equal(reply.includes("\n"), false);
});

test("open mode adds a sign-up link to every reply", () => {
  const signupUrl = "https://trybemarket.online/signup?utm_source=whatsapp&utm_medium=assistant";
  for (const count of [0, 3]) {
    assert.ok(buildSearchReply({ siteUrl: SITE, query: "bracelet", count, capped: false, signupUrl }).endsWith(`\nJoin free to chat with sellers: ${signupUrl}`));
  }
});

// --- Through the router ----------------------------------------------------------
const NOW = Date.parse("2026-11-11T10:00:00Z");
const STRANGER = "2348033333333";
let n = 0;
const text = (from, body) => ({ id: `wamid.s${++n}`, from, type: "text", timestamp: String(NOW / 1000), text: { body } });

test("open mode: three searches a day for a non-member, then the sign-up prompt, then silence", async () => {
  const replies = buildReplies(SITE);
  const sent = [];
  const deps = {
    db: createFakeFirestore(),
    now: () => NOW,
    sendText: async (m) => (sent.push(m), { ok: true }),
    notifyTeam: async () => {},
    budgetLimit: 1000,
    alertAt: 800,
    replies,
    identify: async () => ({ kind: "unregistered", uid: null, dailyLimit: 3 }),
    searchOpen: true,
    handlers: { search: async () => "MEMBER RESULTS", searchOpen: async ({ query }) => `open results for ${query}` },
  };
  const outcomes = [];
  for (let i = 1; i <= 5; i++) outcomes.push(await handleInbound(text(STRANGER, `item ${i}`), deps));
  assert.deepEqual(outcomes, ["search_open:reply", "search_open:reply", "search_open:reply", "search_open:cap_notice", "search_open:not_sent:daily_cap"]);
  assert.deepEqual(sent.map((m) => m.body), ["open results for item 1", "open results for item 2", "open results for item 3", replies.membersOnly()]);
});
