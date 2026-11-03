"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const chat = fs.readFileSync("assets/chat.js", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");

assert.match(chat, /async function makePeer\(kind,\{receiving=false\}=\{\}\)/, "call setup should distinguish the caller from the receiver");
assert.match(chat, /els\.receiverHangup\.hidden=!receiving/, "the extra mobile receiver control should not duplicate the caller's Hang Up button");
assert.match(chat, /async function start\(kind\).*await makePeer\(kind\)/, "outgoing calls should use the normal caller controls");
assert.match(chat, /async function accept\(\).*await makePeer\(offer\.mode,\{receiving:true\}\)/, "accepted calls should expose the receiver-side Hang Up control");
assert.match(messages, /id="hangUp"[^>]+aria-label="Hang up the current call"/, "the primary accessible Hang Up control should remain available to both roles");
assert.match(messages, /id="receiverHangUp"[^>]+receiver-hangup/, "the receiver should retain a dedicated touch-friendly Hang Up control");

console.log("Call role-control checks passed: callers avoid duplicate controls and receivers retain a mobile Hang Up action.");
