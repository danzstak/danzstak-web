"use strict";
// Owner 2026-11-18 (phone screenshot): while a profile loads, or when loading times out, the header
// read "DanzStak member". No placeholder name may show before the real profile arrives.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const page = fs.readFileSync("profile.html", "utf8");
assert.match(page, /<h1 id="profileName"( class="[^"]*")?><\/h1>/, "the profile name starts empty");
assert.match(page, /<p id="profileHandle" class="handle"><\/p>/, "the @handle starts empty");
assert.match(page, /<div id="profileInitial" class="avatar" aria-hidden="true"><\/div>/, "the avatar starts without a placeholder initial");
assert.doesNotMatch(page, /DanzStak member|@member</, "no placeholder member name or handle in the page");
// The mobile header copies the loaded name; before that it stays blank.
const nav = fs.readFileSync("assets/profile-nav.js", "utf8");
assert.match(nav, /window\.danzstakCurrentProfile\?\.name \|\| document\.getElementById\("profileName"\)\?\.textContent\?\.trim\(\) \|\| ""/);
console.log("profile placeholder name ok");
