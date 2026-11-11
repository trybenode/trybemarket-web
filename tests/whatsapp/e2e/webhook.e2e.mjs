/**
 * End-to-end check of the WhatsApp webhook: signed calls → the real route →
 * the Firestore EMULATOR + a fake Meta server. Nothing touches production and
 * no real WhatsApp message is sent. Not part of `npm test` (it needs servers).
 *
 * To run, from the repo root:
 *   1. Firestore emulator on 127.0.0.1:8085
 *        java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-*.jar --port=8085 --host=127.0.0.1
 *   2. Fake Meta:  node tests/whatsapp/e2e/mock-meta.mjs
 *   3. `next build`, then two servers with these variables on both —
 *        FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 WHATSAPP_APP_SECRET=test-app-secret
 *        WHATSAPP_API_URL=http://127.0.0.1:4010 WHATSAPP_PHONE_NUMBER_ID=TEST_NUMBER_ID
 *        WHATSAPP_ACCESS_TOKEN=test-token
 *      port 3002 (assistant on) also gets WA_ENABLED=true WHATSAPP_BUSINESS_NUMBER=2348000000000;
 *      port 3003 (assistant off) gets neither.
 *   4. FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node --env-file=.env tests/whatsapp/e2e/webhook.e2e.mjs
 * Start from an empty emulator each time (restart it), since the checks count documents.
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
const { createLinkCode } = await import(path.join(ROOT, "lib/whatsapp/link.js"));

const SECRET = "test-app-secret";
const ON = "http://localhost:3002/api/whatsapp/webhook";
const OFF = "http://localhost:3003/api/whatsapp/webhook";
const META = "http://127.0.0.1:4010";
let fail = 0, n = 0;
const t = (label, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fail++; console.log(ok ? "ok  " : "FAIL", label, ok ? "" : `\n      got  ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sent = async () => (await fetch(`${META}/_sent`)).json();
const reset = () => fetch(`${META}/_reset`);
const now = () => String(Math.floor(Date.now() / 1000));
const text = (from, body, id = `wamid.e2e${++n}`) => ({ id, from, type: "text", timestamp: now(), text: { body } });
const payload = (value) => ({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value }] }] });
async function post(url, body, { secret = SECRET } = {}) {
  const raw = JSON.stringify(body);
  const sig = "sha256=" + crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
  const started = Date.now();
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": sig }, body: raw });
  return { status: res.status, ms: Date.now() - started };
}
const settle = () => sleep(1500);

const SELLER = "2348011110001", STUDENT = "2348022220002", STRANGER = "2348033330003";
await db.doc("users/seller1").set({ fullName: "Test Seller" });
await db.doc("users/student1").set({ fullName: "Test Student", phone: STUDENT, whatsappMarketing: true });
await db.doc("whatsappMessages/wamid.campaign1").set({ status: "sent", campaignId: "c1", uid: "student1" });

// 1. Signature
t("wrong signature is refused", (await post(ON, payload({ messages: [text(STRANGER, "help")] }), { secret: "wrong" })).status, 401);
await settle();
t("…and nothing was sent or recorded", [(await sent()).length, (await db.collection("waMessages").get()).size], [0, 0]);

// 2. Unregistered: members-only once a day
await post(ON, payload({ messages: [text(STRANGER, "bracelet")] })); await settle();
await post(ON, payload({ messages: [text(STRANGER, "iphone charger")] })); await settle();
let out = await sent();
t("unregistered number gets one members-only reply, then silence", [out.length, out[0]?.to, /Join free: https:\/\/.*\/signup\?utm_source=whatsapp/.test(out[0]?.body)], [1, STRANGER, true]);
t("the reply went to the configured number id with the token", [out[0].path, out[0].auth], ["/TEST_NUMBER_ID/messages", "Bearer test-token"]);

// 3. Link
await reset();
const { code } = await createLinkCode(db, "seller1");
await post(ON, payload({ messages: [text(SELLER, `LINK ${code}`)] })); await settle();
out = await sent();
const user = (await db.doc("users/seller1").get()).data();
t("LINK connects the number and confirms", [out.length, out[0]?.body.startsWith("Connected"), (await db.doc(`waLinks/${SELLER}`).get()).data()?.uid], [1, true, "seller1"]);
t("the user record gets only the flag — no number", [user.whatsappLinked, JSON.stringify(user).includes(SELLER)], [true, false]);

// 4. Replay: same message delivered three times → one reply
await reset();
const help = text(SELLER, "help", "wamid.replay1");
for (let i = 0; i < 3; i++) await post(ON, payload({ messages: [help] }));
await settle();
t("a replayed webhook is answered once", (await sent()).length, 1);
t("…and counted once", (await db.collection("waUsage").where("phone", "==", SELLER).get()).docs[0].data().replies, 1);
t("the message record notes what happened", (await db.doc("waMessages/wamid.replay1").get()).data().result, "help:reply");

// 5. 200 first, work after: Meta slow (2s) but the webhook answers fast
await reset(); await fetch(`${META}/_delay/2000`);
const timing = await post(ON, payload({ messages: [text(SELLER, "hello")] }));
t("the webhook answers 200 before the reply work finishes", [timing.status, timing.ms < 1000], [200, true]);
t("…the reply hasn't gone out yet", (await sent()).length, 0);
await sleep(3000);
t("…and goes out afterwards", (await sent()).length, 1);
await fetch(`${META}/_delay/0`);

// 6. Cap: Free = 5 a day. 2 used (help, hello); 3 more replies, then one notice, then silence.
await reset();
for (let i = 0; i < 6; i++) { await post(ON, payload({ messages: [text(SELLER, "help")] })); await sleep(700); }
await settle();
out = await sent();
t("the cap stops at the plan limit: 3 more replies, one notice, then silence", [out.length, out[3]?.body], [4, "Daily limit reached. It resets at midnight."]);

// 7. STOP: marketing opt-out still recorded (old behaviour) + a confirmation, even at the cap
await reset();
await post(ON, payload({ messages: [text(STUDENT, "STOP")] })); await settle();
out = await sent();
t("STOP still turns promotions off", (await db.doc("users/student1").get()).data().whatsappMarketing, false);
t("…and is confirmed", [out.length, out[0]?.body.startsWith("Done")], [1, true]);
await reset();
await post(ON, payload({ messages: [text(SELLER, "stop")] })); await settle();
t("a STOP confirmation goes out even at the daily cap", (await sent()).length, 1);

// 8. Delivery status for a campaign message still recorded; Meta preference changes too
await post(ON, payload({ statuses: [{ id: "wamid.campaign1", status: "delivered", timestamp: now() }], user_preferences: [{ wa_id: STUDENT, category: "marketing_messages", value: "resume" }] })); await settle();
t("delivery statuses are still recorded", (await db.doc("whatsappMessages/wamid.campaign1").get()).data().status, "delivered");
t("a 'resume' preference turns promotions back on", (await db.doc("users/student1").get()).data().whatsappMarketing, true);

// 9. Profile-number match: registered for help, but not for seller commands (none built yet → help)
await reset();
await post(ON, payload({ messages: [text(STUDENT, "help")] })); await settle();
t("a number on one profile counts as registered", [(await sent()).length, (await sent())[0]?.body.includes("TrybeMarket on WhatsApp")], [1, true]);

// 10. Assistant switched off (WA_ENABLED unset): old jobs still run, no replies, messages still de-duplicated
await reset();
await db.doc("users/student1").update({ whatsappMarketing: true });
const r = await post(OFF, payload({ messages: [text(STUDENT, "STOP"), text(STRANGER, "bracelet")] })); await settle();
t("with the assistant off: 200, STOP still works, nothing is sent", [r.status, (await db.doc("users/student1").get()).data().whatsappMarketing, (await sent()).length], [200, false, 0]);

// Month total
const budget = (await db.collection("waBudget").get()).docs[0];
console.log("month doc:", budget.id, JSON.stringify({ replies: budget.data().replies }));
console.log(fail ? `${fail} FAILED` : "all passed");
process.exit(fail ? 1 : 0);
