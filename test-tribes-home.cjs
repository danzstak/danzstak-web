"use strict";
// Owner 2026-11-18: Tribes opens like Facebook Groups, DanzStak look (no letters in boxes, no category wall, no '97 forms).
const assert = require("node:assert/strict");
const fs = require("node:fs");
const js = fs.readFileSync("assets/feed-enhancements.js", "utf8"), css = fs.readFileSync("assets/tribes-home.css", "utf8"), art = fs.readFileSync("assets/tribes-art.js", "utf8"), html = fs.readFileSync("feed.html", "utf8");
assert.match(js, /for \(const \[value, label\] of \[\["joined", "Your Tribes"\], \["discover", "Discover"\]\]\)/, "Your Tribes first");
assert.match(js, /window\.danzstakTribeArt\.art\(group\.name, group\.category\)/, "art covers instead of letters");
assert.match(js, /toolbar\.classList\.toggle\("is-searching", open\)/, "search and categories only after tapping search");
assert.match(js, /tribePins\.has\(b\.id\)\) - Number\(tribePins\.has\(a\.id\)\)/, "pinned Tribes first (member's choice)");
assert.match(js, /card\.classList\.toggle\("show-tools", open\)/, "Report and Elder tools behind ⋯");
assert.match(css, /\.tribes-head:not\(\.is-searching\) \.groups-discovery-controls\{display:none!important\}/);
assert.match(art, /createElementNS\(ns, "svg"\)/, "art is SVG, no images");
assert.ok(html.indexOf("assets/tribes-art.js") < html.indexOf("assets/feed-enhancements.js?v="), "art loads before the Tribes code");
console.log("Tribes home checks passed: Your Tribes first, art covers, hidden search/categories, pins, ⋯ tools.");
