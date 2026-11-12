/**
 * createListing against a REAL Firestore (the emulator) — above all, that
 * uploads sent at the same moment can't slip past the plan limit, which an
 * in-memory fake can't prove. Not part of `npm test`.
 *
 *   java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-*.jar --port=8085 --host=127.0.0.1
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node --env-file=.env tests/listing/e2e/create-listing.emu.mjs
 */
import { createRequire } from "module";
import path from "path";
const ROOT = process.argv[2] || process.cwd();
const require = createRequire(path.join(ROOT, "package.json"));
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8085") { console.log("Refusing: not on the emulator"); process.exit(1); }
const admin = require("firebase-admin");
admin.initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = admin.firestore();
const { createListingCore } = await import(path.join(ROOT, "lib/listingCore.js"));

let fail = 0;
const t = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", label, ok ? "" : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); };
const CLOUD = "dj21x4jnt";
const img = (n) => `https://res.cloudinary.com/${CLOUD}/image/upload/v1/market_trybe_products/p${n}.jpg`;
const product = (n) => ({ name: `Item ${n}`, subcategory: ["Laptops"], categoryId: "Electronics", description: "A thing", brand: "B", condition: "New", color: "Black", price: 1000, originalPrice: "", year: "2026", images: [img(n)] });
const run = `r${Date.now()}`;
const uid = (name) => `${name}-${run}`;
const create = (who, n, type = "product", input = product(n)) => createListingCore(db, { uid: uid(who), type, input, cloudName: CLOUD });
const count = async (who, collection = "products") => (await db.collection(collection).where("userId", "==", uid(who)).get()).size;

await db.doc("subscriptionPlans/free-tier").set({ limits: { maxProducts: 3, maxServices: 1, vipTags: 0 } });
await db.doc("subscriptionPlans/product_premium").set({ limits: { maxProducts: 9999, vipTags: 2 } });
for (const who of ["free", "racer", "premium"]) await db.doc(`users/${uid(who)}`).set({ isVerified: true, selectedUniversity: "Lead City University of Ibadan" });
await db.doc(`users/${uid("unverified")}`).set({ fullName: "No KYC" });
await db.doc(`subscriptions/${uid("premium")}`).set({ product: { planId: "product_premium", isActive: true, expiryDate: new Date(Date.now() + 30 * 86400000).toISOString() } });

// One at a time
for (let i = 1; i <= 3; i++) await create("free", i);
const fourth = await create("free", 4).then(() => "created", (e) => e.code);
t("a free seller's 4th product is refused", [fourth, await count("free")], ["limit_reached", 3]);

// All at once: 10 uploads in the same instant, limit 3
const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => create("racer", i)));
const ok = results.filter((r) => r.status === "fulfilled").length;
const refused = results.filter((r) => r.status === "rejected").map((r) => r.reason.code);
t("10 uploads at the same moment: exactly 3 get through", [ok, await count("racer")], [3, 3]);
t("…and the other 7 are told the limit was reached", [refused.length, [...new Set(refused)]], [7, ["limit_reached"]]);

// Paid plan: no limit, and concurrent creates all succeed
const many = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => create("premium", i)));
t("a Premium seller isn't limited", [many.filter((r) => r.status === "fulfilled").length, await count("premium")], [8, 8]);

const saved = (await db.collection("products").where("userId", "==", uid("premium")).limit(1).get()).docs[0].data();
t("a saved listing is ranked and searchable from the start", [saved.sellerTier, saved.rankScore >= 1000, saved.searchKeywords.includes("laptops"), saved.isVip, saved.source, typeof saved.createdAt.toDate], ["premium", true, true, false, "web", "function"]);

t("an unverified account can't list", await create("unverified", 1).then(() => "created", (e) => e.code), "kyc_required");

// Services have their own limit
await create("free", 1, "service", { name: "Braids", categoryId: "Beauty & Styling", description: "Neat", price: 5000, availability: { type: "on_contact" }, images: [img(9)] });
const second = await create("free", 2, "service", { name: "Braids 2", categoryId: "Beauty & Styling", description: "Neat", price: 5000, availability: { type: "on_contact" }, images: [img(8)] }).then(() => "created", (e) => e.code);
t("a free seller's 2nd service is refused", [second, await count("free", "services")], ["limit_reached", 1]);

console.log(fail ? `${fail} FAILED` : "all passed");
process.exit(fail ? 1 : 0);
