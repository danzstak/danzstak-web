"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const helper = api.slice(api.indexOf("function approximateMilesBetween("), api.indexOf("function distanceToSearchPathMiles("));
let fail = false;
const context = vm.createContext({
  console: { error() {} }, venueDirectoryTable: "DANZSTAK-VenueDirectory",
  scanAll: async request => {
    assert.equal(request.TableName, "DANZSTAK-VenueDirectory");
    if (fail) throw Object.assign(new Error("unavailable"), { name: "ServiceUnavailable" });
    return [{
      venueKey: { S: "abc123" }, name: { S: "The Public Room" }, address: { S: "1 Music Way" }, locality: { S: "Portland" },
      longitude: { N: "-122.67" }, latitude: { N: "45.52" }, website: { S: "https://room.example/" }, email: { S: "book@room.example" },
      categories: { SS: ["Member-verified public live music venue"] }, status: { S: "approved" }, approvedAt: { S: "2026-10-30T12:00:00Z" }
    }];
  }
});
vm.runInContext(helper, context);

(async () => {
  const leads = await context.approvedMemberVenueLeads({ position: [-122.68, 45.53] });
  assert.equal(leads.length, 1);
  assert.equal(leads[0].sourceName, "DanzStak reviewed venue directory");
  assert.equal(leads[0].contactVerificationRequired, true);
  assert.ok(leads[0].distanceMiles < 2);
  assert.equal((await context.approvedMemberVenueLeads({ position: [-122.68, 45.53] }, { west: -123, east: -122, south: 45, north: 46 })).length, 1);
  assert.equal((await context.approvedMemberVenueLeads({ position: [-122.68, 45.53] }, { west: -80, east: -70, south: 30, north: 40 })).length, 0);
  fail = true;
  assert.deepEqual(Array.from(await context.approvedMemberVenueLeads({ position: [-122.68, 45.53] })), [], "directory outages must not block live map discovery");
  const deployment = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
  const moderation = fs.readFileSync("moderate-venue-directory.ps1", "utf8");
  assert.match(deployment, /DANZSTAK-VenueDirectory/);
  assert.match(deployment, /PointInTimeRecoveryEnabled=true/);
  assert.match(moderation, /pending-review/);
  assert.match(moderation, /publicVenueCertified/);
  assert.match(moderation, /attribute_not_exists\(venueKey\)/);
  console.log("Reviewed venue directory checks passed: bounded reads, proximity, outage fallback, moderation, and recovery protection.");
})().catch(error => { console.error(error); process.exitCode = 1; });
