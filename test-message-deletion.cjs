const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const deletionCode = source.slice(source.indexOf("async function deleteMessage("), source.indexOf("async function reactMessage("));

class GetItemCommand { constructor(input) { this.input = input; } }
class QueryCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }

const sender = "artist@example.com";
const contact = "venue@example.com";
const messageId = "1700000000001#11111111-1111-4111-a111-111111111111";
const previousId = "1700000000000#22222222-2222-4222-a222-222222222222";
const mediaKey = "messages/ownerhash/33333333-3333-4333-a333-333333333333.jpg";

function harness({ storedSender = sender, storedMediaKey = mediaKey, failMediaAttempts = 0, failReactionAttempts = 0, failPreview = false } = {}) {
  const events = [];
  const message = {
    conversationId: { S: "conversation" }, messageId: { S: messageId }, senderEmail: { S: storedSender },
    recipientEmail: { S: contact }, content: { S: "Newest message" }, createdAt: { S: "2026-11-08T10:00:01.000Z" },
    ...(storedMediaKey ? { mediaKey: { S: storedMediaKey }, mediaType: { S: "image" } } : {})
  };
  let mediaAttempts = 0;
  let reactionAttempts = 0;
  const context = vm.createContext({
    process: { env: { MESSAGES_TABLE: "messages", MESSAGE_REACTIONS_TABLE: "reactions", CONVERSATIONS_TABLE: "conversations", MEDIA_BUCKET: "media" } },
    GetItemCommand, QueryCommand, UpdateItemCommand, DeleteItemCommand, DeleteObjectCommand,
    conversationId: () => "conversation", ownerPrefix: () => "ownerhash",
    json: (statusCode, body) => ({ statusCode, body: JSON.stringify(body) }), console: { ...console, error: () => {} },
    queryAll: async (input, maximumItems) => {
      events.push({ type: "query-reactions", maximumItems });
      return [
        { conversationId: { S: "conversation" }, reactionId: { S: `${messageId}#one` }, messageId: { S: messageId } },
        { conversationId: { S: "conversation" }, reactionId: { S: `${previousId}#two` }, messageId: { S: previousId } }
      ];
    },
    s3: { send: async command => {
      mediaAttempts += 1;
      events.push({ type: "media-delete", input: command.input });
      if (mediaAttempts <= failMediaAttempts) throw Error("temporary storage failure");
      return {};
    } },
    db: { send: async command => {
      if (command instanceof GetItemCommand) return { Item: message };
      if (command instanceof QueryCommand) return { Items: [message, { conversationId: { S: "conversation" }, messageId: { S: previousId }, senderEmail: { S: contact }, recipientEmail: { S: sender }, content: { S: "Previous message" }, createdAt: { S: "2026-11-08T10:00:00.000Z" } }] };
      if (command instanceof UpdateItemCommand) {
        events.push({ type: "conversation-update", input: command.input });
        if (failPreview) throw Error("temporary preview failure");
        return {};
      }
      if (command instanceof DeleteItemCommand) {
        const table = command.input.TableName;
        events.push({ type: table === "messages" ? "message-delete" : "reaction-delete", input: command.input });
        if (table === "reactions" && ++reactionAttempts <= failReactionAttempts) throw Error("temporary reaction failure");
        return {};
      }
      throw Error("Unexpected database command");
    } }
  });
  vm.runInContext(deletionCode, context);
  return { context, events, mediaAttempts: () => mediaAttempts, reactionAttempts: () => reactionAttempts };
}

(async () => {
  const denied = harness({ storedSender: contact });
  const deniedResponse = await denied.context.deleteMessage({ contactEmail: contact, messageId, scope: "everyone" }, { email: sender });
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(denied.events.length, 0, "a recipient cannot delete the sender's message or attachment");

  const foreignMedia = harness({ storedMediaKey: "messages/someone-else/file.jpg" });
  const foreignResponse = await foreignMedia.context.deleteMessage({ contactEmail: contact, messageId, scope: "everyone" }, { email: sender });
  assert.equal(foreignResponse.statusCode, 409);
  assert.equal(foreignMedia.events.length, 0, "a mismatched storage owner must not trigger destructive work");

  const unavailable = harness({ failMediaAttempts: 3 });
  const unavailableResponse = await unavailable.context.deleteMessage({ contactEmail: contact, messageId, scope: "everyone" }, { email: sender });
  assert.equal(unavailableResponse.statusCode, 503);
  assert.deepEqual(JSON.parse(unavailableResponse.body), { error: "Message attachment could not be removed yet. Try again.", deleted: false });
  assert.equal(unavailable.mediaAttempts(), 3, "message media deletion gets the complete retry budget");
  assert.ok(!unavailable.events.some(event => ["reaction-delete", "conversation-update", "message-delete"].includes(event.type)), "database records must remain retryable while media removal is unavailable");

  const success = harness({ failMediaAttempts: 2, failReactionAttempts: 2 });
  const successResponse = await success.context.deleteMessage({ contactEmail: contact, messageId, scope: "everyone" }, { email: sender });
  assert.equal(successResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(successResponse.body), { deleted: true, scope: "everyone", cleanupPending: false });
  assert.equal(success.mediaAttempts(), 3, "temporary storage failures are retried");
  assert.equal(success.reactionAttempts(), 3, "temporary reaction cleanup failures are retried");
  assert.equal(success.events.find(event => event.type === "query-reactions").maximumItems, Number.MAX_SAFE_INTEGER, "reaction cleanup cannot stop at the shared query helper limit");
  const updates = success.events.filter(event => event.type === "conversation-update");
  assert.equal(updates.length, 2, "both conversation owners receive a corrected preview");
  assert.ok(updates.every(event => event.input.ExpressionAttributeValues[":p"].S === "Previous message"), "the preview returns to real conversation content instead of a deletion placeholder");
  const messageDeleteIndex = success.events.findIndex(event => event.type === "message-delete");
  assert.ok(success.events.findIndex(event => event.type === "media-delete") < messageDeleteIndex, "attachment removal must precede destruction of the retry record");
  assert.ok(success.events.findIndex(event => event.type === "conversation-update") < messageDeleteIndex, "conversation references must be cleaned before the source record disappears");

  const removeHere = harness();
  const removeHereResponse = await removeHere.context.deleteMessage({ contactEmail: contact, messageId, scope: "me" }, { email: sender });
  assert.equal(removeHereResponse.statusCode, 200);
  assert.equal(removeHere.events.filter(event => event.type === "conversation-update").length, 1, "remove for me only changes the requesting account state");
  assert.ok(!removeHere.events.some(event => ["media-delete", "reaction-delete", "message-delete"].includes(event.type)), "remove for me must preserve the shared message and its media");

  console.log("Message deletion checks passed: sender authorization, storage-first cleanup, retries, preview repair, and remove-here isolation.");
})().catch(error => { console.error(error); process.exitCode = 1; });
