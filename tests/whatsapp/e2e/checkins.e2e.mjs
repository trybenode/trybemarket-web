/**
 * End-to-end check of the seller check-ins through the real webhook (same
 * setup as webhook.e2e.mjs — emulator, fake Meta, a server on 3002 with the
 * assistant on). Run it on an empty emulator:
 *   FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node --env-file=.env tests/whatsapp/e2e/checkins.e2e.mjs
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

const SECRET = "test-app-secret";
const ON = "http://localhost:3002/api/whatsapp/webhook";
const META = "http://127.0.0.1:4010";
let fail = 0, n = 0;
const t = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", label, ok ? "" : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function say(from, body) {
  const message = { id: `wamid.checkin${++n}`, from, type: "text", timestamp: String(Math.floor(Date.now() / 1000)), text: { body } };
  const raw = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: { messages: [message] } }] }] });
  const sig = "sha256=" + crypto.createHmac("sha256", SECRET).update(raw, "utf8").digest("hex");
  await fetch(ON, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": sig }, body: raw });
  await sleep(1800);
  const out = await (await fetch(`${META}/_sent`)).json();
  await fetch(`${META}/_reset`);
  return out.map((m) => m.body);
}
const UTM = "utm_source=whatsapp&utm_medium=assistant";
const daysAgo = (d, hour = 12) => new Date(Date.now() - d * 86400000 - (new Date().getUTCHours() - hour) * 3600000);

// A free seller and a Premium seller, both connected; a student whose number is only on a profile.
const FREE = "2348011110001", PAID = "2348011110002", STUDENT = "2348022220002";
await db.doc(`waLinks/${FREE}`).set({ uid: "free1", linkedAt: new Date(), optInAt: new Date() });
await db.doc(`waLinks/${PAID}`).set({ uid: "paid1", linkedAt: new Date(), optInAt: new Date() });
await db.doc("users/free1").set({ fullName: "Free Seller" });
await db.doc("users/paid1").set({ fullName: "Paid Seller" });
await db.doc("users/student1").set({ fullName: "Test Student", phone: STUDENT });
await db.doc("users/buyerA").set({ fullName: "Ada Obi" });
await db.doc("users/buyerB").set({ fullName: "Tolu Ade" });
await db.doc("users/buyerC").set({ fullName: "Chidi Eze" });
await db.doc("subscriptions/paid1").set({ product: { planId: "product_premium", isActive: true, expiryDate: new Date(Date.now() + 30 * 86400000).toISOString() } });
// An expired plan must count as free.
await db.doc("subscriptions/free1").set({ product: { planId: "product_vip", isActive: true, expiryDate: new Date(Date.now() - 86400000).toISOString() } });

// Listings: 2 products + 1 service live, 1 held; someone else's product must not count.
await db.collection("products").add({ userId: "free1", name: "Rechargeable Fan", createdAt: daysAgo(10) });
await db.collection("products").add({ userId: "free1", name: "Gold bracelet", createdAt: daysAgo(1) });
await db.collection("services").add({ userId: "free1", name: "Braids", createdAt: daysAgo(5) });
await db.collection("heldListings").add({ userId: "free1", collection: "products", data: { name: "Old item" } });
await db.collection("products").add({ userId: "someoneElse", name: "Not mine", createdAt: daysAgo(0) });

// Chats: 3 unread for free1 (from A, B, C), 1 already read, 1 unread but someone else's.
await db.collection("conversation").add({ participants: ["buyerA", "free1"], unreadBy: ["free1"] });
await db.collection("conversation").add({ participants: ["free1", "buyerB"], unreadBy: ["free1"] });
await db.collection("conversation").add({ participants: ["buyerC", "free1"], unreadBy: ["free1"] });
await db.collection("conversation").add({ participants: ["buyerA", "free1"], unreadBy: [] });
await db.collection("conversation").add({ participants: ["buyerA", "paid1"], unreadBy: ["buyerA"] });

// Shop views: free1 — 2 today, 3 yesterday. paid1 — 4 today, 1 two days ago, 2 nine days ago (outside the week).
const view = (uid, key, at) => db.collection(`users/${uid}/shopViewLog`).doc(key).set({ viewerKey: key, viewedAt: at });
const now = new Date();
await Promise.all([
  view("free1", "v1", now), view("free1", "v2", now), view("free1", "v3", daysAgo(1)), view("free1", "v4", daysAgo(1)), view("free1", "v5", daysAgo(1)),
  view("paid1", "p1", now), view("paid1", "p2", now), view("paid1", "p3", now), view("paid1", "p4", now),
  view("paid1", "p5", daysAgo(2)), view("paid1", "p6", daysAgo(9)), view("paid1", "p7", daysAgo(9)),
]);

let out = await say(FREE, "my listings");
t("my listings: live count, latest, held mentioned, a link — no list", out, [`You have 3 live listings (2 products, 1 service). Latest: Gold bracelet. 1 listing on hold — see My Shop. Manage them: https://trybemarket.online/my-shop?${UTM}`]);

out = await say(FREE, "messages");
t("messages: unread chats only, first names", [out.length, /^3 unread chats — from \w+, \w+ and 1 more\. Reply: https:\/\/trybemarket\.online\/messages\?/.test(out[0])], [1, true]);

out = await say(PAID, "messages");
t("messages: nothing unread", out, [`No unread chats — you're all caught up. https://trybemarket.online/messages?${UTM}`]);

out = await say(FREE, "views");
t("views (free, incl. an expired VIP plan): today's total and an upgrade link", out, [`Your shop had 2 views today. See your week with Premium: https://trybemarket.online/subscription?${UTM}`]);

out = await say(PAID, "views");
t("views (Premium): today plus the last 7 days, day by day", [out.length, out[0].startsWith("Your shop had 4 views today. Last 7 days: 5 ("), (out[0].match(/ · /g) || []).length, out[0].endsWith(" 4).")], [1, true, 6, true]);

out = await say(PAID, "my listings");
t("a seller with nothing listed is pointed to the upload page", out, [`You have no live listings yet. Add one: https://trybemarket.online/upload?${UTM}`]);

out = await say(STUDENT, "views");
t("a number that's only on a profile can't use seller check-ins", [out.length, out[0].startsWith("That's for connected sellers.")], [1, true]);

out = await say(FREE, "help");
t("help lists the check-ins for a connected seller", out[0].includes("*my listings*, *messages*, *views*"), true);

console.log(fail ? `${fail} FAILED` : "all passed");
process.exit(fail ? 1 : 0);
