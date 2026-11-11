import test from "node:test";
import assert from "node:assert/strict";
import { claimMessage } from "../../lib/whatsapp/dedupe.js";
import { createLinkCode, findLinkedUid } from "../../lib/whatsapp/link.js";
import { buildReplies } from "../../lib/whatsapp/replies.js";
import { STALE_AFTER_MS, handleInbound } from "../../lib/whatsapp/router.js";
import { collectWebhookWork } from "../../lib/whatsapp/webhook.js";
import { createFakeFirestore } from "./fakeFirestore.mjs";

const NOW = Date.parse("2026-11-11T10:00:00Z");
const LINKED = "2348011111111"; // connected seller, Free plan (5 a day)
const PROFILE = "2348022222222"; // number on one profile, not connected
const STRANGER = "2348033333333";
const replies = buildReplies("https://trybemarket.online");

let nextId = 0;
const text = (from, body, extra = {}) => ({ id: `wamid.${++nextId}`, from, type: "text", timestamp: String(NOW / 1000), text: { body }, ...extra });

function setup({ handlers = {}, searchOpen = false, budgetLimit = 1000, sendOk = true } = {}) {
  const db = createFakeFirestore();
  const sent = [];
  const alerts = [];
  const deps = {
    db,
    now: () => NOW,
    sendText: async (message) => {
      if (sendOk) sent.push(message);
      return { ok: sendOk };
    },
    notifyTeam: async (info) => alerts.push(info),
    budgetLimit,
    alertAt: Math.floor(budgetLimit * 0.8),
    replies,
    identify: async (phone) =>
      phone === LINKED ? { kind: "linked", uid: "seller1", dailyLimit: 5 } :
      phone === PROFILE ? { kind: "profile", uid: "student1", dailyLimit: 5 } :
      { kind: "unregistered", uid: null, dailyLimit: 0 },
    searchOpen,
    handlers,
  };
  return { db, deps, sent, alerts };
}

test("LINK <code> connects the number and confirms", async () => {
  const { db, deps, sent } = setup();
  const { code } = await createLinkCode(db, "seller1", { now: NOW });
  assert.equal(await handleInbound(text(STRANGER, `LINK ${code}`), deps), "link:linked:reply");
  assert.equal(await findLinkedUid(db, STRANGER), "seller1");
  assert.deepEqual(sent, [{ to: STRANGER, body: replies.linked() }]);
});

test("a wrong, expired or reused code gets a clear reply and links nothing", async () => {
  const { db, deps, sent } = setup();
  assert.equal(await handleInbound(text(STRANGER, "LINK ZZZZZZ"), deps), "link:invalid:reply");
  assert.equal(await handleInbound(text(STRANGER, "LINK"), deps), "link:invalid:reply");
  assert.equal(await findLinkedUid(db, STRANGER), null);
  assert.equal(sent.length, 2);
  assert.ok(sent.every((m) => m.body === replies.linkInvalid()));
});

test("STOP is confirmed for anyone, and never counted", async () => {
  const { db, deps, sent } = setup();
  assert.equal(await handleInbound(text(STRANGER, "STOP"), deps), "stop:reply");
  assert.equal(sent[0].body, replies.stopped());
  assert.equal(db._get(`waUsage/${STRANGER}_20261111`).replies, 0);
});

test("an unregistered number gets the members-only reply once a day, then silence", async () => {
  const { deps, sent } = setup({ handlers: { search: async () => "RESULTS" } });
  assert.equal(await handleInbound(text(STRANGER, "bracelet"), deps), "members_only:reply");
  assert.equal(await handleInbound(text(STRANGER, "bracelet"), deps), "members_only:not_sent:signup_already_sent");
  assert.equal(await handleInbound(text(STRANGER, "help"), deps), "members_only:not_sent:signup_already_sent");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body, replies.membersOnly());
  assert.ok(sent[0].body.includes("utm_source=whatsapp"));
});

test("a registered student can search; a profile-number match can't use seller commands", async () => {
  const calls = [];
  const { deps, sent } = setup({
    handlers: {
      search: async ({ query, sender }) => (calls.push(["search", query, sender.uid]), `found ${query}`),
      command: async ({ name, sender }) => (calls.push(["command", name, sender.uid]), `your ${name}`),
    },
  });
  assert.equal(await handleInbound(text(PROFILE, "iphone charger"), deps), "search:reply");
  assert.equal(await handleInbound(text(PROFILE, "my listings"), deps), "needs_link:reply");
  assert.equal(await handleInbound(text(LINKED, "my listings"), deps), "command:listings:reply");
  assert.deepEqual(calls, [["search", "iphone charger", "student1"], ["command", "listings", "seller1"]]);
  assert.deepEqual(sent.map((m) => m.body), ["found iphone charger", replies.needsLink(), "your listings"]);
});

test("the cap stops at the plan limit: 5 replies, one notice, then silence", async () => {
  const { deps, sent } = setup({ handlers: { search: async ({ query }) => `found ${query}` } });
  const outcomes = [];
  for (let i = 0; i < 8; i++) outcomes.push(await handleInbound(text(LINKED, `item ${i}`), deps));
  assert.deepEqual(outcomes, [
    "search:reply", "search:reply", "search:reply", "search:reply", "search:reply",
    "search:cap_notice",
    "search:not_sent:daily_cap", "search:not_sent:daily_cap",
  ]);
  assert.equal(sent.length, 6);
  assert.equal(sent[5].body, replies.capReached());
  // …but a STOP confirmation still goes out at the cap
  assert.equal(await handleInbound(text(LINKED, "stop"), deps), "stop:reply");
});

test("photos get one 'text only for now' reply a day, not one per photo", async () => {
  const { deps, sent } = setup();
  const photo = () => ({ id: `wamid.${++nextId}`, from: LINKED, type: "image", timestamp: String(NOW / 1000), image: { id: "m1" } });
  assert.equal(await handleInbound(photo(), deps), "unsupported:image:reply");
  assert.equal(await handleInbound(photo(), deps), "unsupported:image:not_sent:unsupported_already_sent");
  assert.equal(await handleInbound(photo(), deps), "unsupported:image:not_sent:unsupported_already_sent");
  assert.equal(sent.length, 1);
});

test("help lists only what this build can do", async () => {
  const bare = setup();
  await handleInbound(text(LINKED, "help"), bare.deps);
  assert.ok(!bare.sent[0].body.includes("search"));

  const full = setup({ handlers: { search: async () => "", command: async () => "" } });
  await handleInbound(text(LINKED, "help"), full.deps);
  assert.ok(full.sent[0].body.includes("bracelet"));
  assert.ok(full.sent[0].body.includes("my listings"));
  await handleInbound(text(PROFILE, "help"), full.deps);
  assert.ok(full.sent[1].body.includes("connect your account"));
});

test("once the monthly budget is spent, searches go quiet but link confirmations still send", async () => {
  const { db, deps, sent } = setup({ handlers: { search: async () => "RESULTS" }, budgetLimit: 3 });
  for (let i = 0; i < 3; i++) await handleInbound(text(LINKED, `item ${i}`), deps);
  assert.equal(await handleInbound(text(LINKED, "another"), deps), "search:not_sent:monthly_budget");
  assert.equal(await handleInbound(text(STRANGER, "bracelet"), deps), "members_only:not_sent:monthly_budget");
  const { code } = await createLinkCode(db, "student9", { now: NOW });
  assert.equal(await handleInbound(text(STRANGER, `LINK ${code}`), deps), "link:linked:reply");
  assert.equal(sent.length, 4);
});

test("the team is alerted once when the month reaches the alert level", async () => {
  const { deps, alerts } = setup({ handlers: { search: async () => "RESULTS" }, budgetLimit: 5 }); // alert at 4
  for (let i = 0; i < 5; i++) await handleInbound(text(LINKED, `item ${i}`), deps);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(alerts, [{ monthReplies: 4, budgetLimit: 5 }]);
});

test("a failed send gives the reply back, so it doesn't use up the cap", async () => {
  const { db, deps } = setup({ handlers: { search: async () => "RESULTS" }, sendOk: false });
  assert.equal(await handleInbound(text(LINKED, "bracelet"), deps), "search:not_sent:send_failed");
  assert.equal(db._get(`waUsage/${LINKED}_20261111`).replies, 0);
  assert.equal(db._get("waBudget/202611").replies, 0);
});

test("old re-deliveries, group messages, empty messages and missing senders are ignored", async () => {
  const { deps, sent } = setup();
  const stale = text(LINKED, "help", { timestamp: String((NOW - STALE_AFTER_MS - 1000) / 1000) });
  assert.equal(await handleInbound(stale, deps), "ignored:stale");
  assert.equal(await handleInbound(text(LINKED, "help", { group_id: "g1" }), deps), "ignored:group");
  assert.equal(await handleInbound(text(LINKED, "🙂"), deps), "ignored:empty");
  assert.equal(await handleInbound({ id: "x", type: "text", text: { body: "help" } }, deps), "ignored:no_sender");
  assert.equal(sent.length, 0);
});

test("open mode lets an unregistered number search only when it's switched on and built", async () => {
  const off = setup({ handlers: { search: async () => "R", searchOpen: async () => "OPEN RESULTS" } });
  assert.equal(await handleInbound(text(STRANGER, "bracelet"), off.deps), "members_only:reply");
  const on = setup({ handlers: { search: async () => "R", searchOpen: async () => "OPEN RESULTS" }, searchOpen: true });
  // (the open-mode daily limit comes from identify(); 0 here, so the first reply is the cap notice)
  on.deps.identify = async () => ({ kind: "unregistered", uid: null, dailyLimit: 3 });
  assert.equal(await handleInbound(text(STRANGER, "bracelet"), on.deps), "search_open:reply");
  assert.equal(on.sent[0].body, "OPEN RESULTS");
});

// --- Webhook steps --------------------------------------------------------------
const payload = (value) => ({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value }] }] });

test("the webhook payload is sorted into messages, stop requests, preferences and statuses", () => {
  const work = collectWebhookWork(
    payload({
      messages: [text(LINKED, "bracelet"), text(STRANGER, "Stop promotions"), { type: "button", from: PROFILE, id: "b1", button: { text: "STOP" } }],
      user_preferences: [
        { wa_id: LINKED, category: "marketing_messages", value: "stop" },
        { wa_id: PROFILE, category: "marketing_messages", value: "resume" },
        { wa_id: PROFILE, category: "something_else", value: "stop" },
      ],
      statuses: [{ id: "wamid.out1", status: "delivered", timestamp: "1" }, { status: "read" }],
    })
  );
  assert.equal(work.messages.length, 3);
  assert.deepEqual(work.stopRequests, [STRANGER, PROFILE]);
  assert.deepEqual(work.preferences, [{ waId: LINKED, enabled: false }, { waId: PROFILE, enabled: true }]);
  assert.equal(work.statuses.length, 1);
});

test("an empty or odd payload yields no work and doesn't throw", () => {
  for (const odd of [null, {}, { entry: [{}] }, { entry: [{ changes: [{}] }] }, payload({ messages: [null, "x"] })]) {
    const work = collectWebhookWork(odd);
    assert.deepEqual([work.messages.length, work.stopRequests.length, work.preferences.length, work.statuses.length], [0, 0, 0, 0]);
  }
});

test("a replayed webhook changes nothing: the second delivery is not handled", async () => {
  const { db, deps, sent } = setup({ handlers: { search: async () => "RESULTS" } });
  const body = payload({ messages: [text(LINKED, "bracelet")] });
  const deliver = async () => {
    const work = collectWebhookWork(structuredClone(body));
    const claimed = await Promise.all(work.messages.map((m) => claimMessage(db, m, NOW)));
    for (const message of work.messages.filter((_, i) => claimed[i])) await handleInbound(message, deps);
  };
  await deliver();
  await deliver();
  await deliver();
  assert.equal(sent.length, 1);
  assert.equal(db._get(`waUsage/${LINKED}_20261111`).replies, 1);
});
