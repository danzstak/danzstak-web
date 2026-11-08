const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const cleanupCode = source.slice(source.indexOf("async function cleanupProfileMedia("), source.indexOf("async function updateProfileUnique("));

class UpdateItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }

function conditional(message = "conditional") { const error = new Error(message); error.name = "ConditionalCheckFailedException"; return error; }

function harness({ failingKey = "", item = {} } = {}) {
  const mediaAttempts = new Map();
  const updates = [];
  let sequence = 0;
  const state = JSON.parse(JSON.stringify(item));
  const context = vm.createContext({
    process: { env: { MEDIA_BUCKET: "media", SETTINGS_TABLE: "settings" } },
    UpdateItemCommand, DeleteObjectCommand,
    ownerPrefix: () => "ownerhash",
    randomUUID: () => `claim-${++sequence}`,
    now: () => 100,
    GetItemCommand: class GetItemCommand { constructor(input) { this.input = input; } },
    console: { ...console, error: () => {} },
    s3: { send: async command => {
      const key = command.input.Key;
      mediaAttempts.set(key, (mediaAttempts.get(key) || 0) + 1);
      if (key === failingKey) throw Error("temporary storage failure");
      return {};
    } },
    db: { send: async command => {
      if (command.constructor.name === "GetItemCommand") return { Item: state };
      updates.push(command.input);
      const input = command.input, values = input.ExpressionAttributeValues || {};
      if (input.UpdateExpression.startsWith("SET profileMediaCleanupClaim")) {
        const key = values[":candidate"].S;
        const active = [state.profileAvatarKey?.S, state.profileCoverKey?.S, state.profileVideoKey?.S].includes(key);
        if (!(state.profileMediaCleanup?.SS || []).includes(key) || active || state.profileMediaCleanupClaim) throw conditional();
        state.profileMediaCleanupClaim = values[":claim"];
        state.profileMediaCleanupClaimKey = values[":candidate"];
        state.profileMediaCleanupClaimExpiresAt = values[":expires"];
        return {};
      }
      if (input.ConditionExpression?.includes("profileMediaCleanupClaim = :claim")) {
        if (state.profileMediaCleanupClaim?.S !== values[":claim"].S || state.profileMediaCleanupClaimKey?.S !== values[":candidate"].S) throw conditional();
        if (values[":resolved"]) state.profileMediaCleanup.SS = (state.profileMediaCleanup?.SS || []).filter(key => !values[":resolved"].SS.includes(key));
        delete state.profileMediaCleanupClaim; delete state.profileMediaCleanupClaimKey; delete state.profileMediaCleanupClaimExpiresAt;
        return {};
      }
      if (input.ConditionExpression?.includes("profileAvatarKey = :candidate")) {
        const key = values[":candidate"].S;
        if (![state.profileAvatarKey?.S, state.profileCoverKey?.S, state.profileVideoKey?.S].includes(key)) throw conditional();
      }
      if (values[":resolved"] && state.profileMediaCleanup) state.profileMediaCleanup.SS = state.profileMediaCleanup.SS.filter(key => !values[":resolved"].SS.includes(key));
      return {};
    } }
  });
  vm.runInContext(cleanupCode, context);
  return { context, mediaAttempts, updates, state };
}

(async () => {
  const first = "users/ownerhash/11111111-1111-4111-a111-111111111111.jpg";
  const second = "users/ownerhash/22222222-2222-4222-a222-222222222222.jpg";
  const foreign = "users/someone-else/33333333-3333-4333-a333-333333333333.jpg";
  const partial = harness({ failingKey: second, item: { profileMediaCleanup: { SS: [first, second, foreign] } } });
  const result = await partial.context.cleanupProfileMedia({ email: "artist@example.com" }, [first, second, first, foreign]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { cleaned: 2, pending: 1 }, "successful and invalid queue entries resolve while a failed owned object remains pending");
  assert.equal(partial.mediaAttempts.get(first), 1, "duplicate cleanup entries are deduplicated");
  assert.equal(partial.mediaAttempts.get(second), 3, "failed owned media receives the full retry budget");
  assert.equal(partial.mediaAttempts.has(foreign), false, "profile cleanup never deletes another member's storage key");
  assert.deepEqual(new Set(partial.state.profileMediaCleanup.SS), new Set([second]), "only failed owned media remains in the durable queue");

  const recovered = harness({ item: { profileMediaCleanup: { SS: [second] } } });
  const recoveredResult = await recovered.context.cleanupProfileMedia({ email: "artist@example.com" }, [second]);
  assert.deepEqual(JSON.parse(JSON.stringify(recoveredResult)), { cleaned: 1, pending: 0 });
  assert.equal(recovered.mediaAttempts.get(second), 1, "a later profile save can finish a previously pending cleanup");

  const sharedActive = harness({ item: { profileAvatarKey: { S: first }, profileCoverKey: { S: first }, profileMediaCleanup: { SS: [first] } } });
  const sharedResult = await sharedActive.context.cleanupProfileMedia({ email: "artist@example.com" }, [first]);
  assert.deepEqual(JSON.parse(JSON.stringify(sharedResult)), { cleaned: 1, pending: 0 });
  assert.equal(sharedActive.mediaAttempts.has(first), false, "a key shared by the current avatar and cover is never deleted");
  assert.deepEqual(sharedActive.state.profileMediaCleanup.SS, [], "an active key is removed from a stale cleanup queue");

  const staleQueue = harness({ item: { profileMediaCleanup: { SS: [] } } });
  const staleResult = await staleQueue.context.cleanupProfileMedia({ email: "artist@example.com" }, [first]);
  assert.deepEqual(JSON.parse(JSON.stringify(staleResult)), { cleaned: 1, pending: 0 });
  assert.equal(staleQueue.mediaAttempts.has(first), false, "a stale cleanup request cannot delete a key no longer in the authoritative queue");

  assert.match(source, /profileMediaCleanup = :profileCleanup/, "replaced profile media is committed to a durable cleanup queue with the new profile state");
  assert.match(source, /current\.Item\?\.profileMediaCleanup\?\.SS\|\|\[\]/, "later profile saves reload pending cleanup work");
  assert.match(source, /await cleanupProfileMedia\(user,pendingProfileMedia\)/, "profile updates retry the durable cleanup queue");
  assert.match(source, /profileMediaCleanupClaim/, "cleanup and profile saves use an account-scoped lease");
  assert.match(source, /profileAvatarKey = :candidate OR profileCoverKey = :candidate OR profileVideoKey = :candidate/, "all active profile media references protect a shared key");
  assert.doesNotMatch(source, /Promise\.all\(oldMedia\.map/, "profile updates no longer rely on an unrecoverable best-effort deletion");

  console.log("Profile media cleanup checks passed: durable queueing, leases, active-reference protection, retries, deduplication, and later recovery.");
})().catch(error => { console.error(error); process.exitCode = 1; });
