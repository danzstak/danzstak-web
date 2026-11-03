"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const start = source.indexOf("const osmFailureBackoffMs");
const end = source.indexOf("function discoveryBoundingBox", start);
assert.ok(start >= 0 && end > start, "OpenStreetMap discovery circuit breaker must be present");
const block = source.slice(start, end);

assert.match(block, /const osmFailureBackoffMs = 5 \* 60 \* 1000/);
assert.match(block, /if \(osmBackoffUntil > Date\.now\(\)\)/);
assert.match(block, /retryAfter: osmBackoffUntil/);
assert.match(block, /osmBackoffUntil = Date\.now\(\) \+ osmFailureBackoffMs/);
assert.match(block, /osmBackoffUntil = 0/);
assert.match(block, /provider: "OpenStreetMap"/);

const discovery = source.slice(source.indexOf("async function multiSourceDiscovery"), source.indexOf("async function recordStoreCandidates"));
assert.match(discovery, /Promise\.allSettled\(\[/, "healthy providers must still return results while OpenStreetMap is cooling down");
assert.match(discovery, /Provider temporarily unavailable/, "the response must disclose the unavailable provider instead of reporting zero matches");

console.log("Discovery provider checks passed: OpenStreetMap failures are disclosed and briefly short-circuited while healthy providers continue.");
