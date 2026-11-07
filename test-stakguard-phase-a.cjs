"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = file => fs.readFileSync(file, "utf8");

const html = read("stakguard.html");
const css = read("assets/stakguard.css");
const js = read("assets/stakguard.js");
const registry = read("assets/stakguard-brokers.js");
const feed = read("feed.html");
const settings = read("assets/device-settings.js");
const worker = read("service-worker.js");
const provider = read("docs/STAKGUARD-SCAN-PROVIDER.md");

assert.match(html, /No scan provider connected/);
assert.match(html, /No scan has run/);
assert.match(html, /No broker findings yet/);
assert.match(html, /Keep watch for \$4 a month/);
assert.match(html, /No subscription/);
assert.match(html, /no automatic renewal/i);
assert.match(html, /id="monitorUnavailable" disabled/);
assert.match(html, /California DROP/);
assert.match(html, /Opening a form is not the same as submitting it/);
assert.match(js, /\$\{value \* 4\}/);
assert.match(js, /Math\.min\(12/);
assert.doesNotMatch(js, /fetch\s*\(/, "Phase A must not send scan data or create payments");
assert.doesNotMatch(html + js, /Example verified match|example findings|data-review=/i);
assert.doesNotMatch(html + js, /checkout|stripe|subscribe now|renews automatically|annual discount/i);
assert.match(registry, /Official process under review/);
assert.match(feed, /href="stakguard\.html"/);
assert.match(settings, /Open StakGuard/);
assert.match(worker, /danzstak-shell-v730/);
for (const asset of ["/stakguard.html", "/assets/stakguard.css", "/assets/stakguard-brokers.js", "/assets/stakguard.js"]) assert.ok(worker.includes(asset), `${asset} is missing from the PWA shell`);
assert.match(provider, /found_verified/);
assert.match(provider, /unknown`, never `not_found` or `clean`/);
assert.match(provider, /Every new adapter ships disabled/);
assert.match(css, /min-height:44px/);

const urls = [...registry.matchAll(/url:"([^"]+)"/g)].map(match => new URL(match[1]));
assert.equal(urls.length, 5);
for (const url of urls) {
  assert.equal(url.protocol, "https:");
  assert.ok(!url.username && !url.password && !url.search && !url.hash, `Unsafe registry URL: ${url}`);
}

console.log("StakGuard Phase A checks passed: honest unscanned dashboard, free removal paths, $4 prepaid monitoring disclosure, safe source registry, and disabled provider boundary.");
