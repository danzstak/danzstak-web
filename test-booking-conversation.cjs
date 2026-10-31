"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const listeners = {}, controls = new Map();
function control(id, value = "") {
  const item = { id, value, clicked: 0, focused: 0, addEventListener(type, handler) { listeners[`${id}:${type}`] = handler; }, dispatchEvent() {}, click() { this.clicked += 1; }, focus() { this.focused += 1; } };
  controls.set(id, item); return item;
}
for (const id of ["bookingBriefForm", "bookingBrief", "bookingBriefStatus", "bookingBriefExample", "bandName", "startCity", "musicGenre", "days", "showCount", "departOn", "bookingMode", "travelDirection", "endCity", "tourStops", "routeSearchAction"]) control(id);
const context = vm.createContext({
  window: {}, Event: class {},
  document: { getElementById: id => controls.get(id) || null }
});
vm.runInContext(fs.readFileSync("assets/booking-conversation.js", "utf8"), context);

const parse = context.window.danzstakParseTourBrief;
assert.equal(typeof parse, "function");
const berlin = parse("Plan a 10-day DIY punk tour for The Rats from Momo, Italy to Berlin and back home.");
assert.equal(berlin.days, 10);
assert.equal(berlin.genre, "DIY Punk");
assert.equal(berlin.act, "The Rats");
assert.equal(berlin.home, "Momo, Italy");
assert.equal(berlin.destination, "Berlin");
assert.equal(berlin.mode, "tour");
const local = parse("Find rock clubs near home from Portland");
assert.equal(local.genre, "Rock");
assert.equal(local.mode, "local");
const directional = parse("Plan 7 days for Static Age from Jackson and travel west starting 2027-01-10");
assert.equal(directional.days, 7);
assert.equal(directional.act, "Static Age");
assert.equal(directional.home, "Jackson");
assert.equal(directional.direction, "west");
assert.equal(directional.departOn, "2027-01-10");
const plain = parse("The Rats. DIY punk. From Momo, Italy to Berlin and back home for 10 days.");
assert.equal(plain.act, "The Rats");
assert.equal(plain.genre, "DIY Punk");
assert.equal(plain.home, "Momo, Italy");
assert.equal(plain.destination, "Berlin");
assert.equal(plain.days, 10);
const eroticon = parse("I want to plan a tour for Eroticon from San Francisco to LA and then up Seattle and back to San Francisco. I would like to be out 30 days and do 20 shows.");
assert.equal(eroticon.act, "Eroticon");
assert.equal(eroticon.home, "San Francisco");
assert.deepEqual(Array.from(eroticon.stops), ["LA"]);
assert.equal(eroticon.destination, "Seattle");
assert.equal(eroticon.days, 30);
assert.equal(eroticon.shows, 20);

controls.get("bookingBrief").value = "Plan a 10-day DIY punk tour for The Rats from Momo, Italy to Berlin and back home.";
listeners["bookingBriefForm:submit"]({ preventDefault() {} });
assert.equal(controls.get("bandName").value, "The Rats");
assert.equal(controls.get("startCity").value, "Momo, Italy");
assert.equal(controls.get("endCity").value, "Berlin");
assert.equal(controls.get("routeSearchAction").clicked, 1);
assert.match(controls.get("bookingBriefStatus").value || controls.get("bookingBriefStatus").textContent, /Building the route/);

const markup = fs.readFileSync("booking.html", "utf8");
assert.match(markup, /id="bookingBriefForm"/);
assert.match(markup, /assets\/booking-conversation\.js\?v=449/);
assert.match(markup, /Where do you want to play\?/);
assert.match(markup, /More tour options: genre, crew, van and budget/);
console.log("Conversational Booking Agent checks passed: natural route, genre, act, days, date, direction, and one-click planning.");
