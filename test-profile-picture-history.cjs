"use strict";
// Directive F4c (owner 2026-11-19): "when a user clicks on the profile picture that is not the account owner they should
// be able to do a horizontal swipe to see previous profile pictures". The server (call-signaling) keeps them:
// - a new picture moves the old one into the history, newest first, at most 30 (older ones are cleaned up); removing a
//   picture deletes it (a picture the member removed never shows again);
// - the clean-up of profile media never deletes a key that is in the history;
// - GET /profiles/pictures lists the current picture then the history as signed links (no storage keys), only to the
//   member and to people who may see their profile; DELETE /profiles/pictures removes one and cleans it up;
// - reselecting a picture from the history takes it out of the history.
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const block = template.slice(template.indexOf("          async function cleanupProfileMedia("), template.indexOf("          async function sendMessage")).trim();
const line = start => { const at = template.indexOf("          " + start); assert.ok(at > 0, `found ${start}`); return template.slice(at, template.indexOf("\n", at)).trim(); };
const routes = ["const pictureId=", "async function memberEmail(", "async function profilePictures(", "async function deleteProfilePicture("].map(line).join("\n");

class GetItemCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }
class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }
class HeadObjectCommand { constructor(input) { this.input = input; } }
class ListUsersCommand { constructor(input) { this.input = input; } }

const key = n => `users/owner/${String(n).padStart(8, "0")}-1111-4111-a111-111111111111.jpg`;
const clone = value => JSON.parse(JSON.stringify(value));
const conflict = () => Object.assign(new Error("conditional conflict"), { name: "TransactionCanceledException" });
const updateConflict = () => Object.assign(new Error("conditional conflict"), { name: "ConditionalCheckFailedException" });
const history = state => JSON.parse(state.profileAvatarHistory?.S || "[]").map(entry => entry.k);

function harness(item = {}, { friends = true } = {}) {
  const state = clone(item), existing = new Set(Array.from({ length: 40 }, (_, n) => key(n))), deletes = new Map();
  let sequence = 0, clock = 0;
  const inHistory = candidate => (state.profileAvatarHistory?.S || "").includes(candidate);
  const db = { send: async command => {
    const input = command.input, values = input.ExpressionAttributeValues || {};
    if (command instanceof GetItemCommand) return { Item: clone(state) };
    if (command instanceof TransactWriteItemsCommand) {
      const update = input.TransactItems.at(-1).Update, v = update.ExpressionAttributeValues;
      if ((v[":expectedAvatar"]?.S || "") !== (state.profileAvatarKey?.S || "")) throw conflict();
      if ((v[":expectedHistory"]?.S || "") !== (state.profileAvatarHistory?.S || "")) throw conflict();
      for (const [field, token] of [["profileAvatarKey", ":profileAvatarKey"], ["profileAvatarHistory", ":profileAvatarHistory"], ["profileAvatarSetAt", ":profileAvatarSetAt"]]) if (v[token]) state[field] = v[token];
      if (v[":profileCleanup"]) state.profileMediaCleanup = clone(v[":profileCleanup"]); else delete state.profileMediaCleanup;
      return {};
    }
    if (command instanceof UpdateItemCommand) {
      const expression = input.UpdateExpression;
      if (expression.startsWith("SET profileAvatarHistory")) { // DELETE /profiles/pictures
        if (values[":expected"].S !== state.profileAvatarHistory?.S) throw updateConflict();
        state.profileAvatarHistory = values[":next"];
        if (values[":gone"]) state.profileMediaCleanup = { SS: [...new Set([...(state.profileMediaCleanup?.SS || []), ...values[":gone"].SS])] };
        return {};
      }
      if (expression.startsWith("SET profileMediaCleanupClaim")) { // the real condition: in the queue, not active, not in the history
        const candidate = values[":candidate"].S;
        assert.match(input.ConditionExpression, /NOT contains\(profileAvatarHistory, :candidate\)/, "the clean-up claim refuses history keys");
        if (!(state.profileMediaCleanup?.SS || []).includes(candidate) || state.profileAvatarKey?.S === candidate || inHistory(candidate)) throw updateConflict();
        Object.assign(state, { profileMediaCleanupClaim: values[":claim"], profileMediaCleanupClaimKey: values[":candidate"], profileMediaCleanupClaimExpiresAt: values[":expires"] });
        return {};
      }
      if (input.ConditionExpression?.includes("profileMediaCleanupClaim = :claim")) {
        if (values[":resolved"] && state.profileMediaCleanup) state.profileMediaCleanup.SS = state.profileMediaCleanup.SS.filter(entry => !values[":resolved"].SS.includes(entry));
        delete state.profileMediaCleanupClaim; delete state.profileMediaCleanupClaimKey; delete state.profileMediaCleanupClaimExpiresAt;
        return {};
      }
      if (input.ConditionExpression?.includes("profileAvatarKey = :candidate")) { // an active or history key leaves the queue
        const candidate = values[":candidate"].S;
        if (state.profileAvatarKey?.S !== candidate && !inHistory(candidate)) throw updateConflict();
        if (state.profileMediaCleanup) state.profileMediaCleanup.SS = state.profileMediaCleanup.SS.filter(entry => entry !== candidate);
        return {};
      }
    }
    return {};
  } };
  const context = vm.createContext({
    process: { env: { SETTINGS_TABLE: "settings", PROFILE_NAMES_TABLE: "names", MEDIA_BUCKET: "media", USER_POOL_ID: "pool" } },
    GetItemCommand, UpdateItemCommand, TransactWriteItemsCommand, DeleteItemCommand, DeleteObjectCommand, HeadObjectCommand, ListUsersCommand,
    json: (statusCode, body) => ({ statusCode, body }), ownerPrefix: () => "owner", now: () => 100, createHash: crypto.createHash,
    Date: class extends Date { constructor(...args) { super(...(args.length ? args : [Date.UTC(2026, 10, 19, 12, 0, clock++)])); } },
    randomUUID: () => `00000000-0000-4000-a000-${String(++sequence).padStart(12, "0")}`,
    scanAll: async () => [], getProfile: async () => ({ statusCode: 200 }), console: { ...console, error() {} },
    canContact: async () => friends, attr: (account, name) => account.Attributes.find(entry => entry.Name === name)?.Value || "",
    cognito: { send: async () => ({ Users: [{ Attributes: [{ Name: "email", Value: "artist@example.com" }, { Name: "sub", Value: "22222222-2222-4222-a222-222222222222" }] }] }) },
    signedMediaUrl: (method, mediaKey) => `https://cdn.example/${mediaKey}?signed`,
    s3: { send: async command => {
      const mediaKey = command.input.Key;
      if (command instanceof HeadObjectCommand) { if (!existing.has(mediaKey)) throw new Error("not found"); return {}; }
      deletes.set(mediaKey, (deletes.get(mediaKey) || 0) + 1); existing.delete(mediaKey); return {};
    } },
    db
  });
  vm.runInContext(block + "\n" + routes, context);
  return { context, state, deletes };
}
const save = (h, body) => { h.context.event = { body: JSON.stringify(body) }; return vm.runInContext('updateProfileUnique(event,{email:"artist@example.com"})', h.context); };
const call = (h, fn, query, email = "artist@example.com") => { h.context.event = { queryStringParameters: query }; return vm.runInContext(`${fn}(event,{email:${JSON.stringify(email)}})`, h.context); };

(async () => {
  // A new picture keeps the old one, newest first; nothing is deleted.
  const h = harness({ profileAvatarKey: { S: key(1) } });
  assert.equal((await save(h, { avatarKey: key(2) })).statusCode, 200);
  assert.equal((await save(h, { avatarKey: key(3) })).statusCode, 200);
  assert.equal(h.state.profileAvatarKey.S, key(3));
  assert.deepEqual(history(h.state), [key(2), key(1)], "the older pictures stay, newest first");
  assert.equal(h.deletes.size, 0, "changing the picture deletes nothing");
  assert.ok(h.state.profileAvatarSetAt?.S, "the time the picture was set is kept");

  // The list: the current picture first, then the history, as signed links; no storage keys.
  let list = await call(h, "profilePictures", {});
  assert.equal(list.statusCode, 200);
  assert.deepEqual(Array.from(list.body.pictures, picture => picture.url), [key(3), key(2), key(1)].map(entry => `https://cdn.example/${entry}?signed`));
  assert.equal(list.body.pictures[0].current, true);
  assert.ok(list.body.pictures.every(picture => /^[a-f0-9]{24}$/.test(picture.id) && !("k" in picture) && !("key" in picture)), "ids, never storage keys");
  const visitor = await call(h, "profilePictures", { member: "22222222-2222-4222-a222-222222222222" }, "fan@example.com");
  assert.equal(visitor.body.pictures.length, 3, "someone who may see the profile sees the history");
  assert.equal(visitor.body.isOwner, false);
  const stranger = harness({ profileAvatarKey: { S: key(1) } }, { friends: false });
  assert.equal((await call(stranger, "profilePictures", { member: "22222222-2222-4222-a222-222222222222" }, "stranger@example.com")).statusCode, 403, "the same visibility as the profile");

  // The owner deletes one: it leaves the list and is cleaned up; the rest stay.
  const old = list.body.pictures.find(picture => picture.url.includes(key(1)));
  assert.equal((await call(h, "deleteProfilePicture", { id: old.id })).statusCode, 200);
  assert.deepEqual(history(h.state), [key(2)], "a deleted picture never appears again");
  assert.equal(h.deletes.get(key(1)), 1, "it is deleted from storage");
  assert.equal((await call(h, "deleteProfilePicture", { id: old.id })).statusCode, 404);
  assert.equal((await call(h, "deleteProfilePicture", { id: "not-an-id" })).statusCode, 400);

  // Removing the current picture deletes it (it does not become a past picture).
  assert.equal((await save(h, { avatarKey: "" })).statusCode, 200);
  assert.deepEqual(history(h.state), [key(2)]);
  assert.equal(h.deletes.get(key(3)), 1, "a removed picture is deleted, not kept");

  // Reselecting a picture from the history takes it out of the history.
  const back = harness({ profileAvatarKey: { S: key(2) }, profileAvatarHistory: { S: JSON.stringify([{ k: key(1), t: "2026-11-01T00:00:00.000Z" }]) } });
  assert.equal((await save(back, { avatarKey: key(1) })).statusCode, 200);
  assert.deepEqual(history(back.state), [key(2)]);
  assert.equal(back.deletes.size, 0);

  // At most 30 past pictures: the oldest one beyond that is cleaned up.
  const many = harness({ profileAvatarKey: { S: key(0) } });
  for (let n = 1; n <= 31; n += 1) assert.equal((await save(many, { avatarKey: key(n) })).statusCode, 200);
  assert.equal(history(many.state).length, 30);
  assert.equal(history(many.state)[0], key(30));
  assert.equal(many.deletes.get(key(0)), 1, "the 31st past picture is cleaned up");
  assert.equal([...many.deletes.keys()].length, 1);

  // Reselecting a picture when the history is full keeps the other 30 and cleans up none of them.
  const full = harness({ profileAvatarKey: { S: key(0) }, profileAvatarHistory: { S: JSON.stringify(Array.from({ length: 30 }, (_, n) => ({ k: key(n + 1), t: "" }))) } });
  assert.equal((await save(full, { avatarKey: key(5) })).statusCode, 200);
  assert.equal(history(full.state).length, 30);
  assert.equal(history(full.state)[0], key(0));
  assert.ok(!history(full.state).includes(key(5)));
  assert.equal(full.deletes.size, 0, "nothing kept is queued for clean-up");
  assert.deepEqual(Array.from(full.state.profileMediaCleanup?.SS || []), []);

  // Clean-up never deletes a history key, even if it was queued.
  const guarded = harness({ profileAvatarKey: { S: key(5) }, profileAvatarHistory: { S: JSON.stringify([{ k: key(4), t: "" }]) }, profileMediaCleanup: { SS: [key(4)] } });
  await vm.runInContext(`cleanupProfileMedia({email:"artist@example.com"},${JSON.stringify([key(4)])})`, guarded.context);
  assert.equal(guarded.deletes.has(key(4)), false, "a history key is never deleted");
  assert.deepEqual(Array.from(guarded.state.profileMediaCleanup.SS), [], "and it leaves the clean-up queue");

  // Routes exist in API Gateway; Dailies send their post id (the full-screen rail, F1a).
  assert.match(template, /RouteKey: GET \/profiles\/pictures/);
  assert.match(template, /RouteKey: DELETE \/profiles\/pictures/);
  assert.match(template, /storyId:x\.storyId\.S,postId:x\.postId\?\.S\|\|''/);
  console.log("Profile picture history checks passed: a new picture keeps the old ones (newest first, at most 30), removing deletes, clean-up never touches history keys, the list is signed links with the profile's visibility, the owner can delete one, and reselecting takes it out of the history.");
})().catch(error => { console.error(error); process.exitCode = 1; });
