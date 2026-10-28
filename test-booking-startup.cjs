const fs = require("node:fs");
const assert = require("node:assert/strict");

const html = fs.readFileSync("booking.html", "utf8");
const agent = fs.readFileSync("assets/booking-agent.js", "utf8");
const map = fs.readFileSync("assets/booking-map.js", "utf8");

assert.match(html, /assets\/booking-agent\.js\?v=314/, "the repaired Booking Agent must bypass prior browser caches");
assert.match(agent, /const routeFieldset = \$\("tourForm"\)\.querySelector\("fieldset"\)/, "route controls must use the planner fieldset after Act and Home move above the form");
assert.doesNotMatch(agent, /\$\("startCity"\)\.closest\("fieldset"\)/, "startup must not look for a fieldset around the external Home field");
assert.match(agent, /routeAction\.id = "routeSearchAction"/, "the map must have a stable route-search target");
assert.match(map, /document\.getElementById\("routeSearchAction"\)/, "Search this area must invoke the stable route action");

console.log("Booking startup checks passed: moved Act/Home fields no longer crash route controls and map search has a stable action target.");
