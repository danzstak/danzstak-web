"use strict";
// Owner 2026-11-25, an Italian tester's lock screen showed "Incoming DanzStak call · Accept / Decline" and "SFScoop sent you
// a message." in English: "Italian has to be Italian the whole thing", "These people really don't understand English not
// a word". Call-signaling writes those notifications in the account's saved language, but the language was only saved
// when a member pressed Save in Settings, so everyone else got English. /push/subscribe now carries the language the app
// is showing, and the server keeps it. This runs the real call-signaling code against an in-memory DynamoDB.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const lines = template.split(/\r?\n/);
const start = lines.findIndex(line => line === "        ZipFile: |");
assert.ok(start >= 0, "call-signaling Lambda source must exist");
const source = [];
for (const line of lines.slice(start + 1)) {
  if (!line.startsWith("          ")) break;
  source.push(line.slice(10));
}

// --- In-memory DynamoDB (just the calls these two functions make) ---
const tables = { push: new Map(), devices: new Map(), settings: new Map() };
const keyOf = (table, key) => table === "push" ? `${key.userEmail.S}|${key.endpointHash.S}` : table === "settings" ? key.userEmail.S : `${key.userEmail.S}|${key.deviceId.S}`;
const clone = value => JSON.parse(JSON.stringify(value));
const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commandNames = ["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"];
const commands = Object.fromEntries(commandNames.map(name => [name, command(name)]));
const puts = [];
class DynamoDBClient {
  async send(request) {
    const { commandName } = request, input = request.input, table = tables[input.TableName];
    if (!table) throw new Error(`Unexpected table ${input.TableName}`);
    if (commandName === "GetItemCommand") { const item = table.get(keyOf(input.TableName, input.Key)); return item ? { Item: clone(item) } : {}; }
    if (commandName === "PutItemCommand") { puts.push(input.TableName); table.set(keyOf(input.TableName, input.Item), clone(input.Item)); return {}; }
    if (commandName === "DeleteItemCommand") { table.delete(keyOf(input.TableName, input.Key)); return {}; }
    if (commandName === "QueryCommand") {
      assert.equal(input.KeyConditionExpression, "userEmail = :u");
      const user = input.ExpressionAttributeValues[":u"].S;
      return { Items: [...table.values()].filter(item => item.userEmail.S === user).map(clone) };
    }
    if (commandName === "UpdateItemCommand") {
      const id = keyOf(input.TableName, input.Key), item = table.get(id) || clone(input.Key);
      const set = input.UpdateExpression.match(/^SET (.+)$/);
      assert.ok(set, `only SET updates are expected: ${input.UpdateExpression}`);
      for (const part of set[1].split(",")) {
        const [raw, value] = part.split("=").map(text => text.trim()), name = input.ExpressionAttributeNames?.[raw] || raw;
        item[name] = clone(input.ExpressionAttributeValues[value]);
      }
      table.set(id, item);
      return input.ReturnValues === "ALL_NEW" ? { Attributes: clone(item) } : {};
    }
    throw new Error(`Unexpected DynamoDB command: ${commandName}`);
  }
}
class Unused { async send() { throw new Error("not used by push subscribe"); } }
const fakeRequire = id => {
  if (id === "node:crypto" || id === "node:https") return require(id);
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: Unused, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient: Unused, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client: Unused, GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand"), DeleteObjectCommand: command("DeleteObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "https://example.test/signed" };
  throw new Error(`Unexpected module: ${id}`);
};
const runtime = { env: { CALLING_DEVICES_TABLE: "devices", PUSH_SUBSCRIPTIONS_TABLE: "push", SETTINGS_TABLE: "settings", DEVICE_SMS_OTP_REQUIRED: "true" } };
const moduleShim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={savePushSubscription,pushPreferences,localizedPush};`)(fakeRequire, moduleShim, moduleShim.exports, runtime, Buffer, URL, console);
const { savePushSubscription, pushPreferences, localizedPush } = moduleShim.exports.__test;

const me = { email: "phone@danzstak.test", userId: "11111111-1111-4111-8111-111111111111" };
const b64url = bytes => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const subscription = (endpoint, extra = {}) => ({ endpoint, keys: { p256dh: b64url(Buffer.concat([Buffer.from([4]), crypto.randomBytes(64)])), auth: b64url(crypto.randomBytes(16)) }, ...extra });
const save = async body => (await savePushSubscription({ headers: {}, body: JSON.stringify(body) }, me)).statusCode;
const phone = "https://fcm.googleapis.com/fcm/send/phone-endpoint";

(async () => {
  // Before: nothing saved, so pushes are English (what the tester saw).
  assert.equal((await pushPreferences(me.email)).language, "en");
  assert.equal(await save(subscription(phone)), 201);
  assert.equal(tables.settings.get(me.email), undefined, "an old app that sends no language changes nothing");

  for (const [language, title, accept, message] of [["it", "Chiamata DanzStak in arrivo", "Accetta", "SFScoop ti ha inviato un messaggio."], ["fr", "Appel DanzStak entrant", "Accepter", "SFScoop vous a envoyé un message."], ["es", "Llamada entrante de DanzStak", "Aceptar", "SFScoop te envió un mensaje."]]) {
    assert.equal(await save(subscription(phone, { language })), 201);
    const preferences = await pushPreferences(me.email);
    assert.equal(preferences.language, language, `the ${language} app's language is kept for this account`);
    const call = localizedPush(preferences.language, "call", "SFScoop", "video"), text = localizedPush(preferences.language, "message", "SFScoop");
    assert.equal(call.title, title, `${language}: the call notification's title`);
    assert.ok(JSON.stringify(call).includes(accept), `${language}: the Accept button is ${accept}`);
    assert.ok(!/Incoming|Accept"|Decline|calling by/.test(JSON.stringify(call)), `${language}: no English on the call notification`);
    assert.equal(text.body, message, `${language}: the message notification`);
  }
  // Nonsense never overwrites it.
  assert.equal(await save(subscription(phone, { language: "xx" })), 201);
  assert.equal((await pushPreferences(me.email)).language, "es");

  const client = fs.readFileSync("assets/push-notifications.js", "utf8");
  assert.equal((client.match(/keys: serialized\.keys, language: pushLanguage\(\)/g) || []).length, 2, "both saves send the app's language");
  assert.match(client, /attributeFilter: \["lang"\]/, "a change of language saves again");
  console.log("Push language checks passed: the app's language (it, fr, es) is kept on /push/subscribe, call and message notifications come out in it with no English, and an old app or a nonsense code changes nothing.");
})().catch(error => { console.error(error); process.exitCode = 1; });
