"use strict";
// Task 20 (owner 2026-11-17): verify the artist before an EPK goes public or pitches.
// Runs the real artist-verification module (and the real Tour Manager send/reply handlers) against an in-memory
// DynamoDB that evaluates the condition and update expressions the module uses. Pages, DNS and clock are faked.
const assert = require("node:assert/strict");
const fs = require("node:fs");

// ---------- A small DynamoDB for the expressions used here ----------
const table = new Map();
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const keyOf = source => `${source.userId.S}|${source.tourId.S}`;
const scalar = value => value === undefined ? undefined : "N" in value ? Number(value.N) : "S" in value ? value.S : "BOOL" in value ? value.BOOL : JSON.stringify(value);
const fail = (name, extra = {}) => Object.assign(new Error(name), { name }, extra);
function splitTop(text, separator) {
  const parts = []; let depth = 0, start = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1; else if (text[i] === ")") depth -= 1;
    else if (depth === 0 && text.startsWith(separator, i)) { parts.push(text.slice(start, i)); start = i + separator.length; i += separator.length - 1; }
  }
  parts.push(text.slice(start));
  return parts.map(part => part.trim()).filter(Boolean);
}
const unwrap = text => { text = text.trim(); while (text.startsWith("(") && text.endsWith(")") && splitTop(text.slice(1, -1), "\u0000").length === 1 && balanced(text.slice(1, -1))) text = text.slice(1, -1).trim(); return text; };
function balanced(text) { let depth = 0; for (const char of text) { if (char === "(") depth += 1; if (char === ")") depth -= 1; if (depth < 0) return false; } return depth === 0; }
const attrName = (token, names) => token.startsWith("#") ? names[token] : token;
function evaluate(item, expression, names = {}, values = {}) {
  if (!expression) return true;
  const text = unwrap(expression);
  const ors = splitTop(text, " OR ");
  if (ors.length > 1) return ors.some(part => evaluate(item, part, names, values));
  const ands = splitTop(text, " AND ");
  if (ands.length > 1) return ands.every(part => evaluate(item, part, names, values));
  let match;
  if ((match = /^attribute_not_exists\(([#\w]+)\)$/.exec(text))) return item?.[attrName(match[1], names)] === undefined;
  if ((match = /^attribute_exists\(([#\w]+)\)$/.exec(text))) return item?.[attrName(match[1], names)] !== undefined;
  if ((match = /^([#\w]+)\s*(<>|<=|>=|=|<|>)\s*(:\w+)$/.exec(text))) {
    const left = scalar(item?.[attrName(match[1], names)]), right = scalar(values[match[3]]);
    if (left === undefined) return match[2] === "<>";
    return { "=": left === right, "<>": left !== right, "<": left < right, "<=": left <= right, ">": left > right, ">=": left >= right }[match[2]];
  }
  throw new Error(`Unsupported condition: ${text}`);
}
function valueOf(item, expression, names, values) {
  expression = expression.trim();
  const plus = splitTop(expression, " + ");
  if (plus.length === 2) return { N: String(Number(valueOf(item, plus[0], names, values).N || 0) + Number(valueOf(item, plus[1], names, values).N || 0)) };
  const ifNot = /^if_not_exists\(([#\w]+),\s*(:\w+)\)$/.exec(expression);
  if (ifNot) return clone(item[attrName(ifNot[1], names)] ?? values[ifNot[2]]);
  if (expression.startsWith(":")) return clone(values[expression]);
  return clone(item[attrName(expression, names)]);
}
function applyUpdate(item, expression, names = {}, values = {}) {
  for (const [, verb, body] of expression.matchAll(/\b(SET|ADD|REMOVE)\s+(.*?)(?=\s+\b(?:SET|ADD|REMOVE)\b|$)/g)) {
    for (const part of splitTop(body, ",")) {
      if (verb === "SET") { const [left, ...right] = part.split("="); item[attrName(left.trim(), names)] = valueOf(item, right.join("="), names, values); }
      else if (verb === "REMOVE") delete item[attrName(part, names)];
      else { const [left, right] = part.split(/\s+/), name = attrName(left, names); item[name] = { N: String(Number(item[name]?.N || 0) + Number(values[right].N)) }; }
    }
  }
}
function plan(operation) {
  const [kind, input] = Object.entries(operation)[0], key = keyOf(input.Key || input.Item), current = table.get(key);
  const ok = evaluate(current, input.ConditionExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues);
  return { ok, apply() {
    if (kind === "Put") table.set(key, clone(input.Item));
    else if (kind === "Delete") table.delete(key);
    else if (kind === "Update") { const next = clone(current) || clone(input.Key); applyUpdate(next, input.UpdateExpression, input.ExpressionAttributeNames, input.ExpressionAttributeValues); table.set(key, next); }
  } };
}
const writes = [];
const db = {
  async send(command) {
    const input = command.input, name = command.commandName;
    if (name === "GetItemCommand") return { Item: clone(table.get(keyOf(input.Key))) };
    if (name === "QueryCommand") {
      const partition = Object.values(input.ExpressionAttributeValues)[0].S, items = [...table.values()].filter(item => item.userId.S === partition).map(clone);
      return input.Select === "COUNT" ? { Count: items.length } : { Items: items };
    }
    writes.push(name);
    if (name === "TransactWriteItemsCommand") {
      const steps = input.TransactItems.map(plan);
      if (steps.some(step => !step.ok)) throw fail("TransactionCanceledException", { CancellationReasons: steps.map(step => ({ Code: step.ok ? "None" : "ConditionalCheckFailed" })) });
      steps.forEach(step => step.apply());
      return {};
    }
    const step = plan({ [name.replace("ItemCommand", "")]: input });
    if (!step.ok) throw fail("ConditionalCheckFailedException");
    step.apply();
    return {};
  }
};
const command = commandName => class { constructor(input) { this.input = input; this.commandName = commandName; } };
const commands = Object.fromEntries(["GetItemCommand", "PutItemCommand", "QueryCommand", "TransactWriteItemsCommand", "UpdateItemCommand", "DeleteItemCommand"].map(name => [name, command(name)]));

(async () => {
  const v = await import("./infrastructure/auth-api/artist-verification.mjs");

  // ---------- Names: same act despite case/spacing/"the"/"official"; famous and look-alike names ----------
  assert.equal(v.actKey("The Ramblers"), v.actKey("ramblers  OFFICIAL"));
  assert.notEqual(v.actKey("The Ramblers"), v.actKey("The Ramblerz"), "a different name is a different act (name change re-opens verification)");
  assert.match(v.actKey("!!!"), /^x[a-f0-9]{20}$/, "punctuation-only names still get a stable key");
  for (const name of ["Katy Perry", "katy perry OFFICIAL", "The Real Katy Perry", "K4ty Perry", "Katy Perrry", "Kаty Perry" /* Cyrillic a */, "Katy Perry VEVO"]) assert.equal(v.protectedNameMatch(name), "Katy Perry", `${name} is a protected name`);
  for (const name of ["Metallica", "0ff1cial Metallica", "Blink-182", "Bl1nk 182", "Beyoncé", "Charlotte de Witte"]) assert.ok(v.protectedNameMatch(name), `${name} is protected`);
  for (const name of ["The Ramblers", "Ghost Town", "Road Test", "Katie Perrine"]) assert.equal(v.protectedNameMatch(name), "", `${name} is not protected`);
  assert.equal(v.protectedNameMatch("Local Legends", [v.lookalikeKey("Local Legends")]), "Local Legends", "reported names become protected");

  // ---------- Codes and page matching ----------
  const code = v.newVerificationCode();
  assert.match(code, /^DZ-[2-9A-HJKMNP-Z]{6}$/);
  assert.deepEqual(v.pageHasCode(`<head><meta name="danzstak-verify" content="${code}"></head>`, code), { found: true, method: "meta" });
  assert.deepEqual(v.pageHasCode(`<p class="bio">Booking: ${code.toLowerCase()}</p>`, code), { found: true, method: "page" });
  assert.deepEqual(v.pageHasCode(`{"description":"DZ\\u002d${code.slice(3)} punk from Tacoma"}`, code), { found: true, method: "page" }, "JSON-escaped YouTube descriptions count");
  assert.equal(v.pageHasCode(`X${code}9`, code).found, false, "the code must stand alone");
  assert.equal(v.pageHasCode("<p>DZ-AAAAAA</p>", code).found, false, "another code never counts");
  assert.equal(v.pageNamesAct("<title>The Ramblers | Bandcamp</title>", "Ramblers"), true);
  assert.equal(v.pageNamesAct("<title>Someone else</title>", "Ramblers"), false);
  assert.equal(v.txtHasCode([["danzstak-verify=", code]], code), true);
  assert.equal(v.txtHasCode([["danzstak-verify=DZ-AAAAAA"]], code), false);
  assert.equal(v.validDomain("https://TheBand.com/about"), "theband.com");
  assert.equal(v.validDomain("10.0.0.1"), "");

  // ---------- Flows ----------
  let nowMs = Date.parse("2026-11-18T18:00:00.000Z");
  const pages = new Map(), txt = new Map(), fetched = [];
  const fetcher = async url => { fetched.push(url); const html = pages.get(url); return html === undefined ? { status: 404, ok: false, headers: new Map() } : { status: 200, ok: true, headers: new Map([["content-type", "text/html"]]), text: async () => html }; };
  const resolver = async host => [{ address: host.endsWith(".internal-test") ? "10.0.0.7" : "93.184.216.34" }];
  const emails = { band1: "band1@example.com", band2: "band2@example.com", fan1: "fan1@example.com", fan2: "fan2@example.com", editor1: "editor@danzstak.com" };
  const av = v.createArtistVerification({
    db, commands, tableName: "Tours", authenticate: async event => event.user || "", accountEmail: async user => emails[user] || "",
    corsHeaders: origin => ({ "access-control-allow-origin": origin }), originAllowed: origin => origin === "https://danzstak.com",
    isEditor: email => email === "editor@danzstak.com", epkWorkspaceKey: "epk-workspace-v1", epkPublicPartition: "epk-public",
    fetcher, resolver, txtResolver: async domain => txt.get(domain) || [], clock: () => nowMs
  });
  const call = async (user, method, path, body = {}, query = {}) => {
    const response = await av.handle({ user, headers: { origin: "https://danzstak.com" }, queryStringParameters: query, body: JSON.stringify(body) }, method, path);
    return { status: response.statusCode, data: JSON.parse(response.body) };
  };
  const epk = (user, name, published = false) => table.set(`${user}|epk-workspace-v1`, { userId: { S: user }, tourId: { S: "epk-workspace-v1" }, plan: { S: JSON.stringify({ artistName: name }) }, publicId: { S: v.actKey(name) }, published: { BOOL: published } });
  const publicEpk = (user, name) => table.set(`epk-public|${v.actKey(name)}`, { userId: { S: "epk-public" }, tourId: { S: v.actKey(name) }, ownerId: { S: user }, plan: { S: JSON.stringify({ artistName: name }) } });

  assert.equal(await av.handle({ headers: {} }, "GET", "/epk/other"), null, "other routes pass through");
  assert.equal((await av.handle({ headers: { origin: "https://evil.example" }, user: "band1" }, "GET", "/epk/verify")).statusCode, 403);
  assert.equal((await av.handle({ headers: { origin: "https://danzstak.com" } }, "GET", "/epk/verify")).statusCode, 401);

  // Not verified: publish and pitch are blocked server-side.
  epk("band1", "The Ramblers");
  let gate = await av.gate({ userId: "band1", artistName: "The Ramblers", epkItem: table.get("band1|epk-workspace-v1") });
  assert.deepEqual([gate.ok, gate.status, gate.message], [false, "not_verified", v.VERIFY_MESSAGE]);
  assert.equal((await call("band1", "GET", "/epk/verify")).data.verification.status, "not_verified");

  // Code issued for 24 hours; asking again returns the same code.
  const issued = (await call("band1", "POST", "/epk/verify/code", { actName: "The Ramblers" })).data.verification;
  assert.match(issued.code, /^DZ-/);
  assert.equal(Date.parse(issued.codeExpiresAt) - nowMs, 24 * 3600 * 1000);
  assert.equal((await call("band1", "POST", "/epk/verify/code", { actName: "the ramblers" })).data.verification.code, issued.code, "same act, same code");

  // Not found -> stays unverified; name missing -> stays unverified; unsafe URL -> refused without fetching.
  pages.set("https://ramblers.bandcamp.com/", "<title>The Ramblers</title><p>bio without the code</p>");
  let result = await call("band1", "POST", "/epk/verify/check", { actName: "The Ramblers", method: "page", url: "https://ramblers.bandcamp.com/" });
  assert.equal(result.data.verification.status, "not_verified"); assert.match(result.data.message, /could not find your code/);
  nowMs += 6000;
  pages.set("https://soundcloud.com/somebody", `<title>Somebody</title><p>${issued.code}</p>`);
  result = await call("band1", "POST", "/epk/verify/check", { actName: "The Ramblers", method: "page", url: "https://soundcloud.com/somebody" });
  assert.equal(result.data.verification.status, "not_verified"); assert.match(result.data.message, /does not name your act/);
  nowMs += 6000;
  const fetchesBefore = fetched.length;
  result = await call("band1", "POST", "/epk/verify/check", { actName: "The Ramblers", method: "page", url: "https://admin.internal-test/" });
  assert.match(result.data.message, /public https link/); assert.equal(fetched.length, fetchesBefore, "private addresses are never fetched");
  result = await call("band1", "POST", "/epk/verify/check", { actName: "The Ramblers", method: "page", url: "https://ramblers.bandcamp.com/" });
  assert.equal(result.status, 429, "checks are spaced a few seconds apart");

  // A code from another member never counts.
  epk("band2", "The Ramblers");
  const other = (await call("band2", "POST", "/epk/verify/code", { actName: "The Ramblers" })).data.verification;
  assert.notEqual(other.code, issued.code);
  nowMs += 6000;
  pages.set("https://ramblers.bandcamp.com/", `<title>The Ramblers</title><p>Verify: ${issued.code}</p>`);
  result = await call("band2", "POST", "/epk/verify/check", { actName: "The Ramblers", method: "page", url: "https://ramblers.bandcamp.com/" });
  assert.equal(result.data.verification.status, "not_verified", "band1's code on the page does not verify band2");

  // Found -> verified for a year; the stored record keeps only the match result, never the page.
  result = await call("band1", "POST", "/epk/verify/check", { actName: "The Ramblers", method: "page", url: "https://ramblers.bandcamp.com/" });
  assert.equal(result.data.verification.status, "verified"); assert.equal(result.data.verification.method, "page");
  const record = table.get(`band1|ARTIST_VERIFICATION#${v.actKey("The Ramblers")}`);
  assert.ok(!JSON.stringify(record).includes("<title>"), "page contents are never stored");
  assert.equal(record.checkedUrl.S, "https://ramblers.bandcamp.com/");
  gate = await av.gate({ userId: "band1", artistName: "THE RAMBLERS official", epkItem: table.get("band1|epk-workspace-v1") });
  assert.deepEqual([gate.ok, gate.method], [true, "page"]);
  assert.equal((await av.gate({ userId: "band1", artistName: "The Ramblerz", epkItem: null })).ok, false, "renaming the act re-opens verification");
  nowMs += 366 * 86400000;
  assert.equal((await av.gate({ userId: "band1", artistName: "The Ramblers", epkItem: null })).ok, false, "verification is re-checked yearly");
  nowMs = Date.parse("2026-11-19T18:00:00.000Z");

  // Expired codes (24 h) are rejected.
  epk("band3", "Night Shift");
  const old = (await call("band3", "POST", "/epk/verify/code", { actName: "Night Shift" })).data.verification;
  nowMs += 25 * 3600 * 1000;
  pages.set("https://nightshift.example/", `<title>Night Shift</title><meta name="danzstak-verify" content="${old.code}">`);
  result = await call("band3", "POST", "/epk/verify/check", { actName: "Night Shift", method: "page", url: "https://nightshift.example/" });
  assert.equal(result.status, 409); assert.match(result.data.error, /expired/);
  // A fresh code on the act's own website (meta tag) or DNS works.
  const fresh = (await call("band3", "POST", "/epk/verify/code", { actName: "Night Shift" })).data.verification;
  txt.set("nightshift.example", [["danzstak-verify=", fresh.code]]);
  result = await call("band3", "POST", "/epk/verify/check", { actName: "Night Shift", method: "dns", domain: "https://NightShift.example/" });
  assert.deepEqual([result.data.verification.status, result.data.verification.method], ["verified", "dns"]);

  // Protected name -> needs review even with a valid code; an editor approves.
  epk("band4", "Katy Perry");
  const famous = (await call("band4", "POST", "/epk/verify/code", { actName: "Katy Perry" })).data.verification;
  assert.equal(famous.protectedName, true);
  pages.set("https://fake-katy.example/", `<title>Katy Perry</title><p>${famous.code}</p>`);
  nowMs += 6000;
  result = await call("band4", "POST", "/epk/verify/check", { actName: "Katy Perry", method: "page", url: "https://fake-katy.example/" });
  assert.equal(result.data.verification.status, "needs_review");
  gate = await av.gate({ userId: "band4", artistName: "Katy Perry", epkItem: table.get("band4|epk-workspace-v1") });
  assert.deepEqual([gate.ok, gate.message], [false, v.REVIEW_MESSAGE], "a protected name cannot publish until an editor approves");
  assert.equal((await call("band1", "GET", "/epk/verify/reviews")).status, 403, "only editors see the queue");
  const queue = (await call("editor1", "GET", "/epk/verify/reviews")).data.reviews;
  const katy = queue.find(item => item.actName === "Katy Perry");
  assert.ok(katy?.autoCheckPassed);
  assert.equal((await call("editor1", "POST", "/epk/verify/reviews", { id: katy.id, decision: "approve" })).status, 200);
  gate = await av.gate({ userId: "band4", artistName: "Katy Perry", epkItem: null });
  assert.deepEqual([gate.ok, gate.method], [true, "page"]);
  assert.equal(table.get(`band4|ARTIST_VERIFICATION#${v.actKey("Katy Perry")}`).reviewerId.S, "editor1", "manual approvals keep the editor id");

  // Manual review fallback, rejected with a note; never ID documents (only an https link).
  epk("band5", "Basement Tapes");
  assert.equal((await call("band5", "POST", "/epk/verify/review", { actName: "Basement Tapes", evidenceUrl: "data:image/png;base64,AAAA" })).status, 400);
  assert.equal((await call("band5", "POST", "/epk/verify/review", { actName: "Basement Tapes", evidenceUrl: "https://club.example/shows/basement-tapes", note: "Booked by Sam" })).data.verification.status, "needs_review");
  const manual = (await call("editor1", "GET", "/epk/verify/reviews")).data.reviews.find(item => item.actName === "Basement Tapes");
  await call("editor1", "POST", "/epk/verify/reviews", { id: manual.id, decision: "reject", note: "Gig listing names another band." });
  const rejected = (await call("band5", "GET", "/epk/verify")).data.verification;
  assert.deepEqual([rejected.status, rejected.note], ["not_verified", "Gig listing names another band."]);

  // Reports: one member's report does not unpublish; a second does (pending review), pitches and replies stop.
  epk("band1", "The Ramblers", true); publicEpk("band1", "The Ramblers");
  const publicId = v.actKey("The Ramblers");
  assert.equal((await call("band1", "POST", "/epk/verify/report", { publicId })).status, 400, "no self-reports");
  assert.equal((await call("fan1", "POST", "/epk/verify/report", { publicId })).status, 200);
  assert.equal((await call("fan1", "POST", "/epk/verify/report", { publicId })).data.duplicate, true, "one report per member");
  assert.ok(table.has(`epk-public|${publicId}`), "one report keeps the EPK up");
  await call("fan2", "POST", "/epk/verify/report", { publicId, reason: "This is my band" });
  assert.equal(table.has(`epk-public|${publicId}`), false, "two reports unpublish the EPK");
  const held = table.get("band1|epk-workspace-v1");
  assert.deepEqual([held.published.BOOL, held.impersonationHold.BOOL], [false, true]);
  gate = await av.gate({ userId: "band1", artistName: "The Ramblers", epkItem: held });
  assert.deepEqual([gate.ok, gate.hold, gate.message], [false, true, v.HOLD_MESSAGE], "publishing and pitches stop during the hold");
  assert.equal((await av.gate({ userId: "band1", artistName: "The Ramblers", epkItem: held, purpose: "reply" })).ok, false, "replies in the act's name stop too");
  assert.ok(table.has(`ARTIST_VERIFICATION#PROTECTED_NAMES|${v.lookalikeKey("The Ramblers")}`), "reported names join the protected list");
  const reported = (await call("editor1", "GET", "/epk/verify/reviews")).data.reviews.find(item => item.actName === "The Ramblers");
  assert.deepEqual([reported.reason, reported.publicId], ["reported", publicId]);
  await call("editor1", "POST", "/epk/verify/reviews", { id: reported.id, decision: "approve" });
  assert.equal(table.get("band1|epk-workspace-v1").impersonationHold, undefined, "an editor approval lifts the hold");
  assert.equal([...table.keys()].filter(key => key.startsWith(`ARTIST_VERIFICATION#REPORTS#${publicId}|`)).length, 0, "and clears the old reports");
  assert.equal((await av.gate({ userId: "band1", artistName: "The Ramblers", epkItem: table.get("band1|epk-workspace-v1") })).ok, true);

  // One editor flag is enough.
  epk("band3", "Night Shift", true); publicEpk("band3", "Night Shift");
  await call("editor1", "POST", "/epk/verify/report", { publicId: v.actKey("Night Shift") });
  assert.equal(table.get("band3|epk-workspace-v1").impersonationHold.BOOL, true, "one editor flag unpublishes");

  // Inventing act names cannot turn DanzStak into a page fetcher: codes are capped per member per day across acts.
  const codeStatuses = [];
  for (let i = 0; i < v.MAX_MEMBER_CODES_PER_DAY + 1; i += 1) codeStatuses.push((await call("spammer1", "POST", "/epk/verify/code", { actName: `Made Up Act ${i}` })).status);
  assert.deepEqual([codeStatuses.slice(0, -1).every(status => status === 200), codeStatuses.at(-1)], [true, 429]);

  // ---------- The real Tour Manager send/reply handlers refuse unverified acts before reserving anything ----------
  const { createTourManagerBilling } = await import("./infrastructure/auth-api/tour-manager-billing.mjs");
  const ready = { userId: { S: "band9-artist-0001" }, tourId: { S: "epk-workspace-v1" }, published: { BOOL: true }, plan: { S: JSON.stringify({ artistName: "Unverified Act", heroImage: "https://example.com/a.jpg", shortBio: "Loud.", musicLinks: [{ url: "https://example.com/m" }], videoLinks: [{ url: "https://example.com/v" }], bookingEmail: "b@example.com" }) } };
  table.set("band9-artist-0001|epk-workspace-v1", ready);
  let sent = 0;
  const billing = createTourManagerBilling({
    db, commands, authenticate: async () => "band9-artist-0001", corsHeaders: origin => ({ "access-control-allow-origin": origin }), tableName: "Tours",
    sendBookingEmail: async () => { sent += 1; return { messageId: "x" }; }, sendBookingReply: async () => { sent += 1; return { messageId: "y" }; },
    validateOutreachEpkLink: async () => true, env: {},
    verifyArtist: ({ userId, epkItem, purpose }) => av.gate({ userId, artistName: JSON.parse(epkItem?.plan?.S || "{}").artistName, epkItem, purpose })
  });
  const writesBefore = writes.length;
  const send = await billing({ requestContext: { http: { method: "POST" } }, rawPath: "/tour-manager/emails/send", headers: { origin: "https://danzstak.com" }, body: JSON.stringify({ venueKey: "v1", to: "booker@club.example", subject: "Booking", message: "Hello, we would love to play your room in March.", idempotencyKey: "abcdefghijklmnop1234", artistApproved: true }) });
  assert.equal(send.statusCode, 403); assert.match(JSON.parse(send.body).error, /Verify your act/);
  assert.equal(sent, 0); assert.equal(writes.length, writesBefore, "nothing is reserved or sent");
  table.set("band9-artist-0001|epk-workspace-v1", { ...ready, impersonationHold: { BOOL: true } });
  const reply = await billing({ requestContext: { http: { method: "POST" } }, rawPath: "/tour-manager/outreach/reply", headers: { origin: "https://danzstak.com" }, body: JSON.stringify({ outreachId: "abcdefghijklmnop1234", content: "Thanks!", clientMessageId: "abcdefghijklmnop5678" }) });
  assert.equal(reply.statusCode, 403); assert.equal(sent, 0, "no replies in the act's name during a hold");

  // ---------- Wiring: the gates sit in front of every public or outbound path ----------
  const index = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), billingSource = fs.readFileSync("infrastructure/auth-api/tour-manager-billing.mjs", "utf8");
  const workspace = index.slice(index.indexOf("async function epkWorkspace"), index.indexOf("async function publicEpk"));
  assert.ok(workspace.indexOf("artistVerificationService().gate({ userId, artistName: kit.artistName") > 0 && workspace.indexOf("artistVerificationService().gate") < workspace.indexOf("UpdateExpression: ownerUpdate"), "publish is gated before anything is written");
  assert.match(workspace, /verifiedAt: \{ S: verified\.verifiedAt \}/, "the public EPK carries the verified mark");
  const outreach = index.slice(index.indexOf("async function outreachEpkShare"), index.indexOf("function reviewTargetsFromPublishedEpk"));
  // Spec 46: a venue link carries the published EPK, so the act checked is the one on that published copy; the hold
  // still comes from the EPK record.
  assert.ok(outreach.includes("artistVerificationService().gate({ userId, artistName: kitArtistName(publishedCopy), epkItem: epkResult.Item })"), "venue EPK links need a verified act");
  assert.ok(outreach.includes("impersonationHold?.BOOL === true) return reply(404"), "venue links stop during a hold");
  assert.match(index, /path\.startsWith\("\/epk\/verify"\)/);
  assert.match(index, /Verified artist on DanzStak\./, "pitch emails carry the mark");
  const sendSource = billingSource.slice(billingSource.indexOf("async function sendEmail"), billingSource.indexOf("async function refundPurchases"));
  assert.ok(sendSource.indexOf("verifyArtist") < sendSource.indexOf("TransactWriteItemsCommand"), "the send gate runs before credits are reserved");
  const deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
  for (const route of ["GET /epk/verify", "POST /epk/verify/code", "POST /epk/verify/check", "POST /epk/verify/review", "POST /epk/verify/report", "GET /epk/verify/reviews", "POST /epk/verify/reviews"]) assert.ok(deploy.includes(`"${route}"`), `${route} is deployed`);
  const html = fs.readFileSync("epk.html", "utf8"), sw = fs.readFileSync("service-worker.js", "utf8"), ui = fs.readFileSync("assets/epk-verify.js", "utf8");
  assert.match(html, /assets\/epk-verify\.js\?v=\d+/); assert.match(html, /assets\/epk-verify\.css\?v=\d+/);
  assert.ok(sw.includes('"/assets/epk-verify.js"') && sw.includes('"/assets/epk-verify.css"'), "offline shell has the verify assets");
  assert.doesNotMatch(ui, /type:\s*"file"|getUserMedia|capture:/i, "no ID document or selfie upload"); assert.match(ui, /never ask for ID or selfies/);
  assert.match(ui, /not a legal guarantee of identity/, "honest copy");
  assert.match(ui, /Report impersonation/);
  console.log("artist verification: ok");
})().catch(error => { console.error(error); process.exitCode = 1; });
