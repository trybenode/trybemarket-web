import test from "node:test";
import assert from "node:assert/strict";
import { claimMessage } from "../../lib/whatsapp/dedupe.js";
import { LINK_CODE_TTL_MS, createLinkCode, findLinkedPhone, findLinkedUid, maskPhone, redeemLinkCode, unlinkAccount } from "../../lib/whatsapp/link.js";
import { parseInbound } from "../../lib/whatsapp/parse.js";
import { createFakeFirestore } from "./fakeFirestore.mjs";

const PHONE = "2348012345678";
const OTHER_PHONE = "2349087654321";
const NOW = Date.parse("2026-11-11T10:00:00Z");

test("a replayed webhook message is claimed only once", async () => {
  const db = createFakeFirestore();
  const message = { id: "wamid.HBgNMjM0ODAxMjM0NTY3OBUCABIYFjNFQjA=", from: PHONE, type: "text" };
  assert.equal(await claimMessage(db, message, NOW), true);
  assert.equal(await claimMessage(db, message, NOW + 5000), false);
  assert.equal(await claimMessage(db, message, NOW + 86400000), false);
  assert.equal(await claimMessage(db, { ...message, id: "wamid.other" }, NOW), true);
  assert.equal(db._store.size, 2);
});

test("a message without an id is still handled", async () => {
  assert.equal(await claimMessage(createFakeFirestore(), { from: PHONE }, NOW), true);
});

test("codes use only the characters the parser accepts", async () => {
  const db = createFakeFirestore();
  for (let i = 0; i < 50; i++) {
    const { code } = await createLinkCode(db, "u1", { now: NOW });
    assert.deepEqual(parseInbound({ type: "text", text: { body: `LINK ${code}` } }), { type: "link", code });
  }
});

test("a code that's already taken is never reissued", async () => {
  const db = createFakeFirestore();
  const codes = ["AAAAAA", "AAAAAA", "BBBBBB"];
  const first = await createLinkCode(db, "u1", { now: NOW, generate: () => "AAAAAA" });
  const second = await createLinkCode(db, "u2", { now: NOW, generate: () => codes.shift() });
  assert.equal(first.code, "AAAAAA");
  assert.equal(second.code, "BBBBBB");
});

test("linking stores the number in waLinks only — never on the user record", async () => {
  const db = createFakeFirestore();
  await db.collection("users").doc("u1").set({ fullName: "Ada" });
  const { code } = await createLinkCode(db, "u1", { now: NOW });
  const result = await redeemLinkCode(db, { code, phone: PHONE, now: NOW + 60000 });
  assert.deepEqual(result, { status: "linked", uid: "u1" });

  assert.equal(db._get(`waLinks/${PHONE}`).uid, "u1");
  assert.deepEqual(db._get("users/u1"), { fullName: "Ada", whatsappLinked: true });
  assert.equal(JSON.stringify(db._get("users/u1")).includes(PHONE), false);
  assert.equal(await findLinkedUid(db, PHONE), "u1");
  assert.equal(await findLinkedPhone(db, "u1"), PHONE);
});

test("a code works once, expires after 15 minutes, and unknown codes are refused", async () => {
  const db = createFakeFirestore();
  const { code } = await createLinkCode(db, "u1", { now: NOW });
  assert.equal((await redeemLinkCode(db, { code: "ZZZZZZ", phone: PHONE, now: NOW })).status, "invalid");
  assert.equal((await redeemLinkCode(db, { code, phone: PHONE, now: NOW + LINK_CODE_TTL_MS + 1 })).status, "expired");
  assert.equal(await findLinkedUid(db, PHONE), null);

  assert.equal((await redeemLinkCode(db, { code, phone: PHONE, now: NOW + 1000 })).status, "linked");
  // the same message delivered again: still fine
  assert.equal((await redeemLinkCode(db, { code, phone: PHONE, now: NOW + 2000 })).status, "linked");
  // someone else trying the same code: refused
  assert.equal((await redeemLinkCode(db, { code, phone: OTHER_PHONE, now: NOW + 3000 })).status, "used");
  assert.equal(await findLinkedUid(db, OTHER_PHONE), null);
});

test("a number connected to one account can't be claimed by another", async () => {
  const db = createFakeFirestore();
  const a = await createLinkCode(db, "u1", { now: NOW });
  await redeemLinkCode(db, { code: a.code, phone: PHONE, now: NOW });
  const b = await createLinkCode(db, "u2", { now: NOW });
  assert.equal((await redeemLinkCode(db, { code: b.code, phone: PHONE, now: NOW })).status, "taken");
  assert.equal(await findLinkedUid(db, PHONE), "u1");
});

test("connecting a new number replaces the account's old one", async () => {
  const db = createFakeFirestore();
  const a = await createLinkCode(db, "u1", { now: NOW });
  await redeemLinkCode(db, { code: a.code, phone: PHONE, now: NOW });
  const b = await createLinkCode(db, "u1", { now: NOW });
  assert.equal((await redeemLinkCode(db, { code: b.code, phone: OTHER_PHONE, now: NOW })).status, "linked");
  assert.equal(await findLinkedUid(db, PHONE), null);
  assert.equal(await findLinkedUid(db, OTHER_PHONE), "u1");
});

test("disconnecting removes the link and clears the flag", async () => {
  const db = createFakeFirestore();
  const { code } = await createLinkCode(db, "u1", { now: NOW });
  await redeemLinkCode(db, { code, phone: PHONE, now: NOW });
  assert.equal(await unlinkAccount(db, "u1", { now: NOW }), true);
  assert.equal(await findLinkedUid(db, PHONE), null);
  assert.equal(db._get("users/u1").whatsappLinked, false);
  assert.equal(await unlinkAccount(db, "u1", { now: NOW }), false);
});

test("bad input never links anything", async () => {
  const db = createFakeFirestore();
  const { code } = await createLinkCode(db, "u1", { now: NOW });
  assert.equal((await redeemLinkCode(db, { code, phone: "not-a-number", now: NOW })).status, "invalid");
  assert.equal((await redeemLinkCode(db, { code: null, phone: PHONE, now: NOW })).status, "invalid");
  assert.equal(await findLinkedUid(db, "../users/u1"), null);
});

test("a masked number shows only the last four digits", () => {
  assert.equal(maskPhone(PHONE), "•••• 5678");
  assert.equal(maskPhone(""), "••••");
});
