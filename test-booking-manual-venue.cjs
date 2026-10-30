"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createHash } = require("node:crypto");

const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const helper = api.slice(api.indexOf("async function addManualBookingVenue("), api.indexOf("const verifiedSanFranciscoRooms"));
let authenticated = "owner-a", lookup;
class GeocodeCommand { constructor(input) { this.input = input; } }
const context = vm.createContext({
  URL, createHash, GeocodeCommand,
  now: () => Date.parse("2026-10-30T12:00:00Z") / 1000,
  corsHeaders: () => ({}), allowedOrigins: new Set(["https://danzstak.com"]),
  getAuthenticatedUser: async () => authenticated,
  parseJsonBody: event => event.body,
  geoPlaces: { send: async command => {
    lookup = command.input;
    return { ResultItems: [{ Position: [-122.42, 37.76], Address: { Locality: "San Francisco" } }] };
  } }
});
vm.runInContext(helper, context);
const request = (body, origin = "https://danzstak.com") => context.addManualBookingVenue({ headers: { origin }, body });

(async () => {
  assert.equal((await request({}, "https://evil.example")).statusCode, 403);
  authenticated = "";
  assert.equal((await request({})).statusCode, 401);
  authenticated = "owner-a";
  assert.equal((await request({ name: "Room", address: "100 Music St" })).statusCode, 400, "a public contact is required");
  assert.equal((await request({ name: "Room", address: "100 Music St", website: "http://insecure.example" })).statusCode, 400, "websites must use HTTPS");
  const response = await request({ name: "The Room", address: "100 Music St, San Francisco", website: "https://room.example/book", email: "BOOKING@ROOM.EXAMPLE", phone: "+1 415 555 1212" });
  assert.equal(response.statusCode, 200);
  const venue = JSON.parse(response.body).venue;
  assert.equal(lookup.QueryText, "100 Music St, San Francisco");
  assert.deepEqual(Array.from(venue.position), [-122.42, 37.76]);
  assert.deepEqual(Array.from(venue.emails), ["booking@room.example"]);
  assert.equal(venue.sourceName, "Member-added public booking lead");
  assert.equal(venue.contactVerificationRequired, true);
  assert.match(venue.activityEvidence, /Verify the official website/);

  const markup = fs.readFileSync("booking.html", "utf8");
  const client = fs.readFileSync("assets/booking-map.js", "utf8");
  for (const id of ["manualVenueForm", "manualVenueName", "manualVenueAddress", "manualVenueWebsite", "manualVenueEmail", "manualVenuePhone", "manualVenueStatus"]) {
    assert.match(markup, new RegExp(`id=["']${id}["']`), `${id} must be present`);
  }
  assert.match(client, /\/tour\/manual-venue/, "the missing-club form must use the authenticated geocoder");
  assert.match(client, /selectedVenues\.set\(venueIdentity\(place\), place\)/, "a resolved club must enter the private booking list");
  assert.match(client, /addVenueMarker\(place, true\)/, "a resolved club must be pinned on the map");
  console.log("Manual venue checks passed: auth, validation, public contacts, geocoding, private selection, and map pinning.");
})().catch(error => { console.error(error); process.exitCode = 1; });
