"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");

assert.match(source, /function approvedVideoUrl\(value\)/, "The Roll should have one defensive URL parser");
assert.match(source, /isApprovedVideoUrl\(url\) && reelPlayer\(url\)/, "only approved, playable links should survive parsing");
assert.match(source, /if \(!reel\.internal && !reelUrlValue\) continue;/, "damaged external records should not break rendering");
assert.match(source, /open\.href = reelUrlValue\.href/, "source links should use the normalized approved URL");
assert.match(source, /rel = "noopener noreferrer nofollow ugc"/, "member links should be isolated and marked as user-generated content");
assert.match(source, /data\.reels\.flatMap\(reel => \{/, "cloud records should be filtered before entering The Roll");
assert.doesNotMatch(source, /reelPlatform\(new URL\((?:reel|result\.reel)\.url\)/, "cloud records must not use unchecked URL construction");

console.log("Roll URL-safety checks passed: malformed records are dropped and only approved HTTPS video links reach players or anchors.");
