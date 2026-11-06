"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const backend = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const client = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const styles = fs.readFileSync("assets/feed-enhancements.css", "utf8");
const template = fs.readFileSync("infrastructure/engagement/template.yaml", "utf8");
const deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
const i18n = fs.readFileSync("assets/i18n.js", "utf8");

for (const value of [
  'const sessionLifetimeSeconds = 30 * 24 * 60 * 60',
  'const recentAuthenticationSeconds = 10 * 60',
  'deviceLabel: { S: deviceLabel }',
  'FromEmailAddress: "DanzStak Support <support@danzstak.com>"',
  'url.searchParams.set("prompt", "login")',
  'GET" && path === "/auth/sessions"',
  'POST" && path === "/auth/sessions/revoke-others"'
]) assert.ok(backend.includes(value), `account security backend is missing ${value}`);
assert.doesNotMatch(backend.slice(backend.indexOf("function sessionDeviceLabel"), backend.indexOf("function secureCookie")), /ipAddress|fingerprint|rawUserAgent/i);

for (const value of [
  'securityButton.setAttribute("aria-expanded", "false")',
  'securityStatus.setAttribute("aria-live", "polite")',
  'accountSecurityFetch("/auth/sessions")',
  'await window.danzstakConfirm(feedFormat("This ends the DanzStak session on {device}."',
  'accountSecurityFetch("/auth/sessions/revoke-others"',
  'Sessions expire 30 days after sign-in'
]) assert.ok(client.includes(value), `account security UI is missing ${value}`);
assert.match(styles, /\.account-security-device\{display:grid;grid-template-columns:minmax\(0,1fr\) auto/);
assert.match(template, /SessionDevicesTable:[\s\S]+PointInTimeRecoveryEnabled: true[\s\S]+TimeToLiveSpecification: \{AttributeName: expiresAt, Enabled: true\}/);
assert.match(template, /RouteKey: 'DELETE \/auth\/sessions\/\{deviceId\}'/);
assert.match(deploy, /SESSION_DEVICES_TABLE/);

const keysMatch = i18n.match(/const accountSecurityKeys=(\[[^;]+\]);/);
const translationsMatch = i18n.match(/const accountSecurityTranslations=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(accountSecurityTranslations\)\)/);
assert.ok(keysMatch && translationsMatch, "account-security translations must remain inspectable");
const localeContext = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},translations:${translationsMatch[1]}}`, localeContext);
for (const language of ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"]) {
  const values = localeContext.result.translations[language];
  assert.equal(values?.length, localeContext.result.keys.length, `${language} must translate every account-security phrase`);
  assert.ok(values.every(value => String(value).trim()), `${language} account-security translations must not be blank`);
}
assert.match(i18n, /match\(\/\^\(\\d\+\) signed-in devices/, "dynamic signed-in device counts must follow language changes");
assert.match(i18n, /match\(\/\^This device · Last active/, "dynamic account-security timestamps must follow language changes");

const start = backend.indexOf("function accountSecurityOriginAllowed");
const end = backend.indexOf("// LOG OUT", start);
assert.ok(start >= 0 && end > start);

class QueryCommand { constructor(input) { this.input = input; } }
class GetItemCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }

let authenticatedAt = 950;
let queryItems = [];
let foundItem = null;
const deletes = [];
const context = vm.createContext({
  allowedOrigins: new Set(["https://danzstak.com"]),
  corsHeaders: () => ({ "content-type": "application/json" }),
  getAuthenticatedSession: async () => ({
    userId: "owner-1",
    deviceId: "11111111-1111-4111-8111-111111111111",
    deviceLabel: "Chrome on Android",
    createdAt: 800,
    authenticatedAt,
    lastUsedAt: 990,
    expiresAt: 5000
  }),
  sessionDevicesTable: "devices",
  tableName: "sessions",
  recentAuthenticationSeconds: 600,
  sessionLifetimeSeconds: 2592000,
  now: () => 1000,
  QueryCommand,
  GetItemCommand,
  DeleteItemCommand,
  db: { send: async command => {
    if (command instanceof QueryCommand) return { Items: queryItems };
    if (command instanceof GetItemCommand) return { Item: foundItem };
    if (command instanceof DeleteItemCommand) { deletes.push(command.input); return {}; }
    throw new Error("Unexpected command");
  } }
});
vm.runInContext(backend.slice(start, end), context);

const event = { headers: { origin: "https://danzstak.com", "content-type": "application/json" } };
const otherId = "22222222-2222-4222-8222-222222222222";
const item = (deviceId, lastUsedAt, expiresAt = 5000) => ({
  userId: { S: "owner-1" }, deviceId: { S: deviceId }, sessionHash: { S: "a".repeat(64) },
  deviceLabel: { S: deviceId === otherId ? "Safari on iPhone or iPad" : "Chrome on Android" },
  createdAt: { N: "800" }, authenticatedAt: { N: "950" }, lastUsedAt: { N: String(lastUsedAt) }, expiresAt: { N: String(expiresAt) }
});

(async () => {
  queryItems = [item(otherId, 900), item("11111111-1111-4111-8111-111111111111", 990), item("33333333-3333-4333-8333-333333333333", 700, 999)];
  context.event = event;
  const listed = await vm.runInContext("listAccountSessions(event)", context);
  const listBody = JSON.parse(listed.body);
  assert.equal(listed.statusCode, 200);
  assert.equal(listBody.devices.length, 2, "expired devices must not be returned");
  assert.equal(listBody.devices[0].current, true, "current device must sort first");
  assert.equal(listBody.devices[1].label, "Safari on iPhone or iPad");
  assert.ok(!JSON.stringify(listBody).includes("sessionHash"), "session hashes must never reach the browser");

  foundItem = item(otherId, 900);
  context.deviceId = otherId;
  authenticatedAt = 100;
  let revoked = await vm.runInContext("revokeAccountSession(event, deviceId)", context);
  assert.equal(revoked.statusCode, 403);
  assert.equal(JSON.parse(revoked.body).reauthenticationRequired, true);
  assert.equal(deletes.length, 0, "stale authentication must not revoke remote devices");

  authenticatedAt = 950;
  revoked = await vm.runInContext("revokeAccountSession(event, deviceId)", context);
  assert.equal(revoked.statusCode, 200);
  assert.equal(deletes.length, 2);
  assert.equal(deletes[0].TableName, "sessions");
  assert.equal(deletes[0].ExpressionAttributeValues[":userId"].S, "owner-1");
  assert.equal(deletes[1].Key.userId.S, "owner-1");

  deletes.length = 0;
  queryItems = [item(otherId, 900), item("11111111-1111-4111-8111-111111111111", 990)];
  const allOthers = await vm.runInContext("revokeOtherAccountSessions(event)", context);
  assert.equal(JSON.parse(allOthers.body).revoked, 1);
  assert.equal(deletes.length, 2);
  assert.ok(deletes.every(entry => entry.Key?.userId?.S === "owner-1" || entry.ExpressionAttributeValues?.[":userId"]?.S === "owner-1"));

  console.log("Account security session checks passed: private device registry, fixed expiry, recent-auth gate, scoped remote revocation, UI controls, and protected infrastructure.");
})().catch(error => { console.error(error); process.exitCode = 1; });
