const fs = require("fs");
const vm = require("node:vm");
const assert = require("assert");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const editor = fs.readFileSync("assets/profile-editor.js", "utf8");

assert.match(template, /ProfileNamesTable:\s*[\s\S]*?TableName: DanzStak-ProfileNames/);
assert.match(template, /ProfileNamesTable:[\s\S]*?DeletionPolicy: Retain[\s\S]*?PointInTimeRecoveryEnabled: true/);
assert.match(template, /PROFILE_NAMES_TABLE: !Ref ProfileNamesTable/);
assert.match(template, /dynamodb:TransactWriteItems/);
assert.match(template, /TransactWriteItemsCommand/);
assert.match(template, /normalize\('NFKC'\)[\s\S]*?replace\(\/\\s\+\/g,' '\)[\s\S]*?toLocaleLowerCase\('en-US'\)/);
assert.match(template, /for\(const \[field,prefix\] of \[\['handle','handle#'\]\]\)/);
assert.doesNotMatch(template, /\['name','name#'\],\['handle','handle#'\]/, "display names must not be reserved like usernames");
assert.match(template, /attribute_not_exists\(#claim\) OR #owner = :owner/);
assert.match(template, /scanAll\(\{TableName:process\.env\.SETTINGS_TABLE,ProjectionExpression:'userEmail, profileHandle'\}\)/);
assert.match(template, /async function availableProfileSuggestion\(value\)/);
assert.match(template, /for\(let number=2;number<=99;number\+\+\)/);
assert.match(template, /return json\(409,\{error:`That username is already taken\.[\s\S]*?,suggestion\}\)/);
assert.match(template, /async function updateProfile\(event,user\)\{return updateProfileUnique\(event,user\);\}/);
assert.match(editor, /Username \(optional\)/i);
assert.match(editor, /name="handle" minlength="3"/);

const block = template.slice(template.indexOf("          const normalizeProfileClaim"), template.indexOf("          async function sendMessage")).trim();
class GetItemCommand { constructor(input) { this.input = input; } }
class TransactWriteItemsCommand { constructor(input) { this.input = input; } }
class DeleteItemCommand { constructor(input) { this.input = input; } }
class DeleteObjectCommand { constructor(input) { this.input = input; } }
const writes = [];
const lookups = [];
const context = vm.createContext({
  process: { env: { SETTINGS_TABLE: "settings", PROFILE_NAMES_TABLE: "names", MEDIA_BUCKET: "media" } },
  GetItemCommand, TransactWriteItemsCommand, DeleteItemCommand, DeleteObjectCommand,
  json: (statusCode, body) => ({ statusCode, body }),
  ownerPrefix: () => "owner",
  randomUUID: () => "11111111-1111-4111-a111-111111111111",
  scanAll: async () => [{ userEmail: { S: "someone@example.com" }, profileName: { S: "Liana" }, profileHandle: { S: "liana" } }],
  getProfile: async () => ({ statusCode: 200, body: { profile: { name: "Liana", handle: "liana.2" } } }),
  s3: { send: async () => ({}) },
  console,
  db: { send: async command => {
    if (command instanceof GetItemCommand) {
      const claim = command.input.Key?.claim?.S;
      if (!claim) return { Item: {} };
      lookups.push(claim);
      return claim === "handle#liana" ? { Item: { userEmail: { S: "someone@example.com" } } } : {};
    }
    if (command instanceof TransactWriteItemsCommand) { writes.push(command.input); return {}; }
    return {};
  } }
});
vm.runInContext(block, context);

(async () => {
  context.event = { body: JSON.stringify({ name: "Liana", handle: "liana" }) };
  const conflict = await vm.runInContext('updateProfileUnique(event,{email:"owner@example.com"})', context);
  assert.equal(conflict.statusCode, 409, "the generated username remains unique");
  assert.equal(conflict.body.suggestion, "liana.2");
  assert.ok(!lookups.includes("name#liana"), "an existing member named Liana does not block another Liana");

  context.event = { body: JSON.stringify({ name: "Liana", handle: "liana.2" }) };
  const saved = await vm.runInContext('updateProfileUnique(event,{email:"owner@example.com"})', context);
  assert.equal(saved.statusCode, 200, "the suggested handle completes the save without changing the visible name");
  const transaction = writes.at(-1).TransactItems;
  assert.equal(transaction[0].Put.Item.claim.S, "handle#liana.2");
  assert.equal(transaction.some(item => item.Put?.Item?.claim?.S?.startsWith("name#")), false, "display names are never reserved");
  assert.equal(transaction.at(-1).Update.ExpressionAttributeValues[":profileName"].S, "Liana");
  console.log("Profile identity checks passed: display names may repeat while usernames remain atomically unique.");
})().catch(error => { console.error(error); process.exitCode = 1; });
