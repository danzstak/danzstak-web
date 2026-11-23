"use strict";
// L1 (owner 2026-11-19: a tester's MacBook "didn't ring" when called). /calls/inbox answered an unregistered device with a
// bare 403, so a call to it was silent. Calls still need a registered device, but the 403 now says who is calling, so the page
// can show "Register this device to answer". This runs the real call-signaling inbox() against an in-memory DynamoDB:
//   - unregistered: 403 + ringing = the account's own unanswered, unended phone/video offers, newest call details only
//     (callId, mode, caller name, time): no connection details (SDP), no caller email, no text-mode offers, no blocked callers;
//   - registered: the full inbox as before.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const lines = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8").split(/\r?\n/);
const start = lines.findIndex(line => line === "        ZipFile: |");
const source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }

const me = { email: "callee@danzstak.test", userId: "11111111-1111-4111-8111-111111111111" };
const deviceId = "33333333-3333-4333-8333-333333333333", token = "T".repeat(43);
const nowS = Math.floor(Date.now() / 1000);
const offer = (callId, sender, mode, extra = {}) => ({ recipientEmail: { S: me.email }, eventId: { S: `${Date.now()}#${callId}` }, senderEmail: { S: sender }, callId: { S: callId }, mode: { S: mode }, signalType: { S: "offer" }, payload: { S: JSON.stringify({ type: "offer", sdp: "v=0\r\na=candidate:1 1 udp 1 192.0.2.10 5000 typ host" }) }, createdAt: { S: new Date().toISOString() }, expiresAt: { N: String(nowS + 120) }, senderName: { S: extra.name || "" } });
const CALLS = {
  ringing: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  hungUp: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  blocked: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  text: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  expired: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
};
const calls = [
  offer(CALLS.ringing, "dee@danzstak.test", "video", { name: "Tour Friend" }),
  offer(CALLS.hungUp, "bo@danzstak.test", "phone", { name: "Bo" }),
  { ...offer(CALLS.hungUp, "bo@danzstak.test", "phone"), signalType: { S: "hangup" }, eventId: { S: `${Date.now()}#hang` } },
  offer(CALLS.blocked, "pest@danzstak.test", "phone", { name: "Pest" }),
  offer(CALLS.text, "dee@danzstak.test", "text", { name: "Tour Friend" }),
  { ...offer(CALLS.expired, "old@danzstak.test", "phone", { name: "Old" }), expiresAt: { N: String(nowS - 5) } }
];
const friends = [{ userEmail: { S: me.email }, friendEmail: { S: "pest@danzstak.test" }, status: { S: "blocked" } }, { userEmail: { S: me.email }, friendEmail: { S: "dee@danzstak.test" }, status: { S: "friends" } }];
let registered = false;
const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
class DynamoDBClient {
  async send(request) {
    const input = request.input, name = request.commandName;
    if (name === "GetItemCommand" && input.TableName === "devices") {
      return registered ? { Item: { kind: { S: "registered" }, deviceId: { S: deviceId }, otpVerifiedAt: { S: "2026-11-20T00:00:00Z" }, tokenHash: { S: crypto.createHash("sha256").update(token).digest("hex") }, allowCalls: { BOOL: true }, lastUsedAt: { S: new Date().toISOString() } } } : {};
    }
    if (name === "QueryCommand" && input.TableName === "calls") {
      const at = Number(input.ExpressionAttributeValues[":n"].N);
      return { Items: calls.filter(item => item.recipientEmail.S === input.ExpressionAttributeValues[":r"].S && Number(item.expiresAt.N) > at && item.signalType) };
    }
    if (name === "QueryCommand" && input.TableName === "friends") return { Items: friends };
    throw new Error(`Unexpected DynamoDB command: ${name} ${input.TableName}`);
  }
}
class Unused { async send() { throw new Error("not used by the inbox"); } }
const fakeRequire = id => {
  if (id === "node:crypto" || id === "node:https") return require(id);
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...Object.fromEntries(commandNames.map(n => [n, command(n)])) };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: Unused, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient: Unused, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client: Unused, GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "" };
  throw new Error(`Unexpected module: ${id}`);
};
const shim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={inbox};`)(fakeRequire, shim, shim.exports, { env: { CALLING_DEVICES_TABLE: "devices", CALLS_TABLE: "calls", FRIENDS_TABLE: "friends", DEVICE_SMS_OTP_REQUIRED: "true" } }, Buffer, URL, console);
const { inbox } = shim.exports.__test;
const ask = async headers => { const response = await inbox({ headers }, me); return { status: response.statusCode, body: JSON.parse(response.body) }; };

(async () => {
  // Unregistered (no device headers at all, as on the tester's Mac).
  let result = await ask({});
  assert.equal(result.status, 403);
  assert.equal(result.body.code, "CALL_DEVICE_REGISTRATION_REQUIRED", "still can't receive the call itself");
  assert.deepEqual(result.body.ringing.map(call => call.callId), [CALLS.ringing], "only the live phone/video call: not hung up, not blocked, not text, not expired");
  const [call] = result.body.ringing;
  assert.deepEqual(Object.keys(call).sort(), ["callId", "createdAt", "mode", "senderName"], "who is calling and how, nothing else");
  assert.equal(call.senderName, "Tour Friend");
  assert.equal(call.mode, "video");
  assert.doesNotMatch(JSON.stringify(result.body), /sdp|candidate|192\.0\.2|@danzstak\.test|payload/i, "no connection details or emails reach an unregistered device");

  // A device with the wrong token is unregistered too.
  registered = true;
  result = await ask({ "x-danzstak-device-id": deviceId, "x-danzstak-device-token": "W".repeat(43) });
  assert.equal(result.status, 403);
  assert.equal(result.body.ringing.length, 1);

  // Registered: the full inbox, as before.
  result = await ask({ "x-danzstak-device-id": deviceId, "x-danzstak-device-token": token });
  assert.equal(result.status, 200);
  assert.ok(result.body.events.some(event => event.callId === CALLS.ringing && event.payload?.sdp), "a registered device still gets the offer to answer");
  assert.equal(result.body.ringing, undefined);

  console.log("Ringing summary checks passed: an unregistered device learns who is calling (name, phone or video) for live calls only, with no connection details, emails, blocked callers, text or ended calls; a registered device gets the full inbox.");
})().catch(error => { console.error(error); process.exitCode = 1; });
