const fs = require("node:fs");
const assert = require("node:assert/strict");

const authApi = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const signaling = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8");
const productionConfig = fs.readFileSync("aws-configure-production.ps1", "utf8");
const reviewOrigin = "https://review.danzstak.com";

assert.match(authApi, /const reviewOrigin = "https:\/\/review\.danzstak\.com";[\s\S]*?new Set\(\[allowedOrigin, "https:\/\/www\.danzstak\.com", reviewOrigin\]\)/,
  "the Auth API must allow only the named same-site review origin alongside production");
assert.match(signaling, /AllowedOrigins: \['https:\/\/danzstak\.com', 'https:\/\/www\.danzstak\.com', 'https:\/\/review\.danzstak\.com'\]/,
  "the media bucket must allow the named review origin");
assert.ok(signaling.split(reviewOrigin).length >= 4,
  "the call API and plan mutation guards must accept the named review origin");
assert.match(productionConfig, /AllowOrigins=https:\/\/danzstak\.com,https:\/\/www\.danzstak\.com,https:\/\/review\.danzstak\.com/,
  "runtime CORS configuration must preserve the review origin");
assert.match(authApi, /SameSite=Lax/);
assert.match(signaling, /SameSite=Lax/);
assert.doesNotMatch(authApi, /allowedOrigins\s*=\s*new Set\([^\n]*\*/,
  "review access must not introduce a wildcard origin");

console.log("Review-origin checks passed: named same-site staging, credentialed CORS, mutation guards, and Lax session protection remain aligned.");
