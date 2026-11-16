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
