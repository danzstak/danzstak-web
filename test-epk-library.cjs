"use strict";
// Spec 47, Train B part 1 (owner 2026-11-24: "users may have a bunch of epk", "and also several per artist",
// "a limit of 5 epk per artist"). Runs the Auth API's real EPK handlers against an in-memory table and checks:
// - one account holds several EPKs (the original record is "main", the others epk#<id>), each with its own link;
// - + New EPK starts blank or copies one; Rename changes the label;
// - two EPKs for one artist publish to two links, each with its own versions;
// - deleting one leaves the other untouched, and never deletes a file the other still uses;
// - a 6th EPK for one artist is refused (create, and renaming the act inside another EPK);
// - My EPKs lists every EPK with each name's verification state; EPKs never show up as tours.
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

// Task 20 stand-in: which act names are verified, and every name the check was asked about.
const verification = { verified: new Set(["Eroticon"]), asked: [] };
const artistVerificationService = () => ({ gate: async ({ artistName, purpose }) => {
  verification.asked.push({ artistName, purpose: purpose || "pitch" });
  return verification.verified.has(artistName) ? { ok: true, status: "verified", verifiedAt: "2026-11-24T09:00:00.000Z", method: "page" } : { ok: false, status: "not_verified", message: "Verify your act to publish or pitch." };
} });

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
  epkForViewer: kit => kit, artistVerificationService,
  kitArtistName: item => { try { return JSON.parse(item?.plan?.S || "{}").artistName || ""; } catch { return ""; } }, aiEpkHandler: async () => ({ publishBlock: async () => null }), validatedEpkMedia: async () => {},
  randomUUID: () => crypto.randomUUID(), randomValue: () => crypto.randomBytes(32).toString("hex"), randomBytes: crypto.randomBytes,
  epkShareLink: id => `https://danzstak.com/e/${id}`, validEpkId: id => /^[a-z0-9-]{3,64}$/.test(id || ""), validCardKey: () => false,
  EPK_CARD_PARTITION: "epk-share-card", epkMediaPattern: owner => new RegExp(`^epk/${owner}/[a-f0-9-]{36}\\.(jpg|png|webp|pdf)$`),
  runCleanup: async tasks => { for (const task of tasks) await task(); return 0; },
  now: () => Math.floor(clock / 1000),
  queryAll: async request => {
    const user = request.ExpressionAttributeValues[":user"].S, prefix = request.ExpressionAttributeValues[":prefix"]?.S || "";
    return [...table.values()].filter(item => item.userId.S === user && item.tourId.S.startsWith(prefix)).map(clone);
  }
});
vm.runInContext(`${constants}\n${workspaceCode}\n${outreachCode}`, context);
const call = async (method, { body, query } = {}) => {
  const response = await context.epkWorkspace({ headers: { origin }, body: body ? JSON.stringify(body) : undefined, queryStringParameters: query }, method);
  return { status: response.statusCode, data: JSON.parse(response.body) };
};
const kit = (artistName, bio, mediaNumbers) => ({ artistName, bio, media: mediaNumbers.map(n => ({ key: media(n), type: "image" })) });
const save = (action, value, epkId) => call("POST", { body: { kit: value, action, ...(epkId ? { epkId } : {}) } });
const publicCopy = id => table.get(`epk-public|${id}`);
const versions = prefix => [...table.values()].filter(item => item.userId.S === `epkv#${userId}` && item.tourId.S.startsWith(prefix));

(async () => {
  // The original EPK ("main"), published with photo 1.
  let result = await save("publish", kit("Eroticon", "club set", [1]));
  assert.equal(result.status, 200);
  assert.equal(result.data.epkId, "main");
  assert.equal(publicCopy("eroticon").epkTourId.S, "epk-workspace-v1", "the public copy names its EPK (impersonation holds find it)");

  // + New EPK as a copy of main: a private draft for the same artist that shares photo 1.
  result = await call("POST", { body: { action: "create", from: "main", label: "  DJ   set " } });
  assert.equal(result.status, 200);
  const dj = result.data.epkId;
  assert.match(dj, /^[a-f0-9]{10}$/);
  assert.equal(result.data.label, "DJ set");
  assert.equal(result.data.published, false);
  const djRecord = table.get(`${userId}|epk#${dj}`);
  assert.equal(JSON.parse(djRecord.plan.S).bio, "club set", "a copy starts from the EPK it copies");
  assert.deepEqual(djRecord.mediaKeys.SS, [media(1)]);

  // Its own draft, its own link, its own versions; main is untouched.
  result = await save("draft", kit("Eroticon", "dj set", [1, 2]), dj);
  assert.equal(result.status, 200);
  assert.equal(result.data.published, false);
  result = await save("publish", kit("Eroticon", "dj set", [1, 2]), dj);
  assert.equal(result.status, 200);
  assert.equal(result.data.publicId, "eroticon-dj-set", "a second EPK gets its own link");
  assert.equal(JSON.parse(publicCopy("eroticon-dj-set").plan.S).bio, "dj set");
  assert.equal(publicCopy("eroticon-dj-set").epkTourId.S, `epk#${dj}`);
  assert.equal(JSON.parse(publicCopy("eroticon").plan.S).bio, "club set", "publishing one EPK never changes another");
  assert.equal(versions("main#").length, 1);
  assert.equal(versions(`${dj}#`).length, 1, "each EPK keeps its own versions");
  result = await call("GET", { query: { epk: dj, versions: "1" } });
  assert.equal(result.data.versions.length, 1);
  result = await call("GET", { query: { epk: dj, version: result.data.versions[0].id } });
  assert.equal(result.data.kit.bio, "dj set");
  result = await call("GET", { query: { epk: dj } });
  assert.equal(result.data.kit.bio, "dj set");
  assert.equal(result.data.label, "DJ set");
  assert.equal(result.data.epkId, dj);
  result = await call("GET");
  assert.equal(result.data.kit.bio, "club set", "no ?epk= still means the original EPK (older pages)");

  // A file the other EPK uses is never deleted: main drops photo 1 from its draft and publishes without it.
  await save("publish", kit("Eroticon", "club set 2", [3]));
  for (let i = 0; i < 21; i += 1) await save("publish", kit("Eroticon", `club ${i}`, [3]));
  assert.ok(!deletedMedia.includes(media(1)), "photo 1 stays while the DJ set still uses it");

  // Rename.
  result = await call("POST", { body: { action: "rename", epkId: dj, label: "Festival DJ set" } });
  assert.equal(result.status, 200);
  assert.equal(table.get(`${userId}|epk#${dj}`).label.S, "Festival DJ set");
  assert.equal((await call("POST", { body: { action: "rename", epkId: dj, label: "   " } })).status, 400);

  // Bad ids never reach the table.
  for (const bad of ["../x", "MAIN", "abc", "epk#0123456789"]) {
    assert.equal((await call("GET", { query: { epk: bad } })).status, 400, `bad id ${bad}`);
    assert.equal((await save("draft", kit("Eroticon", "x", []), bad)).status, 400, `bad id ${bad} on save`);
  }
  assert.equal((await call("GET", { query: { epk: "fedcba9876" } })).status, 404, "an EPK that doesn't exist");
  assert.equal((await save("draft", kit("Eroticon", "x", []), "fedcba9876")).status, 404, "saving never creates an EPK by id");

  // 5 per artist: main + DJ set + 3 more is 5; the 6th is refused, with or without accents and case.
  for (const label of ["Live", "Italia", "Radio"]) assert.equal((await call("POST", { body: { action: "create", artistName: "Eroticon", label } })).status, 200);
  result = await call("POST", { body: { action: "create", artistName: "ÉROTICON!", label: "One more" } });
  assert.equal(result.status, 409, "a 6th EPK for one artist is refused");
  assert.equal(result.data.code, "epk_artist_limit");
  assert.equal(result.data.max, 5);
  result = await call("POST", { body: { action: "create", from: dj, label: "Copy" } });
  assert.equal(result.status, 409, "a copy counts too");
  // Another name on the same account is fine (one person, several artist names).
  result = await call("POST", { body: { action: "create", artistName: "Sleeping Dragon", label: "Label" } });
  assert.equal(result.status, 200);
  const label = result.data.epkId;
  assert.equal(JSON.parse(table.get(`${userId}|epk#${label}`).plan.S).artistName, "Sleeping Dragon", "a blank EPK holds only the artist name");
  // Renaming the act inside that EPK to Eroticon would make a 6th.
  result = await save("draft", kit("Eroticon", "sneaky", []), label);
  assert.equal(result.status, 409);
  assert.equal(result.data.code, "epk_artist_limit");
  assert.equal(JSON.parse(table.get(`${userId}|epk#${label}`).plan.S).artistName, "Sleeping Dragon", "a refused save changes nothing");
  assert.equal((await call("POST", { body: { action: "create", artistName: "", label: "x" } })).status, 400);
  assert.equal((await call("POST", { body: { action: "create", artistName: "New act", label: "" } })).status, 400);

  // My EPKs: every EPK, newest first, with each name's verification state once.
  result = await call("GET", { query: { list: "1" } });
  assert.equal(result.status, 200);
  assert.equal(result.data.epks.length, 6);
  assert.equal(result.data.maxPerArtist, 5);
  const djRow = result.data.epks.find(item => item.epkId === dj);
  assert.equal(djRow.label, "Festival DJ set");
  assert.equal(djRow.published, true);
  assert.equal(djRow.shareUrl, "https://danzstak.com/e/eroticon-dj-set");
  assert.ok(!("plan" in djRow) && !("mediaKeys" in djRow), "the list never sends plans or file keys");
  assert.deepEqual(result.data.names.map(item => [item.artistName, item.count, item.status]).sort(), [["Eroticon", 5, "verified"], ["Sleeping Dragon", 1, "not_verified"]]);
  const sorted = result.data.epks.map(item => item.updatedAt);
  assert.deepEqual(sorted, [...sorted].sort().reverse(), "newest first");

  // Delete the DJ set: its link, versions and only-its-own files go; main is untouched.
  deletedMedia.length = 0;
  result = await call("DELETE", { query: { epk: dj } });
  assert.equal(result.data.deleted, true);
  assert.equal(table.get(`${userId}|epk#${dj}`), undefined);
  assert.equal(publicCopy("eroticon-dj-set"), undefined, "its link stops working");
  assert.equal(versions(`${dj}#`).length, 0);
  assert.ok(deletedMedia.includes(media(1)) && deletedMedia.includes(media(2)), "files no other EPK uses are deleted");
  assert.ok(!deletedMedia.includes(media(3)), "main's photo stays");
  assert.equal(JSON.parse(publicCopy("eroticon").plan.S).bio, "club 20", "main stays published");
  assert.equal(versions("main#").length, 20);
  // Now a 5th Eroticon EPK fits again.
  result = await call("POST", { body: { action: "create", artistName: "Eroticon", label: "Again" } });
  assert.equal(result.status, 200);
  assert.equal((await call("DELETE", { query: { epk: result.data.epkId } })).data.deleted, true);

  // Two EPKs share a file; deleting main keeps it for the other.
  const shared = (await call("POST", { body: { action: "create", from: "main", label: "Shared" } })).data.epkId;
  assert.ok(shared);
  deletedMedia.length = 0;
  result = await call("DELETE");
  assert.equal(result.data.deleted, true);
  assert.ok(!deletedMedia.includes(media(3)), "a file the copy uses survives deleting main");
  assert.equal(versions("main#").length, 0);
  assert.ok(table.get(`${userId}|epk#${shared}`), "the other EPKs stay");

  // Wiring.
  assert.match(source, /!id\.startsWith\(epkRecordPrefix\) && !id\.startsWith\("EPK#"\)/, "EPKs and venue links never show up as tours");
  const verify = fs.readFileSync(path.join(__dirname, "infrastructure/auth-api/artist-verification.mjs"), "utf8");
  assert.match(verify, /epkTourId: publicItem\.epkTourId\?\.S/, "a report holds the EPK that was reported");
  const page = fs.readFileSync(path.join(__dirname, "epk.html"), "utf8");
  assert.match(page, /<script src="assets\/epk-library\.js\?v=\d+" defer><\/script>/);
  assert.match(fs.readFileSync(path.join(__dirname, "service-worker.js"), "utf8"), /"\/assets\/epk-library\.js"/);
  console.log("EPK library checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
