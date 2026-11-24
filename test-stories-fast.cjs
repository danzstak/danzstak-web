"use strict";
// C2 (task 38 step 4, owner 2026-11-19: "takes 10 sec with one user"). Call-signaling's Cognito sits in us-east-1, so every
// lookup crosses the country. This runs the real call-signaling code against an in-memory DynamoDB and Cognito and counts
// the calls:
//   - identity(): a member's second request within a minute doesn't ask Cognito again (the session is still read every time);
//     after a minute it asks again; an ended session is refused before any cache;
//   - GET /stories: every author's name and member id come from one BatchGetItem on the settings table (100 keys a request,
//     unprocessed keys retried), Cognito only for an author whose settings lack them, and their member id is then kept on
//     their settings record (never creating a record); if the settings read fails, Cognito names still show;
//   - the Lambda role may BatchGetItem the settings table, and both member-facing Lambdas run at 1024 MB.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const lines = template.split(/\r?\n/);
const start = lines.findIndex(line => line === "        ZipFile: |");
const source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }

let clock = Date.parse("2026-11-24T15:00:00Z");
class FakeDate extends Date { static now() { return clock; } }
const nowSeconds = () => Math.floor(clock / 1000);

const SESSION = "a".repeat(64), ENDED = "b".repeat(64);
const me = { email: "me@danzstak.test", sub: "11111111-1111-4111-8111-111111111111" };
const sessions = new Map([
  [crypto.createHash("sha256").update(SESSION).digest("hex"), { type: { S: "user_session" }, userId: { S: me.sub }, expiresAt: { N: String(nowSeconds() + 3600) } }],
  [crypto.createHash("sha256").update(ENDED).digest("hex"), { type: { S: "user_session" }, userId: { S: me.sub }, expiresAt: { N: String(nowSeconds() - 1) } }]
]);
// Authors: a0..a{n-1}. Settings: "full" authors hold profileName + memberSub; "named" hold only profileName (memberSub is
// learned from Cognito and kept); "none" have no settings record at all.
let stories = [], settings = new Map(), cognitoAccounts = new Map();
const calls = { listUsers: [], batch: [], settingsUpdates: [], settingsGets: 0 };
let batchFails = false, unprocessedOnce = false;
function world(n, kinds) {
  stories = []; settings = new Map(); cognitoAccounts = new Map();
  for (let i = 0; i < n; i++) {
    const email = `a${i}@danzstak.test`, sub = `sub-${i}`, kind = kinds(i);
    stories.push({ storyId: { S: crypto.randomUUID() }, userEmail: { S: email }, audience: { S: "public" }, mediaKey: { S: `users/x/${i}.jpg` }, mediaType: { S: "image" }, fromPost: { BOOL: true }, createdAt: { S: new Date(clock - i * 1000).toISOString() }, expiresAt: { N: String(nowSeconds() + 3600) } });
    cognitoAccounts.set(email, { Attributes: [{ Name: "email", Value: email }, { Name: "sub", Value: sub }, { Name: "name", Value: `Cognito ${i}` }] });
    if (kind === "full") settings.set(email, { userEmail: { S: email }, profileName: { S: `Artist ${i}` }, memberSub: { S: sub } });
    if (kind === "named") settings.set(email, { userEmail: { S: email }, profileName: { S: `Artist ${i}` } });
  }
  stories.push({ storyId: { S: crypto.randomUUID() }, userEmail: { S: "a0@danzstak.test" }, kind: { S: "reel" }, content: { S: "https://youtu.be/abc" }, createdAt: { S: new Date(clock).toISOString() } });
  calls.listUsers = []; calls.batch = []; calls.settingsUpdates = []; calls.settingsGets = 0;
}

const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "BatchGetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
class DynamoDBClient {
  async send(request) {
    const input = request.input, name = request.commandName;
    if (name === "GetItemCommand" && input.TableName === "sessions") return { Item: sessions.get(input.Key.sessionId.S) };
    if (name === "GetItemCommand" && input.TableName === "settings") { calls.settingsGets += 1; return input.Key.userEmail.S === me.email ? { Item: { dailyTakeCount: { N: "3" } } } : { Item: settings.get(input.Key.userEmail.S) }; }
    if (name === "ScanCommand" && input.TableName === "stories") return { Items: stories };
    if (name === "QueryCommand" && input.TableName === "friends") return { Items: [] };
    if (name === "BatchGetItemCommand") {
      calls.batch.push(input);
      if (batchFails) { const error = new Error("throttled"); error.name = "ProvisionedThroughputExceededException"; throw error; }
      const request = input.RequestItems.settings;
      assert.ok(request.Keys.length <= 100, "a BatchGetItem asks for at most 100 keys");
      assert.equal(request.ProjectionExpression, "userEmail, profileName, memberSub", "only the name and member id are read");
      let keys = request.Keys, unprocessed = [];
      if (unprocessedOnce && keys.length > 2) { unprocessedOnce = false; unprocessed = keys.slice(-2); keys = keys.slice(0, -2); }
      return { Responses: { settings: keys.map(key => settings.get(key.userEmail.S)).filter(Boolean) }, UnprocessedKeys: unprocessed.length ? { settings: { Keys: unprocessed } } : {} };
    }
    if (name === "UpdateItemCommand" && input.TableName === "settings" && /memberSub/.test(input.UpdateExpression)) {
      calls.settingsUpdates.push(input);
      const item = settings.get(input.Key.userEmail.S);
      if (!item) { const error = new Error("condition"); error.name = "ConditionalCheckFailedException"; throw error; }
      item.memberSub = input.ExpressionAttributeValues[":sub"];
      return {};
    }
    throw new Error(`Unexpected DynamoDB command: ${name} ${input.TableName}`);
  }
}
class Cognito {
  async send(request) {
    if (request.commandName !== "ListUsersCommand") throw new Error("unexpected Cognito call");
    const filter = request.input.Filter; calls.listUsers.push(filter);
    const bySub = /^sub = "(.*)"$/.exec(filter), byEmail = /^email = "(.*)"$/.exec(filter);
    if (bySub) return { Users: bySub[1] === me.sub ? [{ Attributes: [{ Name: "email", Value: me.email }, { Name: "sub", Value: me.sub }] }] : [] };
    if (byEmail) return { Users: cognitoAccounts.has(byEmail[1]) ? [cognitoAccounts.get(byEmail[1])] : [] };
    throw new Error("unexpected filter " + filter);
  }
}
class Unused { async send() { throw new Error("not used"); } }
const fakeRequire = id => {
  if (id === "node:crypto") return require(id);
  if (id === "node:https") return { request() { throw new Error("no network"); }, get() { throw new Error("no network"); } };
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...Object.fromEntries(commandNames.map(n => [n, command(n)])) };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: Cognito, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient: Unused, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client: Unused, GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand"), HeadObjectCommand: command("HeadObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "" };
  throw new Error(`Unexpected module: ${id}`);
};
const shim = { exports: {} };
const env = { SESSIONS_TABLE: "sessions", SETTINGS_TABLE: "settings", STORIES_TABLE: "stories", FRIENDS_TABLE: "friends", USER_POOL_ID: "pool", MEDIA_BUCKET: "media", AWS_REGION: "us-west-1", AWS_ACCESS_KEY_ID: "x", AWS_SECRET_ACCESS_KEY: "y" };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", "Date", `${source.join("\n")}\nmodule.exports.__test={identity,getStories};`)(fakeRequire, shim, shim.exports, { env }, Buffer, URL, { log() {}, warn() {}, error() {} }, FakeDate);
const { identity, getStories } = shim.exports.__test;
const request = raw => ({ headers: { authorization: `Bearer ${raw}` } });
const dailies = async user => { const response = await getStories(user); assert.equal(response.statusCode, 200); return JSON.parse(response.body); };

(async () => {
  // identity(): one Cognito call per member per minute, not per request.
  world(0, () => "none");
  assert.deepEqual(await identity(request(SESSION)), { email: me.email, userId: me.sub });
  assert.equal(calls.listUsers.length, 1, "the first request asks Cognito who the session belongs to");
  for (let i = 0; i < 5; i++) { clock += 5000; assert.deepEqual(await identity(request(SESSION)), { email: me.email, userId: me.sub }); }
  assert.equal(calls.listUsers.length, 1, "polling within a minute (5 requests, 25 s) doesn't ask Cognito again");
  assert.equal(await identity(request(ENDED)), null, "an ended session is refused even while its member is remembered");
  clock += 61000;
  await identity(request(SESSION));
  assert.equal(calls.listUsers.length, 2, "after a minute Cognito is asked again");

  // GET /stories with 12 authors: 9 have everything, 2 have a name but no member id yet, 1 has no settings record.
  world(12, i => i < 9 ? "full" : i < 11 ? "named" : "none");
  let result = await dailies(me);
  assert.equal(result.stories.length, 12);
  assert.equal(calls.batch.length, 1, "one BatchGetItem for every author");
  assert.equal(calls.settingsGets, 1, "the only single settings read is your own TAKE count, not one per author");
  assert.deepEqual(calls.listUsers.map(f => f.replace(/^email = "(.*)"$/, "$1")).sort(), ["a10@danzstak.test", "a11@danzstak.test", "a9@danzstak.test"], "Cognito only for the 3 authors whose settings lack their member id");
  const byName = Object.fromEntries(result.stories.map(s => [s.displayName, s.memberId]));
  assert.equal(byName["Artist 0"], "sub-0");
  assert.equal(byName["Artist 9"], "sub-9", "a saved profile name wins over Cognito's name");
  assert.equal(byName["Cognito 11"], "sub-11", "an author with no settings record shows their Cognito name");
  assert.equal(result.reels[0].displayName, "Artist 0");
  assert.ok(result.stories.every(s => !Object.hasOwn(s, "userEmail") && !JSON.stringify(s).includes("@danzstak.test")), "no email address in the answer");
  assert.deepEqual(calls.settingsUpdates.map(u => u.Key.userEmail.S).sort(), ["a10@danzstak.test", "a9@danzstak.test"], "the member id is kept on each settings record that lacks it, and no write is tried where there's no record");
  assert.ok(calls.settingsUpdates.every(u => u.ConditionExpression === "attribute_exists(userEmail)" && u.UpdateExpression === "SET memberSub = :sub"), "the member id is only added to an existing record");
  assert.equal(settings.has("a11@danzstak.test"), false, "no settings record is created for an author who has none");
  assert.equal(settings.get("a9@danzstak.test").memberSub.S, "sub-9", "the member id is kept for next time");

  // A minute later (fresh cache): the two that were learned no longer need Cognito; only the author with no record does.
  clock += 61000; calls.listUsers = []; calls.batch = [];
  result = await dailies(me);
  assert.deepEqual(calls.listUsers, ['email = "a11@danzstak.test"'], "kept member ids spare Cognito next time");
  assert.equal(result.stories.length, 12);

  // 130 authors: two BatchGetItem requests (100 + 30), and keys DynamoDB leaves unprocessed are asked for again.
  world(130, () => "full"); unprocessedOnce = true;
  result = await dailies(me);
  assert.equal(calls.listUsers.length, 0, "no Cognito call when every author's settings hold their name and id");
  assert.equal(calls.batch.length, 3, "100 + 30 keys, plus one retry for 2 unprocessed keys");
  assert.deepEqual(calls.batch.map(b => b.RequestItems.settings.Keys.length), [100, 2, 30]);
  assert.ok(result.stories.every(s => /^Artist \d+$/.test(s.displayName) && /^sub-\d+$/.test(s.memberId)), "every author is named, the retried ones too");

  // The settings read fails: names still show (from Cognito), the Dailies still load.
  world(3, () => "full"); batchFails = true;
  result = await dailies(me);
  batchFails = false;
  assert.equal(result.stories.length, 3);
  assert.deepEqual(result.stories.map(s => s.displayName).sort(), ["Cognito 0", "Cognito 1", "Cognito 2"]);
  assert.equal(calls.settingsUpdates.length, 0, "after a failed read nothing is written (the records weren't seen)");

  // IAM and memory.
  assert.match(template, /Action: \[dynamodb:GetItem, dynamodb:BatchGetItem, dynamodb:PutItem, dynamodb:Scan, dynamodb:UpdateItem\]\n\s+Resource: !GetAtt UserSettingsTable\.Arn/, "the Lambda role may BatchGetItem the settings table");
  assert.match(template, /FunctionName: DANZSTAK-Call-Signaling\n(?:\s+\w+: .*\n){3}\s+Timeout: 10\n\s+MemorySize: 1024\n/, "call-signaling runs at 1024 MB");
  const deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
  assert.match(deploy, /--timeout 30 --memory-size 1024 /, "the Auth API deploy sets 1024 MB");
  assert.doesNotMatch(deploy, /memory-size 256/, "no 256 MB left in the Auth API deploy");

  console.log("Fast Stories checks passed: a member's id and email are kept for a minute (no Cognito call per request), every Dailies author comes from one BatchGetItem (100 keys a request, unprocessed retried), Cognito only for authors missing their id or name (then kept on their existing settings record), names still show when the settings read fails, and both Lambdas run at 1024 MB.");
})().catch(error => { console.error(error); process.exitCode = 1; });
