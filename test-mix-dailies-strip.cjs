"use strict";
// Mix Dailies strip (fix-it 18, owner 2026-11-17). Real browser: browser-checks/mix-dailies-strip.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const html = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/mix-polish.css", "utf8");
assert.match(html, /takeLine\.textContent = takes \? `TAKE \$\{takes\}` : "";\s*takeLine\.hidden = !takes;/, "no TAKE 0 before the first upload");
assert.match(html, /<strong>SCENE 1<\/strong><small hidden><\/small>/, "the first paint has no TAKE 0 either");
assert.match(css, /body\.danzstak-original #storiesRail \.story,\s*body\.danzstak-original #storiesRail:not\(:has\(\.story\[data-story-id\]\)\) \.story-create\{\s*flex:1 0 calc\(\(100% - 4px\) \/ 3\.25\)!important;/, "tiles are a third of the screen and grow to fill the row");
// The inline script edit must keep the CSP hash in step, or the whole Mix script is blocked (caught while building this).
const csp = html.match(/script-src ([^;]*)/)[1];
for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  const hash = crypto.createHash("sha256").update(body, "utf8").digest("base64");
  assert.ok(csp.includes(`'sha256-${hash}'`), "every inline script is allowed by its exact CSP hash");
}
console.log("Mix Dailies strip checks passed.");
