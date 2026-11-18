"use strict";
// One phone verification across the same person's DanzStak accounts (owner 2026-11-17).
// Runs the real Auth API phone service/adapter and the real call-signaling Lambda against one in-memory DynamoDB
// that evaluates the same condition and update expressions DynamoDB would. Twilio is mocked; no network.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// ---------- A small DynamoDB: keys, conditions, updates, transactions ----------
const schemas = { devices: ["userEmail", "deviceId"], phone: ["recordKey"], push: ["userEmail", "endpointHash"] };
const tables = Object.fromEntries(Object.keys(schemas).map(name => [name, new Map()]));
const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const keyString = (table, source) => schemas[table].map(name => source[name]?.S ?? "").join("|");
function pathParts(expression, names) { return expression.trim().split(".").map(part => part.startsWith("#") ? names[part] : part); }
function getPath(item, parts) { let node = item?.[parts[0]]; for (const part of parts.slice(1)) node = node?.M?.[part]; return node; }
function setPath(item, parts, value) {
  if (parts.length === 1) { item[parts[0]] = value; return; }
  let node = item[parts[0]];
  for (const part of parts.slice(1, -1)) node = node?.M?.[part];
  if (!node?.M) { const error = new Error("The document path provided in the update expression is invalid for update"); error.name = "ValidationException"; throw error; }
  node.M[parts.at(-1)] = value;
}
function removePath(item, parts) { if (parts.length === 1) { delete item[parts[0]]; return; } let node = item[parts[0]]; for (const part of parts.slice(1, -1)) node = node?.M?.[part]; if (node?.M) delete node.M[parts.at(-1)]; }
function scalar(value) { if (!value) return undefined; if ("N" in value) return Number(value.N); if ("S" in value) return value.S; if ("BOOL" in value) return value.BOOL; return JSON.stringify(value); }
function size(value) { if (!value) return undefined; if (value.SS) return value.SS.length; if (value.M) return Object.keys(value.M).length; if (value.L) return value.L.length; if ("S" in value) return value.S.length; return undefined; }
function compare(left, op, right) {
  if (left === undefined) return op === "<>";
  return { "=": left === right, "<>": left !== right, "<": left < right, "<=": left <= right, ">": left > right, ">=": left >= right }[op];
}
function evaluate(item, expression, names = {}, values = {}) {
  if (!expression) return true;
  return expression.split(/\s+OR\s+/).some(any => any.split(/\s+AND\s+/).every(term => {
    term = term.trim();
    let match;
    if ((match = /^attribute_not_exists\((.+)\)$/.exec(term))) return getPath(item, pathParts(match[1], names)) === undefined;
    if ((match = /^attribute_exists\((.+)\)$/.exec(term))) return getPath(item, pathParts(match[1], names)) !== undefined;
    if ((match = /^contains\(([^,]+),\s*(:\w+)\)$/.exec(term))) { const value = getPath(item, pathParts(match[1], names)), needle = values[match[2]].S; return Boolean(value?.SS?.includes(needle) || value?.S?.includes(needle)); }
    if ((match = /^size\((.+)\)\s*(<>|<=|>=|=|<|>)\s*(:\w+)$/.exec(term))) return compare(size(getPath(item, pathParts(match[1], names))), match[2], scalar(values[match[3]]));
    if ((match = /^([#\w.]+)\s*(<>|<=|>=|=|<|>)\s*(:\w+)$/.exec(term))) return compare(scalar(getPath(item, pathParts(match[1], names))), match[2], scalar(values[match[3]]));
    throw new Error(`Unsupported condition term: ${term}`);
  }));
}
function applyUpdate(item, expression, names = {}, values = {}) {
  const clauses = [...expression.matchAll(/\b(SET|ADD|REMOVE|DELETE)\s+(.*?)(?=\s+\b(?:SET|ADD|REMOVE|DELETE)\b|$)/g)];
  for (const [, verb, body] of clauses) for (const part of body.split(/,\s*/)) {
    if (verb === "SET") { const [left, right] = part.split(/\s*=\s*/); setPath(item, pathParts(left, names), clone(values[right.trim()])); }
    else if (verb === "REMOVE") removePath(item, pathParts(part, names));
    else {
      const [left, right] = part.trim().split(/\s+/), parts = pathParts(left, names), current = getPath(item, parts), value = values[right];
      if (verb === "ADD" && value.N !== undefined) setPath(item, parts, { N: String(Number(current?.N || 0) + Number(value.N)) });
      else if (verb === "ADD") setPath(item, parts, { SS: [...new Set([...(current?.SS || []), ...value.SS])] });
      else { const left2 = (current?.SS || []).filter(entry => !value.SS.includes(entry)); if (left2.length) setPath(item, parts, { SS: left2 }); else removePath(item, parts); }
    }
  }
}
const fail = name => { const error = new Error(name); error.name = name; return error; };
function plan(operation) {
  const [kind, input] = Object.entries(operation)[0], table = tables[input.TableName], key = keyString(input.TableName, input.Key || input.Item);
  const current = table.get(key), names = input.ExpressionAttributeNames, values = input.ExpressionAttributeValues;
  const ok = evaluate(current, input.ConditionExpression, names, values);
  return { ok, key, apply() {
    if (kind === "Put") table.set(key, clone(input.Item));
    else if (kind === "Delete") table.delete(key);
    else if (kind === "Update") { const next = clone(current) || clone(input.Key); applyUpdate(next, input.UpdateExpression, names, values); table.set(key, next); }
  }, before: clone(current), table: input.TableName };
}
const log = [];
const db = {
  async send(request) {
    const input = request.input, name = request.commandName;
    if (name === "GetItemCommand") return { Item: clone(tables[input.TableName].get(keyString(input.TableName, input.Key))) };
    if (name === "QueryCommand") {
      const partition = schemas[input.TableName][0], wanted = input.ExpressionAttributeValues[":u"].S;
      return { Items: [...tables[input.TableName].values()].filter(item => item[partition]?.S === wanted).map(clone) };
    }
    if (["PutItemCommand", "DeleteItemCommand", "UpdateItemCommand"].includes(name)) {
      const step = plan({ [name.replace("ItemCommand", "")]: input });
      if (!step.ok) throw fail("ConditionalCheckFailedException");
      step.apply();
      if (input.ReturnValues === "ALL_OLD") return { Attributes: step.before };
      if (input.ReturnValues === "ALL_NEW") return { Attributes: clone(tables[input.TableName].get(step.key)) };
      return {};
    }
    if (name === "TransactWriteItemsCommand") {
      const steps = input.TransactItems.map(plan), seen = new Set();
      for (const step of steps) { const id = `${step.table}/${step.key}`; if (seen.has(id)) throw fail("ValidationException"); seen.add(id); }
      if (steps.some(step => !step.ok)) throw fail("TransactionCanceledException");
      steps.forEach(step => step.apply());
      log.push(input.TransactItems);
      return {};
    }
    throw new Error(`Unexpected command ${name}`);
  }
};
const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
const commands = Object.fromEntries(["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"].map(name => [name, command(name)]));

// ---------- The call-signaling Lambda, as deployed ----------
const template = fs.readFileSync(path.join(__dirname, "infrastructure/call-signaling/template.yaml"), "utf8");
const lines = template.split(/\r?\n/), start = lines.findIndex(line => line === "        ZipFile: |"), source = [];
for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }
class DynamoDBClient { send(request) { return db.send(request); } }
const fakeRequire = id => {
  if (id === "node:crypto" || id === "node:https") return require(id);
  if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient, ...commands };
  if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: class { async send() { return {}; } }, ListUsersCommand: command("ListUsersCommand") };
  if (id === "@aws-sdk/client-kms") return { KMSClient: class {}, GetPublicKeyCommand: command("GetPublicKeyCommand"), SignCommand: command("SignCommand") };
  if (id === "@aws-sdk/client-s3") return { S3Client: class {}, DeleteObjectCommand: command("DeleteObjectCommand"), HeadObjectCommand: command("HeadObjectCommand"), GetObjectCommand: command("GetObjectCommand"), PutObjectCommand: command("PutObjectCommand") };
  if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "" };
  throw new Error(`Unexpected module: ${id}`);
};
const consoleLines = [];
const quietConsole = { ...console, log: (...args) => consoleLines.push(args.join(" ")), error: (...args) => consoleLines.push(args.join(" ")) };
const runtime = { env: { CALLING_DEVICES_TABLE: "devices", PHONE_VERIFICATION_TABLE: "phone", PUSH_SUBSCRIPTIONS_TABLE: "push", DEVICE_SMS_OTP_REQUIRED: "true" } };
const shim = { exports: {} };
new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={createDeviceChallenge,registerCallingDevice,listCallingDevices,revokeCallingDevice,previewSharedDevice,shareCallingDevice,authenticatedCallingDevice};`)(fakeRequire, shim, shim.exports, runtime, Buffer, URL, quietConsole);
const lambda = shim.exports.__test;
const body = response => JSON.parse(response.body);

(async () => {
  const load = file => import(pathToFileURL(path.join(__dirname, "infrastructure/auth-api", file)));
  const { createPersonalPhoneService } = await load("personal-phone-service.mjs"), adapterModule = await load("personal-phone-dynamodb.mjs");
  const adapter = adapterModule.createPersonalPhoneDynamoAdapter({ db, tableName: "phone", commands });
  let twilioStarts = 0;
  const verifier = { start: async () => { twilioStarts++; return { verificationSid: "VE" + crypto.randomBytes(16).toString("hex") }; }, check: async ({ code }) => ({ approved: code === "123456" }), cancel: async () => true };
  const phone = createPersonalPhoneService({ adapter, verifier, secret: "s".repeat(64), enabled: true });

  const account = n => ({ email: `artist${n}@example.test`, userId: crypto.randomUUID() });
  const accounts = Array.from({ length: 12 }, (_, i) => account(i));
  const [A, B] = accounts;
  const headers = credential => ({ "x-danzstak-device-id": credential.deviceId, "x-danzstak-device-token": credential.deviceToken });
  const challengeFor = async user => body(await lambda.createDeviceChallenge(user));
  // A real device registration: device challenge -> Twilio-approved SMS code bound to it -> one-time grant -> device.
  async function registerWithText(user, number = "4155550123") {
    const challenge = await challengeFor(user);
    await phone.send({ userId: user.userId, countryCode: "+1", localNumber: number, purpose: "sync_device", deviceChallengeId: challenge.challengeId, deviceChallenge: challenge.challenge });
    const confirmed = await phone.confirm({ userId: user.userId, code: "123456", purpose: "sync_device", deviceChallengeId: challenge.challengeId, deviceChallenge: challenge.challenge });
    const response = await lambda.registerCallingDevice({ body: JSON.stringify({ challengeId: challenge.challengeId, challenge: challenge.challenge, name: "Van phone", deviceGrantId: confirmed.deviceGrantId, deviceGrantToken: confirmed.deviceGrantToken }) }, user);
    assert.equal(response.statusCode, 201, response.body);
    return body(response);
  }
  const sourceOf = credential => ({ physicalDeviceId: credential.physicalDeviceId, deviceId: credential.deviceId, deviceToken: credential.deviceToken });
  async function share(user, credential, name = "Van phone") {
    const challenge = await challengeFor(user);
    return lambda.shareCallingDevice({ body: JSON.stringify({ source: sourceOf(credential), challengeId: challenge.challengeId, challenge: challenge.challenge, name }) }, user);
  }
  const preview = (user, source) => lambda.previewSharedDevice({ body: JSON.stringify({ source }) }, user);
  const phoneRecord = user => tables.phone.get(`ACCOUNT#${user.userId}`);
  const claimOf = hash => tables.phone.get(`PHONE#${hash}`);

  // ---- Account A registers this phone with a real (mocked-Twilio) text ----
  const a = await registerWithText(A);
  assert.match(a.physicalDeviceId, /^[a-f0-9-]{36}$/, "a registration creates the physical device record");
  assert.match(a.accountTag, /^[a-f0-9]{32}$/, "accounts are identified to the browser by a hash, never an email");
  const aRow = tables.devices.get(`${A.email}|${a.deviceId}`), phoneHash = aRow.verifiedPhoneHash.S;
  assert.equal(phoneHash, phoneRecord(A).phoneHash.S, "the device keeps the verified number's fingerprint");
  assert.deepEqual(claimOf(phoneHash).accounts.SS, [A.userId], "the number is linked to A");
  assert.equal(twilioStarts, 1);

  // ---- Account B signs in on the same device: one question, no new text ----
  let response = await preview(B, sourceOf(a));
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual(body(response), { eligible: true, numberEnding: "23" }, "B sees only the last two digits");
  response = await share(B, a, "Van phone");
  assert.equal(response.statusCode, 201, response.body);
  const b = body(response);
  assert.equal(twilioStarts, 1, "sharing sends no text");
  assert.equal(b.physicalDeviceId, a.physicalDeviceId, "same physical device registration");
  assert.notEqual(b.deviceToken, a.deviceToken, "B gets its own device token");
  assert.ok(await lambda.authenticatedCallingDevice({ headers: headers(b) }, B), "B can now call from this device");
  assert.ok(await lambda.authenticatedCallingDevice({ headers: headers(a) }, A), "A keeps working");
  assert.equal(await lambda.authenticatedCallingDevice({ headers: headers(a) }, B), null, "A's token never works as B");
  assert.equal(phoneRecord(B).status.S, "verified", "the number is linked to B");
  assert.equal(phoneRecord(B).phoneHash.S, phoneHash);
  assert.equal(phoneRecord(B).maskedNumber.S, phoneRecord(A).maskedNumber.S, "B's own record keeps the owner-only masked last four");
  assert.deepEqual([...claimOf(phoneHash).accounts.SS].sort(), [A.userId, B.userId].sort(), "each link is recorded per account");
  assert.ok(!JSON.stringify(tables.phone.get(`ACCOUNT#${B.userId}`)).includes("4155550123"), "numbers stay hashed");
  response = await share(B, a);
  assert.equal(body(response).code, "SHARE_SAME_ACCOUNT", "B can't register the same device twice");
  let list = body(await lambda.listCallingDevices({ headers: headers(b) }, B));
  assert.equal(list.currentDeviceRegistered, true);
  assert.equal(list.currentPhysicalDeviceId, a.physicalDeviceId);
  assert.equal(list.devices[0].sharedAccounts, 1, "the device list knows another account uses this device");
  assert.ok(!JSON.stringify(list).includes(A.email) && !JSON.stringify(list).includes(A.userId), "B never sees A's email or id");

  // ---- Only the same physical device registration counts ----
  const C = accounts[2];
  const otherDevice = { physicalDeviceId: crypto.randomUUID(), deviceId: crypto.randomUUID(), deviceToken: crypto.randomBytes(32).toString("base64url") };
  assert.equal(body(await preview(C, otherDevice)).code, "SHARE_SOURCE_INVALID", "a registration from another device is refused");
  assert.equal(body(await preview(C, { ...sourceOf(a), deviceToken: crypto.randomBytes(32).toString("base64url") })).code, "SHARE_SOURCE_INVALID", "the right ids with a wrong token are refused");
  assert.equal(body(await preview(C, { physicalDeviceId: a.physicalDeviceId })).code, "SHARE_SOURCE_INVALID", "a client-only flag is refused");
  assert.equal(body(await preview(C, {})).code, "SHARE_SOURCE_INVALID", "no proof, no registration");
  const forged = await challengeFor(C);
  response = await lambda.shareCallingDevice({ body: JSON.stringify({ source: { physicalDeviceId: a.physicalDeviceId, deviceId: a.deviceId, deviceToken: "x".repeat(43) }, challengeId: forged.challengeId, challenge: forged.challenge, name: "Fake" }) }, C);
  assert.equal(response.statusCode, 403, "a forged device token never registers");
  // An account-level claim is not enough: D verifies the same number on a different device, which still needs its own text.
  const D = accounts[3], d = await registerWithText(D);
  assert.notEqual(d.physicalDeviceId, a.physicalDeviceId, "a different device gets its own registration");
  assert.equal(twilioStarts, 2, "and its own text");
  assert.equal(phoneRecord(D).phoneHash.S, phoneHash);
  // A number verified on another account but a different number on this one: no silent change.
  const Z = account("z");
  await registerWithText(Z, "4155550999");
  assert.equal(body(await preview(Z, sourceOf(a))).code, "SHARE_DIFFERENT_NUMBER", "an account with another number verifies with its own text");

  // ---- At most 10 accounts per number ----
  // Linked so far: A, B, D. Seven more shares (accounts 4..10) fill the number to 10; the device then holds 9.
  for (const user of accounts.slice(4, 11)) { response = await share(user, a); assert.equal(response.statusCode, 201, response.body); }
  assert.equal(claimOf(phoneHash).accounts.SS.length, 10, "the number holds 10 accounts");
  response = await share(C, a);
  assert.equal(body(response).code, "NUMBER_ACCOUNT_LIMIT", "an 11th account on the number is refused, even on the same device");
  assert.equal(phoneRecord(C), undefined, "and nothing was linked");
  const startsBefore = twilioStarts, extra = account("x"), challenge = await challengeFor(extra);
  await assert.rejects(phone.send({ userId: extra.userId, countryCode: "+1", localNumber: "4155550123", purpose: "sync_device", deviceChallengeId: challenge.challengeId, deviceChallenge: challenge.challenge }), error => error.code === "number_limit" && error.statusCode === 409, "an 11th account can't link the number by text");
  assert.equal(twilioStarts, startsBefore, "and no text is sent");
  // Removing the number from one account frees a place; the others keep it.
  await phone.remove(D.userId);
  assert.equal(claimOf(phoneHash).accounts.SS.length, 9);
  assert.ok(claimOf(phoneHash).accounts.SS.includes(A.userId), "the other accounts keep the number");
  assert.equal(phoneRecord(A).status.S, "verified");

  // ---- At most 10 accounts per device ----
  assert.equal((await share(C, a)).statusCode, 201, "the 10th account on a device is accepted");
  const members = Object.keys(tables.devices.get(`PHYSICAL#${a.physicalDeviceId}|META`).members.M);
  assert.equal(members.length, 10);
  assert.ok(members.every(key => /^m[a-f0-9]{31}$/.test(key)), "device records key accounts by hash");
  response = await share(accounts[11], a);
  assert.equal(body(response).code, "DEVICE_ACCOUNT_LIMIT", "the 11th account on a device is refused");
  assert.equal(phoneRecord(accounts[11]), undefined, "and nothing was linked");
  assert.equal(body(await preview(extra, sourceOf(a))).code, "DEVICE_ACCOUNT_LIMIT");

  // ---- Remove from this account vs. from all my accounts on this device ----
  response = await lambda.revokeCallingDevice({ queryStringParameters: { deviceId: a.deviceId } }, A);
  assert.equal(body(response).scope, "this");
  assert.equal(await lambda.authenticatedCallingDevice({ headers: headers(a) }, A), null, "A's registration on this device is removed");
  assert.ok(await lambda.authenticatedCallingDevice({ headers: headers(b) }, B), "B's stays");
  assert.equal(Object.keys(tables.devices.get(`PHYSICAL#${a.physicalDeviceId}|META`).members.M).length, 9);
  assert.equal(body(await preview(accounts[11], sourceOf(a))).code, "SHARE_SOURCE_INVALID", "a removed registration can't be shared");
  response = await lambda.revokeCallingDevice({ queryStringParameters: { deviceId: b.deviceId, scope: "all" } }, B);
  assert.equal(response.statusCode, 200, response.body);
  assert.deepEqual([body(response).scope, body(response).revokedAccounts, body(response).physicalDeviceId], ["all", 9, a.physicalDeviceId], "every account on this device is removed");
  assert.equal(tables.devices.get(`PHYSICAL#${a.physicalDeviceId}|META`), undefined);
  assert.equal(await lambda.authenticatedCallingDevice({ headers: headers(b) }, B), null);
  const stillActive = [...tables.devices.values()].filter(row => row.kind?.S === "registered" && !row.revokedAt && row.physicalDeviceId?.S === a.physicalDeviceId);
  assert.equal(stillActive.length, 0, "no registration on that device survives revoke-all");
  assert.ok(await lambda.authenticatedCallingDevice({ headers: headers(d) }, D), "a different device is untouched");
  // Revoke-all only works for an account registered on that device.
  response = await lambda.revokeCallingDevice({ queryStringParameters: { deviceId: d.deviceId, scope: "all" } }, A);
  assert.equal(response.statusCode, 404, "an account can't remove another account's device");
  assert.ok(await lambda.authenticatedCallingDevice({ headers: headers(d) }, D));

  // ---- Registrations made before this change are upgraded the next time their account opens SYNC ----
  const P = account("p"), legacyToken = crypto.randomBytes(32).toString("base64url"), legacyId = crypto.randomUUID();
  tables.phone.set(`ACCOUNT#${P.userId}`, { recordKey: { S: `ACCOUNT#${P.userId}` }, userId: { S: P.userId }, phoneHash: { S: phoneHash }, maskedNumber: { S: "•••• 0123" }, status: { S: "verified" } });
  tables.devices.set(`${P.email}|${legacyId}`, { userEmail: { S: P.email }, deviceId: { S: legacyId }, kind: { S: "registered" }, name: { S: "Old phone" }, tokenHash: { S: crypto.createHash("sha256").update(legacyToken).digest("hex") }, allowCalls: { BOOL: true }, registeredAt: { S: "2026-11-10T00:00:00.000Z" }, lastUsedAt: { S: "2026-11-10T00:00:00.000Z" }, otpVerifiedAt: { S: "2026-11-10T00:00:00.000Z" }, verifiedPhoneMask: { S: "•••• 0123" } });
  list = body(await lambda.listCallingDevices({ headers: { "x-danzstak-device-id": legacyId, "x-danzstak-device-token": legacyToken } }, P));
  assert.match(list.currentPhysicalDeviceId, /^[a-f0-9-]{36}$/, "the old registration gets a physical device record");
  assert.equal(tables.devices.get(`${P.email}|${legacyId}`).verifiedPhoneHash.S, phoneHash, "and its number fingerprint");
  // Old single-owner number claims convert without losing their owner.
  const oldHash = "f".repeat(64), Q = account("q");
  tables.phone.set(`PHONE#${oldHash}`, { recordKey: { S: `PHONE#${oldHash}` }, recordType: { S: "phone_claim" }, userId: { S: "legacy-owner" }, challengeId: { S: "c" }, status: { S: "verified" } });
  await db.send(new commands.TransactWriteItemsCommand({ TransactItems: [adapterModule.linkClaimOperation("phone", oldHash, Q.userId, tables.phone.get(`PHONE#${oldHash}`))] }));
  assert.deepEqual([...claimOf(oldHash).accounts.SS].sort(), ["legacy-owner", Q.userId].sort());
  assert.equal(claimOf(oldHash).userId, undefined);

  // ---- Logs carry hashed ids only ----
  const logged = consoleLines.join("\n");
  assert.ok(consoleLines.some(line => line.includes("sync_device_shared")) && consoleLines.some(line => line.includes("sync_device_revoked_all")), "sharing and revoke-all are logged");
  for (const user of [...accounts, P, Q, Z]) assert.ok(!logged.includes(user.email) && !logged.includes(user.userId), "no email or account id in logs");
  assert.ok(!logged.includes(a.physicalDeviceId) && !logged.includes("4155550123"), "no raw device id or number in logs");

  // ---- Wiring: routes, IAM, browser storage, translations ----
  for (const route of ["POST /calls/devices/share/preview", "POST /calls/devices/share"]) assert.ok(template.includes(`RouteKey: ${route},`) && template.includes(`key==='${route}'`), `${route} is routed`);
  assert.match(template, /Action: \[dynamodb:GetItem, dynamodb:DeleteItem, dynamodb:PutItem, dynamodb:UpdateItem, dynamodb:ConditionCheckItem\]\n?\r?\s*Resource: !Sub arn:\$\{AWS::Partition\}:dynamodb:\$\{AWS::Region\}:\$\{AWS::AccountId\}:table\/\$\{PhoneVerificationTable\}/, "the Lambda may link the number to the new account");
  const client = fs.readFileSync(path.join(__dirname, "assets/call-devices.js"), "utf8");
  assert.match(client, /ACCOUNTS_KEY="accounts",MAX_ACCOUNTS=10/, "one stored credential per account on this device");
  assert.doesNotMatch(client, /maskedNumber|localNumber|numberEnding:data\.numberEnding\b[^)]*localStorage/, "no number in browser storage");
  assert.match(client, /This phone is already registered \(number ending \{NN\}\)\. Use it for this account too\?/);
  assert.match(client, /markAsked\(\)/, "the offer is shown once per account");
  assert.match(client, /Remove from this account/);
  assert.match(client, /Remove from all my accounts on this device/);
  assert.match(client, /scope==="all"\?"&scope=all":""/);
  const sandbox = { window: {} };
  require("node:vm").runInNewContext(fs.readFileSync(path.join(__dirname, "assets/i18n-sync.js"), "utf8"), sandbox);
  const words = ["Use this phone for this account?", "This phone is already registered (number ending {NN}). Use it for this account too?", "Yes, use it", "No", "Remove from this account", "Remove from all my accounts on this device", "Also on {count} of your other accounts", "This number is already linked to 10 DanzStak accounts.", "This device is already registered for 10 DanzStak accounts.", "No new text is needed. Another phone or computer still needs its own code."];
  for (const lang of ["it", "fr", "es"]) for (const word of words) {
    const translated = sandbox.window.danzstakTranslations[lang]?.[word];
    assert.ok(translated && translated !== word || word === "No", `${lang}: ${word}`);
    if (word.includes("{NN}")) assert.ok(translated.includes("{NN}"), `${lang} keeps {NN}`);
    if (word.includes("{count}")) assert.ok(translated.includes("{count}"), `${lang} keeps {count}`);
  }
  console.log("Shared phone checks passed: same-device share without a text, second device and forged proof refused, 10 per device and per number, remove from one or all accounts, legacy upgrade, hashed logs, it/fr/es.");
})().catch(error => { console.error(error); process.exit(1); });
