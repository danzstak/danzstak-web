const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const deletionCode = source.slice(source.indexOf("async function deleteStory("), source.indexOf("async function refreshSession("));

class GetItemCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }

const storyId = "11111111-1111-4111-a111-111111111111";
const owner = "artist@example.com";
const mediaKey = "stories/ownerhash/22222222-2222-4222-a222-222222222222.jpg";

function harness({ storedOwner = owner, storedMediaKey = mediaKey, dedicated = true, failMediaAttempts = 0, failRecordAttempts = 0 } = {}) {
  const events = [];
  let mediaAttempts = 0;
  let recordAttempts = 0;
  const context = vm.createContext({
    process: { env: { STORIES_TABLE: "stories", MEDIA_BUCKET: "media" } },
    GetItemCommand, DeleteItemCommand, DeleteObjectCommand,
    ownerPrefix: () => "ownerhash",
    json: (statusCode, body) => ({ statusCode, body: JSON.stringify(body) }),
    console: { ...console, error: () => {} },
    s3: { send: async command => {
      mediaAttempts += 1;
      events.push({ type: "media-delete", input: command.input });
      if (mediaAttempts <= failMediaAttempts) throw Error("temporary storage failure");
      return {};
    } },
    db: { send: async command => {
      if (command instanceof GetItemCommand) return { Item: { storyId: { S: storyId }, userEmail: { S: storedOwner }, ...(storedMediaKey ? { mediaKey: { S: storedMediaKey }, dedicated: { BOOL: dedicated } } : {}) } };
      if (command instanceof DeleteItemCommand) {
        recordAttempts += 1;
        events.push({ type: "record-delete", input: command.input });
        if (recordAttempts <= failRecordAttempts) throw Error("temporary record failure");
        return {};
      }
      throw Error("Unexpected database command");
    } }
  });
  vm.runInContext(deletionCode, context);
  return { context, events, mediaAttempts: () => mediaAttempts, recordAttempts: () => recordAttempts };
}

(async () => {
  const denied = harness({ storedOwner: "someone@example.com" });
  const deniedResponse = await denied.context.deleteStory({ pathParameters: { storyId } }, { email: owner });
  assert.equal(deniedResponse.statusCode, 403);
  assert.equal(denied.events.length, 0, "a different member cannot remove the creator's Story or media");

  const foreignMedia = harness({ storedMediaKey: "stories/someone-else/file.jpg" });
  const foreignResponse = await foreignMedia.context.deleteStory({ pathParameters: { storyId } }, { email: owner });
  assert.equal(foreignResponse.statusCode, 409);
  assert.equal(foreignMedia.events.length, 0, "foreign media must never be removed by Story deletion");

  const unavailable = harness({ failMediaAttempts: 3 });
  const unavailableResponse = await unavailable.context.deleteStory({ pathParameters: { storyId } }, { email: owner });
  assert.equal(unavailableResponse.statusCode, 503);
  assert.deepEqual(JSON.parse(unavailableResponse.body), { error: "Story media could not be removed yet. Try again.", deleted: false });
  assert.equal(unavailable.mediaAttempts(), 3, "Story media receives the complete retry budget");
  assert.ok(!unavailable.events.some(event => event.type === "record-delete"), "the Story record must remain available to retry when storage is unavailable");

  const success = harness({ failMediaAttempts: 2, failRecordAttempts: 2 });
  const successResponse = await success.context.deleteStory({ pathParameters: { storyId } }, { email: owner });
  assert.equal(successResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(successResponse.body), { deleted: true, cleanupPending: false });
  assert.equal(success.mediaAttempts(), 3, "temporary Story media failures are retried");
  assert.equal(success.recordAttempts(), 3, "temporary Story record failures are retried");
  assert.ok(success.events.findIndex(event => event.type === "media-delete") < success.events.findIndex(event => event.type === "record-delete"), "private media must be removed before its retry record");
  const recordDelete = success.events.find(event => event.type === "record-delete").input;
  assert.equal(recordDelete.ConditionExpression, "userEmail = :owner", "the final Story deletion rechecks creator ownership");

  const reel = harness({ storedMediaKey: "", dedicated: false });
  const reelResponse = await reel.context.deleteStory({ pathParameters: { storyId } }, { email: owner });
  assert.equal(reelResponse.statusCode, 200);
  assert.equal(reel.mediaAttempts(), 0, "link-only Roll items do not invent stored media cleanup");
  assert.equal(reel.recordAttempts(), 1, "link-only Roll items still remove their owned record");

  console.log("Story deletion checks passed: creator authorization, storage-first cleanup, retries, ownership conditions, and link-only removal.");
})().catch(error => { console.error(error); process.exitCode = 1; });
