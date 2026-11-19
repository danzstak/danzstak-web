"use strict";
// Task 25 (owner 2026-11-18): the Booking Agent lines clubs up as a road trip and the Tour Manager
// keeps the route in a straight line, reporting criss-crosses back to Booking with what they cost.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/tour-line.js", "utf8");
const context = { console };
context.window = context;
vm.createContext(context);
vm.runInContext(source, context);
const line = context.danzstakTourLine;
assert.ok(line, "the engine registers window.danzstakTourLine");
assert.equal(require("./assets/tour-line.js").orderStops, require("./assets/tour-line.js").orderStops, "also loads as a CommonJS module");

const CITY = {
  Bellingham: [-122.48, 48.75], Seattle: [-122.33, 47.61], Tacoma: [-122.44, 47.25], Olympia: [-122.90, 47.04],
  Portland: [-122.68, 45.52], Salem: [-123.04, 44.94], Sacramento: [-121.49, 38.58], "San Francisco": [-122.42, 37.77],
  Boise: [-116.20, 43.62], Eugene: [-123.09, 44.05], Spokane: [-117.43, 47.66]
};
const stop = (city, extra = {}) => ({ id: `${city}-${extra.name || "club"}`.toLowerCase().replace(/\W+/g, "-"), name: extra.name || `${city} club`, city, position: CITY[city], ...extra });
const cities = list => Array.from(list, item => item.city).join(" → ");

// ---- The owner's fixture: no backtracking, in either direction -------------------------------
const owner = ["Seattle", "Portland", "Bellingham", "Sacramento", "Salem", "San Francisco"].map(city => stop(city));
const straight = cities(line.orderStops({ stops: owner }));
const expected = "Bellingham → Seattle → Portland → Salem → Sacramento → San Francisco";
assert.ok(straight === expected || straight === expected.split(" → ").reverse().join(" → "), `straight line, got ${straight}`);
// Shuffled input gives the same line.
assert.equal(cities(line.orderStops({ stops: owner.slice().reverse() })), straight);
// One-way from a hometown at the end of the line runs down it.
assert.equal(cities(line.orderStops({ stops: owner.filter(s => s.city !== "Bellingham"), start: { city: "Bellingham", position: CITY.Bellingham } })), "Seattle → Portland → Salem → Sacramento → San Francisco");
// Out and back from San Francisco: a loop that never plays a town twice and is no longer than
// running straight up the coast and driving home from the far end.
const home = { city: "San Francisco", position: CITY["San Francisco"] };
const loopStops = owner.filter(s => s.city !== "San Francisco");
const loop = line.orderStops({ stops: loopStops, start: home, mode: "out_and_back" });
const loopMiles = list => { let at = home.position, miles = 0; for (const s of list) { miles += line.estimateDrive(at, s.position).miles; at = s.position; } return miles + line.estimateDrive(at, home.position).miles; };
const upAndHome = ["Sacramento", "Salem", "Portland", "Seattle", "Bellingham"].map(city => loopStops.find(s => s.city === city));
assert.equal(loop.length, 5);
assert.ok(loopMiles(loop) <= loopMiles(upAndHome) + 1, `loop ${cities(loop)} is no longer than up-and-home`);

// ---- The criss-cross the owner described -----------------------------------------------------
// Seattle → Portland → Bellingham → Seattle → Sacramento → Salem → San Francisco
const crissCross = [
  stop("Seattle", { name: "The Crocodile", date: "2027-05-07", state: "confirmed" }),
  stop("Portland", { name: "Doug Fir", date: "2027-05-08", state: "offered" }),
  stop("Bellingham", { name: "Wild Buffalo", date: "2027-05-09", state: "offered" }),
  stop("Seattle", { name: "Neumos", date: "2027-05-10", state: "held" }),
  stop("Sacramento", { name: "Starlite", date: "2027-05-12", state: "offered" }),
  stop("Salem", { name: "Salem club", date: "2027-05-13", state: "offered" }),
  stop("San Francisco", { name: "Bottom of the Hill", date: "2027-05-15", state: "offered" })
];
const check = line.checkRoute({ stops: crissCross });
assert.equal(check.ok, false);
assert.equal(check.backtracks.length, 3, `3 backtracks, got ${JSON.stringify(check.backtracks)}`);
assert.deepEqual(Array.from(check.backtracks, b => `${b.from}→${b.to}:${b.reason}`), ["Portland→Bellingham:backwards", "Bellingham→Seattle:revisit", "Sacramento→Salem:backwards"]);
assert.ok(check.extra.miles > 300, `the detour costs real miles: ${check.extra.miles}`);
assert.equal(check.extra.hours, Math.round(check.extra.miles / 50 * 10) / 10, "hours follow miles at 50 mph");
assert.ok(check.extra.cost >= Math.round(check.extra.miles * 0.64), "cost includes fuel/van per mile");
assert.ok(check.longDays.some(day => day.from === "Seattle" && day.to === "Sacramento"), "Seattle → Sacramento in two days is flagged as a long day");
assert.ok(check.miles > check.straightMiles);
// The same clubs played in the straight order pass.
const fixed = line.orderStops({ stops: crissCross }).map((item, i) => ({ ...item, date: `2027-05-${String(7 + i * 2).padStart(2, "0")}` }));
const fixedCheck = line.checkRoute({ stops: fixed });
assert.equal(fixedCheck.backtracks.length, 0, `straight order has no backtracks: ${JSON.stringify(fixedCheck.backtracks)}`);
assert.equal(fixedCheck.extra.miles, 0);
// Fewer than two stops: nothing to check.
assert.equal(line.checkRoute({ stops: [crissCross[0]] }).ok, true);

// ---- Swap suggestions: concrete, biggest saving first, never move a confirmed date -------------
const swaps = line.swapSuggestions({ stops: crissCross });
assert.ok(swaps.length >= 1 && swaps.length <= 3);
for (let i = 1; i < swaps.length; i++) assert.ok(swaps[i - 1].saves.miles >= swaps[i].saves.miles, "biggest saving first");
assert.ok(swaps.every(s => s.moves.every(m => m.name !== "The Crocodile")), "confirmed shows keep their date");
assert.ok(swaps[0].saves.hours > 0 && swaps[0].saves.fuel > 0);
assert.ok(swaps.some(s => s.moves.some(m => m.city === "Bellingham") || s.moves.some(m => m.city === "Salem")), "it moves one of the backtracking stops");
assert.equal(line.swapSuggestions({ stops: fixed.map(s => ({ ...s, state: "offered" })) }).length, 0, "a straight route needs no swaps");

// ---- Booking: line up the asks as a road trip -------------------------------------------------
// Owner: Bellingham → Seattle → Tacoma → Olympia → Portland, asked for Thu, Fri, Sat, Sun, Tue.
const thursday = "2027-05-13";
assert.equal(new Date(`${thursday}T00:00:00Z`).getUTCDay(), 4);
const pnw = ["Portland", "Tacoma", "Bellingham", "Olympia", "Seattle"].map(city => stop(city));
const lined = line.lineUpAsks({ stops: pnw, firstDate: thursday });
assert.equal(cities(lined.asks), "Bellingham → Seattle → Tacoma → Olympia → Portland");
const day = date => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${date}T00:00:00Z`).getUTCDay()];
assert.deepEqual(Array.from(lined.asks, ask => day(ask.date)), ["Thu", "Fri", "Sat", "Sun", "Tue"], "consecutive nights, Monday dark");
assert.equal(lined.travelDays, 0);
assert.ok(lined.asks.every(ask => !ask.longDrive));
assert.ok(lined.asks.slice(0, 3).every(ask => !ask.orDate), "back-to-back nights leave no alternative that would collide with another club");
assert.equal(lined.asks[3].orDate, undefined, "Sunday's alternative would be dark Monday");
assert.equal(day(lined.asks[4].orDate), "Wed", "the last club can be asked for the day after");
// A long hop gets a travel day.
const long = line.lineUpAsks({ stops: ["Seattle", "Portland", "Sacramento"].map(city => stop(city)), firstDate: "2027-05-05" });
assert.equal(cities(long.asks), "Seattle → Portland → Sacramento");
assert.equal(long.asks[2].longDrive, true);
assert.ok(long.travelDays >= 1);
assert.ok(new Date(`${long.asks[2].date}T00:00:00Z`) - new Date(`${long.asks[1].date}T00:00:00Z`) >= 2 * 86400000, "Portland → Sacramento needs a travel day");
assert.equal(line.lineUpAsks({ stops: pnw, firstDate: "nope" }).asks.length, 0);

// ---- Suggest clubs along the line; far detours are "off route" and sort last ------------------
const along = line.alongTheLine({ line: [stop("Seattle"), stop("Portland"), stop("Sacramento")], clubs: [stop("Boise"), stop("Salem"), stop("Tacoma"), stop("Eugene")] });
assert.equal(cities(along), "Tacoma → Salem → Eugene → Boise");
assert.equal(along.at(-1).offRoute, true);
assert.ok(along.at(-1).detourHours > 3);
assert.ok(along.slice(0, 3).every(club => !club.offRoute));

// ---- Date asks between confirmed neighbours ---------------------------------------------------
const asks = line.dateAsks({ stops: [
  stop("Portland", { name: "Doug Fir", date: "2027-05-11", state: "confirmed" }),
  stop("Salem", { name: "Salem club", state: "asked" }),
  stop("Eugene", { name: "Eugene club", state: "asked" }),
  stop("Sacramento", { name: "Starlite", date: "2027-05-15", state: "confirmed" }),
  stop("Spokane", { name: "Spokane club", state: "declined" })
] });
const salem = asks.find(item => item.city === "Salem");
assert.ok(salem.fits && salem.dates.length >= 1);
assert.ok(salem.dates.every(date => date > "2027-05-11" && date < "2027-05-15"), "between Portland and Sacramento");
assert.deepEqual(Array.from(salem.between, b => b.city), ["Portland", "Sacramento"]);
assert.ok(!asks.some(item => item.city === "Spokane"), "declined clubs get no ask");
assert.ok(!asks.some(item => item.city === "Portland"), "confirmed clubs get no ask");

// ---- Settings are bounded; the engine never touches the network or storage -------------------
assert.deepEqual(JSON.parse(JSON.stringify(line.settingsOf({ maxDriveHours: 99, costPerMile: -1, darkDays: [9, 2] }))), { maxDriveHours: 6, targetDriveHours: 4, costPerMile: 0.64, hotelNight: 120, darkDays: [2], offRouteHours: 3 });
assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|localStorage|sessionStorage|stripe|checkout/i, "pure engine: no network, storage or payments");

console.log("tour-line ok");
