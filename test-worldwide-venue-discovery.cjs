const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const queryStart = source.indexOf("const regionalVenueTerms");
const queryEnd = source.indexOf("async function multiSourceDiscovery", queryStart);
assert.ok(queryStart >= 0 && queryEnd > queryStart, "worldwide discovery helpers must exist");

const context = vm.createContext({
  createHash: () => ({ update() { return this; }, digest() { return "0123456789abcdef0123456789abcdef"; } }),
  approximateMilesBetween: () => 4.2,
  mapLimit: async () => [],
  fetch: async () => { throw new Error("network must not be used by fixture tests"); },
  setTimeout, clearTimeout, AbortController,
  globalThis: { process: { env: {} } }
});
vm.runInContext(source.slice(queryStart, queryEnd), context);

const italian = Array.from(context.venueDiscoveryQueries({ countryCode: "IT" }, "Tekno DJ"));
assert.ok(italian.includes("locale musica dal vivo"), "Italian searches need local-language venue terms");
assert.ok(italian.includes("tekno soundsystem venue"), "Tekno must remain distinct from generic techno");
const dutch = Array.from(context.venueDiscoveryQueries({ countryCode: "NL" }, "Hardcore Punk"));
assert.ok(dutch.includes("poppodium"), "Dutch searches need the regional poppodium term");
assert.ok(dutch.includes("hardcore punk venue"), "hardcore punk must not collapse into electronic hardcore");
const japanese = Array.from(context.venueDiscoveryQueries({ countryCode: "JP" }, "Rock"));
assert.ok(japanese.includes("ライブハウス"), "non-Latin local-language queries must be preserved");

const mapped = context.googlePlace({
  id: "fixture-id", displayName: { text: "Fixture Live Room" }, formattedAddress: "1 Teststraat, Eindhoven, Nederland",
  addressComponents: [{ longText: "Eindhoven", types: ["locality"] }], location: { longitude: 5.48, latitude: 51.44 },
  primaryType: "night_club", primaryTypeDisplayName: { text: "Night club" }, types: ["night_club", "bar"],
  websiteUri: "https://venue.example", googleMapsUri: "https://maps.google.example/fixture", internationalPhoneNumber: "+31 40 000 0000", businessStatus: "OPERATIONAL"
}, { position: [5.47, 51.44] }, "poppodium");
assert.equal(mapped.locality, "Eindhoven");
assert.deepEqual(Array.from(mapped.websites), ["https://venue.example"]);
assert.equal(mapped.sourceName, "Google Places");
assert.equal(mapped.distanceMiles, 4.2);

assert.doesNotMatch(source, /return distance <= 8;/, "venue discovery must not use the old eight-mile municipal cutoff");
assert.match(source, /MaxResults: 5/, "geocoding should retain ambiguity candidates instead of selecting one result blindly");
assert.match(source, /alternatives/, "ambiguous locality results must be exposed to callers");
assert.match(source, /requireDisambiguation[\s\S]*statusCode: 409/, "ambiguous one-word locality searches must request a region or country");
assert.match(source, /bookingSuitability: assessment\.suitability/, "discovery results must disclose suitability separately from venue existence");
assert.match(source, /coverageNotice/, "empty and partial results must explain coverage honestly");
assert.match(source, /GOOGLE_PLACES_API_KEY/, "the licensed optional discovery provider must keep its credential server-side");
assert.match(source, /discovered\.length < 10 && radiusMiles < 75/, "weak markets must expand before being presented as adequately covered");
assert.match(source, /Math\.min\(75, Math\.max\(40, radiusMiles \* 2\)\)/, "automatic nearby-market expansion must remain bounded");

for (const forbidden of ["Ryan's", "Celebrità", "Phenomenon", "Gilda", "Altstadt", "Dynamo", "Effenaar", "LAB-1", "POPEI", "De Club"]) {
  assert.equal(source.includes(`name: "${forbidden}"`) || source.includes(`name: '${forbidden}'`), false, `${forbidden} must not be hard-coded as a benchmark shortcut`);
}

console.log("Worldwide venue discovery checks passed.");
