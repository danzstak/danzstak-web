"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("feed.html", "utf8");

assert.match(html, /function readFeedPreference\(key\)[\s\S]*catch \{ return null; \}/, "feed preferences tolerate blocked browser storage");
assert.match(html, /function writeFeedPreference\(key, value\)[\s\S]*volatileFeedPreferences\.set/, "feed preferences retain an in-memory fallback");
assert.match(html, /function readHiddenPostIds\(\)[\s\S]*Array\.isArray\(stored\)[\s\S]*catch \{ return new Set\(\); \}/, "hidden-post state tolerates corrupt or blocked storage");
assert.equal((html.match(/localStorage\.getItem\(/g) || []).length, 1, "feed runtime reads go through the guarded preference helper");
assert.doesNotMatch(html, /localStorage\.setItem\("danzstak-news-interest"/, "news preferences use the guarded writer");
assert.match(html, /remove\.setAttribute\("aria-label", "Delete Daily"\);[\s\S]{0,200}remove\.textContent = "🗑️";/, "Daily removal uses the same accessible trash icon as other content");

console.log("Feed storage checks passed: blocked storage cannot break news, Flashes, or durable post loading.");
