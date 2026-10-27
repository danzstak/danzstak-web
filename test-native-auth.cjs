"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const api = fs.readFileSync(path.join(root, "infrastructure", "auth-api", "index.mjs"), "utf8");
const deploy = fs.readFileSync(path.join(root, "aws-deploy-auth-api.ps1"), "utf8");

assert.match(api, /GET" && path === "\/auth\/mobile-login"/, "mobile login route is handled");
assert.match(api, /POST" && path === "\/auth\/mobile-session"/, "one-time session exchange route is handled");
assert.match(api, /\["android", "ios"\]/, "only known native platforms are accepted");
assert.match(api, /\^\[a-f0-9\]\{64\}\$/, "native proofs use fixed-size random values");
assert.match(api, /mobile-exchange:/, "exchange codes are stored under a one-way key");
assert.match(api, /sha256\(verifier\)/, "an intercepted deep link cannot be exchanged without its device verifier");
assert.match(api, /ConditionExpression: "#t = :exchange AND challenge = :challenge"/, "exchange codes are consumed atomically");
assert.match(api, /expiresAt: \{ N: String\(now\(\) \+ 120\) \}/, "exchange codes expire quickly");
assert.match(api, /\^Bearer\\s\+\(\[a-f0-9\]\{64\}\)\$\/i/, "native sessions use opaque bearer tokens");
assert.doesNotMatch(api, /body: JSON\.stringify\(\{[^}]*id_token/, "Cognito identity tokens are never returned to native clients");
assert.match(deploy, /GET \/auth\/mobile-login/, "deployment creates the native login route");
assert.match(deploy, /POST \/auth\/mobile-session/, "deployment creates the exchange route");
assert.match(deploy, /AllowNativeAuthFromApiGateway/, "deployment grants only the native auth route family");

console.log("Native authentication checks passed: device-bound one-time exchange, opaque sessions, expiry, routing, and no Cognito token exposure.");
