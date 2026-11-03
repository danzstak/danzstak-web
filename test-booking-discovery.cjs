const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const functionSource = source.slice(source.indexOf("async function tourCandidates("), source.indexOf("async function planTourRoute("));
const bookingMarkup = fs.readFileSync("booking.html", "utf8");
const quickSearchClient = fs.readFileSync("assets/booking-discovery.js", "utf8");

async function run(fail, genre = "DIY Punk") {
  const queries = [];
  let active = 0, peakActive = 0;
  const context = vm.createContext({
    mapLimit: async (items, limit, worker) => {
      const results = new Array(items.length);
      let next = 0;
      await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
          const index = next++;
          results[index] = await worker(items[index], index);
        }
      }));
      return results;
    },
    SearchTextCommand: class { constructor(input) { this.input = input; } },
    geoPlaces: { async send({ input }) {
      queries.push(input.QueryText);
      active += 1; peakActive = Math.max(peakActive, active);
      try {
        await Promise.resolve();
        if (fail(input.QueryText)) throw new Error("lookup unavailable");
        return { ResultItems: Array.from({ length: 50 }, (_, index) => ({
          venueKey: `${input.QueryText}-${index}`, name: `Room ${index}`, distanceMiles: 1
        })) };
      } finally { active -= 1; }
    } },
    publicPlace: place => place,
    venueDiscoveryQueries: (_point, selectedGenre) => [selectedGenre ? `${selectedGenre.replace(/DIY/gi, "").trim()} live music venue` : "live music venue"],
    recordStoreCandidates: async () => ({ stores: [], providers: [] }),
    multiSourceDiscovery: async () => ({ places: [], providers: [] }),
    approvedMemberVenueLeads: async () => [],
    curatedVenueLeads: () => [],
    isBookableClub: () => true,
    isSupportedBookingLead: () => true,
    isVenueTypeMatch: () => true,
    venueDiscoveryAssessment: () => ({ suitability: "needs-research", reasons: [], genreMatch: true, typeMatch: true }),
    approximateMilesBetween: () => 1,
    venueSuitability: () => 1,
    deduplicateVenues: places => [...new Map(places.map(place => [place.venueKey, place])).values()]
  });
  vm.runInContext(functionSource, context);
  const result = await context.tourCandidates({ label: "Test city", position: [0, 0] }, genre);
  return { result, queries, peakActive };
}

(async () => {
  assert.match(source, /Filter: \{ BoundingBox: boundingBox \}/, "provider searches must be geographically bounded instead of leaking global names into a city search");
  assert.match(source, /path === "\/venues\/search"/, "natural-language venue discovery needs an authenticated API route");
  assert.match(bookingMarkup, /id="venueQuickQuery"/, "the booking page should expose a simple natural-language club finder");
  assert.match(quickSearchClient, /danzstak:venue-search-results/, "quick-search venues should be passed to the booking map");
  assert.match(source, /canExpand: radiusMiles < 150/, "venue discovery should expose an explicit wider-area continuation");
  assert.match(quickSearchClient, /seen\.has\(identity\)/, "wider venue searches should not repeat clubs already displayed");
  assert.match(quickSearchClient, /hasMore \? search\(page \+ 1, radiusMiles, true\) : canExpand/, "pagination and radius expansion must be separate actions");
  assert.match(quickSearchClient, /providerStatusText[\s\S]*if \(!response\.ok\)[\s\S]*providerStatus/, "venue errors should name unavailable providers to the artist");
  const routeListeners = {}, routeElements = new Map();
  const routeElement = (id, extra = {}) => {
    const element = { id, value: "", hidden: false, textContent: "", addEventListener(type, handler) { routeListeners[`${id}:${type}`] = handler; }, replaceChildren() {}, scrollIntoView() {}, ...extra };
    routeElements.set(id, element);
    return element;
  };
  routeElement("venueQuickForm");
  routeElement("venueQuickQuery").value = "Find punk clubs to play between Momo and Berlin for 10 days";
  routeElement("venueQuickStatus"); routeElement("venueQuickResults"); routeElement("venueQuickMore"); routeElement("bookingBrief");
  routeElement("bookingBriefForm", { submitted: 0, requestSubmit() { this.submitted += 1; } });
  vm.runInContext(quickSearchClient, vm.createContext({ window: { dispatchEvent() {} }, document: { getElementById: id => routeElements.get(id) || null, createElement: () => ({ append() {}, set textContent(value) {}, set href(value) {}, set target(value) {}, set rel(value) {} }) }, CustomEvent: class {} }));
  routeListeners["venueQuickForm:submit"]({ preventDefault() {} });
  assert.equal(routeElements.get("bookingBriefForm").submitted, 1, "multi-city language must enter the route planner instead of one-city geocoding");
  assert.equal(routeElements.get("bookingBrief").value, routeElements.get("venueQuickQuery").value);
  const { result, queries, peakActive } = await run(query => query === "budget hotel motel hostel" || query === "Punk live music venue");
  assert.ok(peakActive <= 3, `town discovery exceeded its three-request limit (${peakActive})`);
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
