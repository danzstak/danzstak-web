const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const cleanupCode = source.slice(source.indexOf("async function cleanupProfileMedia("), source.indexOf("async function updateProfileUnique("));

class UpdateItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }

function harness({ failingKey = "" } = {}) {
  const mediaAttempts = new Map();
  const updates = [];
  const context = vm.createContext({
    process: { env: { MEDIA_BUCKET: "media", SETTINGS_TABLE: "settings" } },
    UpdateItemCommand, DeleteObjectCommand,
    ownerPrefix: () => "ownerhash",
    console: { ...console, error: () => {} },
    s3: { send: async command => {
      const key = command.input.Key;
      mediaAttempts.set(key, (mediaAttempts.get(key) || 0) + 1);
      if (key === failingKey) throw Error("temporary storage failure");
      return {};
    } },
    db: { send: async command => { updates.push(command.input); return {}; } }
  });
  vm.runInContext(cleanupCode, context);
  return { context, mediaAttempts, updates };
}

(async () => {
  const first = "users/ownerhash/11111111-1111-4111-a111-111111111111.jpg";
  const second = "users/ownerhash/22222222-2222-4222-a222-222222222222.jpg";
  const foreign = "users/someone-else/33333333-3333-4333-a333-333333333333.jpg";
  const partial = harness({ failingKey: second });
  const result = await partial.context.cleanupProfileMedia({ email: "artist@example.com" }, [first, second, first, foreign]);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), { cleaned: 2, pending: 1 }, "successful and invalid queue entries resolve while a failed owned object remains pending");
  assert.equal(partial.mediaAttempts.get(first), 1, "duplicate cleanup entries are deduplicated");
  assert.equal(partial.mediaAttempts.get(second), 3, "failed owned media receives the full retry budget");
  assert.equal(partial.mediaAttempts.has(foreign), false, "profile cleanup never deletes another member's storage key");
  assert.equal(partial.updates.length, 1);
  assert.deepEqual(new Set(partial.updates[0].ExpressionAttributeValues[":resolved"].SS), new Set([first, foreign]), "only resolved or invalid queue entries are removed from the durable queue");

  const recovered = harness();
  const recoveredResult = await recovered.context.cleanupProfileMedia({ email: "artist@example.com" }, [second]);
  assert.deepEqual(JSON.parse(JSON.stringify(recoveredResult)), { cleaned: 1, pending: 0 });
  assert.equal(recovered.mediaAttempts.get(second), 1, "a later profile save can finish a previously pending cleanup");

  assert.match(source, /ADD profileMediaCleanup :profileCleanup/, "replaced profile media is committed to a durable cleanup queue with the new profile state");
  assert.match(source, /current\.Item\?\.profileMediaCleanup\?\.SS\|\|\[\]/, "later profile saves reload pending cleanup work");
  assert.match(source, /await cleanupProfileMedia\(user,pendingProfileMedia\)/, "profile updates retry the durable cleanup queue");
  assert.doesNotMatch(source, /Promise\.all\(oldMedia\.map/, "profile updates no longer rely on an unrecoverable best-effort deletion");

  console.log("Profile media cleanup checks passed: durable queueing, owner-prefix isolation, retries, deduplication, and later recovery.");
})().catch(error => { console.error(error); process.exitCode = 1; });
