"use strict";
// Answer to join (owner 2026-11-18): runs the real call-invite handlers from the call-signaling template
// against an in-memory DynamoDB, plus static checks on the auth return path and the frontend.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const auth = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const answerPage = fs.readFileSync("answer.html", "utf8");
const answerJs = fs.readFileSync("assets/answer.js", "utf8");
const inviteJs = fs.readFileSync("assets/call-invite.js", "utf8");
const onboarding = fs.readFileSync("assets/signup-onboarding.js", "utf8");
const messages = fs.readFileSync("messages.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

// ---- Infrastructure wiring ----
assert.match(template, /CallInvitesTable:[\s\S]*?TableName: DanzStak-CallInvites[\s\S]*?IndexName: ByCaller[\s\S]*?AttributeName: purgeAt/, "invites need their own table, a by-caller index and a TTL");
assert.match(template, /CALL_INVITES_TABLE: !Ref CallInvitesTable/);
assert.match(template, /- !GetAtt CallInvitesTable\.Arn/, "the signaling role must reach the invites table");
for (const route of ["POST /calls/invites", "GET /calls/invites", "DELETE /calls/invites", "GET /calls/invites/preview", "POST /calls/invites/redeem"]) assert.ok(template.includes(`RouteKey: ${route},`), `${route} route`);

// ---- Load the handlers ----
const start = template.indexOf("          // Answer to join (owner 2026-11-18)");
const end = template.indexOf("  ActivityPushStreamMapping:");
assert.ok(start > 0 && end > start, "invite handler block must stay inspectable");
const source = template.slice(start, end).split("\n").map(line => line.slice(10)).join("\n");

const tables = { invites: new Map(), friends: new Map() };
const key = (a, b) => `${a}|${b}`;
let clock = 1_800_000_000;
const pushes = [];
class Cmd { constructor(input) { this.input = input; } }
class GetItemCommand extends Cmd {} class PutItemCommand extends Cmd {} class UpdateItemCommand extends Cmd {} class QueryCommand extends Cmd {}
const conditionFailed = () => Object.assign(new Error("condition"), { name: "ConditionalCheckFailedException" });
const db = { async send(cmd) {
  const { input } = cmd;
  if (input.TableName === "invites") {
    if (cmd instanceof PutItemCommand) { if (tables.invites.has(input.Item.inviteId.S)) throw conditionFailed(); tables.invites.set(input.Item.inviteId.S, structuredClone(input.Item)); return {}; }
    if (cmd instanceof GetItemCommand) return { Item: structuredClone(tables.invites.get(input.Key.inviteId.S)) };
    if (cmd instanceof UpdateItemCommand) {
      const item = tables.invites.get(input.Key.inviteId.S), v = input.ExpressionAttributeValues;
      if (!item || item.status.S !== v[":open"].S || (v[":me"] && item.callerEmail.S !== v[":me"].S)) throw conditionFailed();
      if (v[":cancelled"]) item.status = v[":cancelled"];
      if (v[":redeemed"]) Object.assign(item, { status: v[":redeemed"], redeemedByEmail: v[":e"], redeemedById: v[":id"] });
      return {};
    }
  }
  if (input.TableName === "friends") {
    if (cmd instanceof PutItemCommand) { tables.friends.set(key(input.Item.userEmail.S, input.Item.friendEmail.S), structuredClone(input.Item)); return {}; }
    if (cmd instanceof GetItemCommand) return { Item: structuredClone(tables.friends.get(key(input.Key.userEmail.S, input.Key.friendEmail.S))) };
  }
  throw new Error("unexpected command");
} };
const json = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });
const sessions = { "alice-session": { email: "alice@example.com", userId: "11111111-1111-4111-8111-111111111111" }, "bob-session": { email: "bob@example.com", userId: "22222222-2222-4222-8222-222222222222" }, "mallory-session": { email: "mallory@example.com", userId: "33333333-3333-4333-8333-333333333333" } };
const registeredDevices = new Set(["alice-session"]);
const context = vm.createContext({
  exports: { handler: async () => json(418, { error: "core" }) },
  createHash: crypto.createHash, randomBytes: crypto.randomBytes, Date, JSON, String, Number, Promise, console: { error() {} },
  db, GetItemCommand, PutItemCommand, UpdateItemCommand, QueryCommand, json,
  now: () => clock,
  process: { env: { CALL_INVITES_TABLE: "invites", FRIENDS_TABLE: "friends", PUSH_SUBSCRIPTIONS_TABLE: "push" } },
  queryAll: async input => {
    if (input.TableName === "push") return [{ subscription: { S: "{}" }, endpointHash: { S: "h" } }];
    const since = Number(input.ExpressionAttributeValues[":since"].N), caller = input.ExpressionAttributeValues[":c"].S;
    return [...tables.invites.values()].filter(item => item.callerEmail.S === caller && Number(item.createdAt.N) >= since).map(item => structuredClone(item));
  },
  deliverPush: async (email, subscription, payload) => { pushes.push({ email, payload }); return true; },
  identity: async event => sessions[event.headers?.cookie] || null,
  authenticatedCallingDevice: async event => registeredDevices.has(event.headers?.cookie) ? { kind: { S: "registered" } } : null,
  publicProfile: async email => ({ name: email.startsWith("alice") ? "Alice Punk" : "Bob", picture: "" }),
  relationshipPair: async (a, b) => [{ Item: tables.friends.get(key(a, b)) }, { Item: tables.friends.get(key(b, a)) }],
  blockedStatus: status => status === "blocked" || status === "blocked_by"
});
vm.runInContext(source, context);
const handler = context.exports.handler;
const ORIGIN = "https://danzstak.com";
const call = async (method, rawPath, { session, body, query } = {}) => {
  const response = await handler({ requestContext: { http: { method } }, rawPath, headers: { origin: ORIGIN, ...(session ? { cookie: session } : {}) }, body: body ? JSON.stringify(body) : undefined, queryStringParameters: query });
  return { status: response.statusCode, data: JSON.parse(response.body) };
};

(async () => {
  assert.equal((await call("GET", "/messages")).status, 418, "other paths fall through to the existing handlers");
  assert.equal((await handler({ requestContext: { http: { method: "POST" } }, rawPath: "/calls/invites", headers: { origin: "https://evil.example" } })).statusCode, 403, "foreign origins are refused");

  // Creating needs a signed-in member on a verified device.
  assert.equal((await call("POST", "/calls/invites", { body: { kind: "video" } })).status, 401);
  const unverified = await call("POST", "/calls/invites", { session: "bob-session", body: { kind: "video" } });
  assert.equal(unverified.status, 403); assert.equal(unverified.data.code, "CALL_DEVICE_REGISTRATION_REQUIRED");
  const created = await call("POST", "/calls/invites", { session: "alice-session", body: { kind: "video" } });
  assert.equal(created.status, 201);
  const token = new URL(created.data.url).searchParams.get("i");
  assert.match(created.data.url, /^https:\/\/danzstak\.com\/answer\.html\?i=[A-Za-z0-9_-]{43}$/);
  assert.equal(created.data.kind, "video");
  const stored = [...tables.invites.values()][0];
  assert.ok(!JSON.stringify(stored).includes(token), "the raw token is never stored");
  assert.equal(stored.inviteId.S, crypto.createHash("sha256").update("call-invite:" + token).digest("hex"));
  assert.equal(Number(stored.expiresAt.N) - Number(stored.createdAt.N), 86400, "the ring window is 24 hours");

  // The public preview shows only the caller's name and picture.
  const preview = await call("GET", "/calls/invites/preview", { query: { i: token } });
  assert.equal(preview.status, 200);
  assert.deepEqual(Object.keys(preview.data).sort(), ["caller", "expiresAt", "kind"]);
  assert.deepEqual(Object.keys(preview.data.caller).sort(), ["name", "picture"], "no email, member id or number on the public preview");
  assert.doesNotMatch(JSON.stringify(preview.data), /@|alice@/);
  assert.equal((await call("GET", "/calls/invites/preview", { query: { i: "x".repeat(43) } })).data.code, "CALL_INVITE_GONE");
  assert.equal((await call("GET", "/calls/invites/preview", { query: { i: "../etc" } })).status, 404);

  // The caller can't answer their own invite.
  assert.equal((await call("POST", "/calls/invites/redeem", { session: "alice-session", body: { token } })).data.code, "CALL_INVITE_OWN");

  // A new member redeems it (no device needed yet: calls stay gated separately) and becomes friends with the caller.
  const redeemed = await call("POST", "/calls/invites/redeem", { session: "bob-session", body: { token } });
  assert.equal(redeemed.status, 200);
  assert.equal(redeemed.data.caller.memberId, "11111111-1111-4111-8111-111111111111");
  assert.equal(redeemed.data.live, true);
  assert.equal(tables.friends.get(key("bob@example.com", "alice@example.com")).status.S, "friends");
  assert.equal(tables.friends.get(key("alice@example.com", "bob@example.com")).status.S, "friends");
  assert.equal(pushes.length, 1); assert.equal(pushes[0].email, "alice@example.com");
  assert.match(pushes[0].payload.title, /^Bob joined DanzStak$/);
  assert.doesNotMatch(JSON.stringify(pushes[0].payload), /bob@example/, "push copy never carries an email");

  // Single use: the same member can reopen it (idempotent), nobody else can.
  assert.equal((await call("POST", "/calls/invites/redeem", { session: "bob-session", body: { token } })).status, 200);
  assert.equal(pushes.length, 1, "reopening does not notify the caller again");
  assert.equal((await call("POST", "/calls/invites/redeem", { session: "mallory-session", body: { token } })).data.code, "CALL_INVITE_GONE");
  assert.equal((await call("GET", "/calls/invites/preview", { query: { i: token } })).status, 404, "a used invite stops previewing");

  // The caller's waiting screen sees who joined.
  const list = await call("GET", "/calls/invites", { session: "alice-session" });
  assert.equal(list.data.invites[0].status, "redeemed");
  assert.deepEqual(list.data.invites[0].joined, { memberId: "22222222-2222-4222-8222-222222222222", name: "Bob", picture: "" });

  // Cancel: only the caller, only while open; a cancelled invite can't be redeemed.
  const second = await call("POST", "/calls/invites", { session: "alice-session", body: { kind: "audio" } });
  const secondToken = new URL(second.data.url).searchParams.get("i");
  assert.equal((await call("DELETE", "/calls/invites", { session: "mallory-session", body: { inviteId: second.data.inviteId } })).status, 404);
  assert.equal((await call("DELETE", "/calls/invites", { session: "alice-session", body: { inviteId: second.data.inviteId } })).status, 200);
  assert.equal((await call("POST", "/calls/invites/redeem", { session: "mallory-session", body: { token: secondToken } })).data.code, "CALL_INVITE_CANCELLED");
  assert.equal(tables.friends.has(key("mallory@example.com", "alice@example.com")), false);

  // Expired ring window: still connects them, but reports a missed call. After 7 days it's gone.
  const third = await call("POST", "/calls/invites", { session: "alice-session", body: { kind: "audio" } });
  const thirdToken = new URL(third.data.url).searchParams.get("i");
  clock += 86401;
  assert.equal((await call("GET", "/calls/invites/preview", { query: { i: thirdToken } })).status, 404);
  const late = await call("POST", "/calls/invites/redeem", { session: "mallory-session", body: { token: thirdToken } });
  assert.equal(late.status, 200); assert.equal(late.data.live, false);
  const fourth = await call("POST", "/calls/invites", { session: "alice-session", body: {} });
  assert.equal(fourth.data.kind, "audio", "unknown kinds default to a voice call");
  clock += 604800;
  assert.equal((await call("POST", "/calls/invites/redeem", { session: "bob-session", body: { token: new URL(fourth.data.url).searchParams.get("i") } })).data.code, "CALL_INVITE_GONE");

  // Blocked members can't use an invite.
  const fifth = await call("POST", "/calls/invites", { session: "alice-session", body: {} });
  tables.friends.set(key("alice@example.com", "carol@example.com"), { status: { S: "blocked" } });
  sessions["carol-session"] = { email: "carol@example.com", userId: "44444444-4444-4444-8444-444444444444" };
  assert.equal((await call("POST", "/calls/invites/redeem", { session: "carol-session", body: { token: new URL(fifth.data.url).searchParams.get("i") } })).data.code, "CALL_INVITE_GONE");

  // Limits: 10 open, 20 a day.
  clock += 200000; tables.invites.clear();
  for (let i = 0; i < 10; i++) assert.equal((await call("POST", "/calls/invites", { session: "alice-session", body: {} })).status, 201);
  assert.equal((await call("POST", "/calls/invites", { session: "alice-session", body: {} })).data.code, "CALL_INVITE_OPEN_LIMIT");
  for (const item of tables.invites.values()) item.status = { S: "cancelled" };
  for (let i = 0; i < 10; i++) assert.equal((await call("POST", "/calls/invites", { session: "alice-session", body: {} })).status, 201);
  for (const item of tables.invites.values()) item.status = { S: "cancelled" };
  assert.equal((await call("POST", "/calls/invites", { session: "alice-session", body: {} })).data.code, "CALL_INVITE_DAILY_LIMIT");

  // ---- Auth return path: only the SYNC invite path, never an open redirect ----
  const safeSource = auth.match(/function safeReturnPath\(value\) \{[\s\S]*?\n\}/)[0];
  const safe = vm.runInNewContext(`(${safeSource})`);
  assert.equal(safe(`/messages.html?invite=${token}`), `/messages.html?invite=${token}`);
  for (const bad of ["https://evil.example/", "//evil.example", `/messages.html?invite=${token}&x=1`, "/feed.html", `/messages.html?invite=${token}#`, "/messages.html?invite=short"]) assert.equal(safe(bad), "", `${bad} must be refused`);
  assert.match(auth, /startLogin\("signup", acceptanceId, event\.queryStringParameters\?\.next, requestLanguage\(event\)\)/);
  assert.match(auth, /siteUrl \+ \(returnPath \|\| "\/"\)/);

  // ---- Frontend ----
  assert.match(answerPage, /id="answerBtn"/); assert.match(answerPage, /id="legalAgreement"/, "answering still needs Terms and Privacy agreement");
  assert.match(answerPage, /frame-ancestors 'none'/); assert.match(answerPage, /name="referrer" content="no-referrer"/, "the token must not leak through referrers");
  assert.match(answerJs, /\/auth\/signup\?next=\$\{encodeURIComponent\(returnPath\)\}/);
  assert.doesNotMatch(answerJs + inviteJs, /localStorage|sessionStorage/, "the invite token never goes into browser storage");
  assert.doesNotMatch(inviteJs, /phoneNumber|e164/i);
  assert.match(inviteJs, /danzstak:call-device-registered/, "calls wait for real device verification");
  assert.match(inviteJs, /Later — text only/);
  assert.match(onboarding, /if \(!\/\[\?&\]\(invite\|invited\)=\/\.test\(location\.search\)\) deviceStep\(\);/, "invitees are not asked twice to register");
  assert.match(messages, /assets\/call-invite\.js\?v=4/); assert.match(messages, /assets\/call-invite\.css\?v=1/);
  for (const asset of ["/answer.html", "/assets/answer.js", "/assets/answer.css", "/assets/call-invite.js", "/assets/call-invite.css"]) assert.ok(worker.includes(`"${asset}"`), `${asset} in the offline shell`);
  assert.match(worker, /danzstak-shell-v1102/);

  console.log("Call invite checks passed: hashed one-time tokens, 24h ring window, private preview, friendship on redeem, cancel, blocks, limits, safe return path, no storage.");
})().catch(error => { console.error(error); process.exitCode = 1; });
