"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("epk.html", "utf8");
const client = fs.readFileSync("assets/epk.js", "utf8");
const css = fs.readFileSync("assets/epk.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");

assert.match(html, /Build your EPK in 5 minutes/, "new artists need a clear guided starting point");
assert.match(html, /id="epkGuideProgress"[^>]*max="5"/, "the guide should disclose five essentials");
for (const key of ["identity", "story", "links", "photo", "contact"]) {
  assert.match(html, new RegExp(`data-check="${key}"`), `the ${key} essential is missing`);
}
for (const step of [1, 2, 3, 4, 5]) {
  assert.match(html, new RegExp(`data-epk-step="${step}"`), `guide step ${step} is missing`);
}
assert.match(html, /Your work stays private until you choose Publish/, "the guide must explain private-by-default behavior");
assert.match(html, /DanzStak does not copy or host it/, "the guide must preserve link-only music and video");
assert.match(client, /function guideCompletion\(/, "the checklist should be driven by actual form content");
assert.match(client, /setGuidedMode\(true\)/, "a new EPK should start in guided mode");
assert.match(client, /if \(data\.kit\) \{ fill\(data\.kit\); setGuidedMode\(false\); \}/, "an existing EPK should retain the complete editor");
assert.match(client, /currentGuideStep < 5/, "the guide should move through bounded steps");
assert.match(client, /setMobilePreview/, "phone artists need an explicit live-preview control");
assert.match(client, /kit\.musicLinks\.length \|\| kit\.videoLinks\.length/, "a real external music or video link should complete the media-link essential");
assert.match(client, /kit\.media\.some\(item => item\.contentType\?\.startsWith\("image\/"\)\)/, "an uploaded image should complete the press-photo essential");
assert.match(css, /\.epk-guided \.epk-form \[data-epk-step\]/, "guided mode should show one step without deleting advanced fields");
assert.match(css, /\.epk-preview-open \.epk-form\{display:none\}/, "the phone preview should not overlap the editor");
assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/, "desktop essentials should use a compact single row");
assert.match(worker, /danzstak-shell-v783/, "the installed PWA must retain the guided EPK assets");
console.log("Five-minute EPK checks passed: private guide, bounded steps, live preview, link-only media, and PWA refresh.");
