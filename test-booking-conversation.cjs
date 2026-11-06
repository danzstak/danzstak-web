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
const screenshotBrief = parse("Tour San Francisco to Seattle and back in 10 days give me clubs to play");
assert.equal(screenshotBrief.home, "San Francisco");
assert.equal(screenshotBrief.destination, "Seattle");
assert.equal(screenshotBrief.mode, "tour");
assert.equal(screenshotBrief.days, 10);
const naturalRoundTrip = parse("Route Test. DIY punk. Seattle to San Francisco and back to Seattle. 10 days. 8 shows.");
assert.equal(naturalRoundTrip.act, "Route Test");
assert.equal(naturalRoundTrip.home, "Seattle");
assert.equal(naturalRoundTrip.destination, "San Francisco");
assert.equal(naturalRoundTrip.days, 10);
assert.equal(naturalRoundTrip.shows, 8);
const naturalDeparture = parse("Route Test. DIY punk. Seattle to San Francisco and back to Seattle. 10 days. 8 shows. Depart January 4, 2027.");
assert.equal(naturalDeparture.departOn, "2027-01-04");
const plainDeparture = parse("Codex. Punk. Seattle to San Francisco and back to Seattle. 10 days. 8 shows. January 1 2027.");
assert.equal(plainDeparture.departOn, "2027-01-01", "a plain-language trailing date should set the first tour day");
const spokenCommaRoute = parse("Route Test, DIY punk from Seattle to San Francisco and back to Seattle, 10 days, 8 shows, depart January 4 2027");
assert.equal(spokenCommaRoute.act, "Route Test");
assert.equal(spokenCommaRoute.genre, "DIY Punk");
assert.equal(spokenCommaRoute.home, "Seattle");
assert.equal(spokenCommaRoute.destination, "San Francisco");
assert.equal(spokenCommaRoute.days, 10);
assert.equal(spokenCommaRoute.shows, 8);
assert.equal(spokenCommaRoute.departOn, "2027-01-04");
assert.equal(parse("Leave Portland on February 29, 2027").departOn, undefined, "invalid calendar dates must not be accepted");
assert.equal(parse("Start Portland on 2027-02-29").departOn, undefined, "invalid ISO calendar dates must not be accepted");
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
const between = parse("Find punk clubs to play between Momo, Italy and Berlin for 10 days.");
assert.equal(between.home, "Momo, Italy");
assert.equal(between.destination, "Berlin");
assert.equal(between.genre, "DIY Punk");
assert.equal(between.days, 10);
assert.equal(between.mode, "tour");

controls.get("bookingBrief").value = "Plan a 10-day DIY punk tour for The Rats from Momo, Italy to Berlin and back home.";
listeners["bookingBriefForm:submit"]({ preventDefault() {} });
assert.equal(controls.get("bandName").value, "The Rats");
assert.equal(controls.get("startCity").value, "Momo, Italy");
assert.equal(controls.get("endCity").value, "Berlin");
assert.equal(controls.get("routeSearchAction").clicked, 1);
assert.match(controls.get("bookingBriefStatus").value || controls.get("bookingBriefStatus").textContent, /Building the route/);

controls.get("bandName").value = "";
controls.get("startCity").value = "";
controls.get("endCity").value = "";
controls.get("bookingBrief").value = "Find punk clubs to play between Momo, Italy and Berlin for 10 days.";
listeners["bookingBriefForm:submit"]({ preventDefault() {} });
assert.equal(controls.get("startCity").value, "Momo, Italy");
assert.equal(controls.get("endCity").value, "Berlin");
assert.equal(controls.get("routeSearchAction").clicked, 2, "venue discovery must not require an act name");

const markup = fs.readFileSync("booking.html", "utf8");
const bookingConversation = fs.readFileSync("assets/booking-conversation.js", "utf8");
const bookingAgent = fs.readFileSync("assets/booking-agent.js", "utf8");
const authApi = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
assert.match(markup, /id="bookingBriefForm"/);
assert.match(markup, /assets\/booking-conversation\.js\?v=477/);
assert.match(markup, /<details class="booking-tools">[\s\S]*?<summary>Use the map or fill in the details yourself<\/summary>/, "manual fields and the venue map should stay behind one optional disclosure");
assert.match(bookingConversation, /details\.booking-tools/,
  "a missing plain-language field should reveal the optional manual controls before moving focus");
assert.match(markup, /Where do you want to play\?/);
assert.match(markup, /More tour options: genre, crew, van and budget/);
assert.match(bookingAgent, /target calendar/);
assert.match(bookingAgent, /Arrive 4:00 PM · Soundcheck 5:00 PM/);
assert.match(bookingAgent, /safe return drive; everyone and the vehicle finish at home/);
assert.match(authApi, /San Jose, California[\s\S]*Santa Cruz, California[\s\S]*Portland, Oregon[\s\S]*Seattle, Washington/);
console.log("Conversational Booking Agent checks passed: natural route, genre, act, days, date, direction, and one-click planning.");
