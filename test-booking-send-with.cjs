"use strict";
// Spec 47 part 2 ("Send with", owner 2026-11-24: "artist might send a different to different venues or festivals").
// Runs the Auth API's real venue-link and booking handlers against an in-memory table, and the real Tour Manager send,
// preflight and reply handlers, and checks:
// - a venue link carries the EPK the artist picked (its published copy), and names it; older pages still mean "main";
// - the booking workspace lists the published EPKs with each one's gate; one ready EPK opens booking;
// - sending, preflight and replies check the EPK the venue link carries, never only the first EPK;
// - deleting an EPK stops its own venue links and leaves the others working.
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
const choicesCode = slice("// Spec 47 part 2 (\"Send with\"): the published EPKs a pitch can carry", "async function bookingSendItems");

class GetItemCommand { constructor(input) { this.input = input; } }
class PutItemCommand { constructor(input) { this.input = input; } }
class UpdateItemCommand { constructor(input) { this.input = input; } }
class QueryCommand { constructor(input) { this.input = input; } }
class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }

const userId = "artist-1", email = "artist@example.test", origin = "https://danzstak.com";
const sha256 = value => crypto.createHash("sha256").update(String(value)).digest("hex");
const table = new Map();
const keyOf = key => `${key.userId.S}|${key.tourId.S}`;
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const db = { send: async command => {
  const input = command.input;
  if (command instanceof GetItemCommand) return { Item: clone(table.get(keyOf(input.Key))) };
  if (command instanceof PutItemCommand) { table.set(keyOf(input.Item), clone(input.Item)); return {}; }
  if (command instanceof QueryCommand) { const values = input.ExpressionAttributeValues, user = (values[":userId"] || values[":user"]).S, prefix = values[":prefix"].S; return { Items: [...table.values()].filter(item => item.userId.S === user && item.tourId.S.startsWith(prefix)).map(clone) }; }
  if (command instanceof UpdateItemCommand) return {};
  if (command instanceof TransactWriteItemsCommand) {
    for (const op of input.TransactItems) {
      if (op.Put) table.set(keyOf(op.Put.Item), clone(op.Put.Item));
      else if (op.Delete) table.delete(keyOf(op.Delete.Key));
    }
    return {};
  }
  throw new Error(`unexpected command ${command.constructor.name}`);
} };
const queryAll = async request => {
  const user = request.ExpressionAttributeValues[":user"].S, prefix = request.ExpressionAttributeValues[":prefix"]?.S || "";
  return [...table.values()].filter(item => item.userId.S === user && item.tourId.S.startsWith(prefix)).map(clone);
};

const readyKit = (artistName, bio) => ({ artistName, bio, heroImage: "https://example.com/a.jpg", shortBio: bio, musicLinks: [{ url: "https://example.com/m" }], videoLinks: [{ url: "https://example.com/v" }], bookingEmail: "b@example.com" });
const putEpk = (tourId, kit, publicId, extra = {}) => {
  table.set(`${userId}|${tourId}`, { userId: { S: userId }, tourId: { S: tourId }, plan: { S: JSON.stringify(kit) }, published: { BOOL: true }, publicId: { S: publicId }, publishedAt: { S: "2026-11-25T10:00:00.000Z" }, updatedAt: { S: "2026-11-25T10:00:00.000Z" }, artistName: { S: kit.artistName }, mediaKeys: { SS: ["x"] }, ...extra });
  table.set(`epk-public|${publicId}`, { userId: { S: "epk-public" }, tourId: { S: publicId }, plan: { S: JSON.stringify({ ...kit, bio: `${kit.bio} (published)` }) }, updatedAt: { S: "2026-11-25T10:00:00.000Z" } });
};

(async () => {
  const pipeline = await import("./infrastructure/auth-api/booking-pipeline.mjs");
  assert.equal(pipeline.epkRecordKeyFor("abcdef0123"), "epk#abcdef0123");
  for (const value of ["main", "", undefined, "../x", "ABCDEF0123", "epk#abcdef0123"]) assert.equal(pipeline.epkRecordKeyFor(value), "epk-workspace-v1", `${value} means the original EPK`);

  const verification = { verified: new Set(["Eroticon"]) };
  const context = vm.createContext({
    Date, JSON, Math, Number, String, Boolean, Array, Set, Map, Object, RegExp, Promise, Error, Buffer, console: { ...console, error: () => {} },
    GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand, TransactWriteItemsCommand, DeleteObjectCommand,
    db, s3: { send: async () => ({}) }, toursTable: "tours", mediaBucket: "media", allowedOrigins: new Set([origin]), corsHeaders: () => ({}),
    getAuthenticatedUser: async () => userId, accountForSub: async () => email, sha256,
    parseJsonBody: event => { try { return JSON.parse(event.body || "null"); } catch { return null; } },
    epkForViewer: kit => kit, epkGate: pipeline.epkGate, EPK_WORKSPACE_KEY: pipeline.EPK_WORKSPACE_KEY,
    artistVerificationService: () => ({ gate: async ({ artistName }) => verification.verified.has(artistName) ? { ok: true, status: "verified", verifiedAt: "2026-11-24T09:00:00.000Z", method: "page" } : { ok: false, status: "not_verified", message: "Verify your act to publish or pitch." } }),
    kitArtistName: item => { try { return JSON.parse(item?.plan?.S || "{}").artistName || ""; } catch { return ""; } },
    randomValue: () => crypto.randomBytes(32).toString("hex"), randomBytes: crypto.randomBytes, randomUUID: () => crypto.randomUUID(),
    epkShareLink: id => `https://danzstak.com/e/${id}`, validEpkId: id => /^[a-z0-9-]{3,64}$/.test(id || ""), validCardKey: () => false,
    EPK_CARD_PARTITION: "epk-share-card", epkMediaPattern: () => /^$/, runCleanup: async tasks => { for (const task of tasks) await task(); return 0; },
    now: () => Math.floor(Date.now() / 1000), queryAll,
    epkOutreachTokenMatches: (token, hash) => sha256(`epk-outreach:${token}`) === hash, verifiedMark: () => true,
    bookingReplyNotice: () => null, bookingNoticeWrites: () => [], engagementNotificationsTable: "n", activityPushOutboxTable: "o"
  });
  vm.runInContext(`${constants}\n${workspaceCode}\n${outreachCode}\n${choicesCode}`, context);

  // Two published EPKs for one artist ("main" = club set, a DJ set), and a third that isn't ready.
  const dj = "abcdef0123", draft = "0123456789";
  putEpk("epk-workspace-v1", readyKit("Eroticon", "club set"), "eroticon");
  putEpk(`epk#${dj}`, readyKit("Eroticon", "dj set"), "eroticon-dj-set", { label: { S: "DJ set" } });
  putEpk(`epk#${draft}`, { artistName: "Eroticon", bio: "half done" }, "eroticon-festival", { label: { S: "Festival" } });
  table.set(`${userId}|booking-workspace-v1`, { userId: { S: userId }, tourId: { S: "booking-workspace-v1" }, plan: { S: JSON.stringify({ venues: [{ venueKey: "club-a", name: "Club A" }, { venueKey: "fest-b", name: "Fest B" }] }) } });
  assert.ok(table.get(`${userId}|booking-workspace-v1`), "the constants still name booking-workspace-v1");

  // The booking workspace lists the published EPKs, each with its own gate.
  let choices = await context.bookingEpkChoices(userId);
  assert.deepEqual(JSON.parse(JSON.stringify(choices.epks.map(item => [item.epkId, item.label, item.artistName, item.ready]).sort())), [["0123456789", "Festival", "Eroticon", false], ["abcdef0123", "DJ set", "Eroticon", true], ["main", "", "Eroticon", true]].sort());
  assert.equal(choices.epk.ready, true);
  assert.ok(!JSON.stringify(choices.epks).includes("plan"), "the list never sends plans");
  // The original EPK unready but another one ready: booking stays open (the picker sends the ready one).
  const mainItem = table.get(`${userId}|epk-workspace-v1`);
  table.set(`${userId}|epk-workspace-v1`, { ...mainItem, plan: { S: JSON.stringify({ artistName: "Eroticon" }) } });
  choices = await context.bookingEpkChoices(userId);
  assert.equal(choices.epk.ready, true, "one ready EPK opens booking");
  table.set(`${userId}|epk-workspace-v1`, mainItem);

  const call = async (method, body, shareId = "") => {
    const response = await context.outreachEpkShare({ headers: { origin }, body: body ? JSON.stringify(body) : undefined }, method, shareId);
    return { status: response.statusCode, data: JSON.parse(response.body) };
  };
  const outA = "outreachclubaaaa0001", outB = "outreachfestbbbb0002", outOld = "outreacholdccccc0003";
  // The club gets the DJ set; its link carries the DJ set's published copy and names it.
  let result = await call("POST", { action: "create", venueKey: "club-a", outreachId: outA, epkId: dj });
  assert.equal(result.status, 200);
  assert.equal(result.data.epkId, dj);
  const shareA = result.data.shareId, tokenA = result.data.shareUrl.split("#token=")[1];
  assert.equal(JSON.parse(table.get(`epk-outreach-share|${shareA}`).plan.S).bio, "dj set (published)", "a venue gets the chosen EPK's published copy");
  assert.equal(table.get(`epk-outreach-share|${shareA}`).epkTourId.S, `epk#${dj}`);
  assert.equal(table.get(`${userId}|EPK#OUTREACH#${outA}`).epkId.S, dj, "the artist's link record names the EPK (Tour Manager checks it)");
  // An older page sends no epkId: the original EPK.
  result = await call("POST", { action: "create", venueKey: "fest-b", outreachId: outOld });
  assert.equal(result.status, 200);
  assert.equal(result.data.epkId, "main");
  assert.equal(JSON.parse(table.get(`epk-outreach-share|${result.data.shareId}`).plan.S).bio, "club set (published)");
  // An EPK that isn't published, or a made-up id, is refused.
  table.set(`${userId}|epk#${draft}`, { ...table.get(`${userId}|epk#${draft}`), published: { BOOL: false } });
  assert.equal((await call("POST", { action: "create", venueKey: "fest-b", outreachId: outB, epkId: draft })).status, 409);
  assert.equal((await call("POST", { action: "create", venueKey: "fest-b", outreachId: outB, epkId: "fedcba9876" })).status, 409);
  assert.equal((await call("POST", { action: "create", venueKey: "fest-b", outreachId: outB, epkId: "../x" })).status, 400);
  // The list of venue links says which EPK each venue got.
  result = await call("GET");
  assert.deepEqual(result.data.shares.map(item => [item.venueKey, item.epkId]).sort(), [["club-a", dj], ["fest-b", "main"]]);
  // A hold on the DJ set stops its link; the club-set link keeps working.
  table.set(`${userId}|epk#${dj}`, { ...table.get(`${userId}|epk#${dj}`), impersonationHold: { BOOL: true } });
  result = await call("POST", { token: tokenA, openId: "0001-abcdef-0001aa" }, shareA);
  assert.equal(result.status, 404, "a hold on the EPK a link carries stops that link");
  assert.match(result.data.error, /under review/);
  delete table.get(`${userId}|epk#${dj}`).impersonationHold;
  result = await call("POST", { token: tokenA, openId: "0002-abcdef-0002bb" }, shareA);
  assert.equal(result.status, 200);
  assert.equal(result.data.kit.bio, "dj set (published)");

  // Deleting the DJ set stops its venue link and leaves the club-set link.
  const djShare = shareA, oldShare = table.get(`${userId}|EPK#OUTREACH#${outOld}`).shareId.S;
  const deleted = await context.epkWorkspace({ headers: { origin }, queryStringParameters: { epk: dj } }, "DELETE");
  assert.equal(JSON.parse(deleted.body).deleted, true);
  assert.equal(table.get(`epk-outreach-share|${djShare}`), undefined, "the deleted EPK's venue link stops");
  assert.equal(table.get(`${userId}|EPK#OUTREACH#${outA}`), undefined);
  assert.ok(table.get(`epk-outreach-share|${oldShare}`), "the other EPK's venue link keeps working");

  // ---------- The real Tour Manager handlers check the EPK the venue link carries ----------
  const { createTourManagerBilling } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  const tm = new Map(), member = "band9-artist-0001";
  const tmDb = { send: async command => {
    if (command.constructor.name === "GetItemCommand") return { Item: clone(tm.get(keyOf(command.input.Key))) };
    if (command.constructor.name === "QueryCommand") return { Items: [] };
    throw new Error(`no writes expected before the gate: ${command.constructor.name}`);
  } };
  const commands = { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand };
  const record = (tourId, kit, extra = {}) => tm.set(`${member}|${tourId}`, { userId: { S: member }, tourId: { S: tourId }, published: { BOOL: true }, plan: { S: JSON.stringify(kit) }, ...extra });
  record("epk-workspace-v1", readyKit("Club Act", "ready"));
  record(`epk#${dj}`, { artistName: "Club Act" });
  const link = (outreachId, epkId) => tm.set(`${member}|EPK#OUTREACH#${outreachId}`, { userId: { S: member }, tourId: { S: `EPK#OUTREACH#${outreachId}` }, epkId: { S: epkId } });
  const checked = [];
  const billing = createTourManagerBilling({
    db: tmDb, commands, authenticate: async () => member, corsHeaders: o => ({ "access-control-allow-origin": o }), tableName: "Tours",
    sendBookingEmail: async () => ({ messageId: "x" }), sendBookingReply: async () => ({ messageId: "y" }), validateOutreachEpkLink: async () => true, env: {},
    verifyArtist: async ({ epkItem }) => { checked.push(epkItem?.tourId?.S); return epkItem?.impersonationHold?.BOOL ? { ok: false, message: "This EPK is on hold.", status: "needs_review", hold: true } : { ok: true }; }
  });
  const post = (route, body) => billing({ requestContext: { http: { method: "POST" } }, rawPath: route, headers: { origin }, body: JSON.stringify(body) });
  const sendBody = id => ({ venueKey: "v1", to: "booker@club.example", subject: "Booking", message: "Hello, we would love to play your room in March.", idempotencyKey: id, artistApproved: true });
  link("pitchdjsetxxxx0001", dj); link("pitchmainxxxx00002", "main");
  let response = await post("/tour-manager/emails/send", sendBody("pitchdjsetxxxx0001"));
  assert.equal(response.statusCode, 409);
  assert.match(JSON.parse(response.body).error, /Finish your EPK/, "a pitch carrying an unready EPK is refused even though the first EPK is ready");
  response = await post("/tour-manager/emails/send", sendBody("pitchmainxxxx00002"));
  assert.notEqual(JSON.parse(response.body).error || "", "", "the second send gets past the gate to the next check");
  assert.doesNotMatch(JSON.parse(response.body).error, /Finish your EPK/);
  assert.deepEqual(checked.at(-1), "epk-workspace-v1");
  response = await post("/tour-manager/outreach/preflight", { venueKey: "v1", to: "booker@club.example", outreachId: "pitchdjsetxxxx0001" });
  assert.equal(response.statusCode, 409);
  assert.match(JSON.parse(response.body).error, /Finish your EPK/, "preflight checks the EPK the link carries");
  // Replies: a hold on the EPK the thread carries stops replies; a hold on another EPK doesn't.
  record(`epk#${dj}`, readyKit("Club Act", "dj"), { impersonationHold: { BOOL: true } });
  response = await post("/tour-manager/outreach/reply", { outreachId: "pitchdjsetxxxx0001", content: "Thanks!", clientMessageId: "abcdefghijklmnop5678" });
  assert.equal(response.statusCode, 403);
  assert.equal(checked.at(-1), `epk#${dj}`);
  response = await post("/tour-manager/outreach/reply", { outreachId: "pitchmainxxxx00002", content: "Thanks!", clientMessageId: "abcdefghijklmnop5679" });
  assert.notEqual(response.statusCode, 403, "a hold on one EPK never stops another EPK's threads");

  // ---------- Wiring ----------
  assert.match(source, /sendWithEpk: String\(b\.sendWithEpk\)/, "the venue keeps the EPK picked for it");
  const page = fs.readFileSync(path.join(__dirname, "assets/booking-selections.js"), "utf8");
  assert.match(page, /body:JSON\.stringify\(\{ action:"create", venueKey:identity\(venue\), outreachId, allowPdf, epkId \}\)/, "the page sends the chosen EPK");
  assert.match(page, /epkChoices = Array\.isArray\(data\.epks\)/);
  for (const lang of ["it", "fr", "es"]) {
    const words = fs.readFileSync(path.join(__dirname, "assets/i18n-music.js"), "utf8");
    const block = words.slice(words.indexOf(`"${lang}": {`));
    for (const key of ['"Send with"', '"Sent with"']) assert.ok(block.indexOf(key) > 0 && block.indexOf(key) < block.indexOf("\n},"), `${key} in ${lang}`);
  }
  console.log("Booking Send with checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
