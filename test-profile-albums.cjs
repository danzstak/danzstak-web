"use strict";
// Queue 5a2 (owner 2026-11-18): named photo and video albums on the profile Photos and Videos tabs.
// Runs the real albums module against an in-memory DynamoDB, then checks the wiring.
const assert = require("node:assert/strict");
const fs = require("node:fs");

// ---------- a small DynamoDB for the expressions albums.mjs uses ----------
const table = new Map();
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const keyOf = source => `${source.userId.S}|${source.tourId.S}`;
const fail = name => Object.assign(new Error(name), { name });
const name = (token, names = {}) => token.startsWith("#") ? names[token] : token;
function condition(item, expression, names) {
  if (!expression) return true;
  return expression.split(/\s+AND\s+/).every(term => {
    const match = /^(attribute_exists|attribute_not_exists)\(([#\w]+)\)$/.exec(term.trim());
    if (!match) throw new Error(`Unsupported condition ${term}`);
    const present = item?.[name(match[2], names)] !== undefined;
    return match[1] === "attribute_exists" ? present : !present;
  });
}
function update(item, expression, names = {}, values = {}) {
  for (const [, verb, body] of expression.matchAll(/\b(SET|ADD|REMOVE)\s+(.*?)(?=\s+\b(?:SET|ADD|REMOVE)\b|$)/g)) {
    const parts = []; let depth = 0, start = 0;
    for (let i = 0; i < body.length; i += 1) { if (body[i] === "(") depth += 1; else if (body[i] === ")") depth -= 1; else if (body[i] === "," && !depth) { parts.push(body.slice(start, i)); start = i + 1; } }
    parts.push(body.slice(start));
    for (const raw of parts.map(part => part.trim()).filter(Boolean)) {
      if (verb === "REMOVE") { delete item[name(raw, names)]; continue; }
      if (verb === "ADD") { const [field, value] = raw.split(/\s+/), key = name(field, names); item[key] = { N: String(Number(item[key]?.N || 0) + Number(values[value].N)) }; continue; }
      const [field, expr] = raw.split(/\s*=\s*/), key = name(field, names), ifNot = /^if_not_exists\(([#\w]+),\s*(:\w+)\)$/.exec(expr);
      item[key] = clone(ifNot ? item[name(ifNot[1], names)] ?? values[ifNot[2]] : values[expr]);
    }
  }
}
function step(operation) {
  const [kind, input] = Object.entries(operation)[0], key = keyOf(input.Key || input.Item), current = table.get(key);
  return { ok: condition(current, input.ConditionExpression, input.ExpressionAttributeNames), apply() {
    if (kind === "Put") table.set(key, clone(input.Item));
    else if (kind === "Delete") table.delete(key);
    else { const next = clone(current) || clone(input.Key); update(next, input.UpdateExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues); table.set(key, next); }
  } };
}
const db = { async send(command) {
  const input = command.input, kind = command.kind;
  if (kind === "Get") return { Item: clone(table.get(keyOf(input.Key))) };
  if (kind === "Query") { const partition = input.ExpressionAttributeValues[":p"].S, prefix = input.ExpressionAttributeValues[":prefix"].S; return { Items: [...table.values()].filter(item => item.userId.S === partition && item.tourId.S.startsWith(prefix)).sort((a, b) => a.tourId.S.localeCompare(b.tourId.S)).map(clone) }; }
  if (kind === "Transact") { const steps = input.TransactItems.map(step); if (steps.some(s => !s.ok)) throw fail("TransactionCanceledException"); steps.forEach(s => s.apply()); return {}; }
  const s = step({ [kind]: input }); if (!s.ok) throw fail("ConditionalCheckFailedException"); s.apply(); return {};
} };
const command = kind => class { constructor(input) { this.input = input; this.kind = kind; } };
const commands = { GetItemCommand: command("Get"), PutItemCommand: command("Put"), QueryCommand: command("Query"), UpdateItemCommand: command("Update"), DeleteItemCommand: command("Delete"), TransactWriteItemsCommand: command("Transact") };

(async () => {
  const m = await import("./infrastructure/auth-api/albums.mjs");
  const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const OWNER = id(1), FRIEND = id(2), STRANGER = id(3), BLOCKED = id(4);
  const prefix = "a".repeat(24), otherPrefix = "b".repeat(24), upload = (ext, n = 1) => `users/${prefix}/${id(100 + n)}.${ext}`;

  // ---------- pure rules ----------
  assert.deepEqual(m.cleanAlbum({ name: "  Hellfest   2026 ", date: "2026-06-21", place: "Clisson", visibility: "public" }), { album: { name: "Hellfest 2026", date: "2026-06-21", place: "Clisson", visibility: "public" } });
  assert.match(m.cleanAlbum({ name: "" }).error, /name/);
  assert.match(m.cleanAlbum({ name: "x", date: "21/06/2026" }).error, /date/);
  assert.match(m.cleanAlbum({ name: "x", visibility: "everyone" }).error, /Public, Friends or Only me/);
  assert.equal(m.cleanAlbum({ name: "x" }).album.visibility, "friends", "new albums default to Friends");
  assert.deepEqual(m.cleanItem({ mediaKey: upload("jpg") }, prefix), { mediaKey: upload("jpg"), mediaType: "image" });
  assert.deepEqual(m.cleanItem({ mediaKey: upload("mov") }, prefix), { mediaKey: upload("mov"), mediaType: "video" });
  for (const bad of [`users/${otherPrefix}/${id(9)}.jpg`, upload("mp3"), upload("wav"), `stories/${prefix}/${id(9)}.jpg`, `users/${prefix}/../x.jpg`]) assert.equal(m.cleanItem({ mediaKey: bad }, prefix), null, `${bad} is refused`);
  assert.equal(m.cleanItem({ mediaKey: upload("jpg"), mediaType: "video" }, prefix), null, "the type must match the file");
  assert.equal(m.canSee("private", { isOwner: true }), true);
  assert.equal(m.canSee("private", { friends: true }), false);
  assert.equal(m.canSee("friends", { friends: true }), true);
  assert.equal(m.canSee("friends", { friends: false }), false);
  assert.equal(m.canSee("public", { friends: false }), true);
  assert.equal(m.canSee("public", { blocked: true }), false);

  // ---------- flows ----------
  const emails = { [OWNER]: "owner@example.com", [FRIEND]: "friend@example.com", [STRANGER]: "stranger@example.com", [BLOCKED]: "blocked@example.com" };
  const relations = { "friend@example.com|owner@example.com": "friends", "blocked@example.com|owner@example.com": "blocked_by" };
  const deleted = []; let s3Fails = false, n = 0;
  const albums = m.createAlbums({
    db, commands, tableName: "Tours", authenticate: async event => event.user, accountEmail: async user => emails[user] || "",
    mediaPrefix: async user => user === OWNER ? prefix : otherPrefix, signedUrl: key => `https://media.example/${key}?signed`,
    deleteMedia: async keys => { if (s3Fails) return false; deleted.push(...keys); return true; },
    relationship: async (viewer, owner) => relations[`${viewer}|${owner}`] || "",
    corsHeaders: origin => ({ "access-control-allow-origin": origin }), originAllowed: origin => origin === "https://danzstak.com",
    clock: () => Date.parse("2026-11-18T22:00:00.000Z") + (n += 1000), newId: () => (n += 1).toString(16).padStart(32, "0")
  });
  const call = async (user, method, path, body, query = {}) => { const response = await albums.handle({ user, headers: { origin: "https://danzstak.com" }, queryStringParameters: query, body: body === undefined ? undefined : JSON.stringify(body) }, method, path); return response && { status: response.statusCode, data: JSON.parse(response.body) }; };

  assert.equal(await albums.handle({ headers: {} }, "GET", "/tours"), null, "other paths pass through");
  assert.equal((await albums.handle({ headers: { origin: "https://evil.example" }, user: OWNER }, "GET", "/albums")).statusCode, 403);
  assert.equal((await call(undefined, "GET", "/albums")).status, 401);
  assert.equal((await call(OWNER, "GET", "/albums/not-an-id")).status, 404);

  const hellfest = (await call(OWNER, "POST", "/albums", { name: "Hellfest 2026", date: "2026-06-21", place: "Clisson", visibility: "public" })).data.album;
  const wedding = (await call(OWNER, "POST", "/albums", { name: "Mike & Ana's wedding", visibility: "friends" })).data.album;
  const diary = (await call(OWNER, "POST", "/albums", { name: "Tour diary", visibility: "private" })).data.album;
  assert.match(hellfest.albumId, /^[a-f0-9]{32}$/);

  // Upload many at once: own photo and video uploads only, never music files or someone else's files.
  let added = await call(OWNER, "POST", `/albums/${hellfest.albumId}/items`, { items: [{ mediaKey: upload("jpg", 1) }, { mediaKey: upload("png", 2) }, { mediaKey: upload("mp4", 3) }] });
  assert.equal(added.status, 200); assert.equal(added.data.added.length, 3);
  assert.equal((await call(OWNER, "POST", `/albums/${hellfest.albumId}/items`, { items: [{ mediaKey: upload("mp3", 4) }] })).status, 400, "no music files");
  assert.equal((await call(OWNER, "POST", `/albums/${hellfest.albumId}/items`, { items: [{ mediaKey: `users/${otherPrefix}/${id(5)}.jpg` }] })).status, 400, "no one else's uploads");
  assert.equal((await call(OWNER, "POST", `/albums/${hellfest.albumId}/items`, { items: Array.from({ length: 51 }, (_, i) => ({ mediaKey: upload("jpg", 10 + i) })) })).status, 400, "at most 50 per request");
  assert.equal((await call(FRIEND, "POST", `/albums/${hellfest.albumId}/items`, { items: [{ mediaKey: `users/${otherPrefix}/${id(6)}.jpg` }] })).status, 404, "nobody adds to someone else's album");
  await call(OWNER, "POST", `/albums/${wedding.albumId}/items`, { items: [{ mediaKey: upload("webp", 7) }] });
  await call(OWNER, "POST", `/albums/${diary.albumId}/items`, { items: [{ mediaKey: upload("mov", 8) }] });

  // Owner list: counts, cover, the Photos tab shows albums with photos (and the owner's empty ones).
  let list = (await call(OWNER, "GET", "/albums", undefined, { kind: "image" })).data;
  assert.equal(list.isOwner, true);
  assert.deepEqual(list.albums.map(album => [album.name, album.photoCount, album.videoCount]), [["Mike & Ana's wedding", 1, 0], ["Hellfest 2026", 2, 1]], "newest first (event date, else when made); the Photos tab leaves out a videos-only album");
  assert.match(list.albums.find(album => album.name === "Hellfest 2026").cover.url, /signed$/, "the first upload becomes the cover");
  assert.deepEqual((await call(OWNER, "GET", "/albums", undefined, { kind: "video" })).data.albums.map(album => album.name), ["Tour diary", "Hellfest 2026"]);

  // Who sees what: Public for any member, Friends for friends, Only me for nobody else, blocked sees nothing.
  const names = async (user, query = {}) => (await call(user, "GET", "/albums", undefined, { member: OWNER, ...query })).data.albums.map(album => album.name).sort();
  assert.deepEqual(await names(FRIEND), ["Hellfest 2026", "Mike & Ana's wedding"]);
  assert.deepEqual(await names(STRANGER), ["Hellfest 2026"]);
  assert.deepEqual(await names(BLOCKED), []);
  assert.equal((await call(STRANGER, "GET", `/albums/${wedding.albumId}`, undefined, { member: OWNER })).status, 404, "a hidden album looks like no album");
  assert.equal((await call(FRIEND, "GET", `/albums/${diary.albumId}`, undefined, { member: OWNER })).status, 404);
  const page = (await call(STRANGER, "GET", `/albums/${hellfest.albumId}`, undefined, { member: OWNER })).data;
  assert.equal(page.isOwner, false); assert.equal(page.items.length, 3);
  assert.ok(page.items.every(item => item.url.endsWith("?signed") && !("mediaKey" in item)), "viewers get signed links, never storage keys");

  // Rename, change who sees it, pick the cover.
  const video = page.items.find(item => item.mediaType === "video");
  let edited = await call(OWNER, "PATCH", `/albums/${hellfest.albumId}`, { name: "Hellfest 2026 – Saturday", visibility: "friends", coverItemId: video.itemId });
  assert.equal(edited.status, 200);
  assert.deepEqual([edited.data.album.name, edited.data.album.visibility, edited.data.album.cover.mediaType], ["Hellfest 2026 – Saturday", "friends", "video"]);
  assert.deepEqual(await names(STRANGER), [], "now Friends only");
  assert.equal((await call(OWNER, "PATCH", `/albums/${hellfest.albumId}`, { visibility: "everyone" })).status, 400);
  assert.equal((await call(OWNER, "PATCH", `/albums/${"f".repeat(32)}`, { name: "x" })).status, 404);

  // Removing one item takes the file out of storage and fixes the counts (and the cover if it was the cover).
  assert.equal((await call(OWNER, "DELETE", `/albums/${hellfest.albumId}/items/${video.itemId}`)).status, 200);
  assert.deepEqual(deleted, [upload("mp4", 3)]);
  list = (await call(OWNER, "GET", "/albums", undefined, { kind: "image" })).data;
  const after = list.albums.find(album => album.albumId === hellfest.albumId);
  assert.deepEqual([after.photoCount, after.videoCount, after.cover], [2, 0, null]);

  // Deleting an album: every file leaves storage first; if that fails nothing is deleted.
  s3Fails = true;
  assert.equal((await call(OWNER, "DELETE", `/albums/${hellfest.albumId}`)).status, 503);
  assert.equal((await call(OWNER, "GET", `/albums/${hellfest.albumId}`)).status, 200, "nothing deleted when storage cleanup fails");
  s3Fails = false; deleted.length = 0;
  assert.deepEqual((await call(OWNER, "DELETE", `/albums/${hellfest.albumId}`)).data, { deleted: true, albumId: hellfest.albumId, files: 2 });
  assert.deepEqual(deleted.sort(), [upload("jpg", 1), upload("png", 2)].sort());
  assert.equal([...table.keys()].filter(key => key.includes(hellfest.albumId)).length, 0, "no records left behind");

  // Export: the owner's albums with which uploads are in each.
  const exported = (await call(OWNER, "GET", "/albums", undefined, { full: "1" })).data.albums;
  assert.deepEqual(exported.map(album => [album.name, album.items.length]).sort(), [["Mike & Ana's wedding", 1], ["Tour diary", 1]]);
  assert.equal((await call(STRANGER, "GET", "/albums", undefined, { member: OWNER, full: "1" })).data.albums.every(album => !album.items), true, "export detail is for the owner only");

  // ---------- wiring ----------
  const index = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
  assert.match(index, /import \{ createAlbums \} from "\.\/albums\.mjs";/);
  assert.match(index, /if \(path === "\/albums" \|\| path\.startsWith\("\/albums\/"\)\) \{ const albums = await albumsService\(\)\.handle\(event, method, path\)/);
  for (const route of ["GET /albums", "POST /albums", "GET /albums/{albumId}", "PATCH /albums/{albumId}", "DELETE /albums/{albumId}", "POST /albums/{albumId}/items", "DELETE /albums/{albumId}/items/{itemId}"]) assert.ok(deploy.includes(`"${route}"`), `${route} is deployed`);
  assert.match(deploy, /--statement-id AllowAlbumsFromApiGateway[^\n]*\/\*\/\*\/albums\*/);
  const profile = fs.readFileSync("profile.html", "utf8"), sw = fs.readFileSync("service-worker.js", "utf8"), ui = fs.readFileSync("assets/profile-albums.js", "utf8");
  assert.match(profile, /assets\/profile-albums\.js\?v=\d+/); assert.match(profile, /assets\/profile-albums\.css\?v=\d+/);
  assert.ok(sw.includes('"/assets/profile-albums.js"') && sw.includes('"/assets/profile-albums.css"'));
  const editor = fs.readFileSync("assets/profile-editor.js", "utf8");
  assert.match(editor, /if \(mediaOnly && version === profileTabVersion && typeof CustomEvent === "function"\) window\.dispatchEvent\(new CustomEvent\("danzstak:profile-media-tab"/);
  assert.match(editor, /to show yet\.` : "No posts to show yet\."; if \(!mediaOnly\) return; \}/, "an empty Photos or Videos grid still gets the Albums row");
  assert.doesNotMatch(ui.match(/const ACCEPT = (\[[^\]]+\])/)[1], /audio/, "the picker never offers music files");
  assert.match(ui, /purpose: "post"/, "albums use the normal post upload ticket");
  assert.match(ui, /can't be recalled/, "delete says plainly that copies outside DanzStak can't be recalled");
  assert.match(fs.readFileSync("assets/account-export.js", "utf8"), /albums: "\/albums\?full=1"/);
  assert.match(fs.readFileSync("assets/account-export-core.js", "utf8"), /albums: Array\.isArray\(sources\.albums\?\.albums\)/);
  console.log("profile albums: ok");
})().catch(error => { console.error(error); process.exitCode = 1; });
