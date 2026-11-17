"use strict";
// Owner 2026-11-16: a real club database. Replies move a club up, bookings make it verified,
// silence keeps it unverified, bounces and stop requests take it out. Counts only, never who.
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const club = await import("./infrastructure/auth-api/club-directory.mjs");
  const send = (venueKey, status, extra = {}) => ({ userId: { S: extra.user || "u1" }, tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${Math.random()}` }, venueKey: { S: venueKey }, status: { S: status }, sentAt: { S: extra.sentAt || "2026-11-01T10:00:00.000Z" }, ...(extra.repliedAt ? { repliedAt: { S: extra.repliedAt } } : {}), ...(extra.followUpTo ? { followUpTo: { S: "x" } } : {}), ...(extra.updatedAt ? { updatedAt: { S: extra.updatedAt } } : {}) });
  const workspace = (user, venues) => ({ userId: { S: user }, tourId: { S: "booking-workspace-v1" }, plan: { S: JSON.stringify({ venues }) } });
  const stats = club.clubStats([
    send("club-booked", "replied", { repliedAt: "2026-11-01T22:00:00.000Z" }),
    send("club-booked", "delivered", { user: "u2" }),
    send("club-booked", "delivered", { followUpTo: true }),
    send("club-answers", "replied", { repliedAt: "2026-11-03T10:00:00.000Z" }),
    send("club-silent", "delivered"),
    send("club-bounced", "bounced", { updatedAt: "2026-11-02T00:00:00.000Z" }),
    send("club-optout", "opted_out", { updatedAt: "2026-11-02T00:00:00.000Z" }),
    workspace("u1", [{ venueKey: "club-booked", name: "The Room", websites: ["https://room.example"], booking: { status: "Confirmed", payToPlay: "tickets" } }, { venueKey: "club-silent", booking: { status: "Email sent" } }]),
    workspace("u2", [{ venueKey: "club-booked", booking: { status: "Played" } }])
  ]);
  const booked = stats.get("club-booked");
  assert.equal(booked.pitches, 2, "follow-ups are not new pitches");
  assert.equal(booked.replies, 1); assert.equal(booked.bookings, 2); assert.equal(booked.tier, "verified");
  assert.equal(booked.medianReplyHours, 12); assert.equal(booked.payToPlay.tickets, 1); assert.equal(booked.name, "The Room");
  assert.equal(stats.get("club-answers").tier, "replied");
  assert.equal(stats.get("club-silent").tier, "found");
  assert.equal(stats.get("club-bounced").tier, "removed");
  assert.equal(stats.get("club-optout").tier, "removed");
  assert.ok(!("bookedBy" in booked), "the stored record never lists which bands booked");
  // A newer reply after a bounce proves the contact works again.
  assert.equal(club.clubTier({ replies: 1, lastReplyAt: "2026-11-05", lastBounceAt: "2026-11-02" }), "replied");
  // Sorting: verified, then replied, then the rest; removed last.
  const order = club.sortByClubTier([{ venueKey: "a", club: { tier: "found" } }, { venueKey: "b", club: { tier: "verified", bookings: 1 } }, { venueKey: "c", club: { tier: "replied" } }, { venueKey: "d", club: { tier: "verified", bookings: 4 } }]).map(venue => venue.venueKey);
  assert.deepEqual(order, ["d", "b", "c", "a"]);
  assert.match(club.clubLabel({ tier: "verified", bookings: 2, replies: 1, pitches: 2, medianReplyHours: 12, payToPlay: { tickets: 1, fee: 0 } }), /^Verified: booked 2 DanzStak bands · usually answers within 12 hours · pay to play reported by 1 band$/);
  // Only public places with a position become records; owner-approved listings are never overwritten.
  assert.equal(club.clubFromPlace({ venueKey: "abc123", name: "No position" }), null);
  const place = club.clubFromPlace({ venueKey: "abc123", name: "Kelly's Olympian", address: "426 SW Washington St", position: [-122.67, 45.52], websites: ["https://kellysolympian.com/"], emails: ["bookings@kellysolympian.com"], phones: ["503-228-3669"], categories: ["Live Music Venue"], sourceName: "DanzStak curated public venue directory" });
  assert.equal(place.website, "https://kellysolympian.com/"); assert.equal(place.email, "bookings@kellysolympian.com");
  const upsert = club.clubUpsert("T", place, "2026-11-16T22:00:00.000Z");
  assert.match(upsert.ConditionExpression, /#status <> :approved/);
  assert.match(upsert.UpdateExpression, /#status = if_not_exists\(#status, :found\)/);
  // CSV for the owner.
  const csv = club.clubCsv([{ venueKey: { S: "abc123" }, tier: { S: "verified" }, name: { S: "Kelly's, \"Olympian\"" }, bookings: { N: "2" } }]);
  assert.match(csv, /^tier,kind,name,locality/); assert.match(csv, /verified,,"Kelly's, ""Olympian"""/);
  // Wiring in the API.
  const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  assert.match(api, /const venues = withClubRecords\(await withVenueFreshness/);
  assert.match(api, /filter\(venue => venue\.club\.tier !== "removed"\)/);
  assert.match(api, /tier IN \(:verified, :replied\)/);
  assert.match(api, /payToPlay: \["tickets", "fee"\]\.includes/);
  assert.match(fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), /withVenueFreshness\(ranked\.slice\(offset, offset \+ 20\)\);\n\s+\/\/[^\n]*\n\s+await saveFoundClubs\(venues\)/, "venue searches save what they find (city sweeps)");
  console.log("Club database checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
