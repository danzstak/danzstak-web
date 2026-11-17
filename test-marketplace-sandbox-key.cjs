"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const index = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
assert.match(index, /const marketplaceStripeSecretName = process\.env\.MARKETPLACE_STRIPE_SECRET_NAME \|\| "danzstak\/stripe\/sandbox-secret-key";/);
assert.match(index, /async function payoutStripeKey\(\) \{\s+if \(!payoutKeyPromise\) payoutKeyPromise = secretsManager\.send\(new GetSecretValueCommand\(\{ SecretId: marketplaceStripeSecretName \}\)\)/, "payouts and tickets read the sandbox key, not the main-account key");
console.log("Marketplace sandbox key checks passed.");
