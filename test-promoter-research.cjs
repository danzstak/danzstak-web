"use strict";
// Owner 2026-11-16: find promoters and party crews worldwide, the way a plain web search does,
// in English and in the city's language, with different terms for every city and genre.
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const p = await import("./infrastructure/auth-api/promoter-research.mjs");
  const bologna = p.promoterQueries({ label: "Bologna, Emilia-Romagna, Italy", countryCode: "IT", position: [11.34, 44.49] }, "DIY punk");
  assert.deepEqual(bologna.map(q => q.query), ["punk promoters Bologna Italy", "punk party organizers Bologna", "promoter punk Bologna", "organizzatori eventi punk Bologna"]);
  assert.equal(bologna[2].language, "it");
  const mannheim = p.promoterQueries({ label: "Mannheim, Germany", countryCode: "DE", position: [8.47, 49.49] }, "techno");
  assert.ok(mannheim.some(q => q.query === "Techno Veranstalter Mannheim")); assert.ok(mannheim.some(q => q.query === "Techno Party Kollektiv Mannheim"));
  assert.ok(p.promoterQueries({ label: "Lyon, France", countryCode: "FR" }, "metal").some(q => q.query === "organisateur soirée metal Lyon"));
  assert.ok(p.promoterQueries({ label: "Madrid, Spain", countryCode: "ES" }, "house").some(q => q.query === "promotores house Madrid"));
  const portland = p.promoterQueries({ label: "Portland, OR, United States" }, "punk").map(q => q.query);
  assert.deepEqual(portland, ["punk promoters Portland United States", "punk party organizers Portland", "punk show bookers Portland", "DIY punk collective Portland"]);
  const point = { label: "Bologna, Italy", position: [11.34, 44.49] };
  const leads = p.promoterLeads([
    { query: "q", result: { url: "https://www.crewbologna.it/booking", title: "Crew Bologna | Techno nights", description: "Booking: info@crewbologna.it +39 051 123 4567" } },
    { query: "q", result: { url: "https://www.crewbologna.it/eventi", title: "Crew Bologna events", description: "" } },
    { query: "q", result: { url: "https://it.wikipedia.org/wiki/Bologna", title: "Bologna", description: "" } },
    { query: "q", result: { url: "https://www.example.com/top-10-promoters", title: "Top 10 best promoters in Bologna", description: "" } },
    { query: "q", result: { url: "http://insecure.example/promoter", title: "Insecure", description: "" } }
  ], point);
  assert.equal(leads.length, 1, "one lead per site; lists, encyclopedias and http pages are dropped");
  assert.equal(leads[0].kind, "promoter"); assert.equal(leads[0].name, "Crew Bologna");
  assert.deepEqual(leads[0].emails, ["info@crewbologna.it"]); assert.equal(leads[0].phones[0], "+39 051 123 4567");
  assert.equal(leads[0].approximatePosition, true); assert.match(leads[0].venueKey, /^promoter-[a-f0-9]{20}$/);
  const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), agent = fs.readFileSync("assets/booking-agent.js", "utf8");
  assert.match(api, /saveFoundClubs\(\[\.\.\.venues, \.\.\.promoters\]\)/);
  assert.match(api, /venues, promoters, hotels/);
  assert.match(api, /!place\.venueKey\.startsWith\("promoter-"\)/, "promoters never pose as venues on the map");
  assert.match(agent, /placeCard\(place, "promoter"\)/);
  assert.match(agent, /place\.approximatePosition \? "" : mapDestination\(place\)/);
  console.log("Promoter research checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
