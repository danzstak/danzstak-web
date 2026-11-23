"use strict";
// Owner 2026-11-23 (a video call with a desktop dropped: "Glitched out and stopped working"). A dropped call is restarted
// (ICE restart) with two new call-signaling signals, "restart" (the caller's new offer) and "restart-answer". This runs the
// real call-signaling send() against an in-memory DynamoDB and Cognito:
//   - both are stored for the other person like any signal (their inbox), from a registered calling device;
//   - neither pushes a call notification (no ring on the other person's phones) nor makes an answer claim;
//   - they're refused for text chats, from an unregistered device, and between people who can't contact each other.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const lines = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8").split(/\r?\n/);
const start = lines.findIndex(line => line === "        ZipFile: |");
const source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }

const me = { email: "caller@danzstak.test", userId: "11111111-1111-4111-8111-111111111111" };
const dee = "dee@danzstak.test", stranger = "stranger@danzstak.test";
const deviceId = "33333333-3333-4333-8333-333333333333", token = "T".repeat(43);
const CALL = "44444444-4444-4444-8444-444444444444";
const puts = [], transactions = [], pushes = [];
const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
class DynamoDBClient {
  async send(request) {
    const input = request.input, name = request.commandName;
    if (name === "GetItemCommand" && input.TableName === "devices") return { Item: { kind: { S: "registered" }, deviceId: { S: deviceId }, otpVerifiedAt: { S: "2026-11-20T00:00:00Z" }, tokenHash: { S: crypto.createHash("sha256").update(token).digest("hex") }, allowCalls: { BOOL: true }, lastUsedAt: { S: new Date().toISOString() } } };
    if (name === "GetItemCommand" && input.TableName === "friends") {
      const pair = [input.Key.userEmail.S, input.Key.friendEmail.S].sort().join("|");
      return pair === [me.email, dee].sort().join("|") ? { Item: { status: { S: "friends" } } } : {};
    }
    if (name === "QueryCommand" && input.TableName === "groups") return { Items: [] };
    if (name === "QueryCommand" && input.TableName === "push") { pushes.push(input); return { Items: [] }; }
    if (name === "PutItemCommand" && input.TableName === "calls") { puts.push(input.Item); return {}; }
    if (name === "TransactWriteItemsCommand") { transactions.push(input); return {}; }
    throw new Error(`Unexpected DynamoDB command: ${name} ${input.TableName}`);
  }
}
class Cognito { async send(request) { if (request.commandName === "ListUsersCommand") return { Users: /dee@|stranger@/.test(request.input.Filter) ? [{ Username: "x" }] : [] }; throw new Error("unexpected Cognito call"); } }
class Unused { async send() { throw new Error("not used by restart signals"); } }
const fakeRequire = id => {
  if (id === "node:crypto") return require(id);
  if (id === "node:https") return { request() { pushes.push("https"); throw new Error("no push expected"); } };
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...Object.fromEntries(commandNames.map(n => [n, command(n)])) };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: Cognito, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient: Unused, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client: Unused, GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "" };
  throw new Error(`Unexpected module: ${id}`);
};
const shim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={send};`)(fakeRequire, shim, shim.exports, { env: { CALLING_DEVICES_TABLE: "devices", CALLS_TABLE: "calls", FRIENDS_TABLE: "friends", GROUPS_TABLE: "groups", PUSH_SUBSCRIPTIONS_TABLE: "push", USER_POOL_ID: "pool", DEVICE_SMS_OTP_REQUIRED: "true" } }, Buffer, URL, console);
const { send } = shim.exports.__test;
const proof = { "x-danzstak-device-id": deviceId, "x-danzstak-device-token": token };
const sdp = "v=0\r\na=ice-ufrag:new1\r\n";
const post = async (body, headers = proof) => { const response = await send({ headers, body: JSON.stringify(body) }, me); return { status: response.statusCode, body: JSON.parse(response.body) }; };

(async () => {
  for (const signalType of ["restart", "restart-answer"]) {
    const before = puts.length;
    const result = await post({ recipientEmail: dee, callId: CALL, mode: "video", signalType, payload: { type: signalType === "restart" ? "offer" : "answer", sdp } });
    assert.equal(result.status, 202, `${signalType}: accepted (${JSON.stringify(result.body)})`);
    assert.equal(puts.length, before + 1, `${signalType}: stored for the other person`);
    const item = puts.at(-1);
    assert.equal(item.recipientEmail.S, dee);
    assert.equal(item.signalType.S, signalType);
    assert.equal(item.callId.S, CALL);
    assert.equal(JSON.parse(item.payload.S).sdp, sdp);
    assert.equal(item.senderName, undefined, `${signalType}: no caller name (it isn't a new call)`);
  }
  assert.deepEqual(pushes, [], "no call push for a restart: the other person's phones don't ring");
  assert.deepEqual(transactions, [], "no answer claim for a restart");

  // Refused: a text chat, an unregistered device, someone who can't be contacted.
  assert.equal((await post({ recipientEmail: dee, callId: CALL, mode: "text", signalType: "restart", payload: { sdp } })).status, 400, "restart is for calls only");
  assert.equal((await post({ recipientEmail: dee, callId: CALL, mode: "video", signalType: "restart", payload: { sdp } }, {})).status, 403, "a restart needs this device's registration");
  assert.equal((await post({ recipientEmail: stranger, callId: CALL, mode: "phone", signalType: "restart", payload: { sdp } })).status, 403, "a restart only goes to someone you can call");
  assert.equal((await post({ recipientEmail: dee, callId: CALL, mode: "video", signalType: "renegotiate", payload: { sdp } })).status, 400, "other signal types are still refused");

  console.log("Call restart signal checks passed: restart and restart-answer reach the other person's inbox from a registered device without ringing them or claiming the call, and are refused for text chats, unregistered devices, people you can't call and unknown types.");
})().catch(error => { console.error(error); process.exitCode = 1; });
