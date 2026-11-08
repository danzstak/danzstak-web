"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = path => fs.readFileSync(path, "utf8");
const feed = read("feed.html");
const hq = read("assets/artist-hq.js");
const css = read("assets/artist-hq.css");
const enhancements = read("assets/feed-enhancements.js");
const worker = read("service-worker.js");

assert.match(feed, /href="#hq" data-feature="HQ"/);
assert.match(feed, /Artist HQ/);
assert.match(feed, /booking-selections\.html#tourManagerTitle/);
assert.match(feed, /assets\/artist-hq\.css\?v=1/);
assert.match(feed, /assets\/artist-hq\.js\?v=1/);
assert.match(enhancements, /\["HQ", "Friends"/);
assert.match(enhancements, /danzstakArtistHq\?\.render/);
assert.match(hq, /get\("\/epk"\)/);
assert.match(hq, /get\("\/tour-manager\/outreach"\)/);
assert.match(hq, /get\("\/tour-manager\/credits"\)/);
assert.match(hq, /Nothing is sent or confirmed without you/);
assert.doesNotMatch(hq, /innerHTML|insertAdjacentHTML|outerHTML/);
assert.match(css, /min-height:44px/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(worker, /danzstak-shell-v732/);
assert.match(worker, /\/assets\/artist-hq\.js/);
assert.match(worker, /\/assets\/artist-hq\.css/);

console.log("Artist HQ checks passed.");
