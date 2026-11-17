"use strict";
// Owner 2026-11-17: trusted promoters (e.g. a punk/metal promoter booking Tacoma, Bremerton and Seattle) are added by the
// DanzStak team, agreed to hear from artists, and are never public: contacts reach only signed-in artists with an EPK.
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const t = await import("./infrastructure/auth-api/trusted-contacts.mjs");
  assert.equal(t.isDirectoryEditor("Owner@Example.com", "owner@example.com, other@example.com"), true);
  assert.equal(t.isDirectoryEditor("fan@example.com", "owner@example.com"), false);
  assert.equal(t.isDirectoryEditor("owner@example.com", ""), false, "no editors configured means nobody can add");
  assert.match(t.parseTrustedContact({ name: "X", towns: ["Tacoma, WA"], phone: "+1 555 010 0000" }).error, /agreed to be contacted/);
  assert.match(t.parseTrustedContact({ name: "X", towns: [], phone: "+1 555 010 0000", consent: true }).error, /town/);
  assert.match(t.parseTrustedContact({ name: "X", towns: ["Tacoma"], consent: true }).error, /phone number, email or website/);
  const { contact } = t.parseTrustedContact({ name: "Test Promoter", kind: "promoter", towns: ["Tacoma, WA", "Bremerton, WA", "Seattle, WA"], genres: "punk, metal", venues: "Test Hall", phone: "+1 555 010 0000", consent: true });
  const items = t.trustedContactItems(contact, [{ label: "Tacoma, WA", position: [-122.44, 47.25] }, { label: "Bremerton, WA", position: [-122.63, 47.57] }, { label: "Seattle, WA", position: [-122.33, 47.61] }], "editorhash", "2026-11-17T10:00:00.000Z");
  assert.equal(items.length, 3, "one record per town");
  assert.ok(items.every(item => item.venueKey.S.startsWith("promoter-trusted-") && item.status.S === "approved" && item.trusted.BOOL === true));
  assert.equal(new Set(items.map(item => item.contactId.S)).size, 1);
  const near = t.trustedPromotersNear(items, { position: [-122.40, 47.30] }, "punk");
  assert.equal(near.length, 1, "one entry per person even when several of their towns are near");
  assert.equal(near[0].locality, "Tacoma, WA");
  assert.deepEqual(near[0].phones, ["+1 555 010 0000"]);
  assert.equal(near[0].genreMatch, true);
  assert.equal(t.trustedPromotersNear(items, { position: [12.34, 44.49] }).length, 0, "far away towns do not show them");
  // Contacts are stripped for members without an EPK.
  const index = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  assert.match(index, /path === "\/tour\/route"\) \{\s*return await withArtistContacts\(event, await planTourRoute\(event\)\)/);
  assert.match(index, /path === "\/venues\/search"\) return await withArtistContacts\(event, await searchVenues\(event\)\)/);
  assert.match(index, /isDirectoryEditor\(email, globalThis\.process\?\.env\?\.DIRECTORY_EDITOR_EMAILS\)/);
  const strip = new Function(`${index.match(/function stripBookingContacts\(value\) \{[\s\S]*?\n\}/)[0]}; return stripBookingContacts;`)();
  const stripped = strip({ route: { itinerary: [{ venues: [{ name: "A", emails: ["a@x.test"], phones: ["1"] }], promoters: [{ name: "P", phones: ["2"] }], hotels: [{ phones: ["3"] }] }] } });
  assert.deepEqual(stripped.route.itinerary[0].venues[0].emails, []);
  assert.equal(stripped.route.itinerary[0].venues[0].contactsHidden, true);
  assert.deepEqual(stripped.route.itinerary[0].promoters[0].phones, []);
  assert.deepEqual(stripped.route.itinerary[0].hotels[0].phones, ["3"], "hotels keep their public numbers");
  // Never in the public repository: no trusted contact data is hard-coded.
  for (const file of ["infrastructure/auth-api/trusted-contacts.mjs", "assets/trusted-contacts.js", "trusted-contacts.html"]) assert.doesNotMatch(fs.readFileSync(file, "utf8"), /\b1?253\d{7}\b|253-\d{3}-\d{4}/);
  const page = fs.readFileSync("trusted-contacts.html", "utf8");
  assert.match(page, /noindex,nofollow/);
  assert.match(fs.readFileSync("aws-deploy-auth-api.ps1", "utf8"), /"GET \/club-directory\/contacts", "POST \/club-directory\/contacts"/);
  assert.match(fs.readFileSync("assets/booking-agent.js", "utf8"), /Contacts show for artists with an EPK/);
  const upd = t.trustedContactUpdate("Dir", { venueKey: { S: "promoter-trusted-x-tacoma" }, name: { S: "Flash" }, status: { S: "approved" } });
  assert.deepEqual(upd.Key, { venueKey: { S: "promoter-trusted-x-tacoma" } });
  assert.match(upd.UpdateExpression, /^SET #f0 = :v0, #f1 = :v1$/);
  assert.equal(upd.ExpressionAttributeNames["#f0"], "name");
  assert.match(fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), /new UpdateItemCommand\(trustedContactUpdate\(venueDirectoryTable, item\)\)/, "saves with the club-database UpdateItem permission");
  console.log("trusted-contacts tests passed");
})().catch(error => { console.error(error); process.exit(1); });
