const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const block = template.slice(template.indexOf("          async function cleanupProfileMedia("), template.indexOf("          async function sendMessage")).trim();

class GetItemCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }
class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }
class HeadObjectCommand { constructor(input) { this.input = input; } }

const A = "users/owner/11111111-1111-4111-a111-111111111111.jpg";
const B = "users/owner/22222222-2222-4222-a222-222222222222.jpg";
const C = "users/owner/33333333-3333-4333-a333-333333333333.jpg";
const clone = value => JSON.parse(JSON.stringify(value));
const conflict = () => { const error = new Error("conditional conflict"); error.name = "TransactionCanceledException"; return error; };
const updateConflict = () => { const error = new Error("conditional conflict"); error.name = "ConditionalCheckFailedException"; return error; };

function harness({ item, failingDeletes = [], concurrentSnapshots = 0 }) {
  const state = clone(item), existing = new Set([A, B, C]), failures = new Set(failingDeletes), deletes = new Map();
  const snapshot = clone(state), waiting = [];
  let getCount = 0, sequence = 0;

  function applyTransaction(input) {
    const update = input.TransactItems.at(-1).Update, values = update.ExpressionAttributeValues;
    if (state.profileMediaCleanupClaim && Number(state.profileMediaCleanupClaimExpiresAt?.N || 0) >= 100) throw conflict();
    for (const [field, token] of [["profileAvatarKey", ":expectedAvatar"], ["profileCoverKey", ":expectedCover"], ["profileVideoKey", ":expectedVideo"]]) {
      const expected = values[token]?.S || "", actual = state[field]?.S || "";
      if (expected !== actual) throw conflict();
    }
    for (const [field, token] of [["profileAvatarKey", ":profileAvatarKey"], ["profileCoverKey", ":profileCoverKey"]]) {
      if (values[token]) state[field] = values[token];
    }
    if (values[":profileCleanup"]) state.profileMediaCleanup = clone(values[":profileCleanup"]);
    else delete state.profileMediaCleanup;
    delete state.profileMediaCleanupClaim; delete state.profileMediaCleanupClaimKey; delete state.profileMediaCleanupClaimExpiresAt;
    return {};
  }

  function applyCleanup(input) {
    const values = input.ExpressionAttributeValues || {}, expression = input.UpdateExpression;
    if (expression.startsWith("SET profileMediaCleanupClaim")) {
      const key = values[":candidate"].S, active = [state.profileAvatarKey?.S, state.profileCoverKey?.S, state.profileVideoKey?.S].includes(key);
      if (!(state.profileMediaCleanup?.SS || []).includes(key) || active || state.profileMediaCleanupClaim) throw updateConflict();
      state.profileMediaCleanupClaim = values[":claim"];
      state.profileMediaCleanupClaimKey = values[":candidate"];
      state.profileMediaCleanupClaimExpiresAt = values[":expires"];
      return {};
    }
    if (input.ConditionExpression?.includes("profileMediaCleanupClaim = :claim")) {
      if (state.profileMediaCleanupClaim?.S !== values[":claim"].S || state.profileMediaCleanupClaimKey?.S !== values[":candidate"].S) throw updateConflict();
      if (values[":resolved"] && state.profileMediaCleanup) state.profileMediaCleanup.SS = state.profileMediaCleanup.SS.filter(key => !values[":resolved"].SS.includes(key));
      delete state.profileMediaCleanupClaim; delete state.profileMediaCleanupClaimKey; delete state.profileMediaCleanupClaimExpiresAt;
      return {};
    }
    if (input.ConditionExpression?.includes("profileAvatarKey = :candidate")) {
      const key = values[":candidate"].S;
      if (![state.profileAvatarKey?.S, state.profileCoverKey?.S, state.profileVideoKey?.S].includes(key)) throw updateConflict();
    }
    if (values[":resolved"] && state.profileMediaCleanup) state.profileMediaCleanup.SS = state.profileMediaCleanup.SS.filter(key => !values[":resolved"].SS.includes(key));
    return {};
  }

  const context = vm.createContext({
    process: { env: { SETTINGS_TABLE: "settings", PROFILE_NAMES_TABLE: "names", MEDIA_BUCKET: "media" } },
    GetItemCommand, UpdateItemCommand, TransactWriteItemsCommand, DeleteItemCommand, DeleteObjectCommand, HeadObjectCommand,
    json: (statusCode, body) => ({ statusCode, body }), ownerPrefix: () => "owner", now: () => 100,
    randomUUID: () => `00000000-0000-4000-a000-${String(++sequence).padStart(12, "0")}`,
    scanAll: async () => [], getProfile: async () => ({ statusCode: 200 }), console: { ...console, error() {} },
    s3: { send: async command => {
      const key = command.input.Key;
      if (command instanceof HeadObjectCommand) { if (!existing.has(key)) throw new Error("not found"); return {}; }
      deletes.set(key, (deletes.get(key) || 0) + 1);
      if (failures.has(key)) throw new Error("temporary storage failure");
      existing.delete(key);
      return {};
    } },
    db: { send: async command => {
      if (command instanceof GetItemCommand) {
        getCount += 1;
        return { Item: concurrentSnapshots && getCount <= concurrentSnapshots ? clone(snapshot) : state };
      }
      if (command instanceof TransactWriteItemsCommand && concurrentSnapshots) {
        return new Promise((resolve, reject) => {
          waiting.push({ input: command.input, resolve, reject });
          if (waiting.length === concurrentSnapshots) {
            for (const entry of waiting) { try { entry.resolve(applyTransaction(entry.input)); } catch (error) { entry.reject(error); } }
          }
        });
      }
      if (command instanceof TransactWriteItemsCommand) return applyTransaction(command.input);
      if (command instanceof UpdateItemCommand) return applyCleanup(command.input);
      return {};
    } }
  });
  vm.runInContext(block, context);
  return { context, state, existing, failures, deletes };
}

async function save(harness, body) {
  harness.context.event = { body: JSON.stringify(body) };
  return vm.runInContext('updateProfileUnique(event,{email:"artist@example.com"})', harness.context);
}

(async () => {
  const reselect = harness({ item: { profileAvatarKey: { S: A } }, failingDeletes: [A] });
  assert.equal((await save(reselect, { avatarKey: B })).statusCode, 200);
  assert.equal(reselect.state.profileAvatarKey.S, B);
  assert.deepEqual(Array.from(reselect.state.profileMediaCleanup.SS), [A]);
  assert.equal(reselect.deletes.get(A), 3, "the failed A cleanup receives its bounded retry budget");
  reselect.failures.delete(A);
  assert.equal((await save(reselect, { avatarKey: A })).statusCode, 200);
  assert.equal(reselect.state.profileAvatarKey.S, A);
  assert.equal(reselect.deletes.get(A), 3, "A to B failed cleanup to A never deletes the reselected active avatar");
  assert.equal(reselect.deletes.get(B), 1, "B becomes the only cleanup candidate after A is reselected");
  assert.deepEqual(Array.from(reselect.state.profileMediaCleanup.SS), []);

  const shared = harness({ item: { profileAvatarKey: { S: A }, profileCoverKey: { S: A } } });
  assert.equal((await save(shared, { avatarKey: B })).statusCode, 200);
  assert.equal(shared.state.profileCoverKey.S, A);
  assert.equal(shared.deletes.has(A), false, "replacing an avatar never deletes the same key while the cover still references it");

  const concurrent = harness({ item: { profileAvatarKey: { S: A } }, concurrentSnapshots: 2 });
  const [first, second] = await Promise.all([save(concurrent, { avatarKey: B }), save(concurrent, { avatarKey: C })]);
  assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 409], "two-device swaps have one winner and one explicit conflict");
  assert.equal(concurrent.state.profileAvatarKey.S, B, "the stale second device cannot overwrite the committed first swap");

  assert.match(template, /ConditionExpression:mediaConditions\.map/, "profile saves compare authoritative avatar, cover, and video references");
  assert.match(template, /HeadObjectCommand/, "reselection verifies storage still exists after a cleanup completes");
  console.log("Profile media race checks passed: A-B-A recovery, shared-key protection, storage validation, and one-winner concurrent swaps.");
})().catch(error => { console.error(error); process.exitCode = 1; });
