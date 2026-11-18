"use strict";
// Task 16-C sweep, Booking agent (owner 2026-11-17). Real browser: AREA=booking browser-checks/buttons-site-audit.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const css = fs.readFileSync("assets/buttons.css", "utf8");
const page = fs.readFileSync("booking.html", "utf8");
assert.match(page, /<link rel="stylesheet" href="assets\/buttons\.css\?v=\d+">/);
assert.match(css, /body\.booking-page #bookingBriefExample\{[^}]*border:0!important;border-radius:var\(--ds-btn-radius\)!important;background:var\(--ds-btn-tonal\)!important/, "Example is a tonal pill, not an outlined box");
assert.match(css, /body\.booking-page \.leaflet-bar a,body\.booking-page \.leaflet-control-zoom a\{width:var\(--ds-btn-size\)!important;height:var\(--ds-btn-size\)!important/, "map zoom is 44px");
assert.match(css, /body\.booking-page \.map-draw-control\{width:var\(--ds-btn-size\)!important/, "draw control is 44px");
assert.match(css, /body\.booking-page \.map-actions>button\{white-space:nowrap;/, "map actions stay on one line");
console.log("Booking button checks passed.");
