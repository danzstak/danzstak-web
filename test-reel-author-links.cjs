const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");

assert.match(source, /memberId: post\.userId \|\| ""/, "post videos carry their opaque author member ID into The Roll");
assert.match(source, /const reelMemberId = String\(reel\.memberId \|\| ""\)/, "Roll cards resolve opaque member IDs");
assert.match(source, /reel\.isOwner === true \? "profile\.html" : "profile\.html\?member=" \+ encodeURIComponent\(reelMemberId\)/, "Roll cards link to self or another member without an email route");
assert.match(source, /author\.setAttribute\("aria-label", "Open " \+ reelAuthorName \+ " profile"\)/, "Roll profile links have accessible names");
assert.match(css, /\.reel-author-link:focus-visible\{outline:2px solid #fff/, "Roll profile links have visible keyboard focus");

console.log("Roll author link checks passed: internal and shared videos use accessible opaque profile routes.");
