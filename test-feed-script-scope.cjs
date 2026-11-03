"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("feed.html", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1])
  .join("\n");

assert.doesNotThrow(
  () => new vm.Script(`${inlineScripts}\n${enhancements}`, { filename: "feed-page-scripts.js" }),
  "feed scripts must compile together without shared-global declaration collisions"
);
assert.match(enhancements, /^"use strict";\s*\(\(\) => \{/,
  "feed enhancements should keep implementation declarations in a private scope");

console.log("Feed script-scope checks passed: inline and enhancement scripts compile together.");
