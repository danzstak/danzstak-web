const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const start = source.indexOf("async function getProfileVideo(event)");
const end = source.indexOf("async function setProfileVideo(event)", start);
assert.ok(start >= 0 && end > start, "profile video endpoint is missing");

class GetItemCommand { constructor(input) { this.input = input; } }
const memberId = "11111111-1111-4111-a111-111111111111";
const reads = [];
let allowed = true;
const context = vm.createContext({
  corsHeaders: () => ({}),
  getAuthenticatedUser: async () => "viewer-id",
  accountForSub: async id => id === memberId ? "member@example.com" : "viewer@example.com",
  canViewProfileMedia: async (viewer, profile) => allowed && viewer === "viewer@example.com" && profile === "member@example.com",
  settingsTable: "settings",
  GetItemCommand,
  db: { send: async command => { reads.push(command.input); return { Item: { profileVideoKey: { S: "users/member/video.mp4" } } }; } },
  signedMediaUrl: key => "https://media.example/" + key
});
vm.runInContext(source.slice(start, end), context);

(async () => {
  const invalid = await context.getProfileVideo({ headers: {}, queryStringParameters: { member: "bad" } });
  assert.equal(invalid.statusCode, 400);
  const result = await context.getProfileVideo({ headers: {}, queryStringParameters: { member: memberId } });
  assert.equal(result.statusCode, 200);
  assert.equal(reads[0].Key.userEmail.S, "member@example.com", "opaque member IDs resolve internally to the settings key");
  assert.equal(JSON.parse(result.body).mediaKey, "users/member/video.mp4");
  allowed = false;
  const denied = await context.getProfileVideo({ headers: {}, queryStringParameters: { member: memberId } });
  assert.equal(denied.statusCode, 403, "opaque profile video lookup keeps friend/group authorization");
  console.log("Profile video privacy checks passed: opaque member lookup, authorization, and internal email resolution.");
})().catch(error => { console.error(error); process.exitCode = 1; });
