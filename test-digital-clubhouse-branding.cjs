const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");

const home = fs.readFileSync("index.html", "utf8");
const manifest = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));

for (const required of [
  "DanzStak | The Digital Clubhouse",
  "DanzStak is the digital clubhouse",
  "The digital clubhouse for music culture",
  'type="application/ld+json"'
]) assert.ok(home.includes(required), `Public digital-clubhouse branding missing: ${required}`);

const jsonText = home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1] || "";
const structured = JSON.parse(jsonText);
assert.equal(structured.name, "DanzStak");
assert.equal(structured.url, "https://danzstak.com/");
const hash = "sha256-" + crypto.createHash("sha256").update(jsonText).digest("base64");
const policy = home.match(/Content-Security-Policy" content="([^"]+)/)?.[1] || "";
assert.ok(policy.includes(`'${hash}'`), "Structured search data must remain authorized by the strict CSP");
assert.match(manifest.description, /digital clubhouse/i);
console.log("Digital clubhouse branding checks passed: search, sharing, visible copy, manifest, and strict structured data.");
