const fs = require("fs");
const crypto = require("crypto");
const assert = require("assert");

const html = fs.readFileSync("feed.html", "utf8");
const scripts = [...html.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(Boolean);
assert.equal(scripts.length, 1, "Feed should have one explicitly hashed inline script");

const expected = "sha256-" + crypto.createHash("sha256").update(scripts[0]).digest("base64");
const policy = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1] || "";
assert.ok(policy.includes("'" + expected + "'"), `Feed CSP must authorize its current inline script (${expected})`);
assert.match(policy, /script-src 'self' 'sha256-[A-Za-z0-9+/]+=*'/, "Feed scripts must remain protected by a strict hash");
assert.doesNotMatch(policy, /script-src[^;]*'unsafe-inline'/, "Feed CSP must not weaken script execution to unsafe-inline");

console.log("Feed CSP checks passed: the live inline script hash is current and strict.");
