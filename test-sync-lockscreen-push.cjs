"use strict";
// Task 16-F lock-screen push. Runs the real call-signaling Lambda source against a fake DynamoDB:
// - POST /calls/decline (the lock-screen Decline): consumes the caller's offer, tells the caller (hangup), needs no calling
//   device, refuses calls that already ended, and only touches the signed-in member's own offers.
// - Booking replies / "venue opened your EPK" in the activity push outbox: pushed only when the matching notice is in the
//   recipient's own bell (their own booking thread), suppressed when message alerts are off or the notice doesn't match.
// - auth-api and booking-inbound write the bell notice and the outbox row together; the service worker shows Accept/Decline.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const lines = template.split(/\r?\n/);
const start = lines.findIndex(line => line === "        ZipFile: |");
const source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }

const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
const commands = Object.fromEntries(commandNames.map(name => [name, command(name)]));
const CALL = "33333333-3333-4333-8333-333333333333", OUTREACH = "outreach_ABCDEFGHIJKLMNOP";
const state = { offers: [], writes: [], deletes: [], outbox: {}, notices: {}, settings: {}, pushTargets: [] };
const now = () => Math.floor(Date.now() / 1000);

class DynamoDBClient {
  async send(request) {
    const input = request.input, name = request.commandName, table = input.TableName;
    if (name === "QueryCommand" && table === "calls") {
      const values = input.ExpressionAttributeValues;
      return { Items: state.offers.filter(item => item.recipientEmail.S === values[":r"].S && item.callId.S === values[":c"]?.S && item.signalType.S === "offer" && Number(item.expiresAt.N) > Number(values[":n"].N)) };
    }
    if (name === "QueryCommand" && table === "push") return { Items: state.pushTargets };
    if (name === "QueryCommand" && table === "devices") return { Items: [] };
    if (name === "DeleteItemCommand" && table === "calls") {
      const index = state.offers.findIndex(item => item.recipientEmail.S === input.Key.recipientEmail.S && item.eventId.S === input.Key.eventId.S);
      if (index < 0) { const error = new Error("gone"); error.name = "ConditionalCheckFailedException"; throw error; }
      state.deletes.push(state.offers.splice(index, 1)[0]); return {};
    }
    if (name === "PutItemCommand" && table === "calls") { state.writes.push(input.Item); return {}; }
    if (name === "GetItemCommand" && table === "outbox") return { Item: state.outbox[input.Key.eventId.S] };
    if (name === "GetItemCommand" && table === "notices") return { Item: state.notices[`${input.Key.userEmail.S}|${input.Key.eventId.S}`] };
    if (name === "GetItemCommand" && table === "settings") return { Item: state.settings[input.Key.userEmail.S] };
    if (name === "UpdateItemCommand" && table === "outbox") { const item = state.outbox[input.Key.eventId.S]; if (item) item.status = { S: input.ExpressionAttributeValues[":status"]?.S || item.status.S }; return {}; }
    throw new Error(`Unexpected DynamoDB command: ${name} ${table || ""}`);
  }
}
class CognitoIdentityProviderClient { async send() { return { Users: [] }; } }
class KMSClient { async send() { throw new Error("no KMS in this test"); } }
class S3Client { async send() { throw new Error("no S3 in this test"); } }
const fakeRequire = id => {
  if (id === "node:crypto" || id === "node:https") return require(id);
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client, GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "https://example.test/signed" };
  throw new Error(`Unexpected module: ${id}`);
};
const runtime = { env: { CALLING_DEVICES_TABLE: "devices", PUSH_SUBSCRIPTIONS_TABLE: "push", FRIENDS_TABLE: "friends", CALLS_TABLE: "calls", USER_POOL_ID: "pool", ACTIVITY_PUSH_OUTBOX_TABLE: "outbox", ENGAGEMENT_NOTIFICATIONS_TABLE: "notices", SETTINGS_TABLE: "settings" } };
const moduleShim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={declineFromNotification,processActivityPush,localizedPush};`)(fakeRequire, moduleShim, moduleShim.exports, runtime, Buffer, URL, { ...console, error() {} });
const { declineFromNotification, processActivityPush, localizedPush } = moduleShim.exports.__test;

const callee = { email: "callee@example.test", userId: "55555555-5555-4555-8555-555555555555" };
const offer = (recipient, callId = CALL) => ({ recipientEmail: { S: recipient }, eventId: { S: `${Date.now()}#44444444-4444-4444-8444-444444444444` }, senderEmail: { S: "caller@example.test" }, callId: { S: callId }, mode: { S: "video" }, signalType: { S: "offer" }, expiresAt: { N: String(now() + 60) } });

(async () => {
  // Decline: no device headers at all, cookie user only.
  state.offers.push(offer(callee.email));
  const declined = await declineFromNotification({ headers: {}, body: JSON.stringify({ callId: CALL }) }, callee);
  assert.equal(declined.statusCode, 202, "lock-screen Decline works without a calling device");
  assert.equal(state.deletes.length, 1, "the offer is consumed so other devices stop ringing");
  const hangup = state.writes.at(-1);
  assert.equal(hangup.recipientEmail.S, "caller@example.test", "the caller is told");
  assert.equal(hangup.signalType.S, "hangup");
  assert.equal(hangup.senderEmail.S, callee.email);
  assert.equal(hangup.callId.S, CALL);
  assert.equal(hangup.mode.S, "video");
  const again = await declineFromNotification({ headers: {}, body: JSON.stringify({ callId: CALL }) }, callee);
  assert.equal(again.statusCode, 404, "a call that already ended can't be declined twice");
  assert.equal(JSON.parse(again.body).code, "CALL_GONE");
  state.offers.push(offer("someone-else@example.test"));
  const notMine = await declineFromNotification({ headers: {}, body: JSON.stringify({ callId: CALL }) }, callee);
  assert.equal(notMine.statusCode, 404, "a member can only decline calls ringing for them");
  assert.equal(state.offers.length, 1, "another member's offer is untouched");
  assert.equal((await declineFromNotification({ headers: {}, body: JSON.stringify({ callId: "nope" }) }, callee)).statusCode, 400);

  // Booking push: the notice must be in the recipient's own bell and match the outreach.
  const artist = "artist@example.test", eventId = `booking_reply#${OUTREACH}#open-20261117`;
  const outboxRow = () => ({ eventId: { S: eventId }, recipientEmail: { S: artist }, type: { S: "booking_reply" }, outreachId: { S: OUTREACH }, status: { S: "pending" } });
  state.settings[artist] = { language: { S: "it" } };
  state.outbox[eventId] = outboxRow();
  assert.equal(await processActivityPush(eventId), true);
  assert.equal(state.outbox[eventId].status.S, "suppressed", "no matching bell notice → no push");
  state.notices[`${artist}|${eventId}`] = { type: { S: "booking_reply" }, outreachId: { S: "outreach_SOMETHINGELSE0000" }, venueName: { S: "Club Lux" }, bookingAction: { S: "opened" } };
  state.outbox[eventId] = outboxRow();
  await processActivityPush(eventId);
  assert.equal(state.outbox[eventId].status.S, "suppressed", "a notice for another thread doesn't unlock a push");
  state.notices[`${artist}|${eventId}`].outreachId = { S: OUTREACH };
  state.settings[artist] = { language: { S: "it" }, messageAlerts: { BOOL: false } };
  state.outbox[eventId] = outboxRow();
  await processActivityPush(eventId);
  assert.equal(state.outbox[eventId].status.S, "suppressed", "message alerts off → no booking push");
  state.settings[artist] = { language: { S: "it" } };
  state.outbox[eventId] = outboxRow();
  await processActivityPush(eventId);
  assert.equal(state.outbox[eventId].status.S, "no_subscription", "a matching notice reaches delivery (no subscription in this test)");

  // Payload shape (static: delivery itself needs a real push service).
  const src = source.join("\n");
  assert.match(src, /payload=\{type:'booking',title:`\$\{venue\} \$\{words\[action\]\}`\.slice\(0,80\),body:String\(\(!syncPrefs\?\.hidePreviews&&notice\.preview\?\.S\)\|\|words\.body\)\.slice\(0,160\),silent:inQuietHours\(syncPrefs,'message'\),tag:`booking-\$\{outreachId\}`,url:`\/messages\.html\?section=bookings&outreach=\$\{encodeURIComponent\(outreachId\)\}`\}/);
  assert.match(src, /if\(item\.type\?\.S==='booking_reply'\)return processBookingPush\(eventId,item\);/);
  assert.match(template, /DeclineRoute: \{Type: AWS::ApiGatewayV2::Route, Properties: \{ApiId: !Ref ApiId, RouteKey: POST \/calls\/decline,/);
  assert.match(src, /if\(key==='POST \/calls\/decline'\)return await declineFromNotification\(event,user\);/);
  const it = localizedPush("it", "call", "SFScoop", "video");
  assert.equal(it.answerTitle, "Accetta"); assert.equal(it.declineTitle, "Rifiuta");
  assert.equal(localizedPush("ko", "call", "x").declineTitle.length > 0, true, "other languages fall back to their Dismiss label");

  // Writers: bell notice + outbox row together, in both copies of notice.mjs.
  for (const file of ["infrastructure/auth-api/booking-reply-notice.mjs", "infrastructure/booking-inbound/notice.mjs"]) {
    const { bookingReplyNotice, bookingNoticeWrites } = await import("./" + file);
    const notice = bookingReplyNotice({ tableName: "notices", artistEmail: artist, outreachId: OUTREACH, dedupe: "open-20261117", venueName: "Club Lux", action: "opened", at: "2026-11-17T20:00:00.000Z" });
    const writes = bookingNoticeWrites(notice, "outbox");
    assert.equal(writes.length, 2, `${file}: bell + outbox`);
    assert.equal(writes[1].Put.Item.eventId.S, notice.Item.eventId.S, "the outbox row points at the bell notice");
    assert.equal(writes[1].Put.Item.recipientEmail.S, artist);
    assert.equal(writes[1].Put.Item.type.S, "booking_reply");
    assert.equal(writes[1].Put.Item.outreachId.S, OUTREACH);
    assert.equal(bookingNoticeWrites(notice, "").length, 1, "no outbox table → bell only");
  }
  const auth = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), inbound = fs.readFileSync("infrastructure/booking-inbound/index.mjs", "utf8");
  assert.equal((auth.match(/TransactItems: bookingNoticeWrites\(notice, activityPushOutboxTable\)/g) || []).length, 2, "auth-api: venue reply page and EPK open both push");
  assert.match(inbound, /TransactItems: bookingNoticeWrites\(notice, outboxTable\)/, "email replies push too");

  // Service worker: Accept / Decline, Decline calls the server without opening the app.
  const worker = fs.readFileSync("service-worker.js", "utf8");
  assert.match(worker, /\{ action: "decline", title: String\(payload\.declineTitle \|\| payload\.dismissTitle \|\| "Decline"\)/);
  assert.match(worker, /if \(event\.action === "decline"\) \{ if \(event\.notification\.data\?\.type === "call"\) event\.waitUntil\(declineCallFromNotification/);
  assert.match(worker, /fetch\("https:\/\/api\.danzstak\.com\/calls\/decline", \{ method: "POST", credentials: "include"/);
  assert.match(worker, /client\.postMessage\(\{ type: "DANZSTAK_CALL_RESOLVED", callId \}\)/, "open SYNC windows stop ringing");
  console.log("Lock-screen push checks passed: Decline without opening the app (own offers only, caller told, ended calls refused), booking/EPK-open push only for the artist's own thread, Accept/Decline labels, writers and service worker wired.");
})().catch(error => { console.error(error); process.exitCode = 1; });
