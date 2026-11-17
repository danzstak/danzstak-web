"use strict";
// Owner 2026-11-17: "send out 10 request 7 open and 3 don't after 30 days the user is credited 3 credits."
// Credits come back inside DanzStak (never a Stripe refund), once per unopened first pitch.
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const m = await import("./infrastructure/auth-api/unopened-credit.mjs");
  const club = await import("./infrastructure/auth-api/club-directory.mjs");
  const now = Date.parse("2026-12-20T12:00:00.000Z"), old = "2026-11-10T10:00:00.000Z", fresh = "2026-12-10T10:00:00.000Z";
  const send = (id, extra = {}) => ({ userId: { S: extra.user || "band1" }, tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${id}` }, sendId: { S: id }, venueKey: { S: extra.venue || `venue-${id}` }, venueName: { S: `Club ${id}` }, status: { S: extra.status || "delivered" }, sentAt: { S: extra.sentAt || old }, ...(extra.repliedAt ? { repliedAt: { S: extra.repliedAt } } : {}), ...(extra.restored ? { bounceCreditRestoredAt: { S: old } } : {}), ...(extra.followUpTo ? { followUpTo: { S: "x" } } : {}) });
  const link = (id, opens = 0, extra = {}) => ({ userId: { S: extra.user || "band1" }, tourId: { S: `EPK#OUTREACH#${id}` }, shareId: { S: `share${id}` }, ...(opens ? { openCount: { N: String(opens) }, lastOpenedAt: { S: "2026-11-12T10:00:00.000Z" } } : {}), ...(extra.returned ? { creditReturnedAt: { S: old } } : {}) });
  // The owner's example: 10 pitches, 7 opened, 3 never opened.
  const ten = [];
  for (let i = 0; i < 10; i += 1) ten.push(send(`pitch${i}`), link(`pitch${i}`, i < 7 ? 2 : 0));
  const due = m.unopenedRefunds(ten, now);
  assert.equal(due.length, 3, "10 sent, 7 opened, 3 unopened after 30 days: 3 credits back");
  assert.deepEqual(due.map(item => item.sendId).sort(), ["pitch7", "pitch8", "pitch9"]);
  // Not yet 30 days, replied, bounced-and-refunded, already returned, follow-up, no private link, or still reserving: no refund.
  const none = m.unopenedRefunds([
    send("young", { sentAt: fresh }), link("young"),
    send("answered", { repliedAt: "2026-11-11T10:00:00.000Z" }), link("answered"),
    send("bounced", { status: "bounced", restored: true }), link("bounced"),
    send("done"), link("done", 0, { returned: true }),
    send("follow", { followUpTo: true }), link("follow"),
    send("nolink"),
    send("held", { status: "reserved" }), link("held")
  ], now);
  assert.deepEqual(none, []);
  // The transaction gives back exactly one credit and fails as a whole if the venue opened the link meanwhile.
  const tx = m.unopenedRefundTransaction("Tours", due[0], "2026-12-20T12:00:00.000Z");
  assert.equal(tx.length, 4);
  assert.match(tx[1].Update.ConditionExpression, /attribute_not_exists\(openCount\) OR openCount = :zero/);
  assert.match(tx[2].Update.UpdateExpression, /ADD credits :one, sentEmails :minusOne/);
  assert.equal(tx[3].Put.Item.entryType.S, "email_unopened_restored");
  assert.match(tx[3].Put.Item.description.S, /did not open your EPK within 30 days/);
  assert.match(m.unopenedRefundTransaction("Tours", { ...due[0], status: "provider_accepted" }, "x")[2].Update.UpdateExpression, /reservedCredits :minusOne/);
  const source = fs.readFileSync("infrastructure/auth-api/unopened-credit.mjs", "utf8") + fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8").split("unopenedRefunds(items)")[1].slice(0, 600);
  assert.doesNotMatch(source.split("\n").filter(line => !line.trim().startsWith("//")).join("\n"), /stripe|refunds\.create/i, "unopened credits return inside DanzStak, never through Stripe");

  // Club ranking: an unopened pitch makes the club quiet; 3 in a row take it out of the lists; a later open brings it back.
  const stats = club.clubStats([
    send("q1", { venue: "club-quiet" }), link("q1"),
    send("r1", { venue: "club-gone" }), link("r1"), send("r2", { venue: "club-gone", user: "band2" }), link("r2", 0, { user: "band2" }), send("r3", { venue: "club-gone", user: "band3" }), link("r3", 0, { user: "band3" }),
    send("b1", { venue: "club-back", sentAt: "2026-11-01T10:00:00.000Z" }), link("b1"), send("b2", { venue: "club-back", user: "band2", sentAt: "2026-11-01T10:00:00.000Z" }), link("b2", 0, { user: "band2" }), send("b3", { venue: "club-back", user: "band3" }), link("b3", 1, { user: "band3" }),
    send("o1", { venue: "club-opens" }), link("o1", 3),
    send("y1", { venue: "club-young", sentAt: fresh }), link("y1")
  ], now);
  assert.equal(stats.get("club-quiet").tier, "quiet");
  assert.equal(stats.get("club-gone").tier, "removed");
  assert.equal(stats.get("club-gone").removedReason, "unopened");
  assert.equal(stats.get("club-back").tier, "found", "an open after unopened pitches clears them");
  assert.equal(stats.get("club-opens").opens, 1);
  assert.equal(stats.get("club-young").tier, "found", "under 30 days is not unopened yet");
  const rec = item => club.clubLabel(club.clubRecordFromItem({ venueKey: { S: "k" }, ...item }));
  assert.match(rec({ tier: { S: "removed" }, removedReason: { S: "unopened" } }), /No one opened the last 3 DanzStak pitches/);
  assert.match(rec({ tier: { S: "quiet" } }), /went unopened for 30 days/);
  assert.match(rec({ tier: { S: "found" }, opens: { N: "2" } }), /Opens DanzStak EPKs/);
  const sorted = club.sortByClubTier([{ venueKey: "q", club: { tier: "quiet" } }, { venueKey: "f", club: { tier: "found" } }, { venueKey: "o", club: { tier: "found", opens: 1 } }]);
  assert.deepEqual(sorted.map(v => v.venueKey), ["o", "f", "q"]);
  console.log("unopened-credit tests passed");
})().catch(error => { console.error(error); process.exit(1); });
