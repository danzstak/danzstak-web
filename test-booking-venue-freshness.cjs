const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

(async () => {
  const server = await import("./infrastructure/auth-api/booking-venue-signals.mjs");
  const browser = require("./assets/booking-freshness.js");
  const { freshness, sortByFreshness, cleanReport, signalUpdate, signalFromItem, validSignalVenueKey } = server;
  const now = Date.parse("2026-11-16T12:00:00Z"), ago = days => new Date(now - days * 86400000).toISOString();

  // Rules
  assert.equal(freshness({}, now).level, "unverified", "No signal is shown honestly as Unverified");
  assert.match(freshness({}, now).label, /^Unverified/);
  assert.equal(freshness({ lastReplyAt: ago(20) }, now).level, "active");
  assert.match(freshness({ lastBookedAt: ago(20) }, now).label, /^Active: booked or played/);
  assert.equal(freshness({ lastDeliveredAt: ago(250) }, now).level, "recent");
  assert.equal(freshness({ lastDeliveredAt: ago(400) }, now).level, "unverified", "Activity older than 12 months is not a live signal");
  assert.equal(freshness({ lastBounceAt: ago(10) }, now).level, "bounced");
  assert.equal(freshness({ lastBounceAt: ago(10), lastReplyAt: ago(5) }, now).level, "active", "A reply after a bounce means a working contact");
  assert.equal(freshness({ lastBounceAt: ago(400) }, now).level, "unverified", "A bounce older than 12 months stops counting");
  const oneReport = freshness({ closedReports: 1, closedReportedAt: ago(3) }, now);
  assert.equal(oneReport.level, "reported_closed"); assert.equal(oneReport.hidden, false, "One report warns, it does not hide");
  const twoReports = freshness({ closedReports: 2, closedReportedAt: ago(3) }, now);
  assert.equal(twoReports.level, "closed"); assert.equal(twoReports.hidden, true, "Two member reports hide the club by default");
  assert.equal(freshness({ closedReports: 3, closedReportedAt: ago(30), lastBookedAt: ago(1) }, now).level, "active", "A show booked after the closed reports wins");
  assert.equal(freshness({ closedReports: 3, closedReportedAt: ago(3), ownerStatus: "open" }, now).level, "unverified", "DanzStak review can clear wrong reports");
  assert.equal(freshness({ ownerStatus: "closed", lastBookedAt: ago(1) }, now).hidden, true, "Owner-confirmed closed is always hidden");
  assert.equal(freshness({ closedReports: 2, closedReportedAt: ago(400) }, now).level, "unverified", "Old closed reports expire");

  // Browser copy matches the server for every case.
  const fixtures = [{}, { lastReplyAt: ago(20) }, { lastBookedAt: ago(20), lastReplyAt: ago(2) }, { lastDeliveredAt: ago(250) }, { lastBounceAt: ago(10) }, { lastBounceAt: ago(10), lastReplyAt: ago(5) }, { closedReports: 1, closedReportedAt: ago(3) }, { closedReports: 2, closedReportedAt: ago(3) }, { closedReports: 3, closedReportedAt: ago(3), ownerStatus: "open" }, { ownerStatus: "closed" }, { closedReports: 2, closedReportedAt: ago(400) }];
  for (const fixture of fixtures) assert.deepEqual(browser.freshness(fixture, now), freshness(fixture, now), JSON.stringify(fixture));
  assert.equal(browser.hidden({ freshness: twoReports }), true);

  // Sorting: proven rooms rise, doubtful sink, otherwise incoming order holds.
  const order = sortByFreshness([
    { name: "a", freshness: { level: "unverified" } }, { name: "b", freshness: { level: "bounced" } }, { name: "c", freshness: { level: "active" } },
    { name: "d", freshness: { level: "unverified" } }, { name: "e", freshness: { level: "recent" } }, { name: "f", freshness: { level: "closed" } }
  ]).map(venue => venue.name).join("");
  assert.equal(order, "ceadbf");

  // Writes only move dates forward and carry no member identity.
  const update = signalUpdate("Tours", "osm-node-123", "reply", ago(0));
  assert.equal(update.Key.userId.S, "BOOKING#VENUE_SIGNAL"); assert.equal(update.ExpressionAttributeNames["#field"], "lastReplyAt");
  assert.match(update.ConditionExpression, /attribute_not_exists\(#field\) OR #field < :at/);
  assert.doesNotMatch(JSON.stringify(update), /artistId|reporterId|recipient|@/i);
  assert.equal(signalUpdate("Tours", "osm-node-123", "made-up", ago(0)), null);
  assert.equal(signalUpdate("Tours", "bad#key", "reply", ago(0)), null);
  assert.equal(validSignalVenueKey("google-ChIJ_abc-123"), true); assert.equal(validSignalVenueKey("a#b"), false);
  assert.deepEqual(signalFromItem({ lastReplyAt: { S: ago(1) }, closedReports: { N: "2" }, reporterId: { S: "x" } }), { lastReplyAt: ago(1), closedReports: 2 }, "Only freshness fields are read back");

  // Report validation
  assert.equal(cleanReport({ kind: "closed", venueKey: "osm-node-123" }).kind, "closed");
  assert.match(cleanReport({ kind: "new_contact", venueKey: "osm-node-123" }).error, /new public booking email/);
  assert.match(cleanReport({ kind: "new_contact", venueKey: "osm-node-123", contactUrl: "http://x.com" }).error, /https/);
  assert.equal(cleanReport({ kind: "new_contact", venueKey: "osm-node-123", contactEmail: "New@Club.com" }).email, "new@club.com");
  assert.match(cleanReport({ kind: "gone", venueKey: "osm-node-123" }).error, /what changed/);

  // Report endpoint inside POST /booking-pipeline: saved venue only, one report per member, closed count shared.
  const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  const helper = source.slice(source.indexOf("const bookingWorkspaceId ="), source.indexOf("async function saveTourPlan(event)"));
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {} class PutItemCommand extends Command {} class QueryCommand extends Command {} class BatchGetItemCommand extends Command {} class UpdateItemCommand extends Command {} class TransactWriteItemsCommand extends Command {}
  const records = new Map(), keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  let authenticated = "member-one";
  const workspace = user => records.set(`${user}|booking-workspace-v1`, { userId: { S: user }, tourId: { S: "booking-workspace-v1" }, plan: { S: JSON.stringify({ venues: [{ name: "The Pit", venueKey: "osm-node-123", booking: { status: "Not contacted" } }] }) }, revision: { S: "r1" } });
  workspace("member-one"); workspace("member-two");
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof QueryCommand) return { Items: [] };
    if (command instanceof BatchGetItemCommand) { const [table, request] = Object.entries(command.input.RequestItems)[0]; return { Responses: { [table]: request.Keys.map(keyOf).filter(key => records.has(key)).map(key => records.get(key)) } }; }
    if (command instanceof TransactWriteItemsCommand) {
      const [put, update] = command.input.TransactItems;
      if (records.has(keyOf(put.Put.Item))) { const error = new Error("cancelled"); error.name = "TransactionCanceledException"; throw error; }
      records.set(keyOf(put.Put.Item), structuredClone(put.Put.Item));
      if (update) { const key = keyOf(update.Update.Key), item = records.get(key) || { ...update.Update.Key }; item.closedReports = { N: String(Number(item.closedReports?.N || 0) + 1) }; item.closedReportedAt = update.Update.ExpressionAttributeValues[":at"]; records.set(key, item); }
      return {};
    }
    throw new Error(`Unexpected ${command.constructor.name}`);
  } };
  const context = vm.createContext({ Buffer, console, randomUUID: () => "rev", toursTable: "Tours", corsHeaders: () => ({}), allowedOrigins: new Set(["https://danzstak.com"]), getAuthenticatedUser: async () => authenticated, parseJsonBody: event => event.body, GetItemCommand, PutItemCommand, QueryCommand, BatchGetItemCommand, UpdateItemCommand, TransactWriteItemsCommand, createHash: require("node:crypto").createHash, db });
  Object.assign(context, await import("./infrastructure/auth-api/booking-pipeline.mjs"), server);
  vm.runInContext(helper, context);
  const report = async body => { const result = await context.bookingWorkspace({ headers: { origin: "https://danzstak.com" }, body: { action: "venue_report", ...body } }, "POST"); return { status: result.statusCode, body: JSON.parse(result.body) }; };
  assert.equal((await report({ kind: "closed", venueKey: "osm-node-999" })).status, 409, "Only a venue on the member's own list can be reported");
  const first = await report({ kind: "closed", venueKey: "osm-node-123" });
  assert.equal(first.status, 201); assert.equal(first.body.freshness.level, "reported_closed");
  const again = await report({ kind: "closed", venueKey: "osm-node-123" });
  assert.equal(again.body.alreadyReported, true); assert.equal(records.get("BOOKING#VENUE_SIGNAL|osm-node-123").closedReports.N, "1", "One member cannot stack reports");
  authenticated = "member-two";
  const second = await report({ kind: "closed", venueKey: "osm-node-123" });
  assert.equal(second.body.freshness.level, "closed"); assert.equal(second.body.freshness.hidden, true);
  const contact = await report({ kind: "new_contact", venueKey: "osm-node-123", contactEmail: "newbooker@pit.example" });
  assert.equal(contact.status, 201);
  const pending = [...records.values()].filter(item => item.userId.S === "BOOKING#VENUE_REPORT");
  assert.equal(pending.length, 3); assert.ok(pending.every(item => item.status.S === "pending"), "Every report waits for owner review");
  assert.doesNotMatch(JSON.stringify(records.get("BOOKING#VENUE_SIGNAL|osm-node-123")), /member-|newbooker/, "The shared signal holds no member identity or contact");
  const read = JSON.parse((await context.bookingWorkspace({ headers: { origin: "https://danzstak.com" } }, "GET")).body);
  assert.equal(read.venues[0].freshness.level, "closed", "The pipeline read shows freshness on saved venues");

  // Wiring
  const billing = fs.readFileSync("infrastructure/auth-api/tour-manager-billing.mjs", "utf8"), inbound = fs.readFileSync("infrastructure/booking-inbound/index.mjs", "utf8");
  assert.match(billing, /venueSignal\(sendResult\.Item\?\.venueKey\?\.S \|\| "", type === "delivery" \? "delivered" : "bounce", at\)/);
  assert.match(billing, /await venueSignal\(item\.venueKey\?\.S \|\| "", "reply", at\)/);
  assert.match(inbound, /SET lastReplyAt = :at/);
  assert.match(source, /venues = await withVenueFreshness\(ranked\.slice/); assert.match(source, /recordVenueSignal\(venue\.venueKey, "booked"\)/);
  const page = fs.readFileSync("booking.html", "utf8"), selections = fs.readFileSync("booking-selections.html", "utf8");
  assert.ok(page.indexOf("booking-freshness.js") < page.indexOf("booking-discovery.js"), "Freshness loads before discovery");
  assert.ok(selections.indexOf("booking-freshness.js") < selections.indexOf("booking-selections.js"));
  assert.match(fs.readFileSync("assets/booking-discovery.js", "utf8"), /Show \$\{closed\.length\} closed club/);
  console.log("Venue freshness checks passed: rules, browser parity, sorting, forward-only shared signals without identity, member reports (one each, owner review), closed hidden at 2 reports, wiring.");
})().catch(error => { console.error(error); process.exit(1); });
