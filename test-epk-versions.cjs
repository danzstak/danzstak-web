"use strict";
// Spec 46, Train A (owner 2026-11-24: "need a way to see my previous published epk"). Runs the Auth API's real EPK
// handlers against an in-memory table and checks:
// - saving a draft keeps the published EPK online (before: every draft save took it offline and lost it);
// - venue links carry the published EPK, never the draft;
// - each publish keeps a version (newest 20), which the owner can list, open and bring back;
// - files used by a kept version or by the published copy are never deleted; Unpublish (only) takes the EPK offline;
// - deleting the EPK deletes every version and its files;
// - versions live in their own partition, so the Tour list (GET /tours, which reads the member's whole partition and feeds
//   Booking's saved tours and the account export) never shows them.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");

const source = fs.readFileSync(path.join(__dirname, "infrastructure/auth-api/index.mjs"), "utf8").replace(/\r\n/g, "\n");
const slice = (from, to) => {
  const start = source.indexOf(from), end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `index.mjs still has ${from.slice(0, 60)}`);
  return source.slice(start, end);
};
const constants = slice("const bookingWorkspaceId", "const epkOutreachPrefix") + 'const epkOutreachPrefix = "EPK#OUTREACH#";\n';
const workspaceCode = slice("function epkMediaKeysOf(kit)", "// EPK link previews (epk-share-preview.mjs). POST /epk/share-card");
const outreachCode = slice("async function outreachEpkShare(event, method", "\n}\n") + "\n}\n";

class GetItemCommand { constructor(input) { this.input = input; } }
class PutItemCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }
class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }

const userId = "artist-1", email = "artist@example.test", origin = "https://danzstak.com";
const sha256 = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const ownerPrefix = sha256(email).slice(0, 24);
const media = n => `epk/${ownerPrefix}/${String(n).padStart(8, "0")}-1111-4111-a111-111111111111.jpg`;

const table = new Map();
const keyOf = key => `${key.userId.S}|${key.tourId.S}`;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const deletedMedia = [];

function applyUpdate(key, expression, names = {}, values = {}) {
  const item = clone(table.get(keyOf(key))) || { ...clone(key) };
  const name = token => names[token] || token;
  for (const [, verb, body] of expression.matchAll(/(SET|REMOVE|ADD|DELETE) ([^]*?)(?= (?:SET|REMOVE|ADD|DELETE) |$)/g)) {
    for (const part of body.split(",").map(text => text.trim()).filter(Boolean)) {
      if (verb === "SET") { const [attr, value] = part.split("=").map(text => text.trim()); item[name(attr)] = clone(values[value]); }
      else if (verb === "REMOVE") delete item[name(part)];
      else {
        const [attr, value] = part.split(/\s+/), current = new Set(item[name(attr)]?.SS || []);
        for (const entry of values[value].SS) verb === "ADD" ? current.add(entry) : current.delete(entry);
        if (current.size) item[name(attr)] = { SS: [...current] }; else delete item[name(attr)];
      }
    }
  }
  table.set(keyOf(key), item);
}

const db = { send: async command => {
  const input = command.input;
  if (command instanceof GetItemCommand) return { Item: clone(table.get(keyOf(input.Key))) };
  if (command instanceof PutItemCommand) { table.set(keyOf(input.Item), clone(input.Item)); return {}; }
  if (command instanceof UpdateItemCommand) { applyUpdate(input.Key, input.UpdateExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues); return {}; }
  if (command instanceof TransactWriteItemsCommand) {
    assert.ok(input.TransactItems.length <= 100, "a DynamoDB transaction holds at most 100 writes");
    const keys = input.TransactItems.map(op => keyOf((op.Put && op.Put.Item) || (op.Delete || op.Update).Key));
    assert.equal(new Set(keys).size, keys.length, "a transaction never writes the same item twice");
    for (const op of input.TransactItems) {
      if (op.Put) table.set(keyOf(op.Put.Item), clone(op.Put.Item));
      else if (op.Delete) table.delete(keyOf(op.Delete.Key));
      else applyUpdate(op.Update.Key, op.Update.UpdateExpression, op.Update.ExpressionAttributeNames, op.Update.ExpressionAttributeValues);
    }
    return {};
  }
  throw new Error(`unexpected command ${command.constructor.name}`);
} };

let clock = Date.parse("2026-11-24T10:00:00.000Z");
class FakeDate extends Date {
  constructor(...args) { if (args.length) super(...args); else { clock += 60000; super(clock); } }
  static now() { return clock; }
}

const context = vm.createContext({
  Date: FakeDate, JSON, Math, Number, String, Boolean, Array, Set, Map, Object, RegExp, Promise, Error, Buffer, console: { ...console, error: () => {} },
  GetItemCommand, PutItemCommand, UpdateItemCommand, TransactWriteItemsCommand, DeleteObjectCommand,
  db, s3: { send: async command => { deletedMedia.push(command.input.Key); return {}; } },
  toursTable: "tours", mediaBucket: "media", allowedOrigins: new Set([origin]), corsHeaders: () => ({}),
  getAuthenticatedUser: async () => userId, accountForSub: async () => email, sha256,
  parseJsonBody: event => { try { return JSON.parse(event.body || "null"); } catch { return null; } },
  cleanEpk: kit => kit && kit.artistName ? { ...clone(kit), media: clone(kit.media || []) } : null,
  epkForViewer: kit => kit, aiEpkHandler: async () => ({ publishBlock: async () => null }), validatedEpkMedia: async () => {},
  randomUUID: () => crypto.randomUUID(), randomValue: () => crypto.randomBytes(32).toString("hex"), randomBytes: crypto.randomBytes,
  epkShareLink: id => `https://danzstak.com/e/${id}`, validEpkId: id => /^[a-z0-9-]{3,64}$/.test(id || ""), validCardKey: () => false,
  EPK_CARD_PARTITION: "epk-share-card", epkMediaPattern: owner => new RegExp(`^epk/${owner}/[a-f0-9-]{36}\\.(jpg|png|webp|pdf)$`),
  runCleanup: async tasks => { for (const task of tasks) await task(); return 0; },
  now: () => Math.floor(clock / 1000),
  queryAll: async request => {
    const user = request.ExpressionAttributeValues[":user"].S, prefix = request.ExpressionAttributeValues[":prefix"].S;
    return [...table.values()].filter(item => item.userId.S === user && item.tourId.S.startsWith(prefix)).map(clone);
  }
});
vm.runInContext(`${constants}\n${workspaceCode}\n${outreachCode}`, context);

const call = async (method, { body, query } = {}) => {
  const response = await context.epkWorkspace({ headers: { origin }, body: body ? JSON.stringify(body) : undefined, queryStringParameters: query }, method);
  return { status: response.statusCode, data: JSON.parse(response.body) };
};
const save = (action, kit) => call("POST", { body: { kit, action, publish: action === "publish" } });
const publicCopy = () => table.get("epk-public|eroticon");
const versionItems = () => [...table.values()].filter(item => item.userId.S === `epkv#${userId}` && item.tourId.S.startsWith("main#"));
const kit = (bio, mediaNumbers) => ({ artistName: "Eroticon", bio, media: mediaNumbers.map(n => ({ key: media(n), type: "image" })) });

(async () => {
  // A first draft stays private.
  let result = await save("draft", kit("first draft", [1]));
  assert.equal(result.status, 200);
  assert.equal(result.data.published, false);
  assert.equal(publicCopy(), undefined, "a first draft is never public");
  assert.equal(versionItems().length, 0);

  // Publish A.
  const kitA = kit("published A", [1]);
  result = await save("publish", kitA);
  assert.equal(result.data.published, true);
  const publishedAtA = result.data.publishedAt;
  assert.match(publishedAtA, /^2026-11-24T/);
  assert.equal(JSON.parse(publicCopy().plan.S).bio, "published A");
  assert.equal(versionItems().length, 1, "publishing keeps a version");
  result = await call("GET");
  assert.equal(result.data.published, true);
  assert.equal(result.data.publishedAt, publishedAtA);
  assert.equal(result.data.draftChanged, false);

  // The owner's bug: a draft save used to take the published EPK offline. Now venues keep seeing A.
  result = await save("draft", kit("draft B", [2]));
  assert.equal(result.data.published, true, "a draft save keeps the EPK published");
  assert.equal(result.data.draftChanged, true);
  assert.equal(result.data.publishedAt, publishedAtA);
  assert.equal(JSON.parse(publicCopy().plan.S).bio, "published A", "venues still see the published EPK");
  assert.ok(!deletedMedia.includes(media(1)), "the published EPK's photo is not deleted when the draft drops it");
  result = await call("GET");
  assert.equal(result.data.draftChanged, true, "the builder says the changes are a draft");
  assert.equal(result.data.kit.bio, "draft B", "the builder opens the draft");

  // Older pages send { publish: false } for both Save draft and Unpublish: treated as a draft save, never offline.
  await call("POST", { body: { kit: kit("draft C", [3]), publish: false } });
  assert.equal(JSON.parse(publicCopy().plan.S).bio, "published A");
  assert.ok(deletedMedia.includes(media(2)), "a draft photo nobody uses any more is deleted");
  assert.ok(!deletedMedia.includes(media(1)));

  // A venue link carries the published EPK, never the draft.
  table.set(`${userId}|booking-workspace-v1`, { userId: { S: userId }, tourId: { S: "booking-workspace-v1" }, plan: { S: JSON.stringify({ venues: [{ venueKey: "club-1", name: "Club One" }] }) } });
  const outreach = await context.outreachEpkShare({ headers: { origin }, body: JSON.stringify({ action: "create", venueKey: "club-1", outreachId: "outreach-0001-abcdef" }) }, "POST");
  assert.equal(outreach.statusCode, 200);
  const venueCopy = [...table.values()].find(item => item.userId.S === "epk-outreach-share");
  assert.equal(JSON.parse(venueCopy.plan.S).bio, "published A", "the venue gets what was published");

  // The versions list, one version, and opening it.
  result = await call("GET", { query: { versions: "1" } });
  assert.deepEqual(result.data.versions.map(item => item.id), [publishedAtA]);
  assert.equal(result.data.versions[0].artistName, "Eroticon");
  result = await call("GET", { query: { version: publishedAtA } });
  assert.equal(result.status, 200);
  assert.equal(result.data.kit.bio, "published A");
  assert.equal(result.data.publishedAt, publishedAtA);
  assert.equal((await call("GET", { query: { version: "../../x" } })).status, 400);
  assert.equal((await call("GET", { query: { version: "2020-01-01T00:00:00.000Z" } })).status, 404);

  // 21 more publishes: the newest 20 are kept; files of a kept version are never deleted.
  const published = [];
  for (let i = 1; i <= 21; i += 1) {
    result = await save("publish", kit(`published ${i}`, [100 + i]));
    assert.equal(result.status, 200);
    published.push(result.data.publishedAt);
  }
  assert.equal(versionItems().length, 20, "the newest 20 versions are kept");
  result = await call("GET", { query: { versions: "1" } });
  assert.deepEqual(result.data.versions.map(item => item.id), published.slice(1).reverse(), "newest first; A and the first loop publish are gone");
  assert.ok(deletedMedia.includes(media(1)), "A's photo goes once its version is no longer kept");
  assert.ok(deletedMedia.includes(media(3)), "the old draft's photo goes once it is replaced");
  assert.ok(deletedMedia.includes(media(101)), "a pruned version's photo goes");
  for (let i = 2; i <= 21; i += 1) assert.ok(!deletedMedia.includes(media(100 + i)), `a kept version's photo stays (${i})`);

  // Bring back an older version: the server hands it over; the builder saves it as a draft.
  result = await call("GET", { query: { version: published[1] } });
  assert.equal(result.data.kit.bio, "published 2");
  await save("draft", result.data.kit);
  assert.equal(JSON.parse(publicCopy().plan.S).bio, "published 21", "bringing back is a draft until it is published");
  assert.ok(!deletedMedia.includes(media(121)), "the published copy's photo stays while the draft shows another");

  // Unpublish: offline for venues, the versions stay.
  result = await save("unpublish", result.data.kit);
  assert.equal(result.data.published, false);
  assert.equal(result.data.publishedAt, "");
  assert.equal(publicCopy(), undefined, "Unpublish takes the EPK offline");
  assert.equal(versionItems().length, 20, "Unpublish keeps the published versions");
  result = await call("GET");
  assert.equal(result.data.published, false);
  assert.equal(result.data.publishedAt, "");
  assert.equal(result.data.draftChanged, false);
  assert.equal(table.get(`${userId}|epk-workspace-v1`).publishedPlanHash, undefined);
  for (let i = 2; i <= 21; i += 1) assert.ok(!deletedMedia.includes(media(100 + i)), `kept versions keep their photos after Unpublish (${i})`);

  // Delete the EPK: every version and every file goes.
  result = await call("DELETE");
  assert.equal(result.data.deleted, true);
  assert.equal(versionItems().length, 0, "deleting the EPK deletes its versions");
  for (let i = 2; i <= 21; i += 1) assert.ok(deletedMedia.includes(media(100 + i)), `the version photo is deleted with the EPK (${i})`);

  // The member's own partition holds no versions (the Tour list reads it whole, 1 MB per read).
  assert.equal([...table.values()].filter(item => item.userId.S === userId && /^epkv|^main#/.test(item.tourId.S)).length, 0);
  assert.match(source, /async function listTourPlans[^]*?KeyConditionExpression: "userId = :userId", ExpressionAttributeValues: \{ ":userId": \{ S: userId \} \}/, "GET /tours still reads only the member's own partition");
  assert.match(source, /const epkVersionPartition = userId => `epkv#\$\{userId\}`;/);

  // Wiring: the builder asks for the actions; older pages keep working.
  const builder = fs.readFileSync(path.join(__dirname, "assets/epk.js"), "utf8");
  assert.match(builder, /addEventListener\("click", \(\) => save\("draft"\)\)/);
  assert.match(builder, /addEventListener\("click", \(\) => save\("publish"\)\)/);
  assert.match(builder, /addEventListener\("click", \(\) => save\("unpublish"\)\)/);
  assert.match(builder, /danzstakConfirm\("Venues with the link will see that it's not available/, "Unpublish asks first");
  const page = fs.readFileSync(path.join(__dirname, "epk.html"), "utf8");
  assert.match(page, /<script src="assets\/epk-versions\.js\?v=\d+" defer><\/script>\s*<script src="assets\/epk\.js\?v=\d+" defer>/, "the versions script loads before the builder");
  assert.match(fs.readFileSync(path.join(__dirname, "service-worker.js"), "utf8"), /"\/assets\/epk-versions\.js"/);
  console.log("EPK versions checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
