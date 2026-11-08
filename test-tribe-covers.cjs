const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const infra = fs.readFileSync("infrastructure/engagement/template.yaml", "utf8");
const signaling = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const enhancements = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const styles = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const coverCode = api.slice(api.indexOf("const groupCoverKeyPattern"), api.indexOf("async function broadcastGroup"));

class HeadObjectCommand { constructor(input) { this.input = input; } }
class GetItemCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }

const groupId = "11111111-1111-4111-a111-111111111111";
const ownerId = "22222222-2222-4222-a222-222222222222";
const ownerEmail = "owner@example.com";
const oldCover = "users/aaaaaaaaaaaaaaaaaaaaaaaa/33333333-3333-4333-a333-333333333333.jpg";
const queuedCover = "users/bbbbbbbbbbbbbbbbbbbbbbbb/44444444-4444-4444-a444-444444444444.jpg";
const newCover = "users/cccccccccccccccccccccccc/55555555-5555-4555-a555-555555555555.jpg";
const alternateCover = "users/cccccccccccccccccccccccc/66666666-6666-4666-a666-666666666666.jpg";

function harness({
  meta = { ownerId: { S: ownerId }, coverKey: { S: oldCover } },
  failMedia = new Set(),
  failUpdateConflict = false,
  failMemberAttempts = 0,
  failMetaAttempts = 0
} = {}) {
  const events = [];
  const updates = [];
  const mediaAttempts = new Map();
  const state = JSON.parse(JSON.stringify(meta));
  let claimSequence = 0;
  let memberAttempts = 0;
  let metaAttempts = 0;
  const context = vm.createContext({
    corsHeaders: () => ({}),
    allowedOrigins: new Set(["https://danzstak.com"]),
    getAuthenticatedUser: async () => ownerId,
    accountForSub: async () => ownerEmail,
    groupRecord: async () => state,
    groupMembership: async () => null,
    parseJsonBody: event => JSON.parse(event.body || "{}"),
    sha256: () => "cccccccccccccccccccccccc0000000000000000000000000000000000000000",
    randomUUID: () => `claim-${++claimSequence}`,
    now: () => 100,
    signedMediaUrl: key => `https://media.example/${key}`,
    groupsTable: "groups",
    mediaBucket: "media",
    HeadObjectCommand,
    GetItemCommand,
    UpdateItemCommand,
    DeleteItemCommand,
    DeleteObjectCommand,
    scanAll: async () => [{ userEmail: { S: "member@example.com" }, groupId: { S: groupId } }],
    s3: { send: async command => {
      if (command instanceof HeadObjectCommand) { events.push(`head:${command.input.Key}`); return {}; }
      const key = command.input.Key;
      mediaAttempts.set(key, (mediaAttempts.get(key) || 0) + 1);
      events.push(`media:${key}`);
      if (failMedia.has(key)) throw new Error("temporary storage failure");
      return {};
    } },
    db: { send: async command => {
      if (command instanceof GetItemCommand) return { Item: state };
      if (command instanceof UpdateItemCommand) {
        updates.push(command.input);
        events.push(`update:${command.input.UpdateExpression}`);
        const input = command.input, values = input.ExpressionAttributeValues || {};
        const conflict = () => { const error = new Error("concurrent update"); error.name = "ConditionalCheckFailedException"; throw error; };
        if (input.UpdateExpression.startsWith("SET coverKey")) {
          if (failUpdateConflict || state.coverCleanupClaim && Number(state.coverCleanupClaimExpiresAt?.N || 0) >= 100) conflict();
          const expected = values[":oldCover"]?.S;
          if (expected ? state.coverKey?.S !== expected : state.coverKey) conflict();
          state.coverKey = values[":cover"];
          if (values[":coverCleanup"]) state.coverCleanup = values[":coverCleanup"];
          else delete state.coverCleanup;
          delete state.coverCleanupClaim; delete state.coverCleanupClaimKey; delete state.coverCleanupClaimExpiresAt;
          return {};
        }
        if (input.UpdateExpression.startsWith("SET coverCleanupClaim")) {
          const key = values[":candidate"].S, requiresQueue = input.ConditionExpression.startsWith("contains");
          if (requiresQueue && !(state.coverCleanup?.SS || []).includes(key) || state.coverCleanupClaim || input.ConditionExpression.includes("coverKey <> :candidate") && state.coverKey?.S === key) conflict();
          state.coverCleanupClaim = values[":claim"];
          state.coverCleanupClaimKey = values[":candidate"];
          state.coverCleanupClaimExpiresAt = values[":expires"];
          return {};
        }
        if (input.ConditionExpression?.includes("coverCleanupClaim = :claim")) {
          if (state.coverCleanupClaim?.S !== values[":claim"].S || state.coverCleanupClaimKey?.S !== values[":candidate"].S) conflict();
          if (values[":resolved"] && state.coverCleanup) state.coverCleanup.SS = state.coverCleanup.SS.filter(key => !values[":resolved"].SS.includes(key));
          delete state.coverCleanupClaim; delete state.coverCleanupClaimKey; delete state.coverCleanupClaimExpiresAt;
          return {};
        }
        if (input.ConditionExpression === "coverKey = :candidate" && state.coverKey?.S !== values[":candidate"].S) conflict();
        if (values[":resolved"] && state.coverCleanup) state.coverCleanup.SS = state.coverCleanup.SS.filter(key => !values[":resolved"].SS.includes(key));
        return {};
      }
      if (command instanceof DeleteItemCommand) {
        const isMeta = command.input.Key.groupId.S === "META";
        if (isMeta) {
          metaAttempts += 1;
          events.push("delete:meta");
          if (metaAttempts <= failMetaAttempts) throw new Error("temporary metadata failure");
        } else {
          memberAttempts += 1;
          events.push("delete:member");
          if (memberAttempts <= failMemberAttempts) throw new Error("temporary member failure");
        }
        return {};
      }
      throw new Error("Unexpected database command");
    } },
    console: { ...console, error() {} }
  });
  vm.runInContext(coverCode, context);
  return { context, events, updates, mediaAttempts, state, memberAttempts: () => memberAttempts, metaAttempts: () => metaAttempts };
}

(async () => {
  assert.match(api, /Only an Elder can change the Tribe cover/);
  assert.match(api, /new HeadObjectCommand/);
  assert.match(api, /coverCleanup = :coverCleanup/);
  assert.match(api, /DELETE coverCleanup :resolved/);
  assert.match(api, /ownerId = :owner AND.*coverKey = :cover/, "a concurrent cover change must keep Tribe deletion retryable");
  assert.match(api, /coverUrl: item\.coverKey/);
  assert.match(infra, /RouteKey: 'POST \/groups\/\{groupId\}\/cover'/);
  assert.match(infra, /dynamodb:UpdateItem/);
  assert.match(signaling, /postUpload=new RegExp/);
  assert.match(signaling, /!storyUpload&&!postUpload/);
  assert.match(enhancements, /group\.coverUrl/);
  assert.match(enhancements, /tribe-cover-edit/);
  assert.match(enhancements, /purpose: "post"/);
  assert.match(enhancements, /\/cover"/);
  assert.match(enhancements, /discardUploadedMedia/);
  assert.match(styles, /\.tribe-hero-cover\{position:relative;background-position:center;background-size:cover\}/);
  assert.match(feed, /feed-enhancements\.js\?v=\d+/, "Tribe cover behavior must use a versioned script URL");
  assert.match(feed, /feed-enhancements\.css\?v=\d+/);

  const replacementFailure = harness({ failMedia: new Set([oldCover]) });
  const replacementResponse = await replacementFailure.context.updateGroupCover({
    headers: { origin: "https://danzstak.com" },
    pathParameters: { groupId },
    body: JSON.stringify({ mediaKey: newCover })
  });
  assert.equal(replacementResponse.statusCode, 200, "a committed new cover remains usable while old-media cleanup is retryable");
  assert.equal(JSON.parse(replacementResponse.body).cleanupPending, 1);
  assert.equal(replacementFailure.mediaAttempts.get(oldCover), 3, "old cover cleanup receives three bounded attempts");
  assert.match(replacementFailure.updates[0].UpdateExpression, /coverCleanup = :coverCleanup/, "the replaced key is committed to a durable queue with the new cover");
  assert.match(replacementFailure.updates[0].ConditionExpression, /coverKey = :oldCover/, "a stale Elder cannot overwrite a newer cover");
  assert.deepEqual([...replacementFailure.updates[0].ExpressionAttributeValues[":coverCleanup"].SS], [oldCover]);

  const replacementConflict = harness({ failUpdateConflict: true });
  const conflictResponse = await replacementConflict.context.updateGroupCover({
    headers: { origin: "https://danzstak.com" },
    pathParameters: { groupId },
    body: JSON.stringify({ mediaKey: newCover })
  });
  assert.equal(conflictResponse.statusCode, 409);
  assert.equal(replacementConflict.mediaAttempts.size, 0, "a rejected stale update does not remove the active cover");

  const recovery = harness({ meta: { ownerId: { S: ownerId }, coverKey: { S: newCover }, coverCleanup: { SS: [oldCover, queuedCover] } } });
  const recoveryResponse = await recovery.context.updateGroupCover({
    headers: { origin: "https://danzstak.com" },
    pathParameters: { groupId },
    body: JSON.stringify({ mediaKey: newCover })
  });
  assert.equal(JSON.parse(recoveryResponse.body).cleanupPending, 0);
  assert.equal(recovery.mediaAttempts.get(oldCover), 1);
  assert.equal(recovery.mediaAttempts.get(queuedCover), 1);
  assert.deepEqual(Array.from(recovery.state.coverCleanup.SS), [], "a later cover save drains earlier cleanup work");

  const reselected = harness({ meta: { ownerId: { S: ownerId }, coverKey: { S: alternateCover }, coverCleanup: { SS: [newCover] } } });
  const reselectedResponse = await reselected.context.updateGroupCover({ headers: { origin: "https://danzstak.com" }, pathParameters: { groupId }, body: JSON.stringify({ mediaKey: newCover }) });
  assert.equal(reselectedResponse.statusCode, 200);
  assert.equal(reselected.mediaAttempts.has(newCover), false, "A to B failed cleanup to A never deletes the reselected active cover");
  assert.equal(reselected.mediaAttempts.get(alternateCover), 1, "the newly replaced B cover becomes the only cleanup candidate");

  const sameActive = harness({ meta: { ownerId: { S: ownerId }, coverKey: { S: oldCover }, coverCleanup: { SS: [oldCover] } } });
  const sameActiveResult = await sameActive.context.cleanupGroupCoverObjects(groupId, [oldCover]);
  assert.deepEqual(JSON.parse(JSON.stringify(sameActiveResult)), { cleaned: 1, pending: 0 });
  assert.equal(sameActive.mediaAttempts.has(oldCover), false, "an authoritative active Tribe cover cannot be deleted from a stale queue");
  assert.deepEqual(Array.from(sameActive.state.coverCleanup.SS), []);

  const cleanupInProgress = harness({ meta: { ownerId: { S: ownerId }, coverKey: { S: oldCover }, coverCleanup: { SS: [queuedCover] }, coverCleanupClaim: { S: "other-device" }, coverCleanupClaimKey: { S: queuedCover }, coverCleanupClaimExpiresAt: { N: "400" } } });
  const busyResponse = await cleanupInProgress.context.updateGroupCover({ headers: { origin: "https://danzstak.com" }, pathParameters: { groupId }, body: JSON.stringify({ mediaKey: newCover }) });
  assert.equal(busyResponse.statusCode, 409, "a concurrent device cannot reactivate media while its cleanup lease is active");
  assert.equal(cleanupInProgress.mediaAttempts.size, 0);

  const storageUnavailable = harness({ failMedia: new Set([oldCover]) });
  const storageResponse = await storageUnavailable.context.deleteGroup({ headers: { origin: "https://danzstak.com" }, pathParameters: { groupId } });
  assert.equal(storageResponse.statusCode, 503);
  assert.deepEqual(JSON.parse(storageResponse.body), { error: "Tribe cover could not be removed yet. Try again.", deleted: false });
  assert.equal(storageUnavailable.mediaAttempts.get(oldCover), 3);
  assert.equal(storageUnavailable.events.some(event => event.startsWith("delete:")), false, "Tribe records remain retryable until cover storage is removed");

  const memberFailure = harness({ failMemberAttempts: 3 });
  const memberResponse = await memberFailure.context.deleteGroup({ headers: { origin: "https://danzstak.com" }, pathParameters: { groupId } });
  assert.equal(memberResponse.statusCode, 503);
  assert.equal(memberFailure.memberAttempts(), 3);
  assert.equal(memberFailure.metaAttempts(), 0, "metadata remains until every membership record is gone");

  const metadataRecovery = harness({ failMemberAttempts: 2, failMetaAttempts: 2 });
  const deletedResponse = await metadataRecovery.context.deleteGroup({ headers: { origin: "https://danzstak.com" }, pathParameters: { groupId } });
  assert.equal(deletedResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(deletedResponse.body), { deleted: true });
  assert.equal(metadataRecovery.memberAttempts(), 3, "membership cleanup retries before metadata removal");
  assert.equal(metadataRecovery.metaAttempts(), 3, "metadata cleanup receives the full retry budget");
  assert.ok(metadataRecovery.events.indexOf(`media:${oldCover}`) < metadataRecovery.events.indexOf("delete:member"), "cover storage is removed before Tribe records");
  assert.ok(metadataRecovery.events.lastIndexOf("delete:member") < metadataRecovery.events.indexOf("delete:meta"), "the retry anchor is deleted last");
  assert.equal(metadataRecovery.events.filter(event => event === "delete:meta").length, 3);

  console.log("Elder-managed Tribe cover checks passed: durable replacement queue, storage-first deletion, bounded retries, and metadata-last ordering.");
})().catch(error => { console.error(error); process.exitCode = 1; });
