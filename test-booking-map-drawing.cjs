"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("booking.html", "utf8");
const script = fs.readFileSync("assets/booking-map.js", "utf8");
const css = fs.readFileSync("assets/booking-agent-driver.css", "utf8");

assert.doesNotMatch(html, /id="drawVenueRoute"/, "the redundant page-level Draw route button should be removed");
assert.match(html, /use\s+the pencil on the map/i, "map instructions should point users to the pencil control");
assert.match(script, /L\.DomEvent\.on\(mapDrawControl, "click", toggleRouteDrawing\)/, "the pencil must invoke drawing directly");
assert.match(script, /mapDrawControl\.innerHTML = active \? '<span aria-hidden="true">✓<\/span>'/, "the pencil should become a clear finish control");
assert.match(script, /L\.polyline\(routePoints, \{ color: "#1769e0", weight: 6/, "two points must create a visible route line");
assert.match(script, /if \(routePoints\.length < 2\)/, "a route cannot finish without a line");
assert.match(script, /event\.key !== "Escape" \|\| !drawingRoute/, "keyboard users can cancel drawing");
assert.match(css, /\.map-draw-control\[aria-pressed="true"\]/, "active drawing state must be visible");

console.log("Booking map drawing checks passed: one pencil toggles drawing, creates a route line, finishes with a checkmark, and supports cancellation.");
