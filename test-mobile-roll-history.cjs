"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.doesNotMatch(source, /usesMobileRollHistory|max-width:\s*700px[^\n]*danzstakRollOpen/, "Roll Back behavior must not depend on a phone-only breakpoint");
assert.match(source, /history\.pushState\(\{ \.\.\.currentState, danzstakRollOpen: true \}, ""\)/, "opening The Roll must create a browser Back entry on every device layout");
assert.match(source, /if \(!shouldOpen && !fromHistory && history\.state\?\.danzstakRollOpen === true\) \{\s*history\.back\(\);\s*return;/, "Close and Escape must return through history on every device layout");
assert.match(source, /setRollFullscreen\(true, \{ updateHistory: false, fromHistory: true \}\)/, "Forward must restore fullscreen without creating a history loop");
assert.match(source, /setRollFullscreen\(false, \{ updateHistory: false, fromHistory: true \}\)/, "Back must close fullscreen without adding another history action");
assert.doesNotMatch(source, /danzstakRollOpen:\s*(?:reel|video|url|user|title|media)/, "Roll history state must not contain media or account data");
assert.match(feed, /assets\/feed-enhancements\.js\?v=547/, "the feed must load the device Back-navigation build");

console.log("Roll history checks passed: device Back closes fullscreen on every layout, Forward restores it, and history contains no media data.");
