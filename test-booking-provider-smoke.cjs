"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const script = fs.readFileSync("scripts/booking-provider-smoke.cjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/booking-provider-smoke.yml", "utf8");

assert.match(script, /DANZSTAK_SYNTHETIC_SESSION_A/);
assert.match(script, /authorization: `Bearer \$\{token\}`/);
assert.match(script, /authenticated-read-only-real-provider/);
assert.match(script, /sourcedVenueCount \+ sourcedResearchCount > 0/);
assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*(?:token|session\.user)/i, "Smoke output must not expose the session or account identity");
assert.doesNotMatch(script, /method:\s*"(?:PUT|PATCH|DELETE)"/, "Provider smoke must remain read-only");
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /DANZSTAK_SYNTHETIC_SESSION_A: \$\{\{ secrets\.DANZSTAK_SYNTHETIC_SESSION_A \}\}/);
assert.match(workflow, /node scripts\/booking-provider-smoke\.cjs/);
assert.doesNotMatch(workflow, /schedule:/, "Real-provider smoke must be manually triggered to bound provider cost");

console.log("Booking provider smoke checks passed: authenticated, source-attributed, read-only, secret-safe, and manually triggered.");
