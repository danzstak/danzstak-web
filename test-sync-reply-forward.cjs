"use strict";
// Task 16-E reply / forward / edit / delete. Runs the real call-signaling Lambda code against a fake DynamoDB:
// - reply stores only the original's id; the quote is read from the original, so a message deleted for everyone also
//   vanishes from every quote; replying to a gone message is refused;
// - forward: text only, 1-5 chats, copies are marked Forwarded and point at the root original; the original sender's
//   "delete for everyone" removes every forwarded copy (CLAUDE.md delete rules); a forwarder can't edit a copy;
// - edit only within 15 minutes.
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
const messages = new Map(), conversations = new Map();
const mk = (c, m) => `${c}|${m}`;
const FRIENDS = ["alice@example.test", "bob@example.test", "carol@example.test", "dan@example.test", "eve@example.test", "fay@example.test", "gus@example.test"];
const isFriend = (a, b) => FRIENDS.includes(a) && FRIENDS.includes(b);
function applyUpdate(item, input) {
  const values = input.ExpressionAttributeValues || {};
  const expr = input.UpdateExpression;
  const set = expr.match(/SET (.+?)(?: ADD | REMOVE |$)/)?.[1], add = expr.match(/ADD (.+?)(?: SET | REMOVE |$)/)?.[1], remove = expr.match(/REMOVE (.+)$/)?.[1];
  if (set) for (const part of set.split(", ")) { const [field, value] = part.split(" = "); item[field.replace(/^#/, "")] = values[value.trim()]; }
  if (add) for (const part of add.split(", ")) { const [field, value] = part.trim().split(" "); const v = values[value]; if (v.SS) item[field] = { SS: [...new Set([...(item[field]?.SS || []), ...v.SS])] }; else if (v.N) item[field] = { N: String(Number(item[field]?.N || 0) + Number(v.N)) }; }
  if (remove) for (const field of remove.split(", ")) delete item[field.trim()];
}
class DynamoDBClient {
  async send(request) {
    const input = request.input, name = request.commandName, table = input.TableName;
    if (table === "friends" && name === "GetItemCommand") return { Item: isFriend(input.Key.userEmail.S, input.Key.friendEmail.S) ? { status: { S: "friends" } } : undefined };
    if (table === "messages") {
      if (name === "GetItemCommand") return { Item: messages.get(mk(input.Key.conversationId.S, input.Key.messageId.S)) };
      if (name === "PutItemCommand") { const k = mk(input.Item.conversationId.S, input.Item.messageId.S); if (messages.has(k)) { const e = new Error("exists"); e.name = "ConditionalCheckFailedException"; throw e; } messages.set(k, { ...input.Item }); return {}; }
      if (name === "UpdateItemCommand") { const item = messages.get(mk(input.Key.conversationId.S, input.Key.messageId.S)); if (!item) { const e = new Error("gone"); e.name = "ConditionalCheckFailedException"; throw e; } applyUpdate(item, input); return { Attributes: item }; }
      if (name === "DeleteItemCommand") { messages.delete(mk(input.Key.conversationId.S, input.Key.messageId.S)); return {}; }
      if (name === "QueryCommand") { const c = input.ExpressionAttributeValues[":c"].S; const items = [...messages.values()].filter(m => m.conversationId.S === c).sort((a, b) => a.messageId.S.localeCompare(b.messageId.S)); return { Items: input.ScanIndexForward === false ? items.reverse().slice(0, input.Limit || 50) : items }; }
    }
    if (table === "conversations") {
      const k = input.Key ? mk(input.Key.userEmail.S, input.Key.contactEmail.S) : "";
      if (name === "GetItemCommand") return { Item: conversations.get(k) };
      if (name === "UpdateItemCommand") { const item = conversations.get(k) || { userEmail: input.Key.userEmail, contactEmail: input.Key.contactEmail }; applyUpdate(item, input); conversations.set(k, item); return {}; }
    }
    if (name === "TransactWriteItemsCommand") { for (const t of input.TransactItems) { if (t.Update) await this.send(new commands.UpdateItemCommand(t.Update)); } return {}; }
    if (name === "QueryCommand" || name === "ScanCommand") return { Items: [] };
    if (name === "GetItemCommand") return {};
    if (name === "UpdateItemCommand" || name === "PutItemCommand" || name === "DeleteItemCommand") return {};
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
const runtime = { env: { MESSAGES_TABLE: "messages", CONVERSATIONS_TABLE: "conversations", MESSAGE_REACTIONS_TABLE: "reactions", FRIENDS_TABLE: "friends", GROUPS_TABLE: "groups", SETTINGS_TABLE: "settings", PUSH_SUBSCRIPTIONS_TABLE: "push", USER_POOL_ID: "pool", MEDIA_BUCKET: "bucket", AWS_REGION: "us-west-1" } };
const moduleShim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={sendMessage,getMessages,conversationId};`)(fakeRequire, moduleShim, moduleShim.exports, runtime, Buffer, URL, { ...console, error() {} });
const { sendMessage, getMessages, conversationId } = moduleShim.exports.__test;
const [alice, bob, carol] = ["alice", "bob", "carol"].map(n => ({ email: `${n}@example.test`, userId: n }));
const send = async (user, body) => { const r = await sendMessage({ body: JSON.stringify(body) }, user); return { status: r.statusCode, data: JSON.parse(r.body) }; };
const thread = async (user, contact) => JSON.parse((await getMessages({ queryStringParameters: { contact } }, user)).body).messages;
const id = () => `${String(Date.now()).padStart(13, "0")}#${require("node:crypto").randomUUID()}`;

(async () => {
  // Reply.
  const original = await send(alice, { recipientEmail: bob.email, content: "Load-in is at 6", clientMessageId: id() });
  assert.equal(original.status, 201);
  const reply = await send(bob, { recipientEmail: alice.email, content: "Got it", clientMessageId: id(), replyToId: original.data.message.messageId });
  assert.equal(reply.status, 201);
  assert.equal(reply.data.message.replyTo.snippet, "Load-in is at 6", "the send response already carries the quote");
  const stored = messages.get(mk(conversationId(alice.email, bob.email), reply.data.message.messageId));
  assert.equal(stored.replyToId.S, original.data.message.messageId, "only the id is stored");
  assert.equal(stored.replyToSnippet, undefined, "no copy of the quoted text is stored");
  let view = await thread(alice, bob.email);
  assert.deepEqual(view.find(m => m.content === "Got it").replyTo, { messageId: original.data.message.messageId, senderEmail: alice.email, snippet: "Load-in is at 6" });
  assert.equal((await send(bob, { recipientEmail: alice.email, content: "x", clientMessageId: id(), replyToId: "123" })).status, 400);
  // Forward: limits.
  const tooMany = await sendMessage({ body: JSON.stringify({ action: "forward", contactEmail: bob.email, messageId: original.data.message.messageId, recipients: FRIENDS.slice(1) }) }, alice);
  assert.equal(tooMany.statusCode, 400, "more than 5 chats is refused");
  assert.equal(JSON.parse(tooMany.body).code, "FORWARD_LIMIT");
  const forwarded = JSON.parse((await sendMessage({ body: JSON.stringify({ action: "forward", contactEmail: bob.email, messageId: original.data.message.messageId, recipients: [carol.email, "dan@example.test"] }) }, alice)).body);
  assert.equal(forwarded.forwarded, 2);
  const carolView = await thread(carol, alice.email);
  assert.equal(carolView.length, 1); assert.equal(carolView[0].forwarded, true, "the copy says Forwarded"); assert.equal(carolView[0].content, "Load-in is at 6");
  // Bob (the recipient) can forward it too; his copy points at the same root.
  await sendMessage({ body: JSON.stringify({ action: "forward", contactEmail: alice.email, messageId: original.data.message.messageId, recipients: ["eve@example.test"] }) }, bob);
  const root = messages.get(mk(conversationId(alice.email, bob.email), original.data.message.messageId));
  assert.equal(root.forwardedTo.SS.length, 3, "the original lists every forwarded copy");
  // Forwarded copies can't be edited by the forwarder.
  const copy = carolView[0];
  const editCopy = await sendMessage({ body: JSON.stringify({ action: "edit", contactEmail: carol.email, messageId: copy.messageId, content: "changed" }) }, alice);
  assert.equal(editCopy.statusCode, 403);
  // Edit window: 15 minutes.
  const fresh = await send(alice, { recipientEmail: bob.email, content: "typo", clientMessageId: id() });
  assert.equal((await sendMessage({ body: JSON.stringify({ action: "edit", contactEmail: bob.email, messageId: fresh.data.message.messageId, content: "fixed" }) }, alice)).statusCode, 200, "editing inside 15 minutes works");
  const oldId = `${String(Date.now() - 16 * 60 * 1000).padStart(13, "0")}#${require("node:crypto").randomUUID()}`;
  await send(alice, { recipientEmail: bob.email, content: "old one", clientMessageId: oldId });
  const late = await sendMessage({ body: JSON.stringify({ action: "edit", contactEmail: bob.email, messageId: oldId, content: "too late" }) }, alice);
  assert.equal(late.statusCode, 403); assert.equal(JSON.parse(late.body).code, "EDIT_WINDOW_CLOSED");
  // Delete for everyone: the quote and every forwarded copy disappear.
  const removed = await sendMessage({ body: JSON.stringify({ action: "delete", contactEmail: bob.email, messageId: original.data.message.messageId, scope: "everyone" }) }, alice);
  assert.equal(removed.statusCode, 200); assert.equal(JSON.parse(removed.body).cleanupPending, false);
  view = await thread(bob, alice.email);
  assert.ok(!view.some(m => m.content === "Load-in is at 6"), "the original is gone");
  assert.equal(view.find(m => m.content === "Got it").replyTo, undefined, "the quote is gone too, no placeholder");
  assert.equal((await thread(carol, alice.email)).length, 0, "Alice's forward to Carol is gone");
  assert.equal((await thread({ email: "dan@example.test" }, alice.email)).length, 0, "…and to Dan");
  assert.equal((await thread({ email: "eve@example.test" }, bob.email)).length, 0, "…and Bob's forward to Eve");
  assert.equal((await send(bob, { recipientEmail: alice.email, content: "late reply", clientMessageId: id(), replyToId: original.data.message.messageId })).status, 404, "can't reply to a deleted message");
  // A media message can't be forwarded (text only for now).
  const mediaId = id();
  messages.set(mk(conversationId(alice.email, bob.email), mediaId), { conversationId: { S: conversationId(alice.email, bob.email) }, messageId: { S: mediaId }, senderEmail: { S: alice.email }, recipientEmail: { S: bob.email }, content: { S: "" }, mediaKey: { S: "messages/a/x.jpg" }, mediaType: { S: "image" }, createdAt: { S: new Date().toISOString() } });
  assert.equal(JSON.parse((await sendMessage({ body: JSON.stringify({ action: "forward", contactEmail: bob.email, messageId: mediaId, recipients: [carol.email] }) }, alice)).body).code, "FORWARD_TEXT_ONLY");
  // Client wiring.
  const client = fs.readFileSync("assets/direct-messages.js", "utf8"), reply16e = fs.readFileSync("assets/sync-reply.js", "utf8"), html = fs.readFileSync("messages.html", "utf8"), i18n = fs.readFileSync("assets/i18n-sync.js", "utf8");
  assert.match(client, /Date\.now\(\) - Date\.parse\(message\.createdAt\) < 15 \* 60 \* 1000/, "Edit only offered for 15 minutes");
  assert.match(client, /\.\.\.\(replyToId \? \{ replyToId \} : \{\}\)/);
  assert.match(client, /globalThis\.danzstakSyncReply\?\.decorate\?\.\(item, message/);
  assert.match(reply16e, /MAX_FORWARD = 5/);
  assert.match(reply16e, /if \(dx > 60\) start\(message, context\)/, "swipe right to reply");
  assert.match(reply16e, /for \(let page = 0; !target && page < 5/, "jumping to an old quote loads at most 5 earlier pages");
  assert.match(html, /<script src="assets\/sync-reply\.js\?v=\d+" defer><\/script>/);
  for (const lang of ["it", "fr", "es"]) { const b = i18n.slice(i18n.indexOf(`"${lang}": {`), i18n.indexOf("\n}", i18n.indexOf(`"${lang}": {`))); for (const k of ["Reply", "Forward", "Forwarded", "Replying to {name}", "Forward to…"]) assert.ok(b.includes(JSON.stringify(k) + ":"), `${lang}: ${k}`); }
  console.log("SYNC reply/forward checks passed: quotes resolved from the original (vanish on delete), forward text to 1-5 chats with copies removed by the original's delete-for-everyone, copies not editable, edit within 15 minutes.");
})().catch(error => { console.error(error); process.exitCode = 1; });
