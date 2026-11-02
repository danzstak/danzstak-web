"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const chat = fs.readFileSync(path.join(__dirname, "assets", "chat.js"), "utf8");

assert.match(chat, /function rememberCallFocus\(\).*callReturnFocus=document\.activeElement/, "incoming calls should remember the control that had focus");
assert.match(chat, /function restoreCallFocus\(\).*target\?\.isConnected.*target\.focus\(\)/, "closed call surfaces should restore focus only to a usable control");
assert.match(chat, /function ring\(\)\{rememberCallFocus\(\);els\.incoming\.hidden=false;els\.accept\.focus\(\)/, "incoming calls should focus the first decision control");
assert.match(chat, /async function accept\(\).*els\.hangup\.focus\(\)/, "accepted calls should move focus to the active Hang Up control");
assert.match(chat, /async function decline\(\).*stopRing\(\);restoreCallFocus\(\)/, "declined calls should dismiss immediately and return focus before network cleanup");
assert.match(chat, /async function end\(notify=true\).*restoreCallFocus\(\)/, "ended calls should return focus to the previous control");

console.log("Call focus checks passed: incoming decisions, active Hang Up, decline, and call end keep keyboard focus usable.");
