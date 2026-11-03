"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const helperStart = source.indexOf("async function readMessagingArrayResponse(");
const helperEnd = source.indexOf("\nfunction renderConversationLoadError", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "the bounded messaging response reader must exist");
const context = vm.createContext({ Array });
vm.runInContext(source.slice(helperStart, helperEnd), context);

(async () => {
  const unavailable = await context.readMessagingArrayResponse(null, "conversations");
  assert.deepEqual(JSON.parse(JSON.stringify(unavailable)), { available: false, items: [] });

  const malformed = await context.readMessagingArrayResponse({ ok: true, json: async () => { throw new Error("bad JSON"); } }, "friends");
  assert.deepEqual(JSON.parse(JSON.stringify(malformed)), { available: false, items: [] },
    "malformed optional data must not collapse healthy chat sources");

  const healthy = await context.readMessagingArrayResponse({ ok: true, json: async () => ({ users: [{ memberId: "one" }] }) }, "users");
  assert.equal(healthy.available, true);
  assert.equal(healthy.items.length, 1);

  const block = source.slice(source.indexOf("async function loadConversations()"), source.indexOf("chatSearch?.addEventListener"));
  assert.match(block, /if \(!conversationSource\.available && !friendsSource\.available && !directorySource\.available\) throw new Error/,
    "the contact list should fail only when every source is unavailable");
  assert.match(block, /if \(!sourcesComplete\) \{[\s\S]*for \(const conversation of cachedConversations\)/,
    "saved chats must remain visible while one contact source is unavailable");
  assert.match(source, /Some chats or online statuses are temporarily unavailable\.[\s\S]*Retry contacts/,
    "partial results need an honest warning and retry action");
  assert.doesNotMatch(block, /conversationResponse \? await conversationResponse\.json\(\)/,
    "one malformed JSON response must not collapse healthy chat sources");

  console.log("Message partial-resilience checks passed: saved chats survive partial outages and users get a retry action.");
})().catch(error => { console.error(error); process.exitCode = 1; });
