"use strict";

const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const source = readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const cleanupCode = source.slice(
  source.indexOf("async function cleanupEpkMediaObjects"),
  source.indexOf("async function deleteEpkOutreachShares")
);

assert.ok(cleanupCode.startsWith("async function cleanupEpkMediaObjects"), "the EPK cleanup helper must remain testable");

class UpdateItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }

const ownerPrefix = "0123456789abcdef01234567";
const ownerKey = { userId: { S: "artist-1" }, tourId: { S: "epk-workspace-v1" } };
const first = `epk/${ownerPrefix}/11111111-1111-4111-a111-111111111111.jpg`;
const second = `epk/${ownerPrefix}/22222222-2222-4222-a222-222222222222.pdf`;
const foreign = "epk/fedcba9876543210fedcba98/33333333-3333-4333-a333-333333333333.jpg";

function harness({ failingKey = "", failQueueAck = false } = {}) {
  const mediaAttempts = new Map();
  const updates = [];
  const context = vm.createContext({
    process: { env: { MEDIA_BUCKET: "media", TOURS_TABLE: "tours" } },
    UpdateItemCommand,
    DeleteObjectCommand,
    toursTable: "tours",
    mediaBucket: "media",
    epkMediaPattern: owner => new RegExp(`^epk/${owner}/[a-f0-9-]{36}\\.(jpg|png|webp|pdf)$`),
    console: { ...console, error: () => {} },
    s3: { send: async command => {
      const key = command.input.Key;
      mediaAttempts.set(key, (mediaAttempts.get(key) || 0) + 1);
      if (key === failingKey) throw Error("temporary storage failure");
      return {};
    } },
    db: { send: async command => {
      updates.push(command.input);
      if (failQueueAck) throw Error("temporary database failure");
      return {};
    } }
  });
  vm.runInContext(cleanupCode, context);
  return { context, mediaAttempts, updates };
}

(async () => {
  const partial = harness({ failingKey: second });
  const partialResult = await partial.context.cleanupEpkMediaObjects(ownerKey, ownerPrefix, [first, second, first, foreign]);
  assert.deepEqual(JSON.parse(JSON.stringify(partialResult)), { cleaned: 2, pending: 1 }, "successful and invalid entries resolve while unavailable owned media remains queued");
  assert.equal(partial.mediaAttempts.get(first), 1, "duplicate EPK cleanup keys are deleted once");
  assert.equal(partial.mediaAttempts.get(second), 3, "unavailable EPK media receives the complete retry budget");
  assert.equal(partial.mediaAttempts.has(foreign), false, "EPK cleanup never deletes another artist's object");
  assert.equal(partial.updates.length, 1, "resolved queue entries are acknowledged together");
  assert.deepEqual(new Set(partial.updates[0].ExpressionAttributeValues[":resolved"].SS), new Set([first, foreign]), "only deleted or invalid keys leave the durable queue");

  const recovered = harness();
  const recoveredResult = await recovered.context.cleanupEpkMediaObjects(ownerKey, ownerPrefix, [second]);
  assert.deepEqual(JSON.parse(JSON.stringify(recoveredResult)), { cleaned: 1, pending: 0 });
  assert.equal(recovered.mediaAttempts.get(second), 1, "a later EPK save retries previously unavailable media");

  const readded = harness();
  const readdedResult = await readded.context.cleanupEpkMediaObjects(ownerKey, ownerPrefix, [first], [first]);
  assert.deepEqual(JSON.parse(JSON.stringify(readdedResult)), { cleaned: 1, pending: 0 });
  assert.equal(readded.mediaAttempts.size, 0, "re-adding queued media cancels deletion instead of destroying the current EPK file");
  assert.deepEqual(Array.from(readded.updates[0].ExpressionAttributeValues[":resolved"].SS), [first], "a re-added key is removed from the cleanup queue");

  const staleQueue = harness({ failQueueAck: true });
  const staleResult = await staleQueue.context.cleanupEpkMediaObjects(ownerKey, ownerPrefix, [first]);
  assert.deepEqual(JSON.parse(JSON.stringify(staleResult)), { cleaned: 1, pending: 0 });
  assert.equal(staleQueue.mediaAttempts.get(first), 1, "queue-ack failure happens only after the private object is removed");
  assert.equal(staleQueue.updates.length, 1, "the failed queue acknowledgement can be retried idempotently later");

  assert.match(source, /existing\.Item\?\.mediaCleanup\?\.SS \|\| \[\]/, "every EPK save reloads unfinished cleanup work");
  assert.match(source, /ADD mediaCleanup :mediaCleanup/, "removed EPK media is committed to a durable cleanup set with the new draft");
  assert.match(source, /cleanupEpkMediaObjects\(ownerKey, ownerPrefix, pendingMediaCleanup, \[\.\.\.retained\]\)/, "cleanup excludes files retained by the current EPK");
  assert.match(source, /cleanupPending: cleanup\.pending/, "the save response reports unfinished physical cleanup honestly");
  assert.doesNotMatch(source, /const removed = \(previousKit\.media \|\| \[\]\)[\s\S]{0,500}runCleanup/, "EPK updates no longer use unrecoverable best-effort deletion");

  console.log("EPK media cleanup checks passed: durable queueing, owner-prefix isolation, retries, deduplication, re-add safety, and later recovery.");
})().catch(error => { console.error(error); process.exitCode = 1; });
