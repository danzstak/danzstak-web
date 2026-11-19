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
assert.match(enhancements, /canonicalName === "Groups" \? "Tribes" : canonicalName/);
assert.match(profile, />Your Mix<\/a>/);
assert.match(booking, />Your Mix<\/a>/);
assert.match(messages, /data-chat-return[^>]+aria-label="Back to previous DanzStak screen"[^>]*>Back<\/a>/);
assert.ok(manifest.shortcuts.some(shortcut => shortcut.name === "Your Mix" && shortcut.url === "/feed.html"), "installed app shortcut should use Your Mix");

// Stable route and API names remain unchanged for backward compatibility.
assert.match(feed, /data-feature="Groups"/);
assert.match(feed, /reel: mediaType === "video", originalContentCertified: true/, "every posted video goes to The Roll (T0-A1)");
assert.match(enhancements, /if \(name === "Groups"\)/);

console.log("Branded navigation checks passed: Your Mix, Dailies, The Roll, and Tribes use stable routes.");
