const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

(async () => {
  const { publicAddress, pageEvidence } = await import("./infrastructure/auth-api/venue-research.mjs");
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "::1", "100.64.0.1"]) assert.equal(publicAddress(address), false, address);
  assert.equal(publicAddress("93.184.216.34"), true);
  const evidence = pageEvidence('<script>fake punk</script><h1>Agenda</h1><p>Live music and hardcore punk concerts.</p><a href="mailto:booking@room.example">Contact</a>', "https://room.example");
  assert.deepEqual(evidence.emails, ["booking@room.example"]);
  assert.match(evidence.text, /hardcore punk/);
  assert.doesNotMatch(evidence.text, /fake punk/);

  const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  const context = vm.createContext({});
  vm.runInContext(source.slice(source.indexOf("function normalizedVenueText"), source.indexOf("let reviewedVenueCache")), context);
  assert.notEqual(context.normalizedVenueText("音楽室"), context.normalizedVenueText("演奏室"));
  const rooms = context.deduplicateVenues(["音楽室", "演奏室"].map((name, i) => ({ name, venueKey: String(i), locality: "東根市", address: "1", categories: [] })));
  assert.equal(rooms.length, 2, "different non-Latin rooms must not collapse");
  vm.runInContext(source.slice(source.indexOf("function approximateMilesBetween"), source.indexOf("async function approvedMemberVenueLeads")), context);
  assert.ok(context.approximateMilesBetween([179.9, 0], [-179.9, 0]) < 15, "date-line neighbors are nearby");
  assert.equal(context.approximateMilesBetween([], [0, 0]), Infinity);
  vm.runInContext(source.slice(source.indexOf("function isBookableClub"), source.indexOf("function isRecordStore")), context);
  for (const categories of [["poppodium"], ["discoteca"], ["ライブハウス"], ["공연장"], ["演出场地"], ["Museum", "Live Music Venue"], ["Community Center", "Live Music Venue"]]) {
    assert.equal(context.isBookableClub({ name: "Fixture", categories }, "Tekno DJ"), true, categories.join(" "));
  }
  console.log("Venue website evidence, public URL safety, multilingual identity and distance tests passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
