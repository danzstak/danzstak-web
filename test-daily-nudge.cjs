"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const core = require("./assets/daily-nudge-core.js");

assert.deepEqual(core.locales, ["en", "es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"]);
assert.equal(core.prompts.length, 14, "the complete approved prompt set must be retained");
for (const [index, prompt] of core.prompts.entries()) {
  for (const locale of core.locales) assert.ok(String(prompt[locale] || "").trim(), `prompt ${index} must be translated for ${locale}`);
}
for (const locale of core.locales) {
  assert.equal(core.uiLabels(locale).length, 3, `${locale} needs accessible surface labels`);
  assert.notEqual(core.text(0, locale), "", `${locale} must render a prompt`);
}
assert.equal(core.normalizeLocale("zh-CN"), "zh-Hans");
assert.equal(core.normalizeLocale("zh-TW"), "zh-Hant");
assert.equal(core.normalizeLocale("it-IT"), "it");
assert.equal(core.normalizeLocale("xx"), "en");

const summer = core.localDay(new Date(2026, 5, 15, 23, 59));
const summerLater = core.localDay(new Date(2026, 5, 15, 1, 1));
const nextDay = core.localDay(new Date(2026, 5, 16, 0, 0));
assert.equal(summer.key, summerLater.key, "the choice must remain stable throughout a local day");
assert.equal(nextDay.ordinal, summer.ordinal + 1, "local calendar rotation must not depend on a 24-hour timer");
assert.equal(core.chooseIndex("device-a", summer.key), core.chooseIndex("device-a", summer.key), "same device/day must be stable");
const first = core.chooseIndex("device-a", summer.key);
assert.notEqual(core.chooseIndex("device-a", nextDay.key, [first]), first, "short local history must prevent an immediate repeat");
let differentSeed = "";
for (let index = 0; index < 100; index += 1) {
  const candidate = `device-${index}`;
  if (core.chooseIndex(candidate, summer.key) !== first) { differentSeed = candidate; break; }
}
assert.ok(differentSeed, "independent installations must be capable of selecting different prompts");

const ui = fs.readFileSync("assets/daily-nudge.js", "utf8");
const css = fs.readFileSync("assets/daily-nudge.css", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
assert.match(ui, /crypto\.getRandomValues/, "installation variety must use a local random seed");
assert.doesNotMatch(ui, /fetch\(|XMLHttpRequest|sendBeacon|memberId|userEmail/, "Daily Nudge must not call a service or derive a choice from account identity");
assert.match(ui, /7000/, "the fleeting surface should remain for about seven seconds");
assert.match(ui, /focus-within/, "focused content must not disappear automatically");
assert.match(ui, /prefers-reduced-motion/, "dismissal must respect reduced motion");
assert.match(css, /min-width:44px;min-height:44px/, "dismiss must retain a phone-sized target");
assert.match(css, /width:calc\(100vw - 16px\)/, "phone surface must stay within the viewport");
assert.match(ui, /getBoundingClientRect\(\)\.bottom/, "the temporary surface must clear the actual responsive header height");
assert.match(feed, /daily-nudge-core\.js\?v=1/);
assert.match(feed, /daily-nudge\.js\?v=1/);
assert.match(feed, /daily-nudge\.css\?v=1/);
assert.match(worker, /danzstak-shell-v694/);
for (const asset of ["daily-nudge-core.js", "daily-nudge.js", "daily-nudge.css"]) assert.ok(worker.includes(`/assets/${asset}`), `${asset} must work offline`);

console.log("Daily Nudge checks passed: 14 prompts, 15 locales, stable per-device choice, local-day rotation, privacy, accessibility and offline shell.");
