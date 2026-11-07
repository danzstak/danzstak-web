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
  const sendItem = { userId: { S: artistId }, tourId: { S: `TOUR_MANAGER#EMAIL_SEND#${outreachId}` }, venueKey: { S: "b".repeat(20) }, venueName: { S: "Test Venue" }, subject: { S: "Booking pitch" }, status: { S: "sent" }, createdAt: { S: "2026-11-07T10:00:00Z" } };
  records.set(keyOf(tokenItem), structuredClone(tokenItem)); records.set(keyOf(sendItem), structuredClone(sendItem));
  const db = { async send(command) {
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof QueryCommand) {
      const userId = command.input.ExpressionAttributeValues[":userId"].S, prefix = command.input.ExpressionAttributeValues[":prefix"].S;
      return { Items: [...records.values()].filter(item => item.userId.S === userId && item.tourId.S.startsWith(prefix)) };
    }
    if (command instanceof TransactWriteItemsCommand) {
      const put = command.input.TransactItems[0].Put, update = command.input.TransactItems[1].Update, putKey = keyOf(put.Item), existingSend = records.get(keyOf(update.Key));
      if (records.has(putKey) || !existingSend) throw new Error("transaction rejected");
      records.set(putKey, structuredClone(put.Item)); existingSend.status = update.ExpressionAttributeValues[":replied"]; existingSend.repliedAt = update.ExpressionAttributeValues[":at"];
      return {};
    }
    throw new Error(`Unexpected command ${command.constructor.name}`);
  } };
  let authenticated = artistId;
  const service = createTourManagerBilling({ db, commands, authenticate: async () => authenticated, corsHeaders: origin => origin === "https://danzstak.com" ? { "access-control-allow-origin": origin } : {}, tableName: "Tours", env: {}, clock: () => Date.parse("2026-11-07T12:00:00Z") });
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
  const outreach = await service(event("/tour-manager/outreach", undefined, "GET")), ownerBody = JSON.parse(outreach.body);
  assert.equal(outreach.statusCode, 200); assert.equal(ownerBody.messages.length, 1); assert.equal(ownerBody.replies.length, 1); assert.equal(ownerBody.replies[0].content, payload.content);
  authenticated = outsiderId;
  const outsider = await service(event("/tour-manager/outreach", undefined, "GET")), outsiderBody = JSON.parse(outsider.body);
  assert.equal(outsiderBody.messages.length, 0); assert.equal(outsiderBody.replies.length, 0, "Another artist must not receive this reply");

  const html = fs.readFileSync("booking-reply.html", "utf8"), client = fs.readFileSync("assets/booking-reply.js", "utf8"), sync = fs.readFileSync("assets/booking-sync.js", "utf8"), messages = fs.readFileSync("messages.html", "utf8"), deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8");
  assert.match(html, /You do not need a DanzStak account/); assert.match(html, /noindex,nofollow,noarchive/);
  assert.match(client, /new URLSearchParams\(location\.hash\.slice\(1\)\)/); assert.match(client, /credentials:"omit"/); assert.match(client, /history\.replaceState/);
  assert.match(sync, /credentials: "include"/); assert.match(sync, /sending email from SYNC is not enabled yet/); assert.match(messages, /data-chat-filter="bookings"/);
  assert.match(deploy, /POST \/tour-manager\/reply/); assert.match(worker, /danzstak-shell-v700/); assert.match(worker, /booking-reply\.html/);
  assert.match(optOutFooter(token), /booking-reply\.html#token=a{64}/);
  console.log("Booking reply checks passed: scoped token, idempotency, limits, owner isolation, accountless client, SYNC boundary, route, and PWA assets.");
})().catch(error => { console.error(error); process.exit(1); });
