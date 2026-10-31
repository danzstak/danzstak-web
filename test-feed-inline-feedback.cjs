"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");

const feed = readFileSync("feed.html", "utf8");
const inlineScripts = [...feed.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(Boolean);
assert.equal(inlineScripts.length, 1, "feed should retain one explicitly hashed inline script");
const script = inlineScripts[0];

assert.doesNotMatch(script, /\balert\(/, "feed composer, Flashes, and friend actions should not block the page with browser alerts");
for (const message of [
  "Friend request could not be updated.",
  "Flash could not be deleted.",
  "Flashes must use a supported photo or video file.",
  "Posts must be 5000 characters or fewer.",
  "Certify that this is your original content before posting.",
  "Post was not saved: "
]) assert.ok(script.includes(message), `feed feedback should retain: ${message}`);
assert.ok((script.match(/window\.danzstakShowFeedback\?\./g) || []).length >= 8, "all inline feed failures should use the shared feedback surface");

console.log("Feed inline feedback checks passed: composer, Flash, and friend errors are accessible and nonblocking.");
