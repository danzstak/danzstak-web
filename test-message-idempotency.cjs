"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const source = template.slice(template.indexOf("async function sendMessage("), template.indexOf("async function editMessage("));
assert.match(source, /clientMessageId/, "message sends must carry a stable client ID");
assert.match(source, /ConditionExpression:'attribute_not_exists\(messageId\)'/, "the message write must reject duplicate IDs atomically");
assert.match(source, /if\(created\)await notifyMessage/, "a retried send must not deliver a second push alert");
assert.match(source, /unreadPending:\{BOOL:true\}/, "new messages must carry a retryable unread-accounting marker");
assert.match(source, /SET unreadCounted = :counted REMOVE unreadPending/, "unread accounting must be marked complete atomically");
assert.match(source, /UpdateExpression:'ADD unread :one'/, "each new message must increment rather than overwrite unread count");

class PutItemCommand { constructor(input) { this.input = input; } }
class GetItemCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }
class TransactWriteItemsCommand { constructor(input) { this.input = input; } }

const records = new Map();
const projections = new Map();
let pushes = 0;
let failProjectionOnce = false;
const keyOf = key => `${key.conversationId?.S || key.userEmail?.S}|${key.messageId?.S || key.contactEmail?.S}`;
const db = {
  async send(command) {
    if (command instanceof PutItemCommand) {
      const key = keyOf(command.input.Item);
      if (records.has(key)) throw Object.assign(new Error("duplicate"), { name: "ConditionalCheckFailedException" });
      records.set(key, command.input.Item);
      return {};
    }
    if (command instanceof GetItemCommand) return { Item: records.get(keyOf(command.input.Key)) };
    if (command instanceof TransactWriteItemsCommand) {
      const [messageWrite, conversationWrite] = command.input.TransactItems;
      const messageKey = keyOf(messageWrite.Update.Key);
      const message = records.get(messageKey);
      if (!message || message.unreadPending?.BOOL !== true || message.unreadCounted?.BOOL === true) {
        throw Object.assign(new Error("unread already counted"), { name: "TransactionCanceledException" });
      }
      const conversationKey = keyOf(conversationWrite.Update.Key);
      const previous = projections.get(conversationKey) || { preview: "", updatedAt: "", unread: 0 };
      message.unreadCounted = { BOOL: true };
      delete message.unreadPending;
      projections.set(conversationKey, { ...previous, unread: Number(previous.unread || 0) + 1 });
      return {};
    }
    if (command instanceof UpdateItemCommand) {
      if (failProjectionOnce) { failProjectionOnce = false; throw new Error("projection unavailable"); }
      const key = keyOf(command.input.Key), previous = projections.get(key);
      const nextAt = command.input.ExpressionAttributeValues[":u"].S;
      if (previous && previous.updatedAt >= nextAt) throw Object.assign(new Error("current projection"), { name: "ConditionalCheckFailedException" });
      projections.set(key, { preview: command.input.ExpressionAttributeValues[":p"].S, updatedAt: nextAt, unread: Number(previous?.unread || 0) });
      return {};
    }
    throw new Error("Unexpected command");
  }
};

const context = vm.createContext({
  PutItemCommand, GetItemCommand, UpdateItemCommand, TransactWriteItemsCommand, db,
  process: { env: { MESSAGES_TABLE: "messages", CONVERSATIONS_TABLE: "conversations" } },
  Date, Number,
  randomUUID: () => "33333333-3333-4333-8333-333333333333",
  json: (statusCode, body) => ({ statusCode, body }),
  canContact: async () => true,
  ownerPrefix: () => "owner",
  conversationId: (left, right) => [left, right].sort().join("#"),
  signedMediaUrl: () => "https://media.example.test/file",
  notifyMessage: async () => { pushes++; },
  console
});
vm.runInContext(source, context);

(async () => {
  const user = { email: "artist@example.test", userId: "artist" };
  const clientMessageId = `${String(Date.now()).padStart(13, "0")}#11111111-1111-4111-8111-111111111111`;
  const event = { body: JSON.stringify({ recipientEmail: "friend@example.test", content: "See you at soundcheck", clientMessageId }) };
  const first = await context.sendMessage(event, user);
  const retry = await context.sendMessage(event, user);
  assert.equal(first.statusCode, 201);
  assert.equal(retry.statusCode, 200);
  assert.equal(retry.body.duplicate, true);
  assert.equal(records.size, 1, "the same user action must create one durable message");
  assert.equal(pushes, 1, "the recipient must receive one push alert for a retried message");
  assert.equal(projections.size, 2, "both conversation projections must converge after a retry");
  const recipientProjectionKey = "friend@example.test|artist@example.test";
  assert.equal(projections.get(recipientProjectionKey)?.unread, 1, "one message plus a retry must produce one unread item");
  projections.get(recipientProjectionKey).unread = 0;
  const retryAfterRead = await context.sendMessage(event, user);
  assert.equal(retryAfterRead.statusCode, 200);
  assert.equal(projections.get(recipientProjectionKey)?.unread, 0, "a late idempotent retry must not resurrect an already-read message");

  const legacyRetryId = `${String(Date.now() + 2).padStart(13, "0")}#44444444-4444-4444-8444-444444444444`;
  const legacyRetryCreatedAt = new Date(Number(legacyRetryId.slice(0, 13))).toISOString();
  records.set(`artist@example.test#friend@example.test|${legacyRetryId}`, {
    conversationId: { S: "artist@example.test#friend@example.test" }, messageId: { S: legacyRetryId },
    senderEmail: { S: user.email }, recipientEmail: { S: "friend@example.test" },
    content: { S: "Pre-marker message" }, createdAt: { S: legacyRetryCreatedAt }, receivedAt: { S: legacyRetryCreatedAt }
  });
  const legacyRetry = await context.sendMessage({ body: JSON.stringify({ recipientEmail: "friend@example.test", content: "Pre-marker message", clientMessageId: legacyRetryId }) }, user);
  assert.equal(legacyRetry.body.duplicate, true);
  assert.equal(projections.get(recipientProjectionKey)?.unread, 0, "a retry of a pre-marker message must not double-count a legacy unread item");
  assert.equal(pushes, 1, "a retry of a pre-marker message must not send another push");

  const changed = await context.sendMessage({ body: JSON.stringify({ recipientEmail: "friend@example.test", content: "Changed payload", clientMessageId }) }, user);
  assert.equal(changed.statusCode, 409, "a client ID cannot be reused for different content");
  assert.equal(records.size, 2);
  assert.equal(pushes, 1);

  const legacy = await context.sendMessage({ body: JSON.stringify({ recipientEmail: "friend@example.test", content: "Legacy cached client" }) }, user);
  assert.equal(legacy.statusCode, 201, "a cached pre-release client without an ID must keep working during PWA rollout");
  assert.match(legacy.body.message.messageId, /^\d{13}#33333333-3333-4333-8333-333333333333$/);
  assert.equal(records.size, 3);
  assert.equal(pushes, 2);
  assert.equal(projections.get(recipientProjectionKey)?.unread, 1, "a second unique message must increment unread count from zero");

  const repairId = `${String(Date.now() + 1).padStart(13, "0")}#22222222-2222-4222-8222-222222222222`;
  const repairMediaKey = "messages/owner/44444444-4444-4444-8444-444444444444.jpg";
  const repairEvent = { body: JSON.stringify({ recipientEmail: "friend@example.test", content: "Projection repair", clientMessageId: repairId, mediaKey: repairMediaKey, mediaType: "image" }) };
  failProjectionOnce = true;
  await assert.rejects(context.sendMessage(repairEvent, user), /projection unavailable/);
  assert.equal(records.size, 4, "the durable message remains after a projection failure");
  assert.equal(pushes, 3, "the newly durable message receives one push attempt");
  assert.equal(projections.get(recipientProjectionKey)?.unread, 2, "the durable message must increment unread before a projection retry");
  assert.equal([...records.values()].find(item => item.messageId.S === repairId)?.mediaKey?.S, repairMediaKey, "the committed attachment must remain linked after a projection failure");
  const repaired = await context.sendMessage(repairEvent, user);
  assert.equal(repaired.statusCode, 200);
  assert.equal(repaired.body.duplicate, true);
  assert.equal(repaired.body.message.mediaUrl, "https://media.example.test/file", "the delivered replay must retain its readable attachment");
  assert.equal(records.size, 4, "repairing projections must not create another message");
  assert.equal(pushes, 3, "repairing projections must not send another push");
  assert.equal(projections.size, 2, "a retry must repair both conversation projections");
  assert.equal(projections.get(recipientProjectionKey)?.unread, 2, "projection repair must not count the same message twice");
  const changedMedia = await context.sendMessage({ body: JSON.stringify({ recipientEmail: "friend@example.test", content: "Projection repair", clientMessageId: repairId, mediaKey: "messages/owner/55555555-5555-4555-8555-555555555555.jpg", mediaType: "image" }) }, user);
  assert.equal(changedMedia.statusCode, 409, "an uncertain attachment retry must keep the exact original media key");
  assert.equal([...records.values()].find(item => item.messageId.S === repairId)?.mediaKey?.S, repairMediaKey, "a mismatched replay cannot replace or delete accepted media");
  assert.equal(pushes, 3, "a mismatched media replay cannot send another push");
  console.log("Message idempotency checks passed: one durable write, one push, exact media replay, atomic unread counting, safe retry, projection repair, and payload collision rejection.");
})().catch(error => { console.error(error); process.exitCode = 1; });
