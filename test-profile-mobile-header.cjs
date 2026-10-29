"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const profile = fs.readFileSync("profile.html", "utf8");

assert.match(profile, /@media\(max-width:600px\)\{header\{position:sticky;align-items:center;flex-direction:row;/,
  "phone profile navigation must remain in one compact row");
assert.match(profile, /header\{position:sticky;align-items:center;flex-direction:row;gap:5px;width:100vw;max-width:100vw;/,
  "phone profile navigation must be constrained to the visual viewport");
assert.match(profile, /\.header-actions\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);flex:1 1 0;width:calc\(100vw - 75px\);min-width:0;/,
  "all three account actions must share the available phone width");
assert.match(profile, /\.header-actions \.button\{width:100%;min-width:0;min-height:40px;/,
  "phone account actions must shrink without clipping while retaining usable height");

console.log("Profile mobile-header checks passed: all account actions fit one compact row.");
