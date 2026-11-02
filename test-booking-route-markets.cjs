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
assert.match(source, /venueSearches\.every\(result => result\.status === "rejected"\) && !curatedPool\.length/, "temporary Places throttling must retain a reviewed public club lead for that market");
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
assert.equal(ordinaryTourMarkets.length, 10, "an ordinary tour should bound live place lookups while retaining a useful set of markets");
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
const alternateTourMarkets = Array.from(corridorContext.sampleTourCorridorMarkets(direct, 10, 8, 1));
assert.notDeepEqual(alternateTourMarkets, ordinaryTourMarkets, "searching again should rotate smaller road towns instead of repeating the identical market batch");
assert.equal(ordinaryTourMarkets[0], "Seattle, Washington");
assert.equal(ordinaryTourMarkets.at(-1), "San Francisco, California");
assert.match(source, /reviewedCorridorPoint\(market\) \|\| await geocodeTourPlace\(market\)/, "reviewed I-5 anchors must survive temporary AWS geocoder throttling");
for (const market of ["eugene, oregon", "redding, california"]) {
  assert.match(source, new RegExp(`\\["${market.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&")}"`), `${market} needs a reviewed corridor coordinate`);
}
assert.match(bookingUi, /function targetTourMarkets\(data\)/, "the route overview should turn the discovery pool into a compact bookable run");
assert.match(bookingUi, /function strongestRouteMarkets\(markets, count\)/, "the proposed run should prefer established music markets inside each road segment");
assert.match(bookingUi, /\["seattle", "tacoma", "portland", "medford", "san francisco"\]/, "a five-show I-5 outbound leg should use the safe Seattle-Tacoma-Portland-Medford-San Francisco backbone");
assert.match(bookingUi, /\["portland", 100\][\s\S]*\["eugene", 96\][\s\S]*\["medford", 92\][\s\S]*\["redding", 90\]/, "I-5 planning should favor strong Portland, Eugene, Medford, and Redding scenes");
assert.match(bookingUi, /outward = strongestRouteMarkets\(markets, outwardCount\)/, "outbound show targets should use music-market strength rather than blind even spacing");
assert.match(bookingUi, /returnPool = markets\.slice\(1, -1\)\.reverse\(\)/, "the proposed run should use real intermediate markets on the drive back without treating home as another booking target");
assert.match(bookingUi, /evenlySampleMarkets\(returnChoices, Math\.min\(returnChoices\.length, returnCount \+ 1\)\)\.slice\(0, returnCount\)/, "the return leg should leave one final segment for reaching home safely");
assert.match(bookingUi, /returnPool\.length >= returnCount \+ 2[\s\S]*returnPool\.slice\(1, -1\)/, "return shows should leave travel buffers outside the turnaround and home markets");
assert.match(bookingUi, /Math\.ceil\(\(shows \+ 1\) \* 0\.55\)/, "an eight-show round trip should retain three useful return-leg targets");
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
assert.match(bookingUi, /recommendedRoom = marketVenues\[0\]\?\.name/, "a collapsed tour stop should name its recommended room instead of showing only a city and count");
assert.match(bookingUi, /section\.open = false/, "tour stops should start collapsed on phones");
assert.match(bookingUi, /needsHomeDay = !data\.route\.local && days > 1/, "a round-trip calendar must reserve its final day for reaching home");
assert.match(bookingUi, /finalHomeDay = needsHomeDay && day === days - 1/, "the final round-trip day must not be consumed by another venue target");
assert.match(bookingUi, /returningHome = finalHomeDay \|\| showIndex >= shows/, "a rest day must not claim the band is returning home while later shows remain");
assert.match(bookingUi, /drive toward the next show, load-in buffer, laundry or sleep/, "mid-tour rest days should point toward the next show");
assert.doesNotMatch(bookingUi, /details\.open = true/, "the day-by-day calendar should not force a long result page open");
assert.doesNotMatch(source, /fallbackLabel: `Tour corridor stop/, "reverse-geocode failures must not become fake corridor stops");
assert.match(source, /const verifiedTacomaRooms = \[/, "the I-5 directory must include reviewed Tacoma rooms");
for (const room of ["Real Art Tacoma", "Airport Tavern", "Jazzbones", "Spanish Ballroom"]) {
  assert.match(source, new RegExp(room), `Tacoma booking leads must include ${room}`);
}
assert.match(source, /const belongsToMarket = place =>/, "place-search results must be checked against the requested market");
assert.match(source, /return distance <= 8;/, "a stop must not silently substitute a venue from a distant city");
assert.match(source, /place\.verifiedRoom === true \|\| isBookableClub\(place, genre\)/, "human-reviewed rooms must not be discarded by generic place-name filters");
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
