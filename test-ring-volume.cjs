"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
// Owner 2026-11-17: the SYNC ring was too quiet to hear on a phone.
const incoming = fs.readFileSync("assets/incoming-calls.js", "utf8");
const chat = fs.readFileSync("assets/chat.js", "utf8");
const ring = Number(incoming.match(/gain\.gain\.value = ([0-9.]+)/)[1]);
assert.ok(ring >= 0.3 && ring <= 0.6, `incoming ringtone gain ${ring} must be loud enough to hear but not clip`);
for (const [, level] of chat.matchAll(/playTone\(4[48]0,\.\d+,(\.\d+)\)/g)) assert.ok(Number(level) >= 0.1, `ringback tone ${level} is too quiet`);
console.log("Ring volume checks passed: incoming ringtone and ringback are audible.");
