"use strict";
// Mix Dailies strip (fix-it 18, owner 2026-11-17). Real browser: browser-checks/mix-dailies-strip.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const html = fs.readFileSync("feed.html", "utf8");
const css = fs.readFileSync("assets/mix-polish.css", "utf8");
assert.match(html, /takeLine\.textContent = `TAKE \$\{takes\}`;\s*takeLine\.hidden = false;/, "owner 2026-11-18: the clapper always shows the member's Dailies count");
assert.match(html, /<strong>SCENE 1<\/strong><small hidden><\/small>/, "the first paint has no TAKE 0 either");
assert.match(css, /body\.danzstak-original #storiesRail \.story,\s*body\.danzstak-original #storiesRail:not\(:has\(\.story\[data-story-id\]\)\) \.story-create\{\s*flex:0 0 calc\(\(100% - 4px\) \/ 3\)!important;/, "three tiles across, each a third of the screen (owner 2026-11-18)");
assert.match(css, /#storiesRail \.story-create\{position:sticky!important;left:0;/, "the member's own tile is pinned while friends' Dailies scroll (owner 2026-11-18)");
assert.match(html, /for \(let slot = visibleStories\.length; slot < 2; slot \+= 1\)/, "owner 2026-11-18: always three tiles — two placeholders when friends have no Dailies");
assert.match(css, /\.story\.story-placeholder\{position:relative;background:#121418!important;background-image:none!important;/, "placeholders are plain dark film frames, no gradient");
assert.match(html, /\["LIGHTS", "SOUND"\], \["ROLLING", "SPEED", "SLATING"\], \["ROLL CAMERA", "ROLL SOUND"\], \["QUIET ON SET"\], \["FINAL CHECKS", "PICTURE IS UP"\]/, "owner 2026-11-18: film-set call sheets for the empty slots");
assert.match(html, /"ACTION!"/, "Action is the last cue");
// The inline script edit must keep the CSP hash in step, or the whole Mix script is blocked (caught while building this).
const csp = html.match(/script-src ([^;]*)/)[1];
for (const [, body] of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  const hash = crypto.createHash("sha256").update(body, "utf8").digest("base64");
  assert.ok(csp.includes(`'sha256-${hash}'`), "every inline script is allowed by its exact CSP hash");
}
console.log("Mix Dailies strip checks passed.");
