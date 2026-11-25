"use strict";
// Task 30: Text button in calls; notes over the data channel, text only, never stored.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const note = fs.readFileSync("assets/call-note.js", "utf8"), chat = fs.readFileSync("assets/chat.js", "utf8"), html = fs.readFileSync("messages.html", "utf8");
assert.match(chat, /startsWith\('\{"type":"call-note'\)&&window\.danzstakCallNote\?\.receive\(event\.data,contactName\)\)return;[^\n]*?addMessage\(event\.data\)/, "notes and their delivery receipts go to the note layer, other strings to the chat");
assert.match(note, /fill\(body, text\); \/\/ text only/, "rendered as text");
assert.match(note, /if \(url && url\.origin === location\.origin\) \{ const link = document\.createElement\("a"\); link\.href = url\.href; link\.textContent = url\.href;/, "only a link back to DanzStak becomes tappable, built as text");
assert.doesNotMatch(note, /(body|node)\.innerHTML/, "a received note never goes through innerHTML");
assert.doesNotMatch(note, /fetch\(|localStorage|sessionStorage/, "no server, nothing stored");
assert.match(note, /const MAX = 280, GAP_MS = 2000, ACK_MS = 4000;/);
assert.ok(html.indexOf("assets/chat.js") < html.indexOf("assets/call-note.js"), "loads after chat.js");
// clean(): trims, strips control characters, caps at 280.
const sandbox = { window: {}, document: { readyState: "complete", getElementById: () => null, addEventListener() {} }, MutationObserver: class { observe() {} } };
vm.runInNewContext(note, sandbox);
const api = sandbox.window.danzstakCallNote;
assert.equal(api.clean("  hi\u0007 there  "), "hi there");
assert.equal(api.clean("x".repeat(400)).length, 280);
assert.equal(api.receive("not json"), false);
// L3 (owner 2026-11-19): the receiver never saw the note on a voice call: it was drawn inside the hidden video tile.
assert.doesNotMatch(note, /#videoGrid figure:not\(\.local-video\)/, "never inside a video tile");
assert.match(note, /\(document\.querySelector\("\.call-panel, #videoGrid"\)\?\.parentElement \|\| document\.body\)\.appendChild\(overlay\);/, "on the call screen itself");
assert.match(note, /liveChannel\(\)\?\.send\(JSON\.stringify\(\{ type: "call-note-ack"/, "the receiver confirms delivery");
assert.match(note, /status\.textContent = t\("Sending…"\);/, "the sender waits for the confirmation");
assert.doesNotMatch(note, /lastSent = Date\.now\(\); status\.textContent = t\("Sent ✓"\)/, "Sent ✓ only after the other phone confirms");
assert.equal(api.receive(JSON.stringify({ type: "call-note-ack", id: "x" })), true, "a receipt never shows in the chat");
assert.match(fs.readFileSync("assets/call-screen.css", "utf8"), /\.video-grid\{bottom:max\(var\(--call-subtitle-band\),var\(--call-note-band,0px\)\)!important;/, "a video call's picture ends above the note");
assert.match(fs.readFileSync("assets/call-note.css", "utf8"), /\.call-note-overlay\{position:fixed;/, "the note is fixed on the call screen");
const i18n = fs.readFileSync("assets/i18n-sync.js", "utf8");
for (const key of ["Sending…", "Not delivered, try again"]) assert.equal(i18n.split(`${JSON.stringify(key)}:`).length - 1, 5, `"${key}" translated for it, fr, es, de and pt`);
console.log("Call note checks passed: data channel only, text only, 280 chars, on the call screen (never a hidden video tile), delivery confirmed, video ends above the note, translated.");
