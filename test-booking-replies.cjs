"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const { createTourManagerBilling, optOutTokenHash, optOutFooter } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  class Command { constructor(input) { this.input = input; } }
  class GetItemCommand extends Command {}
  class PutItemCommand extends Command {}
  class QueryCommand extends Command {}
  class TransactWriteItemsCommand extends Command {}
  class UpdateItemCommand extends Command {}
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand };
  const records = new Map(), keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const artistId = "artist_12345678", outsiderId = "artist_87654321", outreachId = "outreach_reply_test_123", token = "a".repeat(64), clientMessageId = "client_reply_test_123";
  const tokenItem = { userId: { S: "TOUR_MANAGER#OPT_OUT_TOKEN" }, tourId: { S: optOutTokenHash(token) }, artistId: { S: artistId }, outreachId: { S: outreachId }, venueKey: { S: "b".repeat(20) }, expiresAt: { N: String(Math.floor(Date.parse("2026-11-08T00:00:00Z") / 1000)) } };
  const sendItem = { userId: { S: artistId }, tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${outreachId}` }, venueKey: { S: "b".repeat(20) }, venueName: { S: "Test Venue" }, recipient: { S: "venue@example.com" }, subject: { S: "Booking pitch" }, status: { S: "sent" }, createdAt: { S: "2026-11-07T10:00:00Z" } };
  const workspaceItem = { userId: { S: artistId }, tourId: { S: "booking-workspace-v1" }, revision: { S: "workspace-revision-1" }, plan: { S: JSON.stringify({ venues: [{ venueKey: "b".repeat(20), name: "Test Venue", booking: { status: "Reply received" } }], artist: {}, tour: {} }) } };
  records.set(keyOf(tokenItem), structuredClone(tokenItem)); records.set(keyOf(sendItem), structuredClone(sendItem)); records.set(keyOf(workspaceItem), structuredClone(workspaceItem));
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof QueryCommand) {
      const userId = command.input.ExpressionAttributeValues[":userId"].S, prefix = command.input.ExpressionAttributeValues[":prefix"].S;
      return { Items: [...records.values()].filter(item => item.userId.S === userId && item.tourId.S.startsWith(prefix)) };
    }
    if (command instanceof PutItemCommand) {
      const key = keyOf(command.input.Item), existing = records.get(key);
      if (command.input.ConditionExpression === "revision = :revision") {
        if (existing?.revision?.S !== command.input.ExpressionAttributeValues[":revision"].S) throw new Error("conditional write rejected");
        records.set(key, structuredClone(command.input.Item)); return {};
      }
      if (records.has(key)) throw new Error("conditional write rejected"); records.set(key, structuredClone(command.input.Item)); return {};
    }
    if (command instanceof UpdateItemCommand) {
      const item = records.get(keyOf(command.input.Key)); if (!item) throw new Error("missing update target");
      item.status = command.input.ExpressionAttributeValues[":sent"] || command.input.ExpressionAttributeValues[":review"];
      if (command.input.ExpressionAttributeValues[":sentAt"]) item.sentAt = command.input.ExpressionAttributeValues[":sentAt"];
      if (command.input.ExpressionAttributeValues[":messageId"]) item.providerMessageId = command.input.ExpressionAttributeValues[":messageId"];
      return {};
    }
    if (command instanceof TransactWriteItemsCommand) {
      const put = command.input.TransactItems[0].Put, update = command.input.TransactItems[1].Update, putKey = keyOf(put.Item), existingSend = records.get(keyOf(update.Key));
      if (records.has(putKey) || !existingSend) throw new Error("transaction rejected");
      records.set(putKey, structuredClone(put.Item)); existingSend.status = update.ExpressionAttributeValues[":replied"]; existingSend.repliedAt = update.ExpressionAttributeValues[":at"];
      return {};
    }
    throw new Error(`Unexpected command ${command.constructor.name}`);
  } };
  let authenticated = artistId, sentReply;
  const service = createTourManagerBilling({ db, commands, authenticate: async () => authenticated, corsHeaders: origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {}, tableName: "Tours", env: {}, clock: () => Date.parse("2026-11-07T12:00:00Z"), sendBookingReply: async input => { sentReply = input; return { messageId: "provider-reply-123" }; } });
  const event = (path, body, method = "POST") => ({ rawPath: path, requestContext: { http: { method } }, headers: { origin: "https://danzstak.com" }, body: body === undefined ? "" : JSON.stringify(body) });
  const payload = { token, action: "offer_date", proposedDate: "2027-03-05", content: "We can offer March 5. What is your guarantee?", clientMessageId };
  const accepted = await service(event("/tour-manager/reply", payload));
  assert.equal(accepted.statusCode, 201); assert.equal(JSON.parse(accepted.body).received, true); assert.equal(records.get(keyOf(sendItem)).status.S, "replied");
  const duplicate = await service(event("/tour-manager/reply", payload));
  assert.equal(duplicate.statusCode, 200); assert.equal(JSON.parse(duplicate.body).duplicate, true);
  const invalid = await service(event("/tour-manager/reply", { ...payload, token: "x".repeat(64), clientMessageId: "client_reply_test_456" }));
  assert.equal(invalid.statusCode, 400);
  const oversized = await service(event("/tour-manager/reply", { ...payload, content: "x".repeat(4001), clientMessageId: "client_reply_test_789" }));
  assert.equal(oversized.statusCode, 400);
  const artistPayload = { outreachId, content: "Thanks. March 5 works for us.", clientMessageId: "artist_reply_test_123" };
  const artistReply = await service(event("/tour-manager/outreach/reply", artistPayload));
  assert.equal(artistReply.statusCode, 200); assert.equal(JSON.parse(artistReply.body).status, "sent"); assert.equal(sentReply.to, "venue@example.com"); assert.equal(sentReply.message, artistPayload.content);
  const artistDuplicate = await service(event("/tour-manager/outreach/reply", artistPayload));
  assert.equal(artistDuplicate.statusCode, 200); assert.equal(JSON.parse(artistDuplicate.body).duplicate, true, "The same artist reply must not send twice");
  const useDate = await service(event("/tour-manager/outreach/use-date", { outreachId, replyId: `TOUR_MANAGER#BOOKING_REPLY#${outreachId}#${clientMessageId}` }));
  assert.equal(useDate.statusCode, 200); assert.equal(JSON.parse(useDate.body).proposedDate, "2027-03-05");
  const savedWorkspace = JSON.parse(records.get(`${artistId}|booking-workspace-v1`).plan.S), savedBooking = savedWorkspace.venues[0].booking;
  assert.equal(savedBooking.status, "Date proposed"); assert.equal(savedBooking.showDate, "2027-03-05"); assert.equal(savedBooking.replySummary, payload.content); assert.notEqual(records.get(`${artistId}|booking-workspace-v1`).revision.S, "workspace-revision-1");
  const outreach = await service(event("/tour-manager/outreach", undefined, "GET")), ownerBody = JSON.parse(outreach.body);
  assert.equal(outreach.statusCode, 200); assert.equal(ownerBody.messages.length, 1); assert.equal(ownerBody.replies.length, 2); assert.equal(ownerBody.replies.find(item => item.direction === "inbound").content, payload.content); assert.equal(ownerBody.replies.find(item => item.direction === "outbound").content, artistPayload.content);
  authenticated = outsiderId;
  const outsider = await service(event("/tour-manager/outreach", undefined, "GET")), outsiderBody = JSON.parse(outsider.body);
  assert.equal(outsiderBody.messages.length, 0); assert.equal(outsiderBody.replies.length, 0, "Another artist must not receive this reply");

  const html = fs.readFileSync("booking-reply.html", "utf8"), client = fs.readFileSync("assets/booking-reply.js", "utf8"), sync = fs.readFileSync("assets/booking-sync.js", "utf8"), messages = fs.readFileSync("messages.html", "utf8"), deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8");
  assert.match(html, /You do not need a DanzStak account/); assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(client, /new URLSearchParams\(location\.hash\.slice\(1\)\)/); assert.match(client, /credentials:"omit"/); assert.match(client, /history\.replaceState/);
  assert.match(sync, /tour-manager\/outreach\/reply/); assert.match(sync, /tour-manager\/outreach\/use-date/); assert.match(sync, /Add proposed date to Tour/); assert.match(sync, /Confirm it only after you have written agreement/); assert.match(messages, /data-chat-filter="bookings"/);
  assert.match(deploy, /POST \/tour-manager\/reply/); assert.match(deploy, /POST \/tour-manager\/outreach\/reply/); assert.match(deploy, /POST \/tour-manager\/outreach\/use-date/); assert.match(worker, /danzstak-shell-v702/); assert.match(worker, /booking-reply\.html/);
  assert.match(optOutFooter(token), /booking-reply\.html#token=a{64}/);
  console.log("Booking reply checks passed: secure inbound actions, artist-reviewed outbound email, no duplicate sends, limits, isolation, routes, and PWA assets.");
})().catch(error => { console.error(error); process.exit(1); });
