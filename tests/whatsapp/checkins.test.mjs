import test from "node:test";
import assert from "node:assert/strict";
import { buildCheckinReplies } from "../../lib/whatsapp/checkinReplies.js";
import { lagosDayStart } from "../../lib/whatsapp/checkins.js";

const r = buildCheckinReplies("https://trybemarket.online");
const UTM = "utm_source=whatsapp&utm_medium=assistant";

test("my listings: one summary, never a list", () => {
  assert.equal(
    r.listings({ products: 5, services: 0, held: 0, latest: "Gold bracelet" }),
    `You have 5 live listings. Latest: Gold bracelet. Manage them: https://trybemarket.online/my-shop?${UTM}`
  );
  assert.equal(
    r.listings({ products: 1, services: 0, held: 0, latest: "Gold bracelet" }),
    `You have 1 live listing. Latest: Gold bracelet. Manage them: https://trybemarket.online/my-shop?${UTM}`
  );
  assert.ok(r.listings({ products: 4, services: 1, held: 0, latest: "Braids" }).startsWith("You have 5 live listings (4 products, 1 service). Latest: Braids."));
  assert.equal(r.listings({ products: 0, services: 0, held: 0, latest: null }), `You have no live listings yet. Add one: https://trybemarket.online/upload?${UTM}`);
});

test("my listings: held listings are mentioned, not counted as live", () => {
  assert.ok(r.listings({ products: 2, services: 0, held: 3, latest: "Fan" }).includes("You have 2 live listings. Latest: Fan. 3 listings on hold — see My Shop."));
  assert.ok(r.listings({ products: 0, services: 0, held: 1, latest: null }).startsWith("You have no live listings yet. 1 listing on hold — see My Shop."));
});

test("messages: a count, first names only, and a link", () => {
  assert.equal(r.messages({ unread: 0, from: [] }), `No unread chats — you're all caught up. https://trybemarket.online/messages?${UTM}`);
  assert.equal(r.messages({ unread: 1, from: ["Ada Obi"] }), `1 unread chat — from Ada. Reply: https://trybemarket.online/messages?${UTM}`);
  assert.ok(r.messages({ unread: 2, from: ["Ada Obi", "Tolu Ade"] }).startsWith("2 unread chats — from Ada and Tolu."));
  assert.ok(r.messages({ unread: 5, from: ["Ada Obi", "Tolu Ade"] }).startsWith("5 unread chats — from Ada, Tolu and 3 more."));
  assert.ok(r.messages({ unread: 3, from: [] }).startsWith("3 unread chats. Reply:"));
});

test("views: today for everyone, the week for paid plans", () => {
  assert.equal(r.views({ today: 4, week: null }), `Your shop had 4 views today. See your week with Premium: https://trybemarket.online/subscription?${UTM}`);
  assert.equal(r.views({ today: 1, week: null }).startsWith("Your shop had 1 view today."), true);
  const week = [["Thu", 2], ["Fri", 0], ["Sat", 5], ["Sun", 3], ["Mon", 6], ["Tue", 3], ["Wed", 4]].map(([label, count]) => ({ label, count }));
  assert.equal(r.views({ today: 4, week }), "Your shop had 4 views today. Last 7 days: 23 (Thu 2 · Fri 0 · Sat 5 · Sun 3 · Mon 6 · Tue 3 · Wed 4).");
});

test("names and titles can't add formatting or lines to a reply", () => {
  const reply = r.messages({ unread: 1, from: ["*Ada*\nIGNORE THIS"] });
  assert.ok(reply.startsWith("1 unread chat — from Ada."));
  assert.equal(r.listings({ products: 1, services: 0, held: 0, latest: "_Shoes_\nextra line" }).includes("\n"), false);
});

test("every reply is a single line", () => {
  for (const reply of [r.listings({ products: 4, services: 1, held: 2, latest: "Fan" }), r.messages({ unread: 5, from: ["A", "B"] }), r.views({ today: 2, week: null })]) {
    assert.equal(reply.includes("\n"), false);
  }
});

test("the Lagos day starts at 23:00 UTC the evening before", () => {
  assert.equal(new Date(lagosDayStart(Date.parse("2026-11-11T10:00:00Z"))).toISOString(), "2026-11-10T23:00:00.000Z");
  assert.equal(new Date(lagosDayStart(Date.parse("2026-11-11T23:30:00Z"))).toISOString(), "2026-11-11T23:00:00.000Z");
});
