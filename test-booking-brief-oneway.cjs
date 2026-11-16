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
