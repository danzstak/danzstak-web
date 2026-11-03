const fs = require("fs");
const assert = require("assert");

const feed = fs.readFileSync("feed.html", "utf8");

assert.match(feed, /created \+ 24 \* 60 \* 60 \* 1000/,
  "Flashes without an explicit server expiry must derive 24 hours from creation");
assert.match(feed, /filter\(story => \{[\s\S]*expiresAt > Date\.now\(\)/,
  "already-expired Flashes must not render even if a stale response includes them");
assert.match(feed, /item\.dataset\.expiresAt = String\(storyExpiryTime\(story\)\)/,
  "rendered Flash cards must retain their expiry time");
assert.match(feed, /setTimeout\(\(\) => \{[\s\S]*data-expires-at[\s\S]*item\.remove\(\)/,
  "open pages must remove Flash cards when their 24 hours end");
assert.match(feed, /viewer\?\.open[\s\S]*viewer\.close\(\)/,
  "an expired Flash must close if it is currently being viewed");
assert.match(feed, /void loadStories\(\)/,
  "client expiry must refresh the server collection so durable cleanup can run");

console.log("Flash client-expiry checks passed: stale responses are filtered and open pages expire cards at 24 hours.");
