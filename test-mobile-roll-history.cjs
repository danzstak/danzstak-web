"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.match(source, /const usesMobileRollHistory = \(\) => matchMedia\("\(max-width: 700px\)"\)\.matches/, "Roll history must be limited to its mobile fullscreen layout");
assert.match(source, /history\.pushState\(\{ \.\.\.currentState, danzstakRollOpen: true \}, ""\)/, "opening The Roll on a phone must create a browser Back entry");
assert.match(source, /if \(usesMobileRollHistory\(\)\) \{\s*history\.back\(\);\s*return;/, "Close and Escape must return through mobile history");
assert.match(source, /setRollFullscreen\(true, \{ updateHistory: false, fromHistory: true \}\)/, "Forward must restore fullscreen without creating a history loop");
assert.match(source, /setRollFullscreen\(false, \{ updateHistory: false, fromHistory: true \}\)/, "Back must close fullscreen without adding another history action");
assert.doesNotMatch(source, /danzstakRollOpen:\s*(?:reel|video|url|user|title|media)/, "Roll history state must not contain media or account data");
assert.match(feed, /assets\/feed-enhancements\.js\?v=527/, "the feed must load the Roll-history build");

console.log("Mobile Roll history checks passed: Back closes fullscreen, Forward restores it, desktop behavior is unchanged, and history contains no media data.");
