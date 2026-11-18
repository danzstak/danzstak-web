"use strict";
// Owner 2026-11-18 (menu screenshot): "Photos and videos need to be removed from the main menu."
// They live on each profile's Photos and Videos tabs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const feed = fs.readFileSync("feed.html", "utf8");
assert.doesNotMatch(feed, /data-feature="Photos"|data-feature="Videos"/, "no Photos or Videos in the main menu");
assert.doesNotMatch(feed, /<span class="menu-label">(Photos|Videos)<\/span>/);
assert.match(feed, /<a href="#groups" data-feature="Groups">[\s\S]*?<p class="menu-section-heading">Music HQ · for musicians<\/p>/, "Tribes is followed by Music HQ");
console.log("menu without Photos and Videos ok");
