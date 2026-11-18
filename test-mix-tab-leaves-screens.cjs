"use strict";
// Fix-it 18 (owner 2026-11-18): the Mix tab always returns to Mix; only one primary screen is visible.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const js = fs.readFileSync("assets/feed-enhancements.js", "utf8");
assert.match(css, /#featureView\[hidden\],\.friends-feature-view\[hidden\]\{display:none!important\}/, "a hidden Friends/feature screen never stays stacked above Mix");
assert.match(js, /activateMobileScreen\("home"\); globalThis\.danzstakSyncMobileMenuCurrent\?\.\(false\); setTimeout\(\(\) => setScreenTitle\(""\), 0\);/, "the Mix tab restores the Your Mix title");
console.log("Mix tab checks passed: hidden screens stay hidden, title returns to Your Mix.");
