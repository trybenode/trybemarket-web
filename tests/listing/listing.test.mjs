import test from "node:test";
import assert from "node:assert/strict";
import { ListingError, createListingCore } from "../../lib/listingCore.js";
import { isListingImageUrl, validateListingInput } from "../../lib/listingValidation.js";
import { MAX_LISTING_PHOTOS, photosThatFit } from "../../lib/listingPhotos.js";
import { resolveLimits } from "../../lib/planLimitsServer.js";
import { createFakeFirestore } from "../whatsapp/fakeFirestore.mjs";

const CLOUD = "dj21x4jnt";
const IMG = (n = 1) => `https://res.cloudinary.com/${CLOUD}/image/upload/q_auto,f_auto,w_1200/v17${n}/market_trybe_products/photo${n}.jpg`;
const NOW = Date.parse("2026-11-13T10:00:00Z");
const FUTURE = "2027-01-01T00:00:00.000Z";
const PAST = "2026-10-18T21:43:50.383Z";

const product = (over = {}) => ({
  name: "  Gold   bracelet ", subcategory: ["Jewellery"], categoryId: "Fashion", negotiable: true,
  description: "Brand new, adjustable.", brand: "None", condition: "New", color: "Gold",
  price: "3500", originalPrice: "", year: "2026", images: [IMG(1), IMG(2)], ...over,
});
const service = (over = {}) => ({
  name: "Braids", categoryId: "Beauty & Styling", description: "Neat braids, home service.",
  price: 5000, availability: { type: "on_contact" }, images: [IMG(3)], ...over,
});

// ---------------------------------------------------------------- validation
test("a product is cleaned and only the form's fields are kept", () => {
  const result = validateListingInput("product", { ...product(), userId: "someone-else", isVip: true, rankScore: 9999, isBoosted: true, sellerTier: "vip" }, { cloudName: CLOUD });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    name: "Gold bracelet", subcategory: ["Jewellery"], categoryId: "Fashion", negotiable: true,
    description: "Brand new, adjustable.", brand: "None", condition: "New", color: "Gold",
    price: 3500, originalPrice: "", year: "2026", images: [IMG(1), IMG(2)],
  });
});

test("a service keeps its availability, with times only when specific", () => {
  assert.deepEqual(validateListingInput("service", service(), { cloudName: CLOUD }).data.availability, { type: "on_contact" });
  const timed = validateListingInput("service", service({ availability: { type: "specific_time", start: "09:00", end: "17:30", extra: "x" } }), { cloudName: CLOUD });
  assert.deepEqual(timed.data.availability, { type: "specific_time", start: "09:00", end: "17:30" });
  assert.equal(validateListingInput("service", service({ availability: { type: "specific_time", start: "17:00", end: "09:00" } }), { cloudName: CLOUD }).ok, false);
  assert.equal(validateListingInput("service", service({ availability: { type: "whenever" } }), { cloudName: CLOUD }).ok, false);
  assert.equal(validateListingInput("service", service({ price: 0 }), { cloudName: CLOUD }).ok, true); // "price on request"
  assert.equal(validateListingInput("service", service({ price: "abc" }), { cloudName: CLOUD }).ok, false);
});

const BAD_PRODUCTS = [
  ["no name", { name: "   " }],
  ["a name that's too long", { name: "x".repeat(151) }],
  ["no category", { categoryId: "" }],
  ["no description", { description: "" }],
  ["a negative price", { price: -1 }],
  ["a price that isn't a number", { price: "three thousand" }],
  ["an absurd price", { price: 1e12 }],
  ["no photos", { images: [] }],
  ["six photos", { images: [1, 2, 3, 4, 5, 6].map(IMG) }],
  ["the same photo twice", { images: [IMG(1), IMG(1)] }],
  ["a photo hosted somewhere else", { images: ["https://evil.example/pixel.png"] }],
  ["a photo from another Cloudinary account", { images: [IMG(1).replace(CLOUD, "othercloud")] }],
  ["a private KYC photo", { images: [`https://res.cloudinary.com/${CLOUD}/image/authenticated/v1/kyc/u1/front.jpg`] }],
  ["a photo address with a query string", { images: [`${IMG(1)}?x=1`] }],
  ["subcategories that are neither a list nor text", { subcategory: { a: 1 } }],
  ["a bad original price", { originalPrice: "free" }],
  ["a field that's far too long", { color: "c".repeat(301) }],
];
for (const [label, over] of BAD_PRODUCTS) {
  test(`a product with ${label} is refused`, () => {
    assert.equal(validateListingInput("product", product(over), { cloudName: CLOUD }).ok, false);
  });
}

// Things real sellers do today (found by checking every listing in production)
// that must NOT be refused.
test("several colours in one field, five photos and a long description are all accepted", () => {
  const colours = "Black, white, cream, navy blue, wine, army green, chocolate brown, burnt orange, mustard yellow, baby pink, sky blue, lilac, ash, charcoal grey, beige, olive, maroon, teal, coral and peach — all sizes".padEnd(210, ".");
  const result = validateListingInput("product", product({ color: colours, images: [1, 2, 3, 4, 5].map(IMG), description: "d".repeat(2588) }), { cloudName: CLOUD });
  assert.equal(result.ok, true);
  assert.equal(result.data.images.length, 5);
  assert.equal(result.data.color.length, 210);
});

test("a subcategory given as plain text (older listings) is accepted as a one-item list", () => {
  assert.deepEqual(validateListingInput("product", product({ subcategory: "Fashion footwear" }), { cloudName: CLOUD }).data.subcategory, ["Fashion footwear"]);
  assert.deepEqual(validateListingInput("product", product({ subcategory: "" }), { cloudName: CLOUD }).data.subcategory, []);
  assert.deepEqual(validateListingInput("product", product({ subcategory: undefined }), { cloudName: CLOUD }).data.subcategory, []);
});

test("a photo on either of our Cloudinary account names is accepted", () => {
  assert.equal(validateListingInput("product", product(), { cloudName: ["dj21x4jnt", "another"] }).ok, true);
  assert.equal(validateListingInput("product", product({ images: [IMG(1).replace(CLOUD, "another")] }), { cloudName: ["dj21x4jnt", "another"] }).ok, true);
  assert.equal(validateListingInput("product", product({ images: [IMG(1).replace(CLOUD, "stranger")] }), { cloudName: ["dj21x4jnt", "another"] }).ok, false);
});

test("the photo limit is five, with a clear reason when there are too many", () => {
  assert.equal(MAX_LISTING_PHOTOS, 5);
  const tooMany = validateListingInput("product", product({ images: [1, 2, 3, 4, 5, 6].map(IMG) }), { cloudName: CLOUD });
  assert.deepEqual(tooMany, { ok: false, error: "A listing can have up to 5 photos. Remove some and try again." });
});

test("the forms keep only the photos that fit, and say so", () => {
  const files = (n) => Array.from({ length: n }, (_, i) => `file${i + 1}`);
  assert.deepEqual(photosThatFit(files(3), 0), { accepted: files(3), skipped: 0, message: null });
  assert.deepEqual(photosThatFit(files(5), 0), { accepted: files(5), skipped: 0, message: null });
  // 17 picked at once (the most seen in production): the first five are kept
  const many = photosThatFit(files(17), 0);
  assert.deepEqual([many.accepted, many.skipped], [files(5), 12]);
  assert.equal(many.message, "A listing can have up to 5 photos, so only the first 5 were added.");
  // room for one more
  assert.equal(photosThatFit(files(3), 4).message, "A listing can have up to 5 photos, so only the first 1 was added.");
  assert.deepEqual(photosThatFit(files(3), 4).accepted, ["file1"]);
  // already full, or an older listing with more than five
  for (const already of [5, 17]) {
    assert.deepEqual(photosThatFit(files(2), already), { accepted: [], skipped: 2, message: "A listing can have up to 5 photos. Remove one to add another." });
  }
});

test("only our own Cloudinary uploads count as listing photos", () => {
  assert.equal(isListingImageUrl(IMG(1), CLOUD), true);
  assert.equal(isListingImageUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/x.webp`, CLOUD), true);
  assert.equal(isListingImageUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/../authenticated/x.jpg`, CLOUD), false);
  assert.equal(isListingImageUrl(`http://res.cloudinary.com/${CLOUD}/image/upload/v1/x.jpg`, CLOUD), false);
  assert.equal(isListingImageUrl(`https://res.cloudinary.com.evil.com/${CLOUD}/image/upload/v1/x.jpg`, CLOUD), false);
  assert.equal(isListingImageUrl(IMG(1), undefined), false);
  assert.equal(isListingImageUrl(null, CLOUD), false);
});

// ---------------------------------------------------------------- plan limits
const PLANS = {
  "free-tier": { limits: { maxProducts: 3, maxServices: 1, vipTags: 0 } },
  product_premium: { limits: { maxProducts: 9999, vipTags: 2 } },
  product_vip: { limits: { maxProducts: 9999, vipTags: 5 } },
  service_premium: { limits: { maxServices: 2 } },
  bundle_premium: { includes: ["product_premium", "service_premium"], limits: { dailyNotifications: 20 } },
};
const getPlan = async (id) => PLANS[id] ?? null;
const paid = (planId, expiryDate = FUTURE) => ({ planId, isActive: true, expiryDate });

test("limits: free by default", async () => {
  assert.deepEqual(await resolveLimits({}, getPlan, NOW), { maxProducts: 3, maxServices: 1, vipTagsProduct: 0, vipTagsService: 0 });
  assert.deepEqual(await resolveLimits({ product: { planId: "product_free", isActive: true } }, getPlan, NOW), { maxProducts: 3, maxServices: 1, vipTagsProduct: 0, vipTagsService: 0 });
});

test("limits: a paid product plan lifts products only; a bundle lifts both", async () => {
  assert.deepEqual(await resolveLimits({ product: paid("product_premium") }, getPlan, NOW), { maxProducts: 9999, maxServices: 1, vipTagsProduct: 2, vipTagsService: 0 });
  assert.deepEqual(await resolveLimits({ bundle: paid("bundle_premium") }, getPlan, NOW), { maxProducts: 9999, maxServices: 2, vipTagsProduct: 2, vipTagsService: 0 });
});

test("limits: an expired or switched-off plan counts as free — even if still marked active", async () => {
  const free = { maxProducts: 3, maxServices: 1, vipTagsProduct: 0, vipTagsService: 0 };
  assert.deepEqual(await resolveLimits({ product: paid("product_vip", PAST) }, getPlan, NOW), free);
  assert.deepEqual(await resolveLimits({ product: { ...paid("product_vip"), isActive: false } }, getPlan, NOW), free);
  assert.deepEqual(await resolveLimits({ bundle: paid("bundle_premium", PAST) }, getPlan, NOW), free);
  assert.deepEqual(await resolveLimits({ product: paid("plan_that_was_deleted") }, getPlan, NOW), free);
});

// ---------------------------------------------------------------- createListing
async function setup({ user = { fullName: "Ada", isVerified: true, selectedUniversity: "Lead City University of Ibadan" }, subs = null } = {}) {
  const db = createFakeFirestore();
  if (user) await db.collection("users").doc("u1").set(user);
  if (subs) await db.collection("subscriptions").doc("u1").set(subs);
  for (const [id, plan] of Object.entries(PLANS)) await db.collection("subscriptionPlans").doc(id).set(plan);
  const create = (type = "product", input = product(), extra = {}) =>
    createListingCore(db, { uid: "u1", type, input, cloudName: CLOUD, now: NOW, random: () => 0.25, ...extra });
  const saved = (collection = "products") => [...db._store.entries()].filter(([path]) => path.startsWith(`${collection}/`)).map(([, data]) => data);
  return { db, create, saved };
}
const rejects = (promise, code) => assert.rejects(promise, (error) => error instanceof ListingError && error.code === code);

test("a verified seller's product is saved ranked, searchable and owned by them", async () => {
  const { create, saved } = await setup();
  const { id } = await create("product", { ...product(), userId: "someone-else", university: "Fake Uni", isVip: true, rankScore: 9999 });
  assert.ok(id);
  const [listing] = saved();
  assert.equal(listing.userId, "u1");
  assert.equal(listing.university, "Lead City University of Ibadan");
  assert.deepEqual([listing.isVip, listing.sellerTier, listing.source], [false, "free", "web"]);
  assert.equal(listing.rankScore, 0.25); // free tier: just the shuffle seed
  assert.ok(listing.searchKeywords.includes("bracelet") && listing.searchKeywords.includes("jewellery") && listing.searchKeywords.includes("bra"));
  assert.equal(listing.createdAt.getTime(), NOW);
});

test("a Premium seller's listing gets the Premium rank straight away", async () => {
  const { create, saved } = await setup({ subs: { product: paid("product_premium") } });
  await create();
  const [listing] = saved();
  assert.equal(listing.sellerTier, "premium");
  assert.ok(listing.rankScore >= 1000);
});

test("the free limit holds: a 4th product is refused, and so is a 2nd service", async () => {
  const { create, saved } = await setup();
  for (let i = 0; i < 3; i++) await create();
  await rejects(create(), "limit_reached");
  assert.equal(saved().length, 3);
  await create("service", service());
  await rejects(create("service", service()), "limit_reached");
  assert.equal(saved("services").length, 1);
});

test("uploads sent at the same moment can't slip past the limit", async () => {
  const { create, saved } = await setup();
  const results = await Promise.allSettled(Array.from({ length: 8 }, () => create()));
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 3);
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => r.reason.code === "limit_reached"));
  assert.equal(saved().length, 3);
});

test("someone else's listings don't count against the seller", async () => {
  const { db, create } = await setup();
  for (let i = 0; i < 5; i++) await db.collection("products").doc(`other${i}`).set({ userId: "u2" });
  await create();
  await create();
  await create();
  await rejects(create(), "limit_reached");
});

test("a paid plan lifts the limit; once it expires the free limit is back", async () => {
  const active = await setup({ subs: { product: paid("product_premium") } });
  for (let i = 0; i < 6; i++) await active.create();
  assert.equal(active.saved().length, 6);

  const expired = await setup({ subs: { product: paid("product_premium", PAST) } });
  for (let i = 0; i < 3; i++) await expired.create();
  await rejects(expired.create(), "limit_reached");
});

test("KYC is required: unverified, expired-provisional and missing accounts can't list", async () => {
  await rejects((await setup({ user: { fullName: "No KYC" } })).create(), "kyc_required");
  const lapsed = { kycLevel: "provisional", provisionalExpiresAt: new Date(NOW - 1000) };
  await rejects((await setup({ user: lapsed })).create(), "kyc_required");
  await rejects((await setup({ user: null })).create(), "not_found");
  const provisional = await setup({ user: { kycLevel: "provisional", provisionalExpiresAt: new Date(NOW + 86400000) } });
  assert.ok((await provisional.create()).id);
});

test("bad input is refused and nothing is saved", async () => {
  const { create, saved } = await setup();
  await rejects(create("product", product({ images: ["https://evil.example/x.png"] })), "invalid");
  await rejects(create("product", null), "invalid");
  await rejects(create("gadget", product()), "invalid");
  assert.equal(saved().length, 0);
});

test("a listing made over WhatsApp is marked as such", async () => {
  const { create, saved } = await setup();
  await create("product", product(), { source: "whatsapp" });
  await create("product", product(), { source: "something-else" });
  assert.deepEqual(saved().map((l) => l.source), ["whatsapp", "web"]);
});
