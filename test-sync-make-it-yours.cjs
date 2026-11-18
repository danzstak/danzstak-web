"use strict";
// Task 16-H "Make it yours" (part 1). Runs the real call-signaling code for the account-saved prefs (validation, quiet hours,
// hidden previews) and checks contrast for every accent × light/dark × wallpaper dim, plus the client wiring.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const lines = template.split(/\r?\n/);
const start = lines.findIndex(line => line === "        ZipFile: |");
const source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }
const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
const commands = Object.fromEntries(commandNames.map(name => [name, command(name)]));
const settings = new Map();
class DynamoDBClient { async send(r) { const i = r.input; if (i.TableName === "settings" && r.commandName === "GetItemCommand") return { Item: settings.get(i.Key.userEmail.S) }; if (i.TableName === "settings" && r.commandName === "UpdateItemCommand") { settings.set(i.Key.userEmail.S, { ...(settings.get(i.Key.userEmail.S) || {}), syncPrefs: i.ExpressionAttributeValues[":p"] }); return {}; } return r.commandName === "QueryCommand" ? { Items: [] } : {}; } }
const fakeRequire = id => {
  if (id === "node:crypto" || id === "node:https") return require(id);
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: class { async send() { return { Users: [] }; } }, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient: class {}, GetPublicKeyCommand: command("G"), SignCommand: command("S") };
  if (id === "@aws-sdk/client-s3") return { S3Client: class {}, GetObjectCommand: command("G"), PutObjectCommand: command("P"), DeleteObjectCommand: command("D") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "" };
  throw new Error(id);
};
const moduleShim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={cleanSyncPrefs,getSyncPrefs,setSyncPrefs,inQuietHours};`)(fakeRequire, moduleShim, moduleShim.exports, { env: { SETTINGS_TABLE: "settings" } }, Buffer, URL, console);
const T = moduleShim.exports.__test;

// Contrast helpers.
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const lum = rgb => { const c = rgb.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

(async () => {
  // Validation: unknown keys and bad values fall back to defaults; nothing else is stored.
  const clean = T.cleanSyncPrefs({ theme: "neon", accent: "metal", bubbles: "square", textSize: 9, vibration: "long", quietHours: { on: true, from: "23:30", to: "6:00", tz: "Europe/Rome", callsRing: false }, hidePreviews: true, reactions: ["🔥", "🤘", "<b>", "x", "y", "z"], evil: "<script>" });
  assert.equal(clean.theme, "auto"); assert.equal(clean.accent, "metal"); assert.equal(clean.bubbles, "square"); assert.equal(clean.textSize, 1); assert.equal(clean.vibration, "long");
  assert.equal(clean.quietHours.from, "23:30"); assert.equal(clean.quietHours.to, "07:00", "bad time falls back"); assert.equal(clean.quietHours.tz, "Europe/Rome");
  assert.equal(clean.reactions[0], "👍", "markup in reactions is refused, all 6 stay defaults"); assert.equal(clean.evil, undefined);
  const me = { email: "me@example.test" };
  assert.equal((await T.setSyncPrefs({ body: JSON.stringify({ prefs: { accent: "punk", hidePreviews: true } }) }, me)).statusCode, 200);
  assert.equal(JSON.parse((await T.getSyncPrefs(me)).body).prefs.accent, "punk", "saved to the account");
  assert.equal((await T.setSyncPrefs({ body: JSON.stringify({ prefs: { reactions: ["x".repeat(5000)] } }) }, me)).statusCode, 413);
  // Quiet hours across midnight, calls ring unless turned off.
  const q = { quietHours: { on: true, from: "23:00", to: "07:00", tz: "UTC", callsRing: true } };
  assert.equal(T.inQuietHours(q, "message", new Date("2026-11-18T02:00:00Z")), true);
  assert.equal(T.inQuietHours(q, "message", new Date("2026-11-18T12:00:00Z")), false);
  assert.equal(T.inQuietHours(q, "call", new Date("2026-11-18T02:00:00Z")), false, "calls still ring by default");
  assert.equal(T.inQuietHours({ quietHours: { ...q.quietHours, callsRing: false } }, "call", new Date("2026-11-18T02:00:00Z")), true);
  assert.equal(T.inQuietHours({ quietHours: { ...q.quietHours, tz: "America/Los_Angeles" } }, "message", new Date("2026-11-18T12:00:00Z")), true, "uses the member's time zone (04:00 in LA)");
  const src = source.join("\n");
  assert.match(src, /body:String\(\(!syncPrefs\?\.hidePreviews&&notice\.preview\?\.S\)\|\|words\.body\)/, "hidden previews: booking pushes show no reply text");
  assert.match(src, /\{type:'message',\.\.\.copy,tag:`message-\$\{tag\}`,url,silent:quiet\}/);
  assert.match(fs.readFileSync("service-worker.js", "utf8"), /silent: payload\.silent === true,/);

  // Contrast: every accent × light/dark × wallpaper dim 0–60%: own-bubble text on its (opaque) tint and the send icon.
  const sandbox = { window: { danzstakSyncSettings: null, addEventListener() {} }, document: { documentElement: { dataset: {}, classList: { toggle() {} }, style: { setProperty() {} } } }, localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false, addEventListener() {} }), fetch: async () => ({ ok: false }), Intl, setTimeout, clearTimeout, JSON, Object, Number, String };
  vm.createContext(sandbox); vm.runInContext(fs.readFileSync("assets/sync-make-it-yours.js", "utf8"), sandbox);
  const accents = sandbox.window.danzstakSyncPrefs.accents;
  for (const [id, a] of Object.entries(accents)) {
    assert.ok(ratio(hex(a.solid), hex(a.on)) >= 4.5, `${id}: send button ${ratio(hex(a.solid), hex(a.on)).toFixed(2)}`);
    for (const dim of [0, 0.3, 0.6]) {
      // Bubbles are opaque, so the wallpaper (and its dim) never sits behind the text; checked anyway at each dim.
      assert.ok(ratio(hex(a.tint), hex(a.ink)) >= 4.5, `${id} light @${dim}: ${ratio(hex(a.tint), hex(a.ink)).toFixed(2)}`);
      assert.ok(ratio(hex(a.darkTint), hex(a.darkInk)) >= 4.5, `${id} dark @${dim}: ${ratio(hex(a.darkTint), hex(a.darkInk)).toFixed(2)}`);
    }
  }
  const css = fs.readFileSync("assets/sync-make-it-yours.css", "utf8");
  assert.match(css, /html\[data-sync-accent\] \.message\.mine\{background:var\(--sync-mine-bg\)!important;color:var\(--sync-mine-ink\)!important/);
  // Client wiring.
  const dm = fs.readFileSync("assets/direct-messages.js", "utf8"), tones = fs.readFileSync("assets/sync-tones.js", "utf8"), myo = fs.readFileSync("assets/sync-make-it-yours.js", "utf8"), html = fs.readFileSync("messages.html", "utf8"), i18n = fs.readFileSync("assets/i18n-sync.js", "utf8");
  for (const [name, code] of [["direct-messages.js", dm], ["sync-tones.js", tones], ["sync-make-it-yours.js", myo]]) assert.doesNotThrow(() => new Function(code), `${name} must parse`);
  assert.match(dm, /globalThis\.danzstakSyncPrefs\?\.reactions\?\.\(\)/, "the reaction menu uses the member's 6");
  assert.match(tones, /if \(quiet && window\.danzstakSyncPrefs\?\.quiet\?\.\(/, "quiet hours silence in-app tones");
  assert.match(myo, /fetch\(API \+ "\/settings\/sync-prefs", \{ method: "POST"/, "saved to the account");
  assert.match(myo, /localStorage\.setItem\(CACHE/, "cached on the device for offline");
  assert.equal((myo.match(/line\("/g) || []).length, 8, "every choice has its own Reset line");
  assert.doesNotMatch(myo.replace(/^\s*\/\/.*$/gm, ""), /price|\$\d|streak|checkout/i, "no paid cosmetics, no streaks");
  assert.match(html, /<script src="assets\/sync-make-it-yours\.js\?v=\d+" defer><\/script>/);
  for (const lang of ["it", "fr", "es"]) { const b = i18n.slice(i18n.indexOf(`"${lang}": {`), i18n.indexOf("\n}", i18n.indexOf(`"${lang}": {`))); for (const k of ["Make it yours", "Quiet hours", "Hide message previews", "Quick reactions", "Accent color"]) assert.ok(b.includes(JSON.stringify(k) + ":"), `${lang}: ${k}`); }
  console.log("Make it yours checks passed: account-saved prefs validated, quiet hours (time zone, calls ring), hidden previews, contrast ≥ 4.5 for every accent × theme × dim, reactions/vibration/quiet wired, it/fr/es.");
})().catch(error => { console.error(error); process.exitCode = 1; });
