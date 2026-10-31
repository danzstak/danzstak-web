"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const bookingUi = fs.readFileSync("assets/booking-agent.js", "utf8");
assert.match(source, /candidates = await mapLimit\(selected, 4, async point =>/, "multi-market discovery should use bounded concurrency");
assert.match(source, /discoveryUnavailable: true/, "one failed market should remain visible without cancelling the route");
assert.doesNotMatch(source, /candidates = await Promise\.all\(selected\.map\(point => tourCandidates/, "tour markets must not launch every venue query simultaneously");
assert.match(bookingUi, /market\.discoveryUnavailable[\s\S]*Club lookup needs another try/, "a failed town lookup should explain its retryable state");
assert.match(bookingUi, /This town stayed on the route/, "the UI should make clear that a failed lookup did not remove the market");
const corridorSource = source.slice(
  source.indexOf("function westCoastTourCorridor("),
  source.indexOf("async function addManualBookingVenue("),
);
const corridorContext = vm.createContext({});
vm.runInContext(corridorSource, corridorContext);

const seattle = { label: "Seattle, Washington, United States", position: [-122.33, 47.61] };
const sanFrancisco = { label: "San Francisco, California, United States", position: [-122.42, 37.77] };
const direct = Array.from(corridorContext.westCoastTourCorridor([seattle, sanFrancisco, seattle]));
assert.deepEqual(direct, [
  "Seattle, Washington", "Tacoma, Washington", "Olympia, Washington",
  "Centralia, Washington", "Longview, Washington", "Vancouver, Washington",
  "Portland, Oregon", "Salem, Oregon", "Albany, Oregon", "Eugene, Oregon",
  "Roseburg, Oregon", "Grants Pass, Oregon", "Medford, Oregon", "Ashland, Oregon",
  "Yreka, California", "Weed, California", "Mount Shasta, California",
  "Dunsmuir, California", "Redding, California", "Red Bluff, California",
  "Chico, California", "Sacramento, California", "San Francisco, California",
]);
assert.deepEqual(
  Array.from(corridorContext.westCoastTourCorridor([sanFrancisco, seattle, sanFrancisco])),
  [...direct].reverse(),
  "the corridor should follow the requested travel direction",
);
const ordinaryTourMarkets = Array.from(corridorContext.sampleTourCorridorMarkets(direct, 10, 8));
assert.equal(ordinaryTourMarkets.length, direct.length, "ordinary corridor tours should expose every known booking market");
assert.deepEqual(ordinaryTourMarkets, direct, "the venue search should preserve every I-5 market in road order");
for (const market of [
  "Tacoma, Washington",
  "Portland, Oregon",
  "Eugene, Oregon",
  "Medford, Oregon",
  "Redding, California",
  "Sacramento, California",
]) {
  assert.ok(ordinaryTourMarkets.includes(market), `${market} should remain in a sampled I-5 club search`);
}
assert.equal(ordinaryTourMarkets[0], "Seattle, Washington");
assert.equal(ordinaryTourMarkets.at(-1), "San Francisco, California");
assert.match(bookingUi, /discoveredPoints = \(data\.candidates \|\| \[\]\)/, "the route overview should use every discovered corridor market");
assert.match(bookingUi, /stopLine\.textContent = points\.map/, "the route overview should name the intermediate towns in one compact line");

const discoverySource = source.slice(
  source.indexOf("async function discoverRouteMarkets("),
  source.indexOf("function westCoastTourCorridor("),
);
const sampledPositions = [];
const discoveryContext = vm.createContext({
  approximateMilesBetween: (left, right) => Math.hypot(left[0] - right[0], left[1] - right[1]),
  reverseGeocodeTourMarket: async position => {
    sampledPositions.push(position);
    return { label: `Market ${position[0]}`, position };
  },
  Promise,
});
vm.runInContext(discoverySource, discoveryContext);

(async () => {
  const geometry = Array.from({ length: 31 }, (_, index) => [index, index % 3]);
  const markets = await discoveryContext.discoverRouteMarkets(
    { Routes: [{ Legs: [{ Geometry: { LineString: geometry } }] }] },
    [
      { label: "Start", position: geometry[0] },
      { label: "Finish", position: geometry.at(-1) },
    ],
    30,
    20,
  );
  assert.equal(sampledPositions.length, 10, "long tours should inspect ten corridor markets");
  assert.ok(sampledPositions.every(position => geometry.some(point => point[0] === position[0] && point[1] === position[1])), "market samples must come from the calculated road geometry");
  assert.ok(markets.length >= 6, "round-trip sampling should retain a useful set of distinct intermediate markets");
  console.log("Booking route-market checks passed: I-5 cities and road-geometry sampling cover intermediate tour markets.");
})().catch(error => { console.error(error); process.exitCode = 1; });
