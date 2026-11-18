"use strict";
// Owner 2026-11-18 (phone screenshot of the tour plan): "In the booking agent how would I add these clubs to my
// contact list?" Every planned club and each backup has an add/remove toggle for the booking list, and one
// button adds every planned club at once.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const agent = fs.readFileSync("assets/booking-agent.js", "utf8");
const body = agent.match(/  function bookingListToggle[\s\S]*?\n  function routeItineraryMarkets/)[0].replace(/\n  function routeItineraryMarkets$/, "");

const listeners = {};
const selected = new Set();
const element = () => { const el = { attrs: {}, handlers: {}, textContent: "", disabled: false, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(type, fn) { this.handlers[type] = fn; }, click() { this.handlers.click?.(); } }; return el; };
const window = {
  danzstakBookingVenueSelected: venue => selected.has(venue.venueKey),
  danzstakToggleBookingVenue: venue => { selected.has(venue.venueKey) ? selected.delete(venue.venueKey) : selected.add(venue.venueKey); (listeners["danzstak:booking-selection"] || []).forEach(fn => fn()); },
  addEventListener: (type, fn) => (listeners[type] ||= []).push(fn),
  dispatchEvent: event => (listeners[event.type] || []).forEach(fn => fn())
};
const document = { createElement: element };
class CustomEvent { constructor(type) { this.type = type; } }
const { bookingListToggle, addAllToBookingList } = new Function("window", "document", "CustomEvent", `${body}; return { bookingListToggle, addAllToBookingList };`)(window, document, CustomEvent);

const harlows = { venueKey: "harlows", name: "Harlow's" }, cypress = { venueKey: "cypress", name: "Cypress" }, colonial = { venueKey: "colonial", name: "Cafe Colonial" };
const add = bookingListToggle(harlows);
assert.equal(add.textContent, "+ Add to booking list");
assert.equal(add.attrs["aria-pressed"], "false");
assert.equal(add.attrs["aria-label"], "Add Harlow's to booking list");
add.click();
assert.ok(selected.has("harlows"));
assert.equal(add.textContent, "✓ On booking list");
assert.equal(add.attrs["aria-label"], "Remove Harlow's from booking list");
add.click();
assert.ok(!selected.has("harlows"), "tapping again removes it");

const backup = bookingListToggle(colonial, { backup: true });
assert.equal(backup.textContent, "+ Cafe Colonial");
assert.equal(backup.className, "tour-plan-add tour-plan-add-backup");
backup.click();
assert.equal(backup.textContent, "✓ Cafe Colonial");

const all = addAllToBookingList([harlows, cypress]);
assert.equal(all.textContent, "+ Add all 2 clubs to booking list");
all.click();
assert.ok(selected.has("harlows") && selected.has("cypress"));
assert.equal(all.textContent, "✓ All clubs on booking list");
assert.equal(all.disabled, true);
assert.equal(add.textContent, "✓ On booking list", "row toggles follow the add-all");
window.danzstakToggleBookingVenue(cypress);
assert.equal(all.textContent, "+ Add all 2 clubs to booking list", "removing one club re-enables add-all");

// Wired into the tour plan: main club toggle, backups as toggles, add-all above the table.
assert.match(agent, /venueCell\.append\(venueName, venueStatus, bookingListToggle\(venue\)\);\r?\n\s*planVenues\.push\(venue\);/);
assert.match(agent, /if \(planVenues\.length\) details\.append\(addAllToBookingList\(planVenues\)\);\r?\n\s*details\.append\(tableBox\);/);
const css = fs.readFileSync("assets/booking-agent.css", "utf8");
assert.match(css, /\.tour-plan-add\{[^}]*min-height:44px/);
assert.match(css, /\.tour-lead-backups \.tour-plan-add-backup\{[^}]*min-height:44px/);
assert.match(css, /\.tour-plan-add-all\{[^}]*min-height:48px/);
console.log("tour plan add-to-booking-list ok");
