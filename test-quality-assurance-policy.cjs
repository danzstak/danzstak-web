"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = file => fs.readFileSync(path.join(__dirname, file), "utf8");
const policy = read("docs/QUALITY-ASSURANCE-POLICY.md");
const checklist = read("docs/RELEASE-CHECKLIST.md");
const workflow = read(".github/workflows/daily-production-health.yml");
const health = read("scripts/production-health-check.cjs");
const authenticatedHealth = read("scripts/authenticated-production-health-check.cjs");
const publicHealthJob = workflow.split("  authenticated-isolated-synthetic:")[0];

for (const phrase of [
  "TEST. TEST. TEST. DEPLOY. TEST AGAIN.",
  "Test 1: functional",
  "Test 2: visual",
  "Test 3: integration",
  "Daily production health checks",
  "NO TEST PASS, NO DEPLOY",
]) assert.ok(policy.includes(phrase) || checklist.includes(phrase), `QA documents must include ${phrase}`);

assert.match(checklist, /Production commit SHA/);
assert.match(checklist, /Rollback/);
assert.match(checklist, /Android Chrome\/installed PWA/);
assert.match(checklist, /iPhone Safari\/installed PWA/);

assert.match(workflow, /schedule:/, "daily health workflow must be scheduled");
assert.match(workflow, /contents: read/, "daily workflow must have read-only repository permission");
assert.match(workflow, /production-health-check\.cjs/, "daily workflow must run the health script");
assert.doesNotMatch(publicHealthJob, /secrets\./, "public daily health workflow must not consume account secrets");

assert.match(health, /method: "GET"/, "daily monitor must use GET requests");
assert.match(health, /read-only-public-synthetic/, "daily monitor must identify its safe scope");
assert.doesNotMatch(health, /method:\s*["'](?:POST|PUT|PATCH|DELETE)["']/i, "daily monitor must not mutate production");
assert.doesNotMatch(health, /checkout\.sessions\.create|SendEmailCommand|PutItemCommand|UpdateItemCommand|DeleteItemCommand/, "daily monitor must not charge, send email, or write data");

assert.match(workflow, /DANZSTAK_AUTHENTICATED_HEALTH_ENABLED/, "authenticated checks must require an explicit repository opt-in");
assert.match(workflow, /secrets\.DANZSTAK_SYNTHETIC_SESSION_A/, "authenticated check must load account A from a repository secret");
assert.match(workflow, /secrets\.DANZSTAK_SYNTHETIC_SESSION_B/, "authenticated check must load account B from a repository secret");
assert.match(authenticatedHealth, /audience:\s*["']private["']/, "synthetic posts must never be public");
assert.match(authenticatedHealth, /scope:\s*["']everyone["']/, "synthetic Chat messages must be removed for both accounts");
assert.match(authenticatedHealth, /runCleanup\(\)/, "authenticated checks must always clean up synthetic records");
assert.match(authenticatedHealth, /DANZSTAK_SYNTHETIC_SESSION_A/, "account A must be supplied outside the repository");
assert.match(authenticatedHealth, /DANZSTAK_SYNTHETIC_SESSION_B/, "account B must be supplied outside the repository");
assert.doesNotMatch(authenticatedHealth, /["'`]\/(?:tour-manager\/)?checkout|checkout\.sessions|SendEmailCommand/i, "authenticated daily checks must not call payment or email operations");

console.log("Permanent QA policy and safe public/authenticated daily health checks passed.");
