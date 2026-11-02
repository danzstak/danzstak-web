"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const messages = fs.readFileSync("assets/direct-messages.js", "utf8");
const messagePage = fs.readFileSync("messages.html", "utf8");
const booking = fs.readFileSync("assets/booking-agent.js", "utf8");

assert.match(feed, /remove\.textContent = "🗑️"[\s\S]*remove\.setAttribute\("aria-label", "Delete Tribe"\)/, "Tribe removal is compact and accessible");
assert.match(feed, /button\.textContent = "🗑️"[\s\S]*button\.setAttribute\("aria-label", "Delete comment"\)/, "comment removal is compact and accessible");
assert.match(feed, /strong\.textContent = title === "Delete post" \? "🗑️" : title/, "post removal uses a trash-can label");
assert.match(feed, /remove\.setAttribute\("aria-label", "Delete from The Roll"\)/, "Roll removal keeps an accessible name");
assert.match(messages, /remove\.textContent = "🗑️"[\s\S]*remove\.setAttribute\("aria-label", messageTranslate\("Delete message"\)\)/, "message removal is compact, accessible, and translated");
assert.match(messagePage, /id="headerDeleteChat"[^>]*aria-label="Delete chat"[^>]*>🗑️<\/button>/, "chat removal is compact and accessible");
assert.match(booking, /remove\.textContent = "🗑️"[\s\S]*remove\.setAttribute\("aria-label", "Delete saved tour"\)/, "saved-tour removal is compact and accessible");
assert.match(feed, /author\.textContent = reelAuthorName/, "Roll profile links display only the member name");

assert.doesNotMatch(messagePage, />\s*Delete(?: chat)?\s*</i, "message markup must not render a wordy Delete control");

console.log("Compact destructive-control checks passed: trash icons retain accessible names and profile links show member names.");
