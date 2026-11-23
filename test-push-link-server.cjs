"use strict";
// L4 (owner 2026-11-20: "When app is closed it doesn't ring. Only rings when on sync"). A closed phone rings only through a
// web push, and call-signaling sends a call push only to subscriptions linked to a registered calling device
// (callPushTargets). The live table showed 7 subscriptions, only 2 linked. One way a link got lost: /push/subscribe saved
// the row with PutItem, so a re-save without this device's proof (its device check failed at start-up, offline or during a
// session refresh) replaced a linked row with an unlinked one, and the phone went silent with SYNC closed.
//
// This runs the real call-signaling code (savePushSubscription and callPushTargets) against an in-memory DynamoDB:
//   1. a subscription saved right after the device registers, with its proof, is a call push target;
//   2. a later re-save of the same subscription without the proof keeps it linked (and says so);
//   3. a save with another device's wrong token never links;
//   4. a revoked or calls-off device stops getting call pushes, and a revoked device's link isn't reported as linked;
//   5. another account's subscriptions are never targets.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const lines = template.split(/\r?\n/);
const start = lines.findIndex(line => line === "        ZipFile: |");
assert.ok(start >= 0, "call-signaling Lambda source must exist");
const source = [];
for (const line of lines.slice(start + 1)) {
  if (!line.startsWith("          ")) break;
  source.push(line.slice(10));
}

// --- In-memory DynamoDB (just the calls these two functions make) ---
const tables = { push: new Map(), devices: new Map() };
const keyOf = (table, key) => table === "push" ? `${key.userEmail.S}|${key.endpointHash.S}` : `${key.userEmail.S}|${key.deviceId.S}`;
const clone = value => JSON.parse(JSON.stringify(value));
const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
const commands = Object.fromEntries(commandNames.map(name => [name, command(name)]));
const puts = [];
class DynamoDBClient {
  async send(request) {
    const { commandName } = request, input = request.input, table = tables[input.TableName];
    if (!table) throw new Error(`Unexpected table ${input.TableName}`);
    if (commandName === "GetItemCommand") { const item = table.get(keyOf(input.TableName, input.Key)); return item ? { Item: clone(item) } : {}; }
    if (commandName === "PutItemCommand") { puts.push(input.TableName); table.set(keyOf(input.TableName, input.Item), clone(input.Item)); return {}; }
    if (commandName === "DeleteItemCommand") { table.delete(keyOf(input.TableName, input.Key)); return {}; }
    if (commandName === "QueryCommand") {
      assert.equal(input.KeyConditionExpression, "userEmail = :u");
      const user = input.ExpressionAttributeValues[":u"].S;
      return { Items: [...table.values()].filter(item => item.userEmail.S === user).map(clone) };
    }
    if (commandName === "UpdateItemCommand") {
      const id = keyOf(input.TableName, input.Key), item = table.get(id) || clone(input.Key);
      const set = input.UpdateExpression.match(/^SET (.+)$/);
      assert.ok(set, `only SET updates are expected: ${input.UpdateExpression}`);
      for (const part of set[1].split(",")) {
        const [name, value] = part.split("=").map(text => text.trim());
        item[name] = clone(input.ExpressionAttributeValues[value]);
      }
      table.set(id, item);
      return input.ReturnValues === "ALL_NEW" ? { Attributes: clone(item) } : {};
    }
    throw new Error(`Unexpected DynamoDB command: ${commandName}`);
  }
}
class Unused { async send() { throw new Error("not used by push subscribe"); } }
const fakeRequire = id => {
  if (id === "node:crypto" || id === "node:https") return require(id);
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: Unused, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient: Unused, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client: Unused, GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "https://example.test/signed" };
  throw new Error(`Unexpected module: ${id}`);
};
const runtime = { env: { CALLING_DEVICES_TABLE: "devices", PUSH_SUBSCRIPTIONS_TABLE: "push", DEVICE_SMS_OTP_REQUIRED: "true" } };
const moduleShim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={savePushSubscription,callPushTargets};`)(fakeRequire, moduleShim, moduleShim.exports, runtime, Buffer, URL, console);
const { savePushSubscription, callPushTargets } = moduleShim.exports.__test;

// --- Fixtures: one member's phone, registered with an SMS code (what registerCallingDevice stores) ---
const me = { email: "phone@danzstak.test", userId: "11111111-1111-4111-8111-111111111111" };
const other = { email: "someone@danzstak.test", userId: "22222222-2222-4222-8222-222222222222" };
const deviceId = "33333333-3333-4333-8333-333333333333", token = "T".repeat(43);
const register = () => tables.devices.set(`${me.email}|${deviceId}`, {
  userEmail: { S: me.email }, deviceId: { S: deviceId }, kind: { S: "registered" }, allowCalls: { BOOL: true },
  tokenHash: { S: crypto.createHash("sha256").update(token).digest("hex") }, otpVerifiedAt: { S: new Date().toISOString() },
  registeredAt: { S: new Date().toISOString() }, lastUsedAt: { S: new Date().toISOString() }
});
const b64url = bytes => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const subscription = endpoint => ({ endpoint, keys: { p256dh: b64url(Buffer.concat([Buffer.from([4]), crypto.randomBytes(64)])), auth: b64url(crypto.randomBytes(16)) } });
const phonePush = subscription("https://fcm.googleapis.com/fcm/send/phone-endpoint");
const proof = { "x-danzstak-device-id": deviceId, "x-danzstak-device-token": token };
const save = async (user, body, headers = {}) => {
  const response = await savePushSubscription({ headers, body: JSON.stringify(body) }, user);
  return { status: response.statusCode, body: JSON.parse(response.body) };
};
const targets = async user => (await callPushTargets(user.email)).map(item => JSON.parse(item.subscription.S).endpoint);

(async () => {
  register();

  // 1. Saved right after registration, with the device's proof: a call push target.
  let result = await save(me, phonePush, proof);
  assert.equal(result.status, 201);
  assert.equal(result.body.callingDeviceLinked, true, "the server says this phone is linked");
  assert.deepEqual(await targets(me), [phonePush.endpoint], "callPushTargets finds the subscription saved right after registration");

  // 2. The same phone re-saves without its proof (the device check failed at start-up): still linked, still rung.
  result = await save(me, phonePush);
  assert.equal(result.body.callingDeviceLinked, true, "a re-save without the proof keeps the link and says so");
  assert.deepEqual(await targets(me), [phonePush.endpoint], "a closed phone still gets the call push after a re-save without its proof");
  assert.equal(puts.filter(table => table === "push").length, 0, "the push row is updated in place, never replaced");

  // 3. A wrong token never links (a new subscription from another browser).
  const laptop = subscription("https://fcm.googleapis.com/fcm/send/laptop-endpoint");
  result = await save(me, laptop, { "x-danzstak-device-id": deviceId, "x-danzstak-device-token": "W".repeat(43) });
  assert.equal(result.body.callingDeviceLinked, false, "a wrong device token never links");
  assert.deepEqual(await targets(me), [phonePush.endpoint], "the unlinked browser isn't rung for calls");

  // 4. Calls off on this device, then revoked: no call pushes, and the kept link isn't reported as linked once revoked.
  tables.devices.get(`${me.email}|${deviceId}`).allowCalls = { BOOL: false };
  assert.deepEqual(await targets(me), [], "a device with calls turned off isn't rung");
  tables.devices.get(`${me.email}|${deviceId}`).allowCalls = { BOOL: true };
  tables.devices.get(`${me.email}|${deviceId}`).revokedAt = { S: new Date().toISOString() };
  assert.deepEqual(await targets(me), [], "a revoked device isn't rung");
  result = await save(me, phonePush);
  assert.equal(result.body.callingDeviceLinked, false, "a revoked device's old link isn't reported as linked");

  // 5. Another account never gets this phone's pushes, even with this device's proof.
  delete tables.devices.get(`${me.email}|${deviceId}`).revokedAt;
  result = await save(other, subscription("https://fcm.googleapis.com/fcm/send/other-endpoint"), proof);
  assert.equal(result.body.callingDeviceLinked, false, "another account can't link with this account's device");
  assert.deepEqual(await targets(other), [], "another account's subscription isn't a call target");
  assert.deepEqual(await targets(me), [phonePush.endpoint], "this account's link is untouched");

  console.log("Push link checks passed: a subscription saved after registration is a call push target, a re-save without the device's proof keeps the link, wrong tokens and other accounts never link, and calls-off or revoked devices aren't rung.");
})().catch(error => { console.error(error); process.exitCode = 1; });
