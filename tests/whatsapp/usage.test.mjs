import test from "node:test";
import assert from "node:assert/strict";
import { REPLY_KINDS, decideReply, lagosDayKey, lagosMonthKey, reserveReply, releaseReply } from "../../lib/whatsapp/usage.js";
import { createFakeFirestore } from "./fakeFirestore.mjs";

const PHONE = "2348012345678";
const base = { dailyLimit: 5, budgetLimit: 1000, alertAt: 800 };
const at = (iso) => Date.parse(iso);

test("the day and month are Lagos time (UTC+1)", () => {
  assert.equal(lagosDayKey(at("2026-11-11T22:59:59Z")), "20261111");
  assert.equal(lagosDayKey(at("2026-11-11T23:00:00Z")), "20261112"); // midnight in Lagos
  assert.equal(lagosMonthKey(at("2026-11-30T23:30:00Z")), "202612");
});

test("counted replies stop at the plan limit, with one cap notice, then silence", () => {
  let usage = {};
  for (let i = 1; i <= 5; i++) {
    const d = decideReply({ kind: REPLY_KINDS.SEARCH, usage, ...base });
    assert.equal(d.send, true);
    assert.equal(d.as, "reply");
    usage = d.usage;
  }
  assert.equal(usage.replies, 5);
  const notice = decideReply({ kind: REPLY_KINDS.SEARCH, usage, ...base });
  assert.deepEqual([notice.send, notice.as], [true, "cap_notice"]);
  assert.equal(notice.usage.replies, 5); // the notice isn't a counted reply
  const silent = decideReply({ kind: REPLY_KINDS.CHECKIN, usage: notice.usage, ...base });
  assert.deepEqual([silent.send, silent.reason], [false, "daily_cap"]);
});

test("a Premium Bundle limit of 20 allows 20", () => {
  let usage = {};
  for (let i = 0; i < 20; i++) usage = decideReply({ kind: REPLY_KINDS.CHECKIN, usage, ...base, dailyLimit: 20 }).usage;
  assert.equal(usage.replies, 20);
  assert.equal(decideReply({ kind: REPLY_KINDS.SEARCH, usage, ...base, dailyLimit: 20 }).as, "cap_notice");
});

test("confirmations are never counted or blocked — even at the cap and over budget", () => {
  const usage = { replies: 5, capNoticeSent: true };
  const d = decideReply({ kind: REPLY_KINDS.CONFIRMATION, usage, ...base, budgetReplies: 5000 });
  assert.equal(d.send, true);
  assert.equal(d.usage.replies, 5);
  assert.equal(d.budgetReplies, 5001); // still a billed message, so the month's total moves
});

test("the signup reply goes out once a day per number", () => {
  const first = decideReply({ kind: REPLY_KINDS.SIGNUP, usage: {}, ...base, dailyLimit: 0 });
  assert.equal(first.send, true);
  const second = decideReply({ kind: REPLY_KINDS.SIGNUP, usage: first.usage, ...base, dailyLimit: 0 });
  assert.deepEqual([second.send, second.reason], [false, "signup_already_sent"]);
});

test("the 'can't read photos yet' notice goes out once a day, and counts", () => {
  const first = decideReply({ kind: REPLY_KINDS.UNSUPPORTED, usage: {}, ...base });
  assert.deepEqual([first.send, first.usage.replies], [true, 1]);
  const second = decideReply({ kind: REPLY_KINDS.UNSUPPORTED, usage: first.usage, ...base });
  assert.deepEqual([second.send, second.reason], [false, "unsupported_already_sent"]);
});

test("when the monthly budget is used up, new searches, check-ins and signup replies pause", () => {
  for (const kind of [REPLY_KINDS.SEARCH, REPLY_KINDS.CHECKIN, REPLY_KINDS.HELP, REPLY_KINDS.SIGNUP, REPLY_KINDS.UNSUPPORTED]) {
    const d = decideReply({ kind, usage: {}, ...base, budgetReplies: 1000 });
    assert.deepEqual([d.send, d.reason], [false, "monthly_budget"], kind);
  }
});

test("reserveReply records usage and the month's total, and stops at the cap", async () => {
  const db = createFakeFirestore();
  const now = at("2026-11-11T10:00:00Z");
  for (let i = 0; i < 5; i++) {
    const r = await reserveReply(db, { phone: PHONE, uid: "u1", kind: REPLY_KINDS.SEARCH, ...base, now });
    assert.equal(r.send, true);
  }
  assert.equal(db._get(`waUsage/${PHONE}_20261111`).replies, 5);
  assert.equal(db._get("waBudget/202611").replies, 5);

  const notice = await reserveReply(db, { phone: PHONE, uid: "u1", kind: REPLY_KINDS.SEARCH, ...base, now });
  assert.equal(notice.as, "cap_notice");
  const silent = await reserveReply(db, { phone: PHONE, uid: "u1", kind: REPLY_KINDS.SEARCH, ...base, now });
  assert.equal(silent.send, false);
  assert.equal(db._get("waBudget/202611").replies, 6); // 5 replies + the notice
});

test("the cap is per Lagos day: it resets at Lagos midnight", async () => {
  const db = createFakeFirestore();
  const lateNight = at("2026-11-11T22:30:00Z"); // 23:30 in Lagos
  for (let i = 0; i < 6; i++) await reserveReply(db, { phone: PHONE, kind: REPLY_KINDS.SEARCH, ...base, now: lateNight });
  const afterMidnight = at("2026-11-11T23:05:00Z"); // 00:05 in Lagos
  const r = await reserveReply(db, { phone: PHONE, kind: REPLY_KINDS.SEARCH, ...base, now: afterMidnight });
  assert.deepEqual([r.send, r.as], [true, "reply"]);
});

test("simultaneous messages can't both take the last reply", async () => {
  const db = createFakeFirestore();
  const now = at("2026-11-11T10:00:00Z");
  const results = await Promise.all(
    Array.from({ length: 12 }, () => reserveReply(db, { phone: PHONE, kind: REPLY_KINDS.SEARCH, ...base, now }))
  );
  assert.equal(results.filter((r) => r.send && r.as === "reply").length, 5);
  assert.equal(results.filter((r) => r.as === "cap_notice").length, 1);
  assert.equal(results.filter((r) => !r.send).length, 6);
});

test("the team is alerted exactly once, on the reply that reaches the alert level", async () => {
  const db = createFakeFirestore();
  const now = at("2026-11-11T10:00:00Z");
  await db.collection("waBudget").doc("202611").set({ replies: 798 });
  const a = await reserveReply(db, { phone: "2348000000001", kind: REPLY_KINDS.SEARCH, ...base, now });
  const b = await reserveReply(db, { phone: "2348000000002", kind: REPLY_KINDS.SEARCH, ...base, now });
  const c = await reserveReply(db, { phone: "2348000000003", kind: REPLY_KINDS.SEARCH, ...base, now });
  assert.deepEqual([a.alert, b.alert, c.alert], [false, true, false]);
  assert.equal(b.monthReplies, 800);
});

test("a failed send gives the reply back", async () => {
  const db = createFakeFirestore();
  const now = at("2026-11-11T10:00:00Z");
  const r = await reserveReply(db, { phone: PHONE, kind: REPLY_KINDS.SEARCH, ...base, now });
  await releaseReply(db, r.reservation);
  assert.equal(db._get(`waUsage/${PHONE}_20261111`).replies, 0);
  assert.equal(db._get("waBudget/202611").replies, 0);

  const confirm = await reserveReply(db, { phone: PHONE, kind: REPLY_KINDS.CONFIRMATION, ...base, now });
  await releaseReply(db, confirm.reservation);
  assert.equal(db._get(`waUsage/${PHONE}_20261111`).replies, 0); // a confirmation never used a daily reply
  await releaseReply(db, null); // nothing reserved: no-op
});
