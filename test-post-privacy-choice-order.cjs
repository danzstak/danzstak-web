"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const profileEditor = fs.readFileSync("assets/profile-editor.js", "utf8");

assert.match(
  enhancements,
  /const values = \["Just me", "Friends", "Public"\];\s*const audiences = \["private", "friends", "public"\];/,
  "post privacy choices should be ordered Just me, Friends, Public"
);
assert.match(
  profileEditor,
  /<option value="owner">Just me<\/option><option value="friends">Friends<\/option><option value="anyone">Public<\/option>/,
  "profile posting privacy choices should be ordered Just me, Friends, Public"
);

console.log("Privacy choice order checks passed: Just me, Friends, Public.");
