"use strict";
// Task 16-D ticks, typing, presence. Runs the real call-signaling Lambda code against a fake DynamoDB:
// ✓ sent / ✓✓ delivered / ✓✓ read (server-side), read receipts off (reciprocal), "typing…" (6 s, existing chats, contacts
// only), last seen / online for everyone / friends / nobody (reciprocal), presence writes last seen at most once a minute.
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
const A = "alice@example.test", B = "bob@example.test";
const db = { conversations: new Map(), settings: new Map(), messages: [], updates: [], friends: new Map([[`${A}|${B}`, "friends"], [`${B}|${A}`, "friends"]]) };
const key = (u, c) => `${u}|${c}`;
const nowS = () => Math.floor(Date.now() / 1000);

class DynamoDBClient {
  async send(request) {
    const input = request.input, name = request.commandName, table = input.TableName;
    if (table === "friends" && name === "GetItemCommand") { const status = db.friends.get(key(input.Key.userEmail.S, input.Key.friendEmail.S)); return { Item: status ? { status: { S: status } } : undefined }; }
    if (table === "friends" || table === "groups") return { Items: [] };
    if (table === "conversations" && name === "GetItemCommand") return { Item: db.conversations.get(key(input.Key.userEmail.S, input.Key.contactEmail.S)) };
    if (table === "conversations" && name === "QueryCommand") return { Items: [...db.conversations.entries()].filter(([k]) => k.startsWith(input.ExpressionAttributeValues[":u"].S + "|")).map(([, v]) => v) };
    if (table === "conversations" && name === "UpdateItemCommand") {
      const k = key(input.Key.userEmail.S, input.Key.contactEmail.S);
      if (input.ConditionExpression === "attribute_exists(userEmail)" && !db.conversations.has(k)) { const e = new Error("no"); e.name = "ConditionalCheckFailedException"; throw e; }
      const item = db.conversations.get(k) || { userEmail: input.Key.userEmail, contactEmail: input.Key.contactEmail };
      const match = input.UpdateExpression.match(/^SET (\w+) = (:\w+)$/);
      if (match) item[match[1]] = input.ExpressionAttributeValues[match[2]];
      db.conversations.set(k, item); db.updates.push({ k, expr: input.UpdateExpression }); return {};
    }
    if (table === "settings" && name === "GetItemCommand") return { Item: db.settings.get(input.Key.userEmail.S) };
    if (table === "settings" && name === "UpdateItemCommand") {
      const item = db.settings.get(input.Key.userEmail.S) || {};
      for (const part of input.UpdateExpression.replace(/^SET /, "").split(", ")) { const [field, value] = part.split(" = "); item[field] = input.ExpressionAttributeValues[value]; }
      db.settings.set(input.Key.userEmail.S, item); db.updates.push({ settings: input.Key.userEmail.S, expr: input.UpdateExpression }); return {};
    }
    if (table === "messages" && name === "QueryCommand") return { Items: db.messages.slice().reverse() };
    if (table === "reactions") return { Items: [] };
    if (table === "presence") return {};
    if (name === "QueryCommand" || name === "ScanCommand") return { Items: [] };
    if (name === "GetItemCommand") return {};
    throw new Error(`Unexpected ${name} ${table}`);
  }
}
class CognitoIdentityProviderClient { async send() { return { Users: [] }; } }
class KMSClient { async send() { throw new Error("no KMS"); } }
class S3Client { async send() { throw new Error("no S3"); } }
const fakeRequire = id => {
  if (id === "node:crypto" || id === "node:https") return require(id);
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client, GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "https://example.test/signed" };
  throw new Error(`Unexpected module: ${id}`);
};
const runtime = { env: { CONVERSATIONS_TABLE: "conversations", SETTINGS_TABLE: "settings", MESSAGES_TABLE: "messages", MESSAGE_REACTIONS_TABLE: "reactions", FRIENDS_TABLE: "friends", GROUPS_TABLE: "groups", PRESENCE_TABLE: "presence", USER_POOL_ID: "pool", PROFILE_NAMES_TABLE: "names" } };
const moduleShim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={getMessages,getConversations,setTyping,setSyncPrivacy,presence,presenceVisibleTo,getPresenceSetting};`)(fakeRequire, moduleShim, moduleShim.exports, runtime, Buffer, URL, { ...console, error() {} });
const T = moduleShim.exports.__test;
const alice = { email: A, userId: "a" }, bob = { email: B, userId: "b" };
const body = r => JSON.parse(r.body);
const msg = (i, sender, at) => ({ conversationId: { S: "c" }, messageId: { S: `${String(1762000000000 + i)}#00000000-0000-4000-8000-00000000000${i}` }, senderEmail: { S: sender }, recipientEmail: { S: sender === A ? B : A }, content: { S: "m" + i }, createdAt: { S: at } });

(async () => {
  db.messages.push(msg(1, A, "2026-11-17T10:00:00.000Z"), msg(2, A, "2026-11-17T10:05:00.000Z"));
  db.conversations.set(key(A, B), { userEmail: { S: A }, contactEmail: { S: B }, preview: { S: "m2" }, updatedAt: { S: "2026-11-17T10:05:00.000Z" } });
  db.conversations.set(key(B, A), { userEmail: { S: B }, contactEmail: { S: A }, preview: { S: "m2" }, updatedAt: { S: "2026-11-17T10:05:00.000Z" }, unread: { N: "2" } });
  const ticks = async () => body(await T.getMessages({ queryStringParameters: { contact: B } }, alice)).messages.map(m => (m.read ? "read" : m.delivered ? "delivered" : "sent"));
  assert.deepEqual(await ticks(), ["sent", "sent"], "✓ sent before Bob's device has the chat");
  // Bob's device lists chats → delivered.
  await T.getConversations(bob);
  assert.deepEqual(await ticks(), ["delivered", "delivered"], "✓✓ delivered once Bob's device fetched the chat list");
  const writes = db.updates.length; await T.getConversations(bob);
  assert.equal(db.updates.length, writes, "delivered is written once per new message, not on every poll");
  // Bob opens the chat → read.
  await T.getMessages({ queryStringParameters: { contact: A, read: "1" } }, bob);
  assert.deepEqual(await ticks(), ["read", "read"], "✓✓ blue after Bob reads");
  // Read receipts off for Bob: a new message is delivered, never read; and Bob doesn't see Alice's reads (reciprocal).
  assert.equal((await T.setSyncPrivacy({ body: JSON.stringify({ lastSeen: "everyone", readReceipts: false }) }, bob)).statusCode, 200);
  await new Promise(r => setTimeout(r, 5)); db.messages.push(msg(3, A, new Date().toISOString())); await new Promise(r => setTimeout(r, 5));
  await T.getMessages({ queryStringParameters: { contact: A, read: "1" } }, bob);
  assert.deepEqual(await ticks(), ["read", "read", "delivered"], "receipts off: delivered only");
  db.messages.push(msg(4, B, new Date().toISOString())); await new Promise(r => setTimeout(r, 5));
  await T.getMessages({ queryStringParameters: { contact: B, read: "1" } }, alice);
  const bobView = body(await T.getMessages({ queryStringParameters: { contact: A } }, bob)).messages.find(m => m.content === "m4");
  assert.equal(bobView.read, false, "with receipts off you don't see other people's blue ticks either");
  assert.equal(bobView.delivered, true);
  // Typing: 6 s window, existing chats only, contacts only.
  assert.equal((await T.setTyping({ body: JSON.stringify({ contactEmail: B }) }, alice)).statusCode, 202);
  assert.equal(body(await T.getMessages({ queryStringParameters: { contact: A } }, bob)).typing, true, "Bob sees Alice typing…");
  assert.equal(body(await T.getConversations(bob)).conversations[0].typing, true, "…in the chat list too");
  assert.equal(body(await T.getMessages({ queryStringParameters: { contact: B } }, alice)).typing, false, "nobody is typing to Alice");
  await T.setTyping({ body: JSON.stringify({ contactEmail: B, typing: false }) }, alice);
  assert.equal(body(await T.getMessages({ queryStringParameters: { contact: A } }, bob)).typing, false, "stops on send");
  const until = Number(db.conversations.get(key(B, A)).contactTypingUntil.N);
  await T.setTyping({ body: JSON.stringify({ contactEmail: B }) }, alice);
  assert.ok(Number(db.conversations.get(key(B, A)).contactTypingUntil.N) - nowS() <= 6, "typing… fades after 6 s");
  const before = db.conversations.size;
  db.friends.set(key(A, "carol@example.test"), "friends"); db.friends.set(key("carol@example.test", A), "friends");
  await T.setTyping({ body: JSON.stringify({ contactEmail: "carol@example.test" }) }, alice);
  assert.equal(db.conversations.size, before, "typing never creates an empty chat");
  assert.equal((await T.setTyping({ body: JSON.stringify({ contactEmail: "stranger@example.test" }) }, alice)).statusCode, 403, "only contacts");
  void until;
  // Last seen / online visibility.
  const vis = (s, friend, viewer) => T.presenceVisibleTo(s, friend, viewer);
  assert.deepEqual(vis({ lastSeenVisibility: { S: "everyone" } }, "none", "everyone"), { online: true, lastSeen: true });
  assert.deepEqual(vis({ lastSeenVisibility: { S: "friends" } }, "none", "everyone"), { online: false, lastSeen: false }, "friends only");
  assert.deepEqual(vis({ lastSeenVisibility: { S: "friends" } }, "friends", "everyone"), { online: true, lastSeen: true });
  assert.deepEqual(vis({ lastSeenVisibility: { S: "nobody" } }, "friends", "everyone"), { online: false, lastSeen: false });
  assert.deepEqual(vis({ onlineVisible: { BOOL: false } }, "friends", "everyone"), { online: false, lastSeen: false }, "the old online switch still means nobody");
  assert.deepEqual(vis({}, "friends", "nobody"), { online: true, lastSeen: false }, "reciprocal: hide yours, you don't see theirs");
  assert.equal((await T.setSyncPrivacy({ body: JSON.stringify({ lastSeen: "sometimes", readReceipts: true }) }, alice)).statusCode, 400);
  await T.setSyncPrivacy({ body: JSON.stringify({ lastSeen: "nobody", readReceipts: true }) }, alice);
  assert.equal(db.settings.get(A).onlineVisible.BOOL, false, "nobody also turns the online dot off");
  const read = body(await T.getPresenceSetting(alice));
  assert.equal(read.lastSeen, "nobody"); assert.equal(read.readReceipts, true);
  // Presence writes last seen at most once a minute.
  db.settings.set(B, { lastSeenVisibility: { S: "everyone" } });
  await T.presence(bob); const first = db.settings.get(B).lastSeenAt?.N;
  assert.ok(first, "last seen recorded");
  const count = db.updates.filter(u => u.settings === B).length; await T.presence(bob);
  assert.equal(db.updates.filter(u => u.settings === B).length, count, "no second write within a minute");
  // Routes and client.
  assert.match(template, /SyncPrivacyRoute: \{Type: AWS::ApiGatewayV2::Route, Properties: \{ApiId: !Ref ApiId, RouteKey: POST \/settings\/sync-privacy,/);
  assert.match(template, /TypingRoute: \{Type: AWS::ApiGatewayV2::Route, Properties: \{ApiId: !Ref ApiId, RouteKey: POST \/messages\/typing,/);
  const client = fs.readFileSync("assets/direct-messages.js", "utf8"), privacy = fs.readFileSync("assets/sync-privacy.js", "utf8"), html = fs.readFileSync("messages.html", "utf8"), i18n = fs.readFileSync("assets/i18n-sync.js", "utf8");
  assert.match(client, /messageTranslate\(read \? "Read" : delivered \? "Delivered" : "Sent"\)/);
  assert.match(client, /contactTyping \? messageTranslate\("typing…"\)/);
  assert.match(client, /if \(typing && Date\.now\(\) - typingSentAt < 4000\) return;/, "typing is sent at most every 4 s");
  assert.match(client, /globalThis\.danzstakStopTyping\?\.\(\); \/\/ 16-D/, "typing stops on send");
  assert.match(privacy, /fetch\(API \+ "\/settings\/sync-privacy"/);
  assert.match(html, /<script src="assets\/sync-privacy\.js\?v=\d+" defer><\/script>/);
  for (const lang of ["it", "fr", "es"]) { const b = i18n.slice(i18n.indexOf(`"${lang}": {`), i18n.indexOf("\n}", i18n.indexOf(`"${lang}": {`))); for (const k of ["Delivered", "typing…", "last seen today at {time}", "Read receipts", "Last seen and online"]) assert.ok(b.includes(JSON.stringify(k) + ":"), `${lang}: ${k}`); }
  console.log("SYNC ticks/typing/presence checks passed: sent → delivered → read, receipts off is reciprocal, typing 6 s on existing chats with contacts only, last seen everyone/friends/nobody (reciprocal), last seen written at most once a minute.");
})().catch(error => { console.error(error); process.exitCode = 1; });
