"use strict";
// L1 (owner 2026-11-19): every "Text me a code" failed because personal-phone-dynamodb.mjs runs a ConditionCheck inside
// TransactWriteItems on DANZSTAK-PhoneVerifications, and the Auth API role had no dynamodb:ConditionCheckItem there
// (tour-manager-billing.mjs had the same gap on DANZSTAK-Tours). A transaction must never ship without its IAM:
// this finds every ConditionCheck table in infrastructure/auth-api/*.mjs and fails unless aws-deploy-auth-api.ps1
// grants dynamodb:ConditionCheckItem on it.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const apiDir = path.join(root, "infrastructure", "auth-api");
const read = file => fs.readFileSync(file, "utf8");
const index = read(path.join(apiDir, "index.mjs"));

// Table constants in index.mjs: const fooTable = process.env.X || "NAME"; or const fooTable = "NAME";
const constants = new Map();
for (const [, name, value] of index.matchAll(/^const (\w+) = (?:process\.env\.\w+ \|\| )?"([\w.-]+)";/gm)) constants.set(name, value);

// Modules that get their table as a `tableName` option: which factory in index.mjs passes it, and with what.
const factories = { "personal-phone-dynamodb.mjs": "createPersonalPhoneDynamoAdapter", "tour-manager-billing.mjs": "createTourManagerBilling" };
function tableFromFactory(file) {
  const factory = factories[file];
  assert.ok(factory, `${file} runs a ConditionCheck on a "tableName" option: add the factory that passes it to this test.`);
  const call = index.slice(index.indexOf(`${factory}({`));
  const match = call.slice(0, call.indexOf("});")).match(/tableName: (\w+)/);
  assert.ok(match, `${factory}(...) in index.mjs must pass tableName.`);
  return resolve(match[1], "index.mjs");
}
function resolve(identifier, file) {
  if (identifier === "tableName" && file !== "index.mjs") return tableFromFactory(file);
  assert.ok(constants.has(identifier), `${file}: ConditionCheck table "${identifier}" is not a table constant in index.mjs; teach this test where it comes from.`);
  return constants.get(identifier);
}

const needed = new Map();
for (const file of fs.readdirSync(apiDir).filter(name => name.endsWith(".mjs"))) {
  const source = read(path.join(apiDir, file));
  for (const [, table] of source.matchAll(/ConditionCheck\s*:\s*\{\s*TableName\s*:\s*([\w.]+|"[\w.-]+")/g)) {
    const name = table.startsWith('"') ? table.slice(1, -1) : resolve(table, file);
    needed.set(name, [...(needed.get(name) || []), file]);
  }
}
assert.ok(needed.has("DANZSTAK-PhoneVerifications") && needed.has("DANZSTAK-Tours"), "The scan must find the phone-verification and Tours ConditionChecks (did the pattern stop matching?).");

// Tables the deploy script grants dynamodb:ConditionCheckItem on.
const script = read(path.join(root, "aws-deploy-auth-api.ps1"));
const variables = new Map([...script.matchAll(/^\$(\w+) = "([\w.-]+)"/gm)].map(([, name, value]) => [name, value]));
const granted = new Set();
for (const block of script.split(/@\{\s*\r?\n\s*Sid = /).slice(1)) {
  const statement = block.slice(0, block.search(/\r?\n\s*\}/) + 1 || undefined);
  if (!/"dynamodb:ConditionCheckItem"/.test(statement)) continue;
  for (const [, table] of statement.matchAll(/table\/(\$\w+|[\w.-]+)/g)) {
    granted.add(table.startsWith("$") ? variables.get(table.slice(1)) : table);
  }
}

const missing = [...needed].filter(([table]) => !granted.has(table)).map(([table, files]) => `${table} (${[...new Set(files)].join(", ")})`);
assert.deepEqual(missing, [], `aws-deploy-auth-api.ps1 must grant dynamodb:ConditionCheckItem on: ${missing.join("; ")}`);
console.log(`Every Auth API ConditionCheck table has dynamodb:ConditionCheckItem in the deploy script: ${[...needed.keys()].sort().join(", ")}.`);
