"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

const read = path => fs.readFileSync(path, "utf8");
const feed = read("feed.html");
const hq = read("assets/artist-hq.js");
const css = read("assets/artist-hq.css");
const booking = read("booking-selections.html");
const bookingJs = read("assets/booking-selections.js");
const enhancements = read("assets/feed-enhancements.js");
const worker = read("service-worker.js");

assert.match(feed, /href="#hq" data-feature="HQ"/);
assert.match(feed, /Music HQ/);
assert.match(feed, /booking-selections\.html#tourManagerTitle/);
assert.match(feed, /assets\/artist-hq\.css\?v=6/);
assert.match(feed, /assets\/artist-hq\.js\?v=6/);
assert.match(enhancements, /\["HQ", "Friends"/);
assert.match(enhancements, /danzstakArtistHq\?\.render/);
assert.match(hq, /get\("\/epk"\)/);
assert.match(hq, /get\("\/tour-manager\/outreach"\)/);
assert.match(hq, /get\("\/tour-manager\/credits"\)/);
assert.match(hq, /bookingEmailCredits \?\? creditsResult\.value\.balance/, "HQ must read the backend's real booking-credit field");
assert.match(hq, /get\("\/booking-pipeline"\)/);
assert.doesNotMatch(hq, /Your EPK and booking work in one place/, "fix-it 18: no explanatory sub-line");
// Fix-it 18 (owner 2026-11-17): compact dashboard: one primary action, 2-column tiles, Pivot card, Music HQ tools.
assert.match(hq, /primary\.replaceChildren\(published \? action\(tr\("Send a pitch"\), "booking\.html", true\) : action\(tr\(ready \? "Publish EPK" : "Build EPK"\), "epk\.html", true\)\);/, "exactly one primary action");
for (const label of ["Next gigs", "Booking replies", "EPK opens", "Email credits"]) assert.ok(hq.includes(`tile("${label}"`), `tile: ${label}`);
assert.doesNotMatch(hq, /pivotCard|data-pivot-trigger/, "owner 2026-11-18: no Pivot card on Music HQ");
assert.match(hq, /\["Record shops", "record-stores\.html"\]/, "Record shops are part of Music HQ");
assert.match(css, /\.artist-hq-tiles\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, "2-column tiles on phones");
assert.match(css, /\.artist-hq-label\{[^}]*white-space:nowrap/, "tile labels stay on one line");
assert.match(hq, /messages\.html\?section=bookings&outreach=/, "one waiting venue must open its exact private SYNC thread");
assert.match(hq, /messages\.html\?section=bookings/, "the HQ fallback must open the SYNC Bookings inbox");
assert.match(hq, /booking-selections\.html\?focusVenue=/, "one due reminder must open its exact saved venue");
assert.doesNotMatch(hq, /messages\.html#bookings/, "the retired hash handoff does not activate the Bookings screen");
assert.doesNotMatch(hq, /innerHTML|insertAdjacentHTML|outerHTML/);
assert.match(css, /min-height:44px/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(booking, /assets\/booking-selections\.js\?v=43/);
assert.match(bookingJs, /searchParams\.get\("focusVenue"\)/);
assert.match(bookingJs, /focusFollowUpVenue\(followUpFocusVenue\)/);
assert.match(worker, /danzstak-shell-v1104/);
assert.match(worker, /\/assets\/artist-hq\.js/);
assert.match(worker, /\/assets\/artist-hq\.css/);

console.log("Artist HQ checks passed.");
