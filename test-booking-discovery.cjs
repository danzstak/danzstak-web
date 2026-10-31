const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const functionSource = source.slice(source.indexOf("async function tourCandidates("), source.indexOf("async function planTourRoute("));

async function run(fail, genre = "DIY Punk") {
  const queries = [];
  const context = vm.createContext({
    SearchTextCommand: class { constructor(input) { this.input = input; } },
    geoPlaces: { async send({ input }) {
      queries.push(input.QueryText);
      if (fail(input.QueryText)) throw new Error("lookup unavailable");
      return { ResultItems: Array.from({ length: 50 }, (_, index) => ({
        venueKey: `${input.QueryText}-${index}`, name: `Room ${index}`, distanceMiles: 1
      })) };
    } },
    publicPlace: place => place,
    approvedMemberVenueLeads: async () => [],
    curatedVenueLeads: () => [],
    isBookableClub: () => true,
    isVenueTypeMatch: () => true,
    venueSuitability: () => 1,
    deduplicateVenues: places => [...new Map(places.map(place => [place.venueKey, place])).values()]
  });
  vm.runInContext(functionSource, context);
  const result = await context.tourCandidates({ label: "Test city", position: [0, 0] }, genre);
  return { result, queries };
}

(async () => {
  const { result, queries } = await run(query => query === "budget hotel motel hostel" || query === "Punk live music venue");
  assert.equal(result.venues.length, 60, "dense discovery must retain more than 24 clubs");
  assert.equal(result.hotels.length, 0, "hotel failure must not break venue discovery");
  assert.equal(result.vanStops.length, 2, "van-rest discovery should return two nearby leads");
  assert.ok(queries.includes("truck stop rest area campground"));
  for (const query of [
    "Punk music club",
    "Punk bar live music",
    "Punk concert club",
    "independent live music venue",
    "live music bar",
    "rock punk metal music venue"
  ]) assert.ok(queries.includes(query), `missing discovery query: ${query}`);
  const classical = await run(() => false, "Orchestra / Classical");
  assert.ok(classical.queries.includes("classical concert hall orchestra venue"), "classical acts need a genre-appropriate discovery query");
  assert.ok(classical.result.venues.length > 0);
  await assert.rejects(run(() => true), /lookup unavailable/, "total provider failure must remain visible");
  console.log("Booking discovery checks passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
