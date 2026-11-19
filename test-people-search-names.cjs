"use strict";
// People search and placeholder names (owner 2026-11-17, live test: "I can't see other accounts").
// Runs the real call-signaling search and profile update against stubbed Cognito/DynamoDB: name AND @username,
// case- and accent-insensitive prefix match, placeholders hidden, never an email or phone number.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const lines = template.split(/\r?\n/), start = lines.findIndex(line => line === "        ZipFile: |"), source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }

const me = { email: "me@example.test", userId: "00000000-0000-4000-8000-000000000000" };
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const people = [
  { n: 1, email: "eroticon@example.test", name: "Eroticon", handle: "eroticon" },
  { n: 2, email: "jose@example.test", name: "José Ángel Núñez", handle: "joseangel" },
  { n: 3, email: "eric@example.test", name: "ÉRIC Dubois", handle: "eric.d" },
  { n: 4, email: "placeholder@example.test", name: "DanzStak member", handle: "danzstak-member" },
  { n: 5, email: "nohandle@example.test", name: "Ghost Rider", handle: "" },
  { n: 6, email: "emailname@example.test", name: "someone@mail.example", handle: "someone" },
  { n: 7, email: "phonename@example.test", name: "Call +1 415 555 0199", handle: "caller" },
  { n: 8, email: "requested@example.test", name: "Erotic Noise", handle: "eroticnoise" },
  { n: 9, email: "blocked@example.test", name: "Eros Blocked", handle: "erosblocked" },
  { n: 10, email: "cognito-only@example.test", cognitoName: "Erin Cognito", cognitoHandle: "erinc" }
];
const friends = { "requested@example.test": "outgoing", "blocked@example.test": "blocked" };
const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commands = Object.fromEntries(["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"].map(name => [name, command(name)]));
class DynamoDBClient {
  async send(request) {
    const input = request.input;
    if (request.commandName === "ScanCommand" && input.TableName === "settings") return { Items: people.filter(p => p.name).map(p => ({ userEmail: { S: p.email }, profileName: { S: p.name }, ...(p.handle ? { profileHandle: { S: p.handle } } : {}) })) };
    if (request.commandName === "ScanCommand" && input.TableName === "presence") return { Items: [] };
    if (request.commandName === "QueryCommand" && input.TableName === "friends") return { Items: Object.entries(friends).map(([email, status]) => ({ friendEmail: { S: email }, status: { S: status } })) };
    throw new Error(`Unexpected ${request.commandName} ${input.TableName}`);
  }
}
class CognitoIdentityProviderClient {
  async send() {
    return { Users: [me, ...people].map(p => ({ Attributes: [{ Name: "email", Value: p.email }, { Name: "sub", Value: p.n ? id(p.n) : me.userId }, ...(p.cognitoName ? [{ Name: "name", Value: p.cognitoName }] : []), ...(p.cognitoHandle ? [{ Name: "preferred_username", Value: p.cognitoHandle }] : [])] })) };
  }
}
const fakeRequire = name => {
  if (name === "node:crypto" || name === "node:https") return require(name);
  if (name === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (name === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient, ListUsersCommand: command("ListUsersCommand") };
  if (name === "@aws-sdk/client-kms") return { KMSClient: class {}, GetPublicKeyCommand: command("x"), SignCommand: command("x") };
  if (name === "@aws-sdk/client-s3") return { S3Client: class {}, DeleteObjectCommand: command("x"), HeadObjectCommand: command("x"), GetObjectCommand: command("x"), PutObjectCommand: command("x") };
  if (name === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "" };
  throw new Error(name);
};
const runtime = { env: { SETTINGS_TABLE: "settings", FRIENDS_TABLE: "friends", PRESENCE_TABLE: "presence", USER_POOL_ID: "pool" } };
const shim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={peopleSearch,placeholderProfile,prefixMatch,searchTokens};`)(fakeRequire, shim, shim.exports, runtime, Buffer, URL, console);
const lambda = shim.exports.__test;

(async () => {
  const search = async query => { const response = await lambda.peopleSearch({ queryStringParameters: { query } }, me); return { status: response.statusCode, body: JSON.parse(response.body) }; };
  const names = async query => (await search(query)).body.users?.map(user => user.name) || [];

  // Name AND @username, prefix, case- and accent-insensitive.
  assert.deepEqual(await names("@eroticon"), ["Eroticon"], "@username works");
  assert.deepEqual(await names("eroticon"), ["Eroticon"], "username without @");
  assert.deepEqual((await names("Erot")).sort(), ["Erotic Noise", "Eroticon"], "name prefix");
  assert.deepEqual(await names("EROTICN"), ["Erotic Noise"], "case-insensitive @username prefix (eroticnoise)");
  assert.deepEqual(await names("rotic"), [], "prefix match, not any substring");
  assert.deepEqual(await names("jose"), ["José Ángel Núñez"], "accent-insensitive: jose finds José");
  assert.deepEqual(await names("angel nunez"), ["José Ángel Núñez"], "every word must match a word prefix");
  assert.deepEqual(await names("ÉRIC"), ["ÉRIC Dubois"]);
  assert.deepEqual(await names("@eric.d"), ["ÉRIC Dubois"], "dots in usernames");
  assert.deepEqual(await names("erin"), ["Erin Cognito"], "a named account from sign-up details is findable");

  // Placeholders never appear until named; no email or phone match or reveal.
  assert.deepEqual(await names("danzstak"), [], "DanzStak member placeholders are hidden");
  assert.deepEqual(await names("ghost"), [], "accounts with no @username are hidden");
  assert.deepEqual(await names("someone"), [], "a name that is an email address is hidden");
  assert.deepEqual(await names("caller"), [], "a name that is a phone number is hidden");
  assert.deepEqual(await names("eroticon@example"), [], "an email address never matches");
  assert.deepEqual(await names("example.test"), [], "an email domain never matches");
  assert.deepEqual(await names("4155550199"), [], "a phone number never matches");
  const everything = await search("e");
  assert.equal(everything.status, 400, "one letter is too broad");
  const all = (await search("er")).body.users;
  assert.ok(all.length >= 3);
  for (const user of all) {
    assert.deepEqual(Object.keys(user).sort(), ["friendStatus", "handle", "memberId", "name", "online", "picture"], "results carry no email or phone field");
    assert.ok(!JSON.stringify(user).includes("@example.test"), "no email in results");
  }
  assert.equal(all.find(user => user.handle === "eroticnoise").friendStatus, "outgoing", "Requested state comes from the server");
  assert.ok(!all.some(user => user.handle === "erosblocked"), "blocked members never appear");

  // Saving a placeholder name or username is refused on the server too.
  const update = template.slice(template.indexOf("async function updateProfileUnique"));
  assert.match(update, /foldSearch\(value\)\.trim\(\)==='danzstak member'\|\|looksPrivate\(value\)\)\)return json\(400,\{error:'Enter the name you want people to see\.'\}\)/);
  assert.match(update, /field==='handle'&&\/\^danzstak\[-_\.\]\?member\/i\.test\(value\)\)return json\(400,\{error:'Choose your own username\.'\}\)/);

  // The naming step runs for placeholder names, missing usernames and email-like names, on every app page.
  const onboarding = fs.readFileSync("assets/signup-onboarding.js", "utf8"), sandbox = { window: {}, document: { readyState: "loading", addEventListener() {} } };
  vm.runInNewContext(onboarding, sandbox);
  const { needsName } = sandbox.window.danzstakSignupOnboarding;
  assert.equal(needsName({ isOwner: true, name: "DanzStak member", handle: "danzstak-member" }), true);
  assert.equal(needsName({ isOwner: true, name: "Real Name", handle: "" }), true, "no @username → naming step");
  assert.equal(needsName({ isOwner: true, name: "me@mail.example", handle: "me" }), true, "an email is not a name");
  assert.equal(needsName({ isOwner: true, name: "Eroticon", handle: "eroticon" }), false);
  assert.equal(needsName({ isOwner: false, name: "DanzStak member", handle: "" }), false, "only for your own account");
  assert.doesNotMatch(onboarding, /name\.value = profile|handle\.value = profile/, "nothing fake is prefilled");
  for (const page of ["feed.html", "profile.html", "messages.html", "bazaar.html", "epk.html", "booking.html", "record-stores.html"]) {
    const html = fs.readFileSync(page, "utf8");
    assert.match(html, /assets\/signup-onboarding\.js\?v=5/, `${page} runs the naming step`);
    assert.ok(html.indexOf("assets/i18n-people.js") > 0 && html.indexOf("assets/i18n-people.js") < html.indexOf("assets/i18n.js?v="), `${page} loads people translations before i18n.js`);
  }
  // Search in the top bar on every page: feed.html (Mix, Music HQ, Events) has the header box; the others get the icon.
  assert.match(fs.readFileSync("feed.html", "utf8"), /class="search"/);
  for (const page of ["messages.html", "bazaar.html", "epk.html", "booking.html", "record-stores.html"]) {
    const html = fs.readFileSync(page, "utf8");
    assert.match(html, /assets\/top-search\.js\?v=\d+/, `${page} has top-bar people search`);
    assert.match(html, /assets\/people-search\.js\?v=\d+/, `${page} loads the person rows`);
    assert.match(html, /assets\/top-search\.css\?v=\d+/);
  }
  const worker = fs.readFileSync("service-worker.js", "utf8");
  for (const file of ["top-search.js", "top-search.css", "i18n-people.js"]) assert.ok(worker.includes(`"/assets/${file}"`), `offline shell caches ${file}`);

  // Every new visible string has it/fr/es.
  const dictionary = { window: {} };
  vm.runInNewContext(fs.readFileSync("assets/i18n-people.js", "utf8"), dictionary);
  const strings = new Set();
  for (const file of ["assets/top-search.js", "assets/people-search.js", "assets/signup-onboarding.js"]) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/\bt\("([^"]+)"\)/g)) strings.add(match[1]);
    for (const match of text.matchAll(/\btf\("([^"]+)"/g)) strings.add(match[1]);
  }
  for (const word of ["Friends", "Requested", "Respond", "View profile", "Sending…", "Add friend"]) strings.add(word);
  assert.ok(strings.size >= 25, `checked ${strings.size} strings`);
  for (const lang of ["it", "fr", "es"]) for (const word of strings) {
    const translated = dictionary.window.danzstakTranslations[lang]?.[word];
    assert.ok(translated, `${lang} translation missing: ${word}`);
    if (word.includes("{name}")) assert.ok(translated.includes("{name}"), `${lang} keeps {name}`);
  }
  console.log(`People search checks passed: name and @username, prefix, case and accents, placeholders hidden, no email or phone, naming step on every page, top-bar search, it/fr/es for ${strings.size} strings.`);
})().catch(error => { console.error(error); process.exit(1); });
