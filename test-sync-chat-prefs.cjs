"use strict";
// Task 16-A chat list (owner 2026-11-17): pin (max 3), mute and archive live on the member's own conversation record.
// Runs the real call-signaling code against a small stubbed DynamoDB.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const lines = template.split(/\r?\n/), start = lines.findIndex(line => line === "        ZipFile: |"), source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }
const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commands = Object.fromEntries(["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"].map(name => [name, command(name)]));
const me = { email: "me@example.test", userId: "00000000-0000-4000-8000-000000000001" };
const rows = new Map(["a", "b", "c", "d"].map(name => [`${name}@example.test`, { userEmail: { S: me.email }, contactEmail: { S: `${name}@example.test` }, preview: { S: "hi" } }]));
const updates = [];
class DynamoDBClient {
  async send(request) {
    const input = request.input;
    if (request.commandName === "QueryCommand") return { Items: [...rows.values()] };
    if (request.commandName === "UpdateItemCommand") {
      const row = rows.get(input.Key.contactEmail.S);
      if (!row) { const error = new Error("missing"); error.name = "ConditionalCheckFailedException"; throw error; }
      updates.push(input);
      const [setPart = "", removePart = ""] = [/SET (.*?)(?= REMOVE|$)/.exec(input.UpdateExpression)?.[1] || "", /REMOVE (.*)$/.exec(input.UpdateExpression)?.[1] || ""];
      for (const clause of setPart.split(/,\s*/).filter(Boolean)) { const [name, value] = clause.split(/\s*=\s*/); row[name] = input.ExpressionAttributeValues[value]; }
      for (const name of removePart.split(/,\s*/).filter(Boolean)) delete row[name];
      return {};
    }
    throw new Error(`Unexpected ${request.commandName}`);
  }
}
const fakeRequire = name => {
  if (name === "node:crypto" || name === "node:https") return require(name);
  if (name === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (name === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: class {}, ListUsersCommand: command("x") };
  if (name === "@aws-sdk/client-kms") return { KMSClient: class {}, GetPublicKeyCommand: command("x"), SignCommand: command("x") };
  if (name === "@aws-sdk/client-s3") return { S3Client: class {}, DeleteObjectCommand: command("x"), HeadObjectCommand: command("x"), GetObjectCommand: command("x"), PutObjectCommand: command("x") };
  if (name === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "" };
  throw new Error(name);
};
const shim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={updateConversationPrefs};`)(fakeRequire, shim, shim.exports, { env: { CONVERSATIONS_TABLE: "conversations" } }, Buffer, URL, console);
const { updateConversationPrefs } = shim.exports.__test;
const call = async body => { const response = await updateConversationPrefs({ body: JSON.stringify(body) }, me); return { status: response.statusCode, body: JSON.parse(response.body) }; };

(async () => {
  assert.equal((await call({ contactEmail: "a@example.test", pinned: true })).status, 200);
  assert.ok(rows.get("a@example.test").pinnedAt.S, "pinning stamps pinnedAt");
  await call({ contactEmail: "b@example.test", pinned: true });
  await call({ contactEmail: "c@example.test", pinned: true });
  const fourth = await call({ contactEmail: "d@example.test", pinned: true });
  assert.deepEqual([fourth.status, fourth.body.code], [409, "PIN_LIMIT"], "at most 3 pinned chats");
  assert.equal((await call({ contactEmail: "a@example.test", pinned: true })).status, 200, "re-pinning a pinned chat is fine at the limit");
  await call({ contactEmail: "a@example.test", pinned: false });
  assert.equal(rows.get("a@example.test").pinnedAt, undefined, "unpin removes it");
  await call({ contactEmail: "b@example.test", muted: true });
  assert.equal(rows.get("b@example.test").muted.BOOL, true);
  await call({ contactEmail: "c@example.test", archived: true });
  assert.equal(rows.get("c@example.test").archived.BOOL, true);
  assert.equal(rows.get("c@example.test").pinnedAt, undefined, "archiving a chat unpins it");
  assert.equal((await call({ contactEmail: "nobody@example.test", muted: true })).status, 404, "only your own existing chats");
  assert.equal((await call({ contactEmail: "a@example.test" })).status, 400, "something must change");
  assert.ok(updates.every(update => update.Key.userEmail.S === me.email), "only the member's own records are written");

  // Wiring: list returns prefs pinned-first, a new message unarchives, a muted chat sends no push, routed.
  assert.match(template, /pinned:Boolean\(x\.pinnedAt\?\.S\),pinnedAt:x\.pinnedAt\?\.S\|\|'',muted:x\.muted\?\.BOOL===true,archived:x\.archived\?\.BOOL===true/);
  assert.match(template, /sort\(\(a,b\)=>Number\(b\.pinned\)-Number\(a\.pinned\)/);
  assert.match(template, /UpdateExpression:'SET preview = :p, updatedAt = :u REMOVE archived'/, "a new message brings an archived chat back");
  assert.match(template, /async function notifyMessage[^\n]*if\(chat\?\.muted\?\.BOOL===true\)return;/, "a muted chat sends no push");
  assert.match(template, /if\(key==='POST \/conversations\/prefs'\)return await updateConversationPrefs\(event,user\)/);
  assert.match(template, /RouteKey: POST \/conversations\/prefs,/);
  console.log("SYNC chat preference checks passed: pin up to 3, mute, archive (unpins), own chats only, unarchive on new message, muted chats silent.");
})().catch(error => { console.error(error); process.exit(1); });
