import test from "node:test";
import assert from "node:assert/strict";
import { parseInbound } from "../../lib/whatsapp/parse.js";
import { buildReplies } from "../../lib/whatsapp/replies.js";
import { COMMAND_BUTTONS, handleInbound } from "../../lib/whatsapp/router.js";
import { createFakeFirestore } from "./fakeFirestore.mjs";

const text = (body) => ({ type: "text", text: { body } });
const guess = (name, query) => ({ type: "command", name, guessed: true, query });

// [what was sent, what it's taken to mean]
const NEAR_MISSES = [
  // the message from the screenshot
  ["my listin", guess("listings", "my listin")],
  // unfinished
  ["my listi", guess("listings", "my listi")],
  ["My list", guess("listings", "My list")],
  ["listin", guess("listings", "listin")],
  ["messag", guess("messages", "messag")],
  ["my messag", guess("messages", "my messag")],
  // one or two typos
  ["my listngs", guess("listings", "my listngs")],
  ["my lisitngs", guess("listings", "my lisitngs")],
  ["listtings", guess("listings", "listtings")],
  ["mesages", guess("messages", "mesages")],
  ["mesagges", guess("messages", "mesagges")],
  ["messgaes", guess("messages", "messgaes")],
  ["veiws", guess("views", "veiws")],
  ["viewz", guess("views", "viewz")],
  ["my veiws", guess("views", "my veiws")],
  // spelled right: a plain command, not a guess
  ["my listings", { type: "command", name: "listings" }],
  ["Messages", { type: "command", name: "messages" }],
  ["views", { type: "command", name: "views" }],
  ["hlep", { type: "help" }],
];
for (const [sent, expected] of NEAR_MISSES) {
  test(`${JSON.stringify(sent)} is read as ${expected.name || expected.type}${expected.guessed ? " (guessed)" : ""}`, () => {
    assert.deepEqual(parseInbound(text(sent)), expected);
  });
}

// Real things people search for that sit close to a command must stay searches.
const STILL_SEARCHES = [
  "massage", "massager", "viewer", "news", "vows", "list", "listen", "my bag", "mess", "passages", "my lamp",
  "bracelet", "iphone charger", "views of lagos", "my listings please", "messages app", "vie",
];
for (const sent of STILL_SEARCHES) {
  test(`${JSON.stringify(sent)} stays a search`, () => {
    assert.deepEqual(parseInbound(text(sent)), { type: "search", query: sent });
  });
}

test("STOP is never guessed — only the exact words opt out", () => {
  for (const sent of ["shop", "stpo", "stopp", "stop it"]) assert.notEqual(parseInbound(text(sent)).type, "stop", sent);
});

test("tapping a button runs that command, whatever its label says", () => {
  const tap = (id, title) => ({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title } } });
  assert.deepEqual(parseInbound(tap("cmd:listings", "My listings")), { type: "command", name: "listings" });
  assert.deepEqual(parseInbound(tap("cmd:views", "anything")), { type: "command", name: "views" });
  // an id we never issued falls back to reading the label as text
  assert.deepEqual(parseInbound(tap("cmd:delete_everything", "bracelet")), { type: "search", query: "bracelet" });
});

// --- Through the router ----------------------------------------------------------
const NOW = Date.parse("2026-11-11T10:00:00Z");
const LINKED = "2348011111111", PROFILE = "2348022222222";
const replies = buildReplies("https://trybemarket.online");
let n = 0;
const message = (from, body) => ({ id: `wamid.t${++n}`, from, type: "text", timestamp: String(NOW / 1000), text: { body } });

function setup() {
  const sent = [];
  const calls = [];
  const deps = {
    db: createFakeFirestore(),
    now: () => NOW,
    sendText: async (m) => (sent.push(m), { ok: true }),
    notifyTeam: async () => {},
    budgetLimit: 1000,
    alertAt: 800,
    replies,
    identify: async (phone) =>
      phone === LINKED ? { kind: "linked", uid: "seller1", dailyLimit: 5 } : { kind: "profile", uid: "student1", dailyLimit: 5 },
    searchOpen: false,
    handlers: {
      search: async ({ query }) => (calls.push(["search", query]), `results for ${query}`),
      command: async ({ name }) => (calls.push(["command", name]), `your ${name}`),
    },
  };
  return { deps, sent, calls };
}

test("a connected seller's near-miss runs the command", async () => {
  const { deps, sent, calls } = setup();
  assert.equal(await handleInbound(message(LINKED, "my listin"), deps), "command:listings:reply");
  assert.equal(await handleInbound(message(LINKED, "mesages"), deps), "command:messages:reply");
  assert.deepEqual(calls, [["command", "listings"], ["command", "messages"]]);
  assert.deepEqual(sent.map((m) => m.body), ["your listings", "your messages"]);
});

test("for someone who isn't connected, a near-miss is just a search", async () => {
  const { deps, sent, calls } = setup();
  assert.equal(await handleInbound(message(PROFILE, "my listin"), deps), "search:reply");
  assert.deepEqual(calls, [["search", "my listin"]]);
  assert.equal(sent[0].body, "results for my listin");
  // …while the properly spelled command still tells them to connect
  assert.equal(await handleInbound(message(PROFILE, "my listings"), deps), "needs_link:reply");
});

test("help and greetings carry the three buttons for a connected seller only", async () => {
  const { deps, sent } = setup();
  await handleInbound(message(LINKED, "help"), deps);
  await handleInbound(message(LINKED, "hi"), deps);
  await handleInbound(message(PROFILE, "help"), deps);
  assert.deepEqual(sent[0].buttons, COMMAND_BUTTONS);
  assert.deepEqual(sent[1].buttons, COMMAND_BUTTONS);
  assert.equal("buttons" in sent[2], false);
  assert.ok(COMMAND_BUTTONS.length <= 3 && COMMAND_BUTTONS.every((b) => b.title.length <= 20));
});

test("a tapped button is answered like the typed command", async () => {
  const { deps, sent } = setup();
  const tap = { id: "wamid.tap1", from: LINKED, type: "interactive", timestamp: String(NOW / 1000), interactive: { type: "button_reply", button_reply: { id: "cmd:views", title: "Views" } } };
  assert.equal(await handleInbound(tap, deps), "command:views:reply");
  assert.equal(sent[0].body, "your views");
});

test("the 'limit reached' notice never carries buttons", async () => {
  const { deps, sent } = setup();
  for (let i = 0; i < 6; i++) await handleInbound(message(LINKED, "help"), deps);
  assert.equal(sent[5].body, replies.capReached());
  assert.equal("buttons" in sent[5], false);
});
