"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const epkHtml = fs.readFileSync("epk.html", "utf8");
const epkClient = fs.readFileSync("assets/epk.js", "utf8");
const bookingHtml = fs.readFileSync("booking-selections.html", "utf8");
const bookingClient = fs.readFileSync("assets/booking-selections.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(epkHtml, /id="epkBookingHandoff"[^>]*hidden/, "the booking handoff must stay hidden before publication");
assert.match(epkHtml, /href="booking-selections\.html\?from=epk">Use this EPK for booking</, "the published EPK needs a direct booking handoff");
assert.match(epkHtml, /review every message before anything sends/i, "the handoff must not imply automatic outreach");
assert.match(epkClient, /handoff\.hidden = row\.hidden/, "published state must control the booking handoff");
assert.match(bookingHtml, /assets\/booking-selections\.js\?v=24/, "the booking workspace must request the connected handoff client");
assert.match(bookingHtml, /id="chooseVenuesNext"[\s\S]*href="booking\.html">Choose venues</, "the connected handoff must expose venue discovery as the next primary action");
assert.match(bookingClient, /epkHandoffRequested[\s\S]*get\("from"\) === "epk"/, "the booking workspace must recognize an explicit EPK handoff");
assert.match(bookingClient, /artistName[\s\S]*genres[\s\S]*hometown[\s\S]*shortPitch \|\| kit\.shortBio/, "the EPK handoff must carry the act identity and pitch, not only a URL");
assert.match(bookingClient, /Switch the act for this pitch\?/, "a different saved act must not be replaced silently");
assert.match(bookingClient, /persist\(\);[\s\S]*render\(\);[\s\S]*saveWorkspaceSnapshot\(\)/, "the connected handoff must persist the imported EPK details");
assert.match(bookingClient, /Choose venues and review each pitch before sending/, "the completion status must lead to the next artist-controlled step");
assert.match(bookingClient, /chooseVenuesNext\.textContent = available \? "Add venues" : "Choose venues"/, "the venue action must remain useful after venues have already been selected");
assert.match(worker, /danzstak-shell-v801/, "the installed PWA must fetch the connected EPK workflow");
assert.doesNotMatch(epkHtml, /tour-manager\/emails\/send|checkout|payment/i, "publishing an EPK must never send outreach or start payment");

console.log("Connected EPK-to-booking handoff checks passed.");
