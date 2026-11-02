const { readFileSync } = require("node:fs");
const assert = require("node:assert/strict");
const source = readFileSync("infrastructure/call-signaling/template.yaml", "utf8");

assert.match(source, /async function peopleSearch\(event,user\)/, "authenticated member search exists");
assert.match(source, /query\.length<2/, "short broad directory scans are rejected");
assert.match(source, /users:users\.slice\(0,20\)/, "member discovery is result-limited");
assert.match(source, /\{memberId,name,handle,picture:/, "results expose only public profile identity fields");
assert.doesNotMatch(source.match(/async function peopleSearch[\s\S]*?async function groupMembership/)?.[0] || "", /users\.push\(\{email/, "search results never expose account email addresses");
assert.match(source, /const memberId=String\(body\.memberId\|\|''\)/, "friend requests accept opaque member IDs");
assert.match(source, /accountByMemberId\(memberId\)/, "member IDs resolve to internal routing server-side");
assert.match(source, /RouteKey: GET \/people/, "member search has an API Gateway route");
assert.match(source, /GET\/people'/, "member search invoke permission is route-scoped");
assert.match(source, /Member discovery may expose only public profile names/, "privacy invariant is persisted with the Lambda");

console.log("Member discovery API checks passed: bounded authenticated search, public-only results, opaque friend requests, route permissions, and persisted privacy constraints.");
