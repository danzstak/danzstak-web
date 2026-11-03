"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { createHash } = require("node:crypto");
const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const context = vm.createContext({ createHash, now: () => Date.now() / 1000, osmAttribution: "© OpenStreetMap contributors" });
vm.runInContext(source.slice(source.indexOf("function publicPlace("), source.indexOf("function isBookableClub(")), context);
vm.runInContext(source.slice(source.indexOf("function isRecordStore("), source.indexOf("const osmAttribution")), context);
// Provider-shaped fixtures reproduce localized category evidence being discarded.
for (const language of ["Verkoop van platen, CD en video", "Dischi, CD e video", "レコード店"]) {
  const place = context.publicPlace({ Title: "Fixture Shop", Position: [5.48, 51.44], Categories: [{ Id: "record,_cd_and_video", Name: "Record, CD and Video", LocalizedName: language }] });
  assert.equal(context.isRecordStore(place), true, `translated label ${language} must preserve provider category evidence`);
  assert.ok(place.categories.includes("record,_cd_and_video"));
}
assert.equal(context.isRecordStore({ name: "Fixture Platenzaak", categories: [] }), true);
assert.equal(context.isRecordStore({ name: "Fixture", categories: ["music"], sourceName: "© OpenStreetMap contributors" }), true);
assert.equal(context.isRecordStore({ name: "Fixture Dental", categories: ["Record, CD and Video"] }), false);
assert.equal(context.isRecordStore({ name: "Fixture", categories: ["Music store"] }), false);
console.log("Localized record-store category regression checks passed.");
