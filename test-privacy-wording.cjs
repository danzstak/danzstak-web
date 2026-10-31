const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");

const files = [
  "feed.html",
  "assets/feed-enhancements.js",
  "assets/facebook-import.js",
  "assets/post-sharing.js",
  "assets/profile-editor.js"
];

for (const file of files) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, />Only me</, `${file} must use the requested Just me label`);
  assert.doesNotMatch(source, /["']Only me["']/, `${file} must not create an Only me control`);
}

const enhancements = readFileSync("assets/feed-enhancements.js", "utf8");
assert.match(enhancements, /const values = \["Just me", "Friends", "Public"\]/);
assert.match(enhancements, /const audiences = \["private", "friends", "public"\]/, "labels must retain the enforced audience values in the displayed order");

const aliases = readFileSync("assets/brand-language-aliases.js", "utf8");
assert.match(aliases, /dictionary\["Just me"\] \|\|= dictionary\["Only me"\]/, "translated privacy labels must retain the existing catalog");

console.log("Privacy wording checks passed: Just me, Friends, and Public use the existing enforced audience values.");
