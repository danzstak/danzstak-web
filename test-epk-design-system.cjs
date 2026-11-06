"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("epk.html", "utf8");
const css = fs.readFileSync("assets/epk.css", "utf8");
const mediaCss = fs.readFileSync("assets/epk-media.css", "utf8");
const client = fs.readFileSync("assets/epk.js", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

for (const id of ["epkBasics", "epkStory", "epkLinks", "epkMedia", "epkProduction", "epkContact"]) {
  assert.match(html, new RegExp(`<details class="epk-step" id="${id}"`), `${id} must be a progressive-disclosure editor section`);
  assert.match(html, new RegExp(`href="#${id}"`), `${id} must be reachable from the section navigator`);
}
assert.match(html, /href="#epkPreview">View live preview/, "phone users need a direct route to the live preview");
assert.match(html, /class="epk-preview-column"[\s\S]*What bookers see/, "the preview must have a clear professional context");
assert.match(html, /assets\/epk\.css\?v=3/);
assert.match(html, /assets\/epk-media\.css\?v=6/);
assert.match(html, /assets\/epk\.js\?v=12/);
assert.match(css, /\.epk-step-nav\{[^}]*overflow-x:auto/, "narrow screens need a contained, non-overflowing section navigator");
assert.match(css, /\.epk-step>summary\{[^}]*min-height:60px/, "section summaries must be comfortable touch targets");
assert.match(css, /@media\(max-width:700px\)[\s\S]*\.epk-save-actions\{[^}]*bottom:58px/, "save and publish controls must stay above mobile navigation");
assert.match(css, /var\(--ds-brand/, "EPK styling must consume shared DANZSTAK tokens");
assert.doesNotMatch(html + client, /🗑️/, "EPK actions must not use cartoon emoji controls");
assert.match(mediaCss, /\.epk-media-item button \{ min-height: 44px;/, "media controls must remain touch accessible");
assert.match(worker, /danzstak-shell-v697/);

console.log("EPK design checks passed: compact section navigation, progressive disclosure, live-preview access, shared tokens and accessible actions.");
