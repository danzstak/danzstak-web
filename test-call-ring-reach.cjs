"use strict";
// Owner 2026-11-24: "trying to get sync to ring the user from an off line app", "if the app is close it should still ring".
// A closed SYNC rings only through a call push to a subscription tied to one of the other person's registered devices. The
// last test call went to a phone that was registered for calls but had no subscription at all, so nothing could ring it,
// and the caller had no way to know. Now a call offer answers whether the push service took a call push for that person:
// ringing:true → the caller's screen says "Ringing…"; ringing:false → "{name}'s phone can't ring while SYNC is closed."
//
// This runs the real call-signaling send() (and notifyCall, callPushTargets, deliverPush with real Web Push encryption and
// VAPID signing) against in-memory DynamoDB, KMS and a stand-in push service:
//   1. the other person's registered phone has a linked subscription and the push service takes it → ringing:true;
//   2. registered phone, no subscription at all (the owner's test call) → ringing:false, nothing sent;
//   3. call alerts turned off → ringing:false, nothing sent;
//   4. the push service refuses the push (410, subscription gone) → ringing:false, and the dead subscription is deleted;
//   5. hangups and text signals carry no "ringing".
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const lines = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8").split(/\r?\n/);
const start = lines.findIndex(line => line === "        ZipFile: |");
const source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }

// --- In-memory DynamoDB ---
const tables = {};
const table = name => tables[name] || (tables[name] = []);
const clone = value => JSON.parse(JSON.stringify(value));
const matches = (item, key) => Object.entries(key).every(([name, value]) => item[name]?.S === value.S);
const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
class DynamoDBClient {
  async send(request) {
    const input = request.input, rows = table(input.TableName);
    switch (request.commandName) {
      case "GetItemCommand": { const item = rows.find(row => matches(row, input.Key)); return item ? { Item: clone(item) } : {}; }
      case "PutItemCommand": rows.push(clone(input.Item)); return {};
      case "DeleteItemCommand": { const index = rows.findIndex(row => matches(row, input.Key)); if (index >= 0) rows.splice(index, 1); return {}; }
      case "QueryCommand": {
        const [name] = input.KeyConditionExpression.split("=").map(part => part.trim()), value = Object.values(input.ExpressionAttributeValues)[0].S;
        return { Items: rows.filter(row => row[name]?.S === value).map(clone) };
      }
      case "UpdateItemCommand": return {};
      default: throw new Error(`Unexpected DynamoDB command: ${request.commandName}`);
    }
  }
}
// --- KMS with a real P-256 key, so VAPID signing runs for real ---
const vapid = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
class KMSClient {
  async send(request) {
    if (request.commandName === "GetPublicKeyCommand") return { PublicKey: vapid.publicKey.export({ type: "spki", format: "der" }) };
    if (request.commandName === "SignCommand") return { Signature: crypto.sign("sha256", request.input.Message, vapid.privateKey) };
    throw new Error("unexpected KMS call");
  }
}
// --- The push service: answers each Web Push with pushStatus ---
let pushStatus = 201;
const pushes = [];
const https = {
  request(url, options, callback) {
    const req = { setTimeout() {}, on() { return req; }, destroy() {}, end(body) { pushes.push({ url: String(url), headers: options.headers, bytes: body.length }); setImmediate(() => callback({ statusCode: pushStatus, resume() {} })); } };
    return req;
  }
};
class Cognito { async send(request) { if (request.commandName === "ListUsersCommand") return { Users: [{ Username: "x", Attributes: [] }] }; throw new Error("unexpected Cognito call"); } }
class Unused { async send() { throw new Error("not used by a call offer"); } }
const fakeRequire = id => {
  if (id === "node:crypto") return require(id);
  if (id === "node:https") return https;
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...Object.fromEntries(commandNames.map(n => [n, command(n)])) };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: Cognito, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client: Unused, GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "" };
  throw new Error(`Unexpected module: ${id}`);
};
const env = { CALLING_DEVICES_TABLE: "devices", PUSH_SUBSCRIPTIONS_TABLE: "push", CALLS_TABLE: "calls", FRIENDS_TABLE: "friends", GROUPS_TABLE: "groups", SETTINGS_TABLE: "settings", USER_POOL_ID: "pool", DEVICE_SMS_OTP_REQUIRED: "true", VAPID_KEY_ID: "vapid" };
const shim = { exports: {} };
const quiet = { ...console, error() {} }; // deliverPush logs a refused push; the test checks the outcome instead
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={send};`)(fakeRequire, shim, shim.exports, { env }, Buffer, URL, quiet);
const { send } = shim.exports.__test;

// --- Fixtures ---
const caller = { email: "caller@danzstak.test", userId: "11111111-1111-4111-8111-111111111111" };
const dee = "dee@danzstak.test";
const callerDevice = "33333333-3333-4333-8333-333333333333", callerToken = "C".repeat(43), deeDevice = "55555555-5555-4555-8555-555555555555";
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const device = (email, id, token) => ({ userEmail: { S: email }, deviceId: { S: id }, kind: { S: "registered" }, allowCalls: { BOOL: true }, tokenHash: { S: hash(token) }, otpVerifiedAt: { S: new Date().toISOString() }, lastUsedAt: { S: new Date().toISOString() } });
table("devices").push(device(caller.email, callerDevice, callerToken), device(dee, deeDevice, "D".repeat(43)));
table("friends").push({ userEmail: { S: caller.email }, friendEmail: { S: dee }, status: { S: "friends" } }, { userEmail: { S: dee }, friendEmail: { S: caller.email }, status: { S: "friends" } });
table("settings").push({ userEmail: { S: caller.email }, profileName: { S: "Night Shift" } });
const b64url = bytes => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const phoneKeys = crypto.createECDH("prime256v1"); phoneKeys.generateKeys();
const deesPhone = { userEmail: { S: dee }, endpointHash: { S: hash("https://fcm.googleapis.com/fcm/send/dee") }, deviceId: { S: deeDevice }, subscription: { S: JSON.stringify({ endpoint: "https://fcm.googleapis.com/fcm/send/dee", keys: { p256dh: b64url(phoneKeys.getPublicKey()), auth: b64url(crypto.randomBytes(16)) } }) } };
const proof = { "x-danzstak-device-id": callerDevice, "x-danzstak-device-token": callerToken, origin: "https://danzstak.com" };
const offer = async (signalType = "offer", mode = "phone") => {
  const response = await send({ headers: proof, body: JSON.stringify({ recipientEmail: dee, callId: crypto.randomUUID(), mode, signalType, payload: { type: "offer", sdp: "v=0" } }) }, caller);
  return { status: response.statusCode, body: JSON.parse(response.body) };
};

(async () => {
  // 1. Dee's registered phone has a linked subscription and the push service takes it.
  table("push").push(clone(deesPhone));
  let result = await offer();
  assert.equal(result.status, 202, JSON.stringify(result.body));
  assert.equal(result.body.ringing, true, "the caller hears that Dee's phone is ringing");
  assert.equal(pushes.length, 1, "one call push went to Dee's phone");
  assert.equal(pushes[0].url, "https://fcm.googleapis.com/fcm/send/dee");
  assert.match(pushes[0].headers.Authorization, /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/, "the push is signed with the VAPID key");

  // 2. The owner's test call: Dee's phone is registered but never subscribed to notifications.
  tables.push = [];
  pushes.length = 0;
  result = await offer("offer", "video");
  assert.equal(result.status, 202);
  assert.equal(result.body.ringing, false, "with no subscription the caller is told Dee's phone can't ring with SYNC closed");
  assert.equal(pushes.length, 0, "nothing to send");

  // 3. Dee turned call alerts off.
  table("push").push(clone(deesPhone));
  table("settings").push({ userEmail: { S: dee }, callAlerts: { BOOL: false } });
  result = await offer();
  assert.equal(result.body.ringing, false, "call alerts off: can't ring with SYNC closed");
  assert.equal(pushes.length, 0, "no push while call alerts are off");
  tables.settings = tables.settings.filter(row => row.userEmail.S !== dee);

  // 4. The push service refuses it (the subscription is gone).
  pushStatus = 410;
  result = await offer();
  assert.equal(result.body.ringing, false, "a refused push doesn't count as ringing");
  assert.equal(pushes.length, 1, "the push was tried");
  assert.equal(table("push").length, 0, "the dead subscription is deleted");
  pushStatus = 201;

  // 5. Only call offers say whether the phone rang.
  table("push").push(clone(deesPhone));
  result = await offer("hangup");
  assert.equal(result.status, 202);
  assert.equal("ringing" in result.body, false, "a hangup carries no ringing");
  result = await offer("offer", "text");
  assert.equal("ringing" in result.body, false, "a text signal carries no ringing");

  console.log("Call ring reach checks passed: an offer says ringing:true when the push service took a call push for a registered, linked phone, and ringing:false with no subscription, call alerts off or a refused push; other signals carry no ringing.");
})().catch(error => { console.error(error); process.exitCode = 1; });
