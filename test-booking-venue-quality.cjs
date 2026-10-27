const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const start = api.indexOf("function isBookableClub");
const end = api.indexOf("function hasBookingContact", start);
assert.ok(start >= 0 && end > start, "venue quality helpers must exist");

const context = vm.createContext({});
vm.runInContext(api.slice(start, end), context);
const isBookableClub = vm.runInContext("isBookableClub", context);

assert.equal(isBookableClub({ name: "Bottom of the Hill", categories: ["Live Music Venue", "Bar"] }, "DIY Punk"), true);
assert.equal(isBookableClub({ name: "Kilowatt", categories: ["Bar", "Live Music"] }, "Rock"), true);
assert.equal(isBookableClub({ name: "Bill Graham Civic Auditorium", categories: ["Auditorium"] }, "Rock"), false);
assert.equal(isBookableClub({ name: "City Art Museum", categories: ["Museum", "Tourist Attraction"] }, "Rock"), false);
assert.equal(isBookableClub({ name: "Auto Shop", categories: ["Automotive Service"] }, "Metal"), false);
assert.equal(isBookableClub({ name: "Downtown Jazz Club", categories: ["Jazz", "Night Club"] }, "DIY Punk"), false);
assert.equal(isBookableClub({ name: "Another Planet Entertainment", categories: ["Concert Promoter", "Entertainment Company"] }, "DIY Punk"), false);
assert.equal(isBookableClub({ name: "Stamina DNB", categories: ["Music Promoter"] }, "DIY Punk"), false);
assert.equal(isBookableClub({ name: "SFGMC", categories: ["Choir"] }, "DIY Punk"), false);
assert.equal(isBookableClub({ name: "RHL Rehearsal Studios", categories: ["Rehearsal Studio"] }, "DIY Punk"), false);
assert.equal(isBookableClub({ name: "Martuni's", categories: ["Cocktail Bar"] }, "DIY Punk"), false);
assert.equal(isBookableClub({ name: "Clusterfest", categories: ["Festival"] }, "DIY Punk"), false);
assert.equal(isBookableClub({ name: "SFJAZZ Center", categories: ["Jazz Workshop"] }, "DIY Punk"), false);
assert.equal(isBookableClub({ name: "PDE", categories: ["Orchestra"] }, "DIY Punk"), false);
assert.equal(isBookableClub({ name: "Musicians Entrance", categories: ["San Francisco Symphony", "Orchestra Facility"] }, "Rock"), false);
assert.equal(isBookableClub({ name: "Club Passport", categories: ["Passport Service", "Government Office"] }, "DJ / Electronic"), false);

const client = fs.readFileSync("assets/booking-agent.js", "utf8");
assert.match(client, /Search again for different clubs/);
assert.match(client, /excludeVenueKeys/);
assert.match(client, /variation:\s*searchVariation/);
assert.match(api, /name: "Public Works"[\s\S]*categories: \["Nightclub", "DJ", "Electronic"\]/);
assert.match(api, /name: "1015 Folsom"[\s\S]*"House", "Techno"/);
assert.match(api, /name: "Audio SF"[\s\S]*"House", "Techno"/);
assert.match(api, /name: "Hawthorne Theatre"[\s\S]*hawthornetheatre\.com\/booking/);
assert.match(api, /name: "Turn! Turn! Turn!"[\s\S]*turnturnturnpdx\.booking@gmail\.com/);
assert.match(api, /name: "Kelly's Olympian"[\s\S]*bookings@kellysolympian\.com/);
assert.doesNotMatch(api, /name: "Kilowatt"[^\n]+categories: \[[^\]]*"DJ"/);
assert.match(client, /seenVenueKeys/);
assert.match(client, /https:\/\/www\.google\.com\/maps\/search\/\?api=1/);
assert.match(client, /Navigate full route in Google Maps/);
assert.match(client, /Navigate to this club/);
assert.match(client, /dir_action=navigate/);
assert.match(client, /https:\/\/maps\.apple\.com/);
assert.match(api, /pointLabel\.includes\("san francisco"\)/);
assert.match(api, /curated\.length \|\| discovered\.length \? \[\] : curatedPool/);
assert.match(api, /selectedGenre \? `\$\{selectedGenre\} live music club`/);
assert.match(api, /searchBounds/);
const mapClient = fs.readFileSync("assets/booking-map.js", "utf8");
assert.match(mapClient, /new L\.Control\.Draw/);
assert.match(mapClient, /body\.searchBounds = searchBounds/);
assert.match(mapClient, /venueMarkers/);

console.log("Booking venue checks passed: positive music-room evidence is required and repeat searches request a different batch.");
