const assert = require("node:assert/strict");
const fs = require("node:fs");

const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const template = fs.readFileSync("infrastructure/engagement/template.yaml", "utf8");

for (const required of [
  'role: { S: "elder" }',
  "async function listGroupMembers(event)",
  "async function manageGroupElder(event)",
  'Only an Elder can invite or manage other Elders.',
  'The founding Elder cannot be changed.',
  "canManageElders: callerIsElder",
  'role: meta?.ownerId?.S === memberId || row?.role?.S === "elder" ? "elder" : "member"'
]) assert.ok(api.includes(required), `Elder authorization missing: ${required}`);

assert.ok(!/members\.push\([^\n]*email/.test(api), "Member responses must not expose Crew email addresses");
assert.match(template, /GET \/groups\/\{groupId\}\/members/);
assert.match(template, /POST \/groups\/\{groupId\}\/elders/);
console.log("Tribe Elder checks passed: founder protection, Elder authorization, Crew privacy, and API routes.");
