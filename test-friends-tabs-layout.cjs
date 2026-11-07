"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(css, /@media\(max-width:375px\)\{\.friends-directory-tabs\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:6px;margin-inline:0;overflow:visible\}/,
  "narrow phones must show all four Friends tabs in a visible two-column grid");
assert.match(css, /\.friends-directory-tab\{width:100%;padding-inline:8px\}/,
  "narrow Friends tabs must fill their grid cells instead of clipping horizontally");
assert.match(feed, /assets\/feed-enhancements\.css\?v=502/,
  "the feed must request the corrected Friends tab stylesheet");
assert.match(worker, /danzstak-shell-v715/,
  "the installed PWA must replace its cached Friends layout");

console.log("Friends tab-layout checks passed: all tabs remain visible at narrow phone widths and the PWA refreshes the corrected CSS.");
