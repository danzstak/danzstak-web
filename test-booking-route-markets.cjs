"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const bookingUi = fs.readFileSync("assets/booking-agent.js", "utf8");
assert.match(source, /candidates = await mapLimit\(selected, 4, async point =>/, "multi-market discovery should use bounded concurrency");
assert.match(source, /mapLimit\(\[\.\.\.new Set\(corridorSearchMarkets\)\], 4/, "corridor geocoding should use bounded concurrency");
assert.match(source, /Tour corridor geocode unavailable/, "one failed corridor geocode should not cancel the tour");
assert.match(source, /mapLimit\(discoveryQueries, 3, async query =>/, "each town should bound its place-search concurrency");
assert.doesNotMatch(source, /Promise\.allSettled\(\[\s*search\("budget hotel motel hostel"\)/, "a town must not launch every place query simultaneously");
assert.match(source, /discoveryUnavailable: true/, "one failed market should remain visible without cancelling the route");
assert.doesNotMatch(source, /candidates = await Promise\.all\(selected\.map\(point => tourCandidates/, "tour markets must not launch every venue query simultaneously");
assert.match(bookingUi, /No solid club leads yet/, "the UI should show one honest retry state when no real clubs are found");
assert.doesNotMatch(bookingUi, /Best club leads \(0 of 0\)/, "empty club accordions must not masquerade as useful results");
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
  "Centralia, Washington", "Kelso, Washington", "Longview, Washington", "Vancouver, Washington",
  "Portland, Oregon", "Salem, Oregon", "Albany, Oregon", "Corvallis, Oregon", "Eugene, Oregon",
  "Cottage Grove, Oregon", "Roseburg, Oregon", "Grants Pass, Oregon", "Medford, Oregon", "Ashland, Oregon",
  "Yreka, California", "Weed, California", "Mount Shasta, California",
  "Dunsmuir, California", "Redding, California", "Anderson, California", "Red Bluff, California",
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
  "Kelso, Washington",
  "Portland, Oregon",
  "Corvallis, Oregon",
  "Eugene, Oregon",
  "Cottage Grove, Oregon",
  "Medford, Oregon",
  "Redding, California",
  "Anderson, California",
  "Sacramento, California",
]) {
  assert.ok(ordinaryTourMarkets.includes(market), `${market} should remain in a sampled I-5 club search`);
}
assert.equal(ordinaryTourMarkets[0], "Seattle, Washington");
assert.equal(ordinaryTourMarkets.at(-1), "San Francisco, California");
assert.match(bookingUi, /function targetTourMarkets\(data\)/, "the route overview should turn the discovery pool into a compact bookable run");
assert.match(bookingUi, /returnPool = markets\.slice\(0, -1\)\.reverse\(\)/, "the proposed run should use real markets on the drive back home");
assert.match(bookingUi, /repeatableReturnMarkets = returnPool\.filter\(market => \(market\.venues \|\| \[\]\)\.length > 1\)/, "a return leg should prefer markets with another real venue instead of repeating an exhausted one-lead city");
assert.match(bookingUi, /targetPoints = targetTourMarkets\(data\)/, "the route map should show the proposed outbound-and-return run instead of every discovery town");
assert.match(bookingUi, /stopLine\.textContent = points\.map/, "the route overview should name the intermediate towns in one compact line");
assert.match(bookingUi, /displayedMarkets = targetMarkets\.filter/, "result cards should be limited to the proposed target markets");
assert.match(bookingUi, /slice\(0, 8\)/, "the initial result page should stay compact on phones");
assert.match(bookingUi, /displayedMarkets\.forEach\(\(market, index\)/, "displayed route markets must receive dates spread across the selected tour window");
assert.match(bookingUi, /Array\.isArray\(market\.venues\) && market\.venues\.length > 0/, "only markets with real club leads should produce result cards");
assert.match(bookingUi, /function routeItineraryMarkets\(route, candidates = \[\]\)/, "the browser should guard against an older API returning only route endpoints");
assert.match(bookingUi, /"Medford, Oregon"[\s\S]*"Redding, California"/, "the browser fallback should retain Medford and Redding between Seattle and San Francisco");
assert.match(bookingUi, /return start\.includes\("seattle"\) \? i5Markets : \[\.\.\.i5Markets\]\.reverse\(\)/, "the browser fallback should follow either requested travel direction");
assert.match(bookingUi, /section = document\.createElement\("details"\),[\s\S]*heading = document\.createElement\("summary"\)/, "each route town should be a compact expandable result instead of a long open panel");
assert.doesNotMatch(bookingUi, /details\.open = true/, "the day-by-day calendar should not force a long result page open");
assert.doesNotMatch(source, /fallbackLabel: `Tour corridor stop/, "reverse-geocode failures must not become fake corridor stops");
assert.match(source, /dominantCount < Math\.ceil\(localities\.length \* 0\.6\)/, "a search centered across a city boundary must display the locality where most returned clubs actually are");
assert.match(source, /real estate\|realtor\|property management/, "non-music businesses must be excluded from club discovery");
assert.match(source, /place\.Address\?\.Locality \|\| place\.Address\?\.District/, "route market names must come from address localities, not nearby business titles");

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
