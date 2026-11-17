"use strict";
// Owner 2026-11-17: bands tour in one-way legs (I-5, then east on I-8/I-10/I-20/I-40/I-80); big tours often
// start in the Midwest (Nashville, Milwaukee) and head east or west. "Keep going" chains the next leg.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const store = {};
const context = { console, localStorage: { getItem: key => store[key] ?? null, setItem: (key, value) => { store[key] = String(value); } }, document: { createElement: () => ({ append() {}, setAttribute() {}, addEventListener() {}, dataset: {} }), getElementById: () => null } };
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync("assets/booking-legs.js", "utf8"), context);
const legs = context.danzstakTourLegs;
const names = list => Array.from(list, option => `${option.corridor} ${option.direction}`);
assert.deepEqual(names(legs.options("San Diego, CA, United States")), ["I-5 north", "I-8 east"]);
assert.deepEqual(names(legs.options("Nashville, TN, United States")), ["I-40 east", "I-40 west", "I-65 south", "I-65 north"]);
assert.deepEqual(names(legs.options("Milwaukee, WI, United States")), ["I-90 / I-94 east", "I-90 / I-94 west"]);
assert.ok(legs.options("Seattle, WA").some(option => option.corridor === "I-90 / I-94" && option.direction === "east" && option.towns.at(-1) === "Boston"));
const unknown = legs.options("Boise, ID, United States");
assert.ok(unknown.length >= 10 && unknown.every(option => option.joinFromHere), "a town off the listed freeways can join any of them");
const agent = fs.readFileSync("assets/booking-agent.js", "utf8"), page = fs.readFileSync("booking.html", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8");
assert.match(agent, /window\.danzstakTourLegs\?\.render\(data\)/);
assert.ok(page.indexOf("assets/booking-legs.js") < page.indexOf("assets/booking-agent.js"));
assert.match(worker, /"\/assets\/booking-legs\.js"/);
assert.match(fs.readFileSync("assets/booking-legs.js", "utf8"), /set\("departOn", nextDay\(data\.route\.returnBy\)\)/, "the next leg starts the day after this one ends");
const legsSource = fs.readFileSync("assets/booking-legs.js", "utf8");
assert.match(legsSource, /getElementById\("routeSearchAction"\)\?\.click\(\)/);
assert.doesNotMatch(legsSource, /requestSubmit\(\)/, "a native form submit reloads the page and loses the tour");
console.log("Tour legs checks passed.");
