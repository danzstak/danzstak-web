"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const script = fs.readFileSync("scripts/booking-provider-smoke.cjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/booking-provider-smoke.yml", "utf8");
const healthWorkflow = fs.readFileSync(".github/workflows/daily-production-health.yml", "utf8");

assert.match(script, /DANZSTAK_SYNTHETIC_SESSION_A/);
assert.match(script, /authorization: `Bearer \$\{token\}`/);
assert.match(script, /authenticated-read-only-real-provider/);
assert.match(script, /sourcedVenueCount \+ sourcedResearchCount > 0/);
assert.match(script, /String\(provider\?\.name \|\| "Unknown provider"\)/, "Provider evidence must use public provider names instead of numeric array indexes");
assert.match(script, /provider\?\.skipped \? "not-configured" : provider\?\.ok \? "ok" : "unavailable"/, "Provider evidence must report a bounded public status");
assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*(?:token|session\.user)/i, "Smoke output must not expose the session or account identity");
assert.doesNotMatch(script, /method:\s*"(?:PUT|PATCH|DELETE)"/, "Provider smoke must remain read-only");
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /DANZSTAK_SYNTHETIC_SESSION_A: \$\{\{ secrets\.DANZSTAK_SYNTHETIC_SESSION_A \}\}/);
assert.match(workflow, /node scripts\/booking-provider-smoke\.cjs/);
assert.doesNotMatch(workflow, /schedule:/, "Real-provider smoke must be manually triggered to bound provider cost");
assert.match(healthWorkflow, /booking_provider_smoke:/, "Existing default-branch workflow must expose an opt-in provider-smoke dispatch input");
assert.match(healthWorkflow, /github\.event_name == 'workflow_dispatch' && inputs\.booking_provider_smoke/, "Scheduled health runs must never incur provider-smoke cost");
assert.match(healthWorkflow, /DANZSTAK_BOOKING_SMOKE_QUERY: \$\{\{ inputs\.booking_query \}\}/);
assert.match(healthWorkflow, /node scripts\/booking-provider-smoke\.cjs/);

console.log("Booking provider smoke checks passed: authenticated, source-attributed, read-only, secret-safe, and manually triggered.");
