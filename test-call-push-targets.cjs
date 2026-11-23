"use strict";
// L4 (owner 2026-11-20: "When app is closed it doesn't ring. Only rings when on sync").
// A closed phone rings only through a web push to a subscription linked to a registered calling device
// (call-signaling `callPushTargets`). This runs the real call-signaling Lambda source with an in-memory DynamoDB:
// - a subscription saved right after registration (with this device's headers) is a call push target;
// - a subscription saved before registration is not, until the phone saves it again after registering (push-notifications.js
//   does that on `danzstak:call-device-registered`), and then it is;
// - a revoked device, a device with calls off, or wrong device headers never get a call push;
// - another member's registered device never receives this member's calls.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const lines = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8").split(/\r?\n/);
const start = lines.findIndex(line => line === "        ZipFile: |");
assert.ok(start >= 0, "call-signaling Lambda source must exist");
const source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }

const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
const commands = Object.fromEntries(commandNames.map(name => [name, command(name)]));
const keyNames = { devices: ["userEmail", "deviceId"], push: ["userEmail", "endpointHash"] };
const tables = { devices: new Map(), push: new Map() };
const keyOf = (table, item) => keyNames[table].map(name => item[name].S).join("|");

class DynamoDBClient {
  async send(request) {
    const { input, commandName } = request, table = tables[input.TableName];
    if (!table) throw new Error(`Unexpected table: ${commandName} ${input.TableName}`);
    if (commandName === "PutItemCommand") { table.set(keyOf(input.TableName, input.Item), structuredClone(input.Item)); return {}; }
    if (commandName === "GetItemCommand") { const item = table.get(keyOf(input.TableName, input.Key)); return item ? { Item: structuredClone(item) } : {}; }
    if (commandName === "UpdateItemCommand") return {}; // lastUsedAt bookkeeping only
    if (commandName === "QueryCommand") {
      const user = input.ExpressionAttributeValues[":u"].S;
      return { Items: [...table.values()].filter(item => item.userEmail.S === user).map(item => structuredClone(item)) };
    }
    throw new Error(`Unexpected DynamoDB command: ${commandName} ${input.TableName}`);
  }
}
const unused = name => class { async send() { throw new Error(`${name} must not be used while saving a subscription`); } };
const fakeRequire = id => {
  if (id === "node:crypto" || id === "node:https") return require(id);
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: unused("Cognito"), ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient: unused("KMS"), GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client: unused("S3"), GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "https://example.test/signed" };
  throw new Error(`Unexpected module: ${id}`);
};
const runtime = { env: { CALLING_DEVICES_TABLE: "devices", PUSH_SUBSCRIPTIONS_TABLE: "push", DEVICE_SMS_OTP_REQUIRED: "true", USER_POOL_ID: "pool" } };
const moduleShim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console",
  `${source.join("\n")}\nmodule.exports.__test={savePushSubscription,callPushTargets};`)(fakeRequire, moduleShim, moduleShim.exports, runtime, Buffer, URL, console);
const { savePushSubscription, callPushTargets } = moduleShim.exports.__test;

const me = { email: "phone-owner@example.test", userId: "55555555-5555-4555-8555-555555555555" };
const friend = { email: "friend@example.test", userId: "66666666-6666-4666-8666-666666666666" };
const b64url = bytes => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const subscription = n => ({ endpoint: `https://fcm.googleapis.com/fcm/send/phone-${n}`, keys: { p256dh: b64url(crypto.randomBytes(65)), auth: b64url(crypto.randomBytes(16)) } });
const newDevice = () => ({ deviceId: crypto.randomUUID(), token: b64url(crypto.randomBytes(32)) });
function register(user, device, extra = {}) { // what /calls/devices/register stores after a confirmed SMS code
  tables.devices.set(`${user.email}|${device.deviceId}`, { userEmail: { S: user.email }, deviceId: { S: device.deviceId }, kind: { S: "registered" }, allowCalls: { BOOL: true }, otpVerifiedAt: { S: new Date().toISOString() }, registeredAt: { S: new Date().toISOString() }, tokenHash: { S: crypto.createHash("sha256").update(device.token).digest("hex") }, ...extra });
}
const save = (user, sub, device) => savePushSubscription({ body: JSON.stringify(sub), headers: device ? { "x-danzstak-device-id": device.deviceId, "x-danzstak-device-token": device.token } : {} }, user);
const endpointsFor = async (user, excluded) => (await callPushTargets(user.email, excluded)).map(item => JSON.parse(item.subscription.S).endpoint).sort();

(async () => {
  // 1. Saved right after registration, with this device's headers → linked and a call target.
  const phone = newDevice(); register(me, phone);
  const first = await save(me, subscription(1), phone);
  assert.equal(first.statusCode, 201);
  assert.equal(JSON.parse(first.body).callingDeviceLinked, true, "a registered phone's subscription is linked");
  assert.deepEqual(await endpointsFor(me), [subscription(1).endpoint], "callPushTargets finds the subscription saved right after registration");
  assert.deepEqual(await endpointsFor(me, phone.deviceId), [], "the device that answered is left out of the 'answered elsewhere' push");

  // 2. Saved before registration (no device yet) → not a call target; the same endpoint saved again after registering → linked.
  const laptop = newDevice();
  const before = await save(me, subscription(2), null);
  assert.equal(JSON.parse(before.body).callingDeviceLinked, false);
  assert.deepEqual(await endpointsFor(me), [subscription(1).endpoint], "an unlinked subscription never gets a call push");
  register(me, laptop);
  const after = await save(me, subscription(2), laptop);
  assert.equal(JSON.parse(after.body).callingDeviceLinked, true, "re-saving after registration links the same subscription");
  assert.equal([...tables.push.values()].filter(item => item.userEmail.S === me.email).length, 2, "the re-save replaces the old row, no duplicate");
  assert.deepEqual(await endpointsFor(me), [subscription(1).endpoint, subscription(2).endpoint].sort());

  // 3. Wrong token, revoked device, calls off, no SMS code → never a call target.
  const stranger = newDevice(); register(me, stranger);
  const wrong = await save(me, subscription(3), { deviceId: stranger.deviceId, token: b64url(crypto.randomBytes(32)) });
  assert.equal(JSON.parse(wrong.body).callingDeviceLinked, false, "wrong device token is not linked");
  const revoked = newDevice(); register(me, revoked, { revokedAt: { S: new Date().toISOString() } });
  assert.equal(JSON.parse((await save(me, subscription(4), revoked)).body).callingDeviceLinked, false, "a revoked device is not linked");
  const noOtp = newDevice(); register(me, noOtp); delete tables.devices.get(`${me.email}|${noOtp.deviceId}`).otpVerifiedAt;
  assert.equal(JSON.parse((await save(me, subscription(5), noOtp)).body).callingDeviceLinked, false, "a device without an SMS code is not linked");
  const quiet = newDevice(); register(me, quiet);
  assert.equal(JSON.parse((await save(me, subscription(6), quiet)).body).callingDeviceLinked, true, "calls-off devices still link (they can turn calls back on)");
  tables.devices.get(`${me.email}|${quiet.deviceId}`).allowCalls = { BOOL: false };
  assert.deepEqual(await endpointsFor(me), [subscription(1).endpoint, subscription(2).endpoint].sort(), "calls-off, revoked, unverified and wrong-token devices never ring");

  // 4. Another member's registered device never receives my calls, even with the same endpoint.
  const theirs = newDevice(); register(friend, theirs);
  await save(friend, subscription(7), theirs);
  assert.deepEqual(await endpointsFor(friend), [subscription(7).endpoint]);
  assert.ok(!(await endpointsFor(me)).includes(subscription(7).endpoint), "one member's subscription is never another member's call target");

  // 5. The browser side re-saves the subscription the moment this device registers (step 2 above depends on it).
  const push = fs.readFileSync("assets/push-notifications.js", "utf8");
  assert.match(push, /addEventListener\("danzstak:call-device-registered", \(\) => renewExistingSubscription\(\{ force: true \}\)\)/);
  assert.match(push, /headers: \{ "Content-Type": "application\/json", \.\.\.\(await globalThis\.danzstakCallingDeviceHeaders\?\.\(\)\)/, "/push/subscribe carries this device's headers");
  console.log("Call push target checks passed: a subscription saved after registration rings when SYNC is closed; unlinked, revoked, unverified and calls-off devices never do.");
})().catch(error => { console.error(error); process.exitCode = 1; });
