const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");

assert.match(feed, /const storyMemberId = String\(story\.memberId \|\| ""\)/, "Flashes use opaque member IDs for profile links");
assert.match(feed, /profile\.href = "profile\.html\?member=" \+ encodeURIComponent\(storyMemberId\)/, "another member's Flash links to that member profile");
assert.match(feed, /profile\.href = "profile\.html"/, "the current member's Flash links to their own profile");
assert.match(feed, /profile\.setAttribute\("aria-label", "Open " \+ storyAuthor \+ " profile"\)/, "Flash profile links have an accessible name");
assert.match(css, /\.story-author-link\{[^}]*z-index:3/, "the author link remains independently clickable above the Flash viewer control");

console.log("Flash author link checks passed: opaque member profile routes, self route, and accessible focus treatment.");
