"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/direct-messages.js", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(source, /function stableIdentityPicture\(value\)[\s\S]*parsed\.origin\}\$\{parsed\.pathname/, "SYNC must compare the stable photo path instead of volatile signed query values");
assert.match(source, /const signature = JSON\.stringify\(eligible\.map\(conversationVisualState\)\);\s*if \(signature === lastChatContactSignature\) return;\s*lastChatContactSignature = signature;\s*chatContacts\.replaceChildren\(\);/, "the contact strip must keep its existing avatar nodes when contact visuals are unchanged");
assert.match(source, /const listSignature = JSON\.stringify\([\s\S]*conversations: visible\.map\(conversationVisualState\)[\s\S]*if \(listSignature === lastConversationListSignature\) return;\s*lastConversationListSignature = listSignature;\s*conversationUsers\.replaceChildren\(\);/, "the conversation list must reconcile semantic changes before rebuilding avatar nodes");
assert.match(source, /cachedConversations\.find\(item => item\.contactEmail === conversation\.contactEmail\) \|\| conversation/, "reused rows must open the newest cached contact data");
assert.match(html, /assets\/direct-messages\.js\?v=497/, "SYNC must request the live read-receipt and avatar-stability implementation");
assert.match(worker, /danzstak-shell-v804/, "the installed PWA must advance for the avatar-stability fix");

console.log("SYNC avatar-stability checks passed: refreshed signed URLs keep the existing images while real contact changes still rerender.");
