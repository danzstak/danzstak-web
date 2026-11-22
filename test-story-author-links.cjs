const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");

assert.match(feed, /const storyMemberId = String\(story\.memberId \|\| ""\)/, "Flashes use opaque member IDs for profile links");
assert.match(feed, /profile\.href = "profile\.html\?member=" \+ encodeURIComponent\(storyMemberId\)/, "another member's Flash links to that member profile");
// T0-A2 (owner 2026-11-19): your own Dailies sit behind your own tile (it opens them), so they are not repeated in the strip.
// Directive F15: friends' Dailies are shuffled once per visit (rotateDailiesForVisit) before the first 12 are shown.
assert.match(feed, /const visibleStories = \[\.\.\.ownInStrip, \.\.\.rotateDailiesForVisit\(allStories\.filter\(story => story\.isOwner !== true\)\)\.slice\(0, 12\)\];/, "the strip shows your Dailies, then friends' Dailies, beside your own tile");
assert.match(feed, /profile\.setAttribute\("aria-label", "Open " \+ storyAuthor \+ " profile"\)/, "Flash profile links have an accessible name");
assert.match(css, /\.story-author-link\{[^}]*z-index:3/, "the author link remains independently clickable above the Flash viewer control");

console.log("Flash author link checks passed: opaque member profile routes, self route, and accessible focus treatment.");
