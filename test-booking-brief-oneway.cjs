"use strict";
// Owner bug 2026-11-16: "Bellingham to San Diego" returned only home-city (SF) clubs because the brief parser
// didn't read one-way routes without "from" or "and back".
const assert = require("node:assert/strict");
const fs = require("node:fs");
const src = fs.readFileSync(require("node:path").join(__dirname, "assets/booking-conversation.js"), "utf8");
const body = src.match(/function parseDepartureDate[\s\S]*?\n  function applyTourBrief/)[0].replace(/\n  function applyTourBrief$/, "");
const tidyPlace = value => String(value || "").trim().replace(/[,.!?]+$/, "").replace(/\s+/g, " ");
const parse = new Function("tidyPlace", `${body}; return parseTourBrief;`)(tidyPlace);
const route = s => { const p = parse(s); return [p.home, p.destination, p.mode]; };
assert.deepEqual(route("bellingham to san diego"), ["bellingham", "san diego", "tour"]);
assert.deepEqual(route("Bellingham, WA to San Diego, CA"), ["Bellingham, WA", "San Diego, CA", "tour"]);
assert.deepEqual(route("Punk. Bellingham to San Diego. 14 days."), ["Bellingham", "San Diego", "tour"]);
assert.deepEqual(route("From Bellingham to San Diego"), ["Bellingham", "San Diego", "tour"]);
assert.deepEqual(route("Seattle to LA and back"), ["Seattle", "LA", "tour"]);
assert.equal(parse("I want to play shows near home").mode, "local");
assert.equal(parse("We need to book 5 shows").mode, undefined);
assert.match(src, /I couldn't read the route/);
console.log("Booking brief one-way route checks passed.");
// Owner's natural test brief (2026-11-16).
const owner = parse("i want to tour 20 days bellingham to san diego and back tacoma find me clubs and places to stay with record stores and radio stations there and back and calculate the cost");
assert.equal(owner.home, "bellingham"); assert.equal(owner.destination, "san diego"); assert.equal(owner.returnTo, "tacoma"); assert.equal(owner.days, 20); assert.equal(owner.mode, "tour");
const lead = parse("tour 10 days seattle to los angeles");
assert.equal(lead.home, "seattle"); assert.equal(lead.destination, "los angeles");
assert.deepEqual([parse("we wanna play 12 days from portland to austin").home, parse("we wanna play 12 days from portland to austin").destination], ["portland", "austin"]);
console.log("Natural-language brief checks passed.");
{
  const p = parse("salt lake to detroit 1 way");
  assert.equal(p.home, "salt lake"); assert.equal(p.destination, "detroit"); assert.equal(p.oneWay, true);
  const q = parse("Salt Lake City to Detroit one way, 10 days");
  assert.equal(q.destination, "Detroit"); assert.equal(q.oneWay, true);
  assert.equal(parse("Seattle to LA and back").oneWay, undefined);
  const server = fs.readFileSync(require("node:path").join(__dirname, "infrastructure/auth-api/index.mjs"), "utf8");
  assert.match(server, /const oneWay = data\.oneWay === true && !directional;/);
  assert.match(server, /oneWay \? \[start, \.\.\.stops, end\] : \[start, \.\.\.stops, end, start\]/);
  assert.match(server, /roundTrip: !oneWay/);
  const ui = fs.readFileSync(require("node:path").join(__dirname, "assets/booking-agent.js"), "utf8");
  assert.match(ui, /oneWay: Boolean\(\$\("oneWayTour"\)\?\.checked\) && mode === "tour"/);
  assert.match(ui, /!data\.route\.oneWay && days > 1/);
  assert.match(src, /parsed\.days \* 0\.7/);
  console.log("One-way tour checks passed.");
}
{
  const vm = require("node:vm");
  const server = fs.readFileSync(require("node:path").join(__dirname, "infrastructure/auth-api/index.mjs"), "utf8");
  const pick = (start, end) => { const i = server.indexOf(start); return server.slice(i, server.indexOf(end, i)); };
  const ctx = vm.createContext({});
  vm.runInContext(pick("function approximateMilesBetween", "\nasync function approvedMemberVenueLeads") + pick("// Music cities a touring band actually plays", "async function reverseGeocodeTourMarket"), ctx);
  // Points on I-80 between Salt Lake and Detroit snap to real music cities, not tiny towns.
  assert.match(ctx.nearestMusicCity([-95.9, 41.25]).label, /^Omaha, NE/);
  assert.match(ctx.nearestMusicCity([-93.7, 41.6]).label, /^Des Moines, IA/);
  assert.match(ctx.nearestMusicCity([-87.4, 41.6]).label, /^Chicago, IL/);
  assert.equal(ctx.nearestMusicCity([-103.5, 38.0]), null, "the middle of nowhere falls back to reverse geocoding");
  const ui = fs.readFileSync(require("node:path").join(__dirname, "assets/booking-agent.js"), "utf8");
  assert.match(ui, /if \(data\.route\.oneWay\) return strongestRouteMarkets/);
  assert.match(ui, /data\.route\.oneWay \? "One way · " : ""/, "one-way routes say so (15-D: in the detail line, so the title fits one line)");
  console.log("Music-city snapping and one-way calendar checks passed.");
}
{
  const server = fs.readFileSync(require("node:path").join(__dirname, "infrastructure/auth-api/index.mjs"), "utf8");
  assert.doesNotMatch(server, /return unique\.slice\(0, 8\);/, "route markets must not be cut to the 8 nearest the start");
  assert.match(server, /const picked = new Set\(\[0, unique\.length - 1\]\);/, "the far end of the route is always kept");
  assert.match(server, /nearestMusicCity\(position, 100\)/);
  console.log("Whole-route market spread checks passed.");
}
{
  // Owner 2026-11-16: "my band wants to play a gig in portland" must search Portland, not invent a route.
  const g = parse("my band wants to play a gig in portland");
  assert.equal(g.mode, "local"); assert.equal(g.home, "portland"); assert.equal(g.destination, undefined);
  assert.equal(parse("we want a show in Portland, OR next month").home, "Portland, OR");
  assert.notEqual(parse("I want to play shows near home").home, "home");
  console.log("Single-city gig checks passed.");
}
{
  // Owner 2026-11-16: Italian, French and Spanish visitors type the brief in their own language.
  const it = parse("Punk. Da Bologna a Napoli. 14 giorni.");
  assert.equal(it.home, "Bologna"); assert.equal(it.destination, "Napoli"); assert.equal(it.days, 14); assert.equal(it.mode, "tour");
  const itBack = parse("Punk. Da Milano a Roma e ritorno. 10 giorni. 8 concerti.");
  assert.equal(itBack.home, "Milano"); assert.equal(itBack.destination, "Roma"); assert.equal(itBack.shows, 8); assert.notEqual(itBack.oneWay, true);
  const itOne = parse("da torino a bari solo andata");
  assert.equal(itOne.destination, "bari"); assert.equal(itOne.oneWay, true);
  const fr = parse("Punk. De Lille à Marseille. 14 jours.");
  assert.equal(fr.home, "Lille"); assert.equal(fr.destination, "Marseille"); assert.equal(fr.days, 14);
  const frBack = parse("Punk. De Paris à Lyon et retour. 10 jours. 8 concerts.");
  assert.equal(frBack.home, "Paris"); assert.equal(frBack.destination, "Lyon"); assert.equal(frBack.shows, 8);
  const es = parse("Punk. De Barcelona a Sevilla. 14 días.");
  assert.equal(es.home, "Barcelona"); assert.equal(es.destination, "Sevilla"); assert.equal(es.days, 14);
  const esLead = parse("una gira de 10 días de Madrid a Valencia y vuelta");
  assert.equal(esLead.home, "Madrid"); assert.equal(esLead.destination, "Valencia"); assert.equal(esLead.days, 10);
  for (const [brief, city] of [["la mia band vuole suonare a Bologna", "Bologna"], ["on veut jouer à Lyon", "Lyon"], ["queremos tocar en Madrid", "Madrid"], ["un concerto a Torino il mese prossimo", "Torino"]]) {
    const p = parse(brief); assert.equal(p.mode, "local", brief); assert.equal(p.home, city, brief); assert.equal(p.singleCity, true, brief);
  }
  // English briefs are untouched.
  assert.equal(parse("my band wants to play a gig in portland").home, "portland");
  assert.equal(parse("salt lake to detroit 1 way").destination, "detroit");
  console.log("Italian, French and Spanish brief checks passed.");
}
{
  // Owner 2026-11-16 (Salt Lake → Detroit live run): no Home pin, no "back home" link and no "Detroit → Detroit" on a
  // one-way tour; no show at the end of a drive longer than a safe driving day.
  const agent = fs.readFileSync(require("node:path").join(__dirname, "assets/booking-agent.js"), "utf8");
  assert.match(agent, /index === coords\.length - 1 && !route\.oneWay \? "Home"/);
  assert.match(agent, /routeDestinations\.length > 2 && !route\.oneWay\)/);
  assert.match(agent, /drop a repeated end/);
  assert.match(agent, /maxLegMiles = Math\.max\(120, \(number\("maxDriveHours"\) \|\| 8\) \* 55\)/);
  assert.match(agent, /longDrive = nextLeg !== null && nextLeg > maxLegMiles && spareDays > 0/);
  console.log("One-way map and long-drive rest checks passed.");
}
{
  // Owner live run 2026-11-16: one gig in Portland is a one-day plan, not ten days of "return toward Portland".
  assert.equal(parse("my band wants to play a gig in portland").days, 1);
  assert.equal(parse("la mia band vuole suonare a Portland").days, 1);
  assert.equal(parse("book us 2 shows in Detroit").days, 2);
  console.log("Single-city day count checks passed.");
}
{
  // Owner 2026-11-16: "a few clubs in each town" and record stores along the way on the day sheet.
  const agent = fs.readFileSync(require("node:path").join(__dirname, "assets/booking-agent.js"), "utf8");
  assert.match(agent, /backupLine\.textContent = `Backups: \$\{backups\.map\(candidate => candidate\.name\)\.join\(", "\)\}`/);
  assert.match(agent, /\.slice\(0, 2\);/);
  assert.match(agent, /Record shop: \$\{recordShop\.name\}/);
  console.log("Backup clubs and record shop on the day sheet checks passed.");
}
