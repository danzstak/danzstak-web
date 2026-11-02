"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const discoverySource = source.slice(
  source.indexOf("const osmAttribution"),
  source.indexOf("function discoveryBoundingBox"),
);

async function loadWith(fetch) {
  const context = vm.createContext({
    fetch,
    process: { env: {} },
    URL,
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    console: { warn() {} },
    approximateMilesBetween: () => 1.25,
  });
  vm.runInContext(discoverySource, context);
  return context.overpassPlaces({ position: [-122.33, 47.61] }, "venue", 30);
}

(async () => {
  assert.match(source, /overpass\.private\.coffee/, "OpenStreetMap discovery needs a current global mirror when the primary service is busy");
  assert.match(source, /maps\.mail\.ru\/osm\/tools\/overpass/, "OpenStreetMap discovery needs more than one current global fallback");
  assert.match(source, /OSM_OVERPASS_ENDPOINTS/, "operators need a server-side list override without changing code");
  const requests = [];
  const places = await loadWith(async endpoint => {
    requests.push(endpoint);
    if (requests.length === 1) return { ok: false, status: 429 };
    return {
      ok: true,
      async json() {
        return { elements: [{ type: "node", id: 42, lat: 47.61, lon: -122.33, tags: { name: "Real Music Room", amenity: "music_venue", website: "https://example.test" } }] };
      },
    };
  });
  assert.equal(requests.length, 3, "discovery should race the bounded global mirror set");
  assert.ok(requests.some(endpoint => endpoint.includes("overpass.private.coffee")), "the current global fallback should be queried");
  assert.equal(places.length, 1);
  assert.equal(places[0].name, "Real Music Room");
  assert.equal(places[0].distanceMiles, 1.3);
  assert.equal(places[0].sources[0].name, "© OpenStreetMap contributors");

  await assert.rejects(
    loadWith(async () => { throw new Error("offline"); }),
    error => error.provider === "OpenStreetMap",
    "all-mirror failure must remain visible to the multi-provider response",
  );
  console.log("OpenStreetMap mirror failover checks passed.");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
