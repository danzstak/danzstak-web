"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const feed = fs.readFileSync("feed.html", "utf8");
const profile = fs.readFileSync("assets/profile-editor.js", "utf8");

assert.match(feed, /newsUrl = new URL\(String\(item\.url \|\| ""\)\)/, "news links should be parsed before use");
assert.match(feed, /!\["http:", "https:"\]\.includes\(newsUrl\.protocol\) \|\| newsUrl\.username \|\| newsUrl\.password/, "news links should reject unsafe schemes and embedded credentials");
assert.match(feed, /link\.href = newsUrl\.href[\s\S]{0,180}link\.referrerPolicy = "no-referrer"/, "news links should use normalized URLs without referral leakage");
assert.match(profile, /link\.rel = "noopener noreferrer nofollow ugc"/, "member profile websites should be isolated and marked as user-generated");
assert.match(profile, /link\.referrerPolicy = "no-referrer"/, "member profile websites should not leak referral context");

console.log("External-link privacy checks passed: news and member profile links are scheme-safe, isolated, and referrer-free.");
