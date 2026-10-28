"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("booking.html", "utf8");
const script = fs.readFileSync("assets/booking-map.js", "utf8");
const css = fs.readFileSync("assets/booking-agent-driver.css", "utf8");
const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");

assert.doesNotMatch(html, /id="drawVenueRoute"/, "the redundant page-level Draw route button should be removed");
assert.match(html, /use\s+the pencil on the map/i, "map instructions should point users to the pencil control");
assert.match(script, /L\.DomEvent\.on\(mapDrawControl, "click", event => \{\s*L\.DomEvent\.stop\(event\);\s*toggleRouteDrawing\(\);/, "the pencil must start drawing without placing an accidental map point");
assert.match(script, /mapDrawControl\.innerHTML = active \? '<span aria-hidden="true">✓<\/span>'/, "the pencil should become a clear finish control");
assert.match(script, /L\.polyline\(routePoints, \{ color: "#1769e0", weight: 6/, "two points must create a visible route line");
assert.match(script, /finalizedRoutePoints = routePoints\.map\(point => \[point\.lng, point\.lat\]\)/, "the finished line must retain its geographic path");
assert.match(script, /body\.searchPath = finalizedRoutePoints/, "the venue request must send the finished path");
assert.match(api, /function distanceToSearchPathMiles\(position, path\)/, "the API must measure venue distance from the drawn route");
assert.match(api, /distanceToSearchPathMiles\(place\.position, searchPath\) <= 25/, "drawn-route results must stay inside a practical corridor");
assert.match(api, /searchPath\.some\(point => point\.length !== 2/, "malformed route coordinates must be rejected");
assert.match(script, /if \(routePoints\.length < 2\)/, "a route cannot finish without a line");
assert.match(script, /event\.key !== "Escape" \|\| !drawingRoute/, "keyboard users can cancel drawing");
assert.match(css, /\.map-draw-control\[aria-pressed="true"\]/, "active drawing state must be visible");

console.log("Booking map drawing checks passed: one pencil toggles drawing, creates a route line, finishes with a checkmark, and supports cancellation.");
