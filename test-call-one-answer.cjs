"use strict";
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

const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
const commands = Object.fromEntries(commandNames.map(name => [name, command(name)]));
const claims = new Set();
const transactions = [];
const token = "b".repeat(43);
const deviceId = "11111111-1111-4111-8111-111111111111";

class DynamoDBClient {
  async send(request) {
    const input = request.input;
    if (request.commandName === "GetItemCommand" && input.TableName === "devices") {
      return { Item: { kind: { S: "registered" }, deviceId: { S: deviceId }, tokenHash: { S: crypto.createHash("sha256").update(token).digest("hex") }, allowCalls: { BOOL: true }, lastUsedAt: { S: new Date().toISOString() } } };
    }
    if (request.commandName === "GetItemCommand" && input.TableName === "friends") return { Item: { status: { S: "friends" } } };
    if (request.commandName === "TransactWriteItemsCommand") {
      const claim = input.TransactItems[0].Put.Item.eventId.S;
      if (claims.has(claim)) { const error = new Error("claim conflict"); error.name = "TransactionCanceledException"; throw error; }
      claims.add(claim);
      transactions.push(input.TransactItems);
      return {};
    }
    throw new Error(`Unexpected DynamoDB command: ${request.commandName} ${input.TableName || ""}`);
  }
}
class CognitoIdentityProviderClient { async send() { return { Users: [{ Username: "caller" }] }; } }
class KMSClient { async send() { throw new Error("KMS must not be used while accepting a call"); } }
class S3Client { async send() { throw new Error("S3 must not be used while accepting a call"); } }

const fakeRequire = id => {
  if (id === "node:crypto" || id === "node:https") return require(id);
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client, GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "https://example.test/signed" };
  throw new Error(`Unexpected module: ${id}`);
};

const runtime = { env: { CALLING_DEVICES_TABLE: "devices", FRIENDS_TABLE: "friends", CALLS_TABLE: "calls", USER_POOL_ID: "pool" } };
const moduleShim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={send};`)(fakeRequire, moduleShim, moduleShim.exports, runtime, Buffer, URL, console);
const { send } = moduleShim.exports.__test;

const event = {
  headers: { "x-danzstak-device-id": deviceId, "x-danzstak-device-token": token },
  body: JSON.stringify({ recipientEmail: "caller@example.test", mode: "phone", signalType: "answer", callId: "33333333-3333-4333-8333-333333333333", offerEventId: "1762286400000#44444444-4444-4444-8444-444444444444", payload: { type: "answer", sdp: "controlled-test" } })
};
const user = { email: "callee@example.test", userId: "55555555-5555-4555-8555-555555555555" };

(async () => {
  const [first, second] = await Promise.all([send(event, user), send(event, user)]);
  const results = [first, second].sort((a, b) => a.statusCode - b.statusCode);
  assert.equal(results[0].statusCode, 202, "one registered device must win the answer race");
  assert.equal(results[1].statusCode, 409, "the other registered device must lose the answer race");
  assert.equal(JSON.parse(results[1].body).code, "CALL_ALREADY_ANSWERED");
  assert.equal(transactions.length, 1, "only one answer transaction may commit");
  const [claim, consumeOffer, deliverAnswer] = transactions[0];
  assert.equal(claim.Put.Item.eventId.S, "CLAIM#33333333-3333-4333-8333-333333333333");
  assert.equal(claim.Put.Item.answeredByDeviceId.S, deviceId);
  assert.equal(consumeOffer.Delete.Key.eventId.S, "1762286400000#44444444-4444-4444-8444-444444444444");
  assert.equal(consumeOffer.Delete.ExpressionAttributeValues[":mode"].S, "phone");
  assert.equal(deliverAnswer.Put.Item.signalType.S, "answer");
  console.log("One-answer-wins check passed: concurrent registered devices produce one committed answer and one explicit conflict.");
})().catch(error => { console.error(error); process.exitCode = 1; });
