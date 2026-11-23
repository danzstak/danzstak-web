"use strict";
// Owner 2026-11-16: "can you see the replies and notify users that so and so contacted them about a gig".
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const { bookingReplyNotice } = await import("./infrastructure/auth-api/booking-reply-notice.mjs");
  const notice = bookingReplyNotice({ tableName: "N", artistEmail: "Band@Example.com", outreachId: "o".repeat(20), dedupe: "abcdef1234", venueName: "Kelly's Olympian", action: "offer_date", preview: "We can do Friday Jan 15,\n 8pm", proposedDate: "2027-01-15", at: "2026-11-17T09:00:00.000Z" });
  assert.equal(notice.Item.userEmail.S, "band@example.com");
  assert.equal(notice.Item.type.S, "booking_reply");
  assert.equal(notice.Item.eventId.S, `booking_reply#${"o".repeat(20)}#abcdef1234`);
  assert.equal(notice.Item.verb.S, "offered you a date"); assert.equal(notice.Item.proposedDate.S, "2027-01-15");
  assert.equal(notice.Item.preview.S, "We can do Friday Jan 15, 8pm");
  assert.equal(notice.ConditionExpression, "attribute_not_exists(eventId)", "a retried reply never doubles the bell");
  assert.equal(bookingReplyNotice({ tableName: "N", artistEmail: "", outreachId: "o".repeat(20), dedupe: "abcdef1234" }), null, "no account email, no notice");
  assert.equal(bookingReplyNotice({ tableName: "N", artistEmail: "a@b.co", outreachId: "bad id", dedupe: "abcdef1234" }), null);
  // The email-reply Lambda ships an identical copy (separate deployment bundle).
  const strip = text => text.split("\n").filter(line => !line.startsWith("// One bell notification")).join("\n");
  assert.equal(strip(fs.readFileSync("infrastructure/booking-inbound/notice.mjs", "utf8")), strip(fs.readFileSync("infrastructure/auth-api/booking-reply-notice.mjs", "utf8")));
  const billing = fs.readFileSync("infrastructure/auth-api/tour-manager-billing.mjs", "utf8"), api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), inbound = fs.readFileSync("infrastructure/booking-inbound/index.mjs", "utf8");
  assert.match(billing, /\.\.\.\(artistEmail \? \{ artistEmail: \{ S: artistEmail \} \} : \{\}\), status: \{ S: "reserved" \}/, "the send record keeps the artist's account email for the email-reply notice");
  assert.match(billing, /await notifyBookingReply\(\{ artistId: item\.artistId\.S, outreachId: item\.outreachId\.S, dedupe: clientMessageId/);
  assert.match(api, /notifyBookingReply: async/); assert.match(api, /item\.type\.S === "booking_reply" \? \{ name: item\.venueName/);
  assert.match(inbound, /bookingReplyNotice\(\{ tableName: noticeTable, artistEmail: source\.artistEmail\?\.S/);
  const feed = fs.readFileSync("assets/feed-enhancements.js", "utf8");
  assert.match(feed, /messages\.html\?section=bookings&outreach=\$\{encodeURIComponent\(notice\.outreachId\)\}/);
  const deploy = fs.readFileSync("aws-configure-booking-replies.ps1", "utf8");
  assert.match(deploy, /\(Join-Path \$Source "notice\.mjs"\)/); assert.match(deploy, /table\/DANZSTAK-EngagementNotifications/);
  // EPK opened (owner 2026-11-17): once per venue link per day, never for the artist's own opens.
  const opened = bookingReplyNotice({ tableName: "N", artistEmail: "a@b.co", outreachId: "o".repeat(20), dedupe: "open-20261117", venueName: "Club X", action: "opened" });
  assert.equal(opened.Item.verb.S, "opened your EPK");
  assert.equal(opened.Item.eventId.S, `booking_reply#${"o".repeat(20)}#open-20261117`);
  const indexSource = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  assert.match(indexSource, /dedupe: `open-\$\{openedAt\.slice\(0, 10\)\.replace\(\/-\/g, ""\)\}`/, "one EPK-open notice per link per day");
  assert.match(indexSource, /await getAuthenticatedUser\(event\)\.catch\(\(\) => ""\) !== ownerId/, "the artist's own opens don't notify");
  assert.match(fs.readFileSync("assets/i18n.js", "utf8"), /"opened your EPK"\];/);
  console.log("Booking reply notice checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
