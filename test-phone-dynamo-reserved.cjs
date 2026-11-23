"use strict";
// Owner live test 2026-11-17: the first real SYNC device registration failed with
// "Invalid UpdateExpression: Attribute name is a reserved keyword; reserved keyword: ttl".
// Every UpdateExpression / ConditionExpression in the phone-verification adapter must alias DynamoDB reserved words.
const assert = require("node:assert/strict");
const fs = require("node:fs");
// Reserved words that are plausible attribute names here (subset of the DynamoDB reserved list).
const RESERVED = ["member", "members", "ttl", "status", "count", "name", "data", "value", "key", "size", "type", "year", "month", "day", "hour", "date", "timestamp", "user", "comment", "source", "state", "number", "level", "token", "session", "connection", "action", "end", "start", "time", "zone", "region", "role", "language", "group", "level"];
for (const file of ["infrastructure/auth-api/personal-phone-dynamodb.mjs"]) {
  const source = fs.readFileSync(file, "utf8");
  const expressions = [...source.matchAll(/(?:Update|Condition|Projection|KeyCondition|Filter)Expression\s*:\s*"([^"]+)"/g)].map(match => match[1]);
  assert.ok(expressions.length >= 5, `${file}: expressions found`);
  for (const expression of expressions) {
    const words = expression.replace(/[#:][A-Za-z0-9_]+/g, " ").split(/[^A-Za-z_]+/).filter(Boolean);
    for (const word of words) assert.ok(!RESERVED.includes(word.toLowerCase()), `${file}: reserved word "${word}" must use a #alias in: ${expression}`);
  }
}
// One phone, several accounts (owner 2026-11-17): the shared claim constant and the call-signaling share/revoke code too.
// DynamoDB functions (size(), contains()…) are syntax, not attribute names.
const functions = /\b(?:attribute_not_exists|attribute_exists|attribute_type|begins_with|contains|size)\(/g; // size(x) is a function, not an attribute
const check = (where, expression) => {
  const words = expression.replace(functions, "(").replace(/[#:][A-Za-z0-9_]+/g, " ").split(/[^A-Za-z_]+/).filter(Boolean);
  for (const word of words) assert.ok(!RESERVED.includes(word.toLowerCase()), `${where}: reserved word "${word}" must use a #alias in: ${expression}`);
};
const dynamo = fs.readFileSync("infrastructure/auth-api/personal-phone-dynamodb.mjs", "utf8");
check("claimRoom", /const claimRoom = "([^"]+)"/.exec(dynamo)[1]);
const template = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const sharedStart = template.indexOf("// One phone, several accounts (owner 2026-11-17)"), revokeStart = template.indexOf("async function revokeCallingDevice(");
assert.ok(sharedStart > 0 && revokeStart > 0, "shared-device code found");
const shared = template.slice(sharedStart, template.indexOf("async function createDeviceChallenge(", sharedStart)) + template.slice(revokeStart, template.indexOf("\n", revokeStart));
const sharedExpressions = [...shared.matchAll(/(?:Update|Condition)Expression:(?:[^'"?]*\?)?'([^']+)'(?::'([^']+)')?/g)].flatMap(match => [match[1], match[2]].filter(Boolean));
assert.ok(sharedExpressions.length >= 8, `shared-device expressions found: ${sharedExpressions.length}`);
for (const expression of sharedExpressions) check("call-signaling", expression);
console.log("Phone verification DynamoDB expressions alias every reserved word (ttl, status, count, members…).");
