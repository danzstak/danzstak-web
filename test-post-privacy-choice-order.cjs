"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const profileEditor = fs.readFileSync("assets/profile-editor.js", "utf8");
const authApi = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");

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
assert.match(
  authApi,
  /const requestedAudience = data\.audience === undefined \? "public" : String\(data\.audience \|\| ""\);\s*if \(!requestedGroupId && !\["public", "friends", "private"\]\.includes\(requestedAudience\)\) \{\s*return \{ statusCode: 400, headers, body: JSON\.stringify\(\{ error: "Invalid audience\." \}\) \};/,
  "new posts must reject malformed audience values rather than widening them to Public"
);
assert.match(
  authApi,
  /if \(Object\.prototype\.hasOwnProperty\.call\(data, "audience"\)\) \{\s*const audience = String\(data\.audience \|\| ""\);\s*if \(!\["public", "friends", "private"\]\.includes\(audience\)\) return \{ statusCode: 400/,
  "post privacy edits must accept only the same three audience values"
);

console.log("Privacy checks passed: Just me, Friends, Public in the UI and strict server-side audience validation.");
