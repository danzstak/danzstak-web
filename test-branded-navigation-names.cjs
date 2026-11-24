const fs = require("fs");
const assert = require("assert");

const feed = fs.readFileSync("feed.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const profile = fs.readFileSync("profile.html", "utf8");
const booking = fs.readFileSync("booking.html", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));

assert.match(feed, /<span class="menu-label">Your Mix<\/span>/);
assert.match(feed, /<span class="menu-label">Tribes<\/span>/);
assert.match(feed, /aria-label="Dailies"/);
assert.match(feed, /<span class="story-create-label">Dailies<\/span>/);
// T0-A1 (owner 2026-11-18): no "The Roll" checkbox in the composer any more — every posted video goes there automatically.
assert.doesNotMatch(feed, /id="shareToReels"/);
assert.match(enhancements, /reelsTitle\.textContent = "The Roll"/);
assert.match(enhancements, /const screenTitles = \{ HQ: "Music HQ", Groups: "Tribes" \};/); // audit 36 C5: one title map
assert.match(enhancements, /const visibleName = screenTitles\[canonicalName\] \|\| canonicalName;/);
assert.match(profile, />Your Mix<\/a>/);
assert.match(booking, />Your Mix<\/a>/);
assert.match(messages, /data-chat-return[^>]+aria-label="Back to previous DanzStak screen"[^>]*>Back<\/a>/);
// SHORTCUT (owner 2026-11-24: "just sync and their shop"): the icon's long-hold list is exactly SYNC, then My shop.
assert.deepEqual(manifest.shortcuts.map(item => [item.name, item.url]), [["SYNC", "/sync/?app=sync"], ["My shop", "/store.html?manage=1"]], "long-hold shortcuts: SYNC and My shop only");

// Stable route and API names remain unchanged for backward compatibility.
assert.match(feed, /data-feature="Groups"/);
assert.match(feed, /reel: mediaType === "video", originalContentCertified: true/, "every posted video goes to The Roll (T0-A1)");
assert.match(enhancements, /if \(name === "Groups"\)/);

console.log("Branded navigation checks passed: Your Mix, Dailies, The Roll, and Tribes use stable routes.");
