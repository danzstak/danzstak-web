"use strict";
// Audit A9 (2026-11-19): tapping your photo in the Mix composer did nothing; it opens your profile (owner rule: every
// profile picture opens that member's profile; only your own big picture on your profile edits it).
const assert = require("node:assert/strict");
const feed = require("node:fs").readFileSync("feed.html", "utf8");
assert.match(feed, /<a class="composer-avatar" href="profile\.html" aria-label="Open your profile"[^>]*>/, "the composer photo is a link to your profile");
assert.doesNotMatch(feed, /<span class="composer-avatar"/, "no dead composer photo");
console.log("Composer avatar checks passed: your photo in the Mix composer opens your profile.");
