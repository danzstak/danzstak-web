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
assert.match(feed, /aria-label="Flashes"/);
assert.match(feed, /<span class="story-create-label">Flashes<\/span>/);
assert.match(feed, /<span>The Roll<\/span>/);
assert.match(enhancements, /reelsTitle\.textContent = "The Roll"/);
assert.match(enhancements, /canonicalName === "Groups" \? "Tribes" : canonicalName/);
assert.match(profile, />Your Mix<\/a>/);
assert.match(booking, />Your Mix<\/a>/);
assert.match(messages, />Back to Your Mix<\/a>/);
assert.ok(manifest.shortcuts.some(shortcut => shortcut.name === "Your Mix" && shortcut.url === "/feed.html"), "installed app shortcut should use Your Mix");

// Stable route and API names remain unchanged for backward compatibility.
assert.match(feed, /data-feature="Groups"/);
assert.match(feed, /id="shareToReels"/);
assert.match(enhancements, /if \(name === "Groups"\)/);

console.log("Branded navigation checks passed: Your Mix, Flashes, The Roll, and Tribes use stable routes.");
