const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("booking.html", "utf8");
const agent = fs.readFileSync("assets/booking-agent.js", "utf8");
const map = fs.readFileSync("assets/booking-map.js", "utf8");
const mapCss = fs.readFileSync("assets/booking-agent-driver.css", "utf8");

assert.match(html, /assets\/booking-agent\.js\?v=\d+/, "the Booking Agent must load a versioned script URL");
assert.match(agent, /upcomingTitle\.textContent = "Upcoming gigs"/, "future plans must stay on Booking Agent under Upcoming gigs");
assert.match(agent, /pastTitle\.textContent = "Past gigs"/, "completed plans must stay on Booking Agent under Past gigs");
assert.match(agent, /tourDate\(tour\) < startOfToday\.getTime\(\)/, "gig plans must be grouped by their tour dates");
assert.match(agent, /const routeFieldset = \$\("tourForm"\)\.querySelector\("fieldset"\)/, "route controls must use the planner fieldset after Act and Home move above the form");
assert.doesNotMatch(agent, /\$\("startCity"\)\.closest\("fieldset"\)/, "startup must not look for a fieldset around the external Home field");
assert.match(agent, /routeAction\.id = "routeSearchAction"/, "the map must have a stable route-search target");
assert.match(map, /document\.getElementById\("routeSearchAction"\)/, "Search this area must invoke the stable route action");
assert.match(map, /map\.on\("click", event => \{ if \(drawingRoute\) addRoutePoint\(event\.latlng\); \}\)/, "route drawing must use Leaflet's mobile-safe map click event");
assert.match(map, /L\.circleMarker\(latlng/, "the first route tap should leave a visible starting point");
assert.match(map, /L\.polyline\(routePoints, \{ color: "#1769e0", weight: 6/, "two or more route points should draw a clearly visible line");
assert.match(map, /L\.DomUtil\.create\("button", "map-draw-control"/, "the map must expose its own visible pencil control");
assert.match(map, /map\.invalidateSize\(\{ animate: false, pan: false \}\)/, "responsive map resizing must not leave a stale tile grid");
assert.match(map, /baseTiles\.redraw\(\)/, "map tiles must redraw after responsive resizing");
assert.match(map, /new IntersectionObserver/, "the map must repair its tile grid when it becomes visible");
assert.doesNotMatch(html, /href="https:\/\/unpkg\.com\/leaflet[^"]+\.css"/, "map positioning must not depend on a third-party stylesheet");
assert.match(mapCss, /\.leaflet-pane,[^}]+position:absolute;left:0;top:0/, "local map CSS must position every tile pane");
assert.match(mapCss, /\.leaflet-top,\.leaflet-bottom\{position:absolute;z-index:1000;pointer-events:none\}/, "local map CSS must anchor map controls over the tiles");

console.log("Booking startup checks passed: moved Act/Home fields no longer crash route controls and map search has a stable action target.");
