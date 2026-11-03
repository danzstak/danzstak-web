"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const packageJson = JSON.parse(fs.readFileSync("infrastructure/auth-api/package.json", "utf8"));
const deploy = fs.readFileSync("scripts/deploy-tour-manager-stripe-test.ps1", "utf8");

assert.equal(packageJson.dependencies["@aws-sdk/client-secrets-manager"], "3.1156.0", "the Lambda bundle must include the v3 Secrets Manager client");
assert.match(source, /new SecretsManagerClient\(\{ region: "us-west-1", maxAttempts: 3 \}\)/, "the reusable Secrets Manager client must be initialized outside the handler");
assert.match(source, /"danzstak\/stripe\/secret-key"/, "the Stripe API key must come from its approved secret");
assert.match(source, /"danzstak\/stripe\/webhook-secret"/, "the webhook signing secret must remain separate");
assert.match(source, /Promise\.all\(\[[\s\S]*GetSecretValueCommand/, "the backend must retrieve both secrets with its IAM role");
assert.match(source, /\.catch\(\(\) => false\)/, "secret lookup failures must fail closed without logging secret values");
assert.match(source, /path\?\.startsWith\("\/tour-manager\/"\) \|\| path\?\.startsWith\("\/phone-number\/"\)/, "phone-number purchases must reach the billing router");
assert.match(deploy, /Required Stripe secret is missing or unreadable:[\s\S]*No Lambda changes were made/, "the test deployment must stop before mutation when either secret is absent");
assert.match(deploy, /TOUR_MANAGER_LIVE_PAYMENTS = "false"/, "the isolated deployment must keep live payments disabled");
assert.doesNotMatch(source + deploy, /console\.(?:log|error)\([^\n]*(?:STRIPE_SECRET_KEY|STRIPE_TOUR_MANAGER_WEBHOOK_SECRET)/, "Stripe secret values must never be logged");

console.log("Stripe secret-loading checks passed: separate Secrets Manager values, IAM retrieval, fail-closed deployment, phone routing, and live-payment lock remain enforced.");
