"use strict";
// Task 30: Text button in calls; notes over the data channel, text only, never stored.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const note = fs.readFileSync("assets/call-note.js", "utf8"), chat = fs.readFileSync("assets/chat.js", "utf8"), html = fs.readFileSync("messages.html", "utf8");
assert.match(chat, /startsWith\('\{"type":"call-note"'\)&&window\.danzstakCallNote\?\.receive\(event\.data,contactName\)\)return;addMessage\(event\.data\)/, "notes go to the overlay, other strings to the chat");
assert.match(note, /body\.textContent = text; \/\/ text only/, "rendered as text");
assert.doesNotMatch(note, /fetch\(|localStorage|sessionStorage/, "no server, nothing stored");
assert.match(note, /const MAX = 280, GAP_MS = 2000;/);
assert.ok(html.indexOf("assets/chat.js") < html.indexOf("assets/call-note.js"), "loads after chat.js");
// clean(): trims, strips control characters, caps at 280.
const sandbox = { window: {}, document: { readyState: "complete", getElementById: () => null, addEventListener() {} }, MutationObserver: class { observe() {} } };
vm.runInNewContext(note, sandbox);
const api = sandbox.window.danzstakCallNote;
assert.equal(api.clean("  hi\u0007 there  "), "hi there");
assert.equal(api.clean("x".repeat(400)).length, 280);
assert.equal(api.receive("not json"), false);
console.log("Call note checks passed: data channel only, text only, 280 chars, chat path unchanged.");
