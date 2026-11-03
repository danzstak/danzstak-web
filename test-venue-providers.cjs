const fs = require("node:fs"), vm = require("node:vm"), assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const requests = [];
const context = vm.createContext({
  createHash, URLSearchParams, AbortController, AbortSignal, setTimeout, clearTimeout,
  globalThis: { process: { env: { GOOGLE_PLACES_API_KEY: "fixture", BRAVE_SEARCH_API_KEY: "fixture" } } },
  approximateMilesBetween: () => 1,
  mapLimit: async (items, _limit, fn) => { const out = []; for (const item of items) out.push(await fn(item)); return out; },
  fetch: async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).includes("googleapis")) {
      const body = JSON.parse(options.body);
      return { ok: true, json: async () => ({ places: [{ id: body.pageToken || "one", displayName: { text: "Fixture" }, location: { latitude: 1, longitude: 1 } }], ...(!body.pageToken ? { nextPageToken: "two" } : {}) }) };
    }
    return { ok: true, json: async () => ({ web: { results: [{ title: "Room | Calendar", url: "https://room.example", description: "<b>Live muziek</b>" }] } }) };
  }
});
vm.runInContext(source.slice(source.indexOf("const regionalVenueTerms"), source.indexOf("async function multiSourceDiscovery")), context);
(async () => {
  context.SearchTextCommand = class { constructor(input) { this.input = input; } };
  context.publicPlace = place => place;
  const awsRequests = [];
  context.geoPlaces = { send: async command => {
    awsRequests.push(command.input);
    if (command.input.QueryText === "failure") throw new Error("AWS throttled");
    return { ResultItems: [{ name: "Fixture", position: [1, 1] }], ...(!command.input.NextToken ? { NextToken: "page-two" } : {}) };
  } };
  vm.runInContext(source.slice(source.indexOf("async function awsPlaceSearch"), source.indexOf("const regionalVenueTerms")), context);
  const point = { label: "Eindhoven, Netherlands", position: [5.48, 51.44], countryCode: "NL", languageCode: "nl" };
  const aws = await context.awsPlaceSearch(point, ["music", "failure"], 25);
  assert.equal(aws.length, 2, "successful AWS pages survive another query's failure");
  assert.equal(aws.partial, true);
  assert.equal(awsRequests[1].NextToken, "page-two");
  assert.deepEqual(Array.from(awsRequests[0].Filter.Circle.Center), point.position);
  await assert.rejects(context.awsPlaceSearch(point, ["failure"], 25), /throttled/);
  const queries = context.venueDiscoveryQueries(point, "Hardcore Punk");
  assert.equal(queries[0], "poppodium");
  const google = await context.googlePlacesSearch(point, queries, 25);
  assert.equal(google.places.length, 10, "five bounded queries consume two pages each");
  assert.equal(JSON.parse(requests[1].options.body).pageToken, "two");
  const web = await context.webVenueResearch(point, "Hardcore Punk");
  assert.equal(web.leads.length, 1, "duplicate source pages merge");
  assert.equal(web.leads[0].needsResearch, true);
  const webRequest = new URL(requests.find(item => item.url.includes("brave.com")).url);
  assert.match(webRequest.searchParams.get("q"), /poppodium/);
  assert.equal(webRequest.searchParams.get("country"), "ALL");
  context.fetch = async () => ({ ok: false, status: 429 });
  await assert.rejects(context.googlePlacesSearch(point, ["live music"], 25), /429/);
  await assert.rejects(context.webVenueResearch(point), /429/);
  await assert.rejects(context.googlePlacesSearch(point, ["live music"], 25), /cooling down/);
  console.log("Provider request, local-language priority, pagination, deduplication and rate-limit tests passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
