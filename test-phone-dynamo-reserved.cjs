"use strict";
// Owner live test 2026-11-17: the first real SYNC device registration failed with
// "Invalid UpdateExpression: Attribute name is a reserved keyword; reserved keyword: ttl".
// Every UpdateExpression / ConditionExpression in the phone-verification adapter must alias DynamoDB reserved words.
const assert = require("node:assert/strict");
const fs = require("node:fs");
// Reserved words that are plausible attribute names here (subset of the DynamoDB reserved list).
const RESERVED = ["ttl", "status", "count", "name", "data", "value", "key", "size", "type", "year", "month", "day", "hour", "date", "timestamp", "user", "comment", "source", "state", "number", "level", "token", "session", "connection", "action", "end", "start", "time", "zone", "region", "role", "language", "group", "level"];
for (const file of ["infrastructure/auth-api/personal-phone-dynamodb.mjs"]) {
  const source = fs.readFileSync(file, "utf8");
  const expressions = [...source.matchAll(/(?:Update|Condition|Projection|KeyCondition|Filter)Expression\s*:\s*"([^"]+)"/g)].map(match => match[1]);
  assert.ok(expressions.length >= 5, `${file}: expressions found`);
  for (const expression of expressions) {
    const words = expression.replace(/[#:][A-Za-z0-9_]+/g, " ").split(/[^A-Za-z_]+/).filter(Boolean);
    for (const word of words) assert.ok(!RESERVED.includes(word.toLowerCase()), `${file}: reserved word "${word}" must use a #alias in: ${expression}`);
  }
}
console.log("Phone verification DynamoDB expressions alias every reserved word (ttl, status, count…).");
