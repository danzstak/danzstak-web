"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/people-search.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.match(source, /const name = id \? document\.createElement\("a"\) : document\.createElement\("strong"\)/, "every search result with an opaque member ID links to a profile regardless of friendship state");
assert.match(source, /name\.href = "profile\.html\?member=" \+ encodeURIComponent\(id\)/, "member search uses the private opaque profile route");
assert.match(source, /name\.setAttribute\("aria-label", "Open " \+ \(person\.name \|\| "DanzStak member"\) \+ " profile"\)/, "profile links announce their purpose without exposing account identifiers");
assert.match(source, /body: JSON\.stringify\(\{ memberId: id \}\)/, "friend requests from search use opaque member IDs rather than email");
assert.doesNotMatch(source, /body: JSON\.stringify\(\{ email:/, "member search never sends or requires an email address");
assert.match(feed, /assets\/people-search\.js\?v=423/, "the live feed loads the current profile-link discovery behavior");

console.log("People profile-link checks passed: every discoverable member can be opened and added through an opaque member ID.");
