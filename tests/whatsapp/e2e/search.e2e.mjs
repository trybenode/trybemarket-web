/**
 * End-to-end check of WhatsApp search through the real webhook (same setup as
 * webhook.e2e.mjs — emulator, fake Meta, servers on 3002/3003). Run it on an
 * empty emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node --env-file=.env tests/whatsapp/e2e/search.e2e.mjs
 */
import crypto from "crypto";
import { createRequire } from "module";
import path from "path";
const ROOT = process.argv[2] || process.cwd();
const require = createRequire(path.join(ROOT, "package.json"));
if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8085") { console.log("Refusing: not on the emulator"); process.exit(1); }
const admin = require("firebase-admin");
admin.initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
const db = admin.firestore();
const { computeSearchKeywords } = await import(path.join(ROOT, "lib/rankScoreShared.js"));

const SECRET = "test-app-secret";
const ON = "http://localhost:3002/api/whatsapp/webhook";
const META = "http://127.0.0.1:4010";
let fail = 0, n = 0;
const t = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", label, ok ? "" : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sent = async () => (await fetch(`${META}/_sent`)).json();
const reset = () => fetch(`${META}/_reset`);
const text = (from, body) => ({ id: `wamid.search${++n}`, from, type: "text", timestamp: String(Math.floor(Date.now() / 1000)), text: { body } });
async function say(from, body) {
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: { messages: [text(from, body)] } }] }] });
  const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  await fetch(ON, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": sig }, body: raw });
  await sleep(1500);
  const out = await sent();
  await reset();
  return out;
}

const STUDENT = "2348022220002", STRANGER = "2348033330003";
await db.doc("users/student1").set({ fullName: "Test Student", phone: STUDENT, selectedUniversity: "Lead City University of Ibadan" });
const listings = [
  { name: "Gold bracelet", description: "brand new", categoryId: "Fashion", subcategory: ["Jewellery"] },
  { name: "Beaded bracelets set", description: "handmade", categoryId: "Fashion", subcategory: ["Jewellery"] },
  { name: "MacBook Pro 2025", description: "M4 pro", categoryId: "Electronics", subcategory: ["Laptops"], brand: "Apple" },
];
await Promise.all(listings.map((l, i) => db.collection("products").add({ ...l, userId: "seller1", rankScore: 0.1 * (i + 1), createdAt: new Date(), searchKeywords: computeSearchKeywords(l) })));
// A held listing lives outside `products`, so it must never be counted.
await db.collection("heldListings").add({ collection: "products", userId: "seller2", data: { name: "Silver bracelet", searchKeywords: computeSearchKeywords({ name: "Silver bracelet" }) } });

let out = await say(STUDENT, "bracelet");
t("a registered student gets a count and a link that fills the site's search", [out.length, out[0]?.body],
  [1, "2 results for “bracelet” on TrybeMarket. See them: https://trybemarket.online/?q=bracelet&utm_source=whatsapp&utm_medium=assistant"]);

out = await say(STUDENT, "Laptops");
t("the subcategory is searchable, like on the site", out[0]?.body.startsWith("1 result for “Laptops” on TrybeMarket. See it: "), true);

out = await say(STUDENT, "spiderman shoes");
t("nothing found: one short reply", out[0]?.body, "None yet for “spiderman shoes”. Try another word.");

const events = (await db.collection("events").where("event_type", "==", "SEARCH_PERFORMED").get()).docs.map((d) => d.data());
const gap = events.find((e) => e.metadata.query === "spiderman shoes");
t("every search is logged for the demand-gap view, in the site's shape", events.length, 3);
t("…the zero-result one carries the student's school and source", [gap.metadata.has_results, gap.metadata.results_count, gap.campus_id, gap.source, gap.user_id, gap.entity_type], [false, 0, "Lead City University of Ibadan", "whatsapp", "student1", "search"]);

out = await say(STUDENT, "hi");
t("a greeting points to search", out[0]?.body, "Hi 👋 Send an item name to search, e.g. *bracelet*. Or send *help*.");
out = await say(STUDENT, "help");
t("help now lists search", out[0]?.body.includes("Send an item name to search"), true);

out = await say(STRANGER, "bracelet");
t("an unregistered number still gets the members-only reply, not results", out[0]?.body.startsWith("WhatsApp search is for TrybeMarket members."), true);
t("…and its search isn't logged", (await db.collection("events").get()).size, 3);

const usage = (await db.collection("waUsage").where("phone", "==", STUDENT).get()).docs[0].data();
t("each reply counted toward the student's daily cap", usage.replies, 5);

console.log(fail ? `${fail} FAILED` : "all passed");
process.exit(fail ? 1 : 0);
