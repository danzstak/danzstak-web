"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const styles = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");

assert.match(source, /reelsRail\.replaceWith\(rollPlaceholder\);\s*document\.body\.appendChild\(reelsRail\)/, "fullscreen Roll must move to a top-level modal layer while preserving its feed position");
assert.match(source, /\.filter\(element => element !== reelsRail\)[\s\S]*element\.inert = true/, "background page regions must become inert while fullscreen is open");
assert.match(source, /reelsRail\.setAttribute\("role", "dialog"\)/, "fullscreen Roll must expose dialog semantics");
assert.match(source, /reelsRail\.setAttribute\("aria-modal", "true"\)/, "fullscreen Roll must identify itself as modal");
assert.match(source, /reelsRail\.setAttribute\("aria-labelledby", reelsTitle\.id\)/, "fullscreen Roll must use its visible heading as the accessible name");
assert.match(source, /rollBackgroundState\.forEach\(\(\{ element, wasInert \}\) => \{ if \(element\.isConnected\) element\.inert = wasInert; \}\)/, "closing must restore each background region's prior inert state");
assert.match(source, /if \(event\.key !== "Tab" \|\| !reelsRail\.classList\.contains\("roll-fullscreen"\)\) return/, "fullscreen Roll must contain keyboard focus");
assert.match(source, /if \(rollPlaceholder \|\| reelsRail\.classList\.contains\("roll-fullscreen"\)\) return/, "feed refreshes must not pull the active modal back into the page");
assert.match(styles, /\.roll-fullscreen \.reel-import-form\{display:none\}/, "off-screen import controls must not remain keyboard reachable in fullscreen");
assert.match(feed, /assets\/feed-enhancements\.css\?v=500/, "the feed must load the modal-accessibility styles");

console.log("Roll modal accessibility checks passed: background isolation, dialog naming, focus containment, hidden import controls, and state restoration are present.");
