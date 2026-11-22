"use strict";
// Directive F1a: the full-screen rail and comments sheet (assets/media-actions.js). The browser behaviour is checked in
// browser-checks/video-rail-comments.cjs; this guards what a browser check can't see at a glance:
// - every word the component shows has an Italian, French and Spanish translation (owner 2026-11-16: every word in the
//   visitor's own language);
// - comments are ordered by time only, Newest or Oldest (never "most relevant");
// - Mix and the profile load it (before the viewer that mounts it) and the offline shell caches it.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/media-actions.js", "utf8");
const keys = new Set([...source.matchAll(/\bt\("((?:[^"\\]|\\.)+)"/g)].map(match => JSON.parse(`"${match[1]}"`)));
for (const match of source.matchAll(/\bt\((\w+) \? "([^"]+)" : "([^"]+)"\)/g)) { keys.add(match[2]); keys.add(match[3]); }
for (const match of source.matchAll(/t\(order === "newest" \? "([^"]+)" : "([^"]+)"\)/g)) { keys.add(match[1]); keys.add(match[2]); }
for (const match of source.matchAll(/\bfeedback\((?:[\w.]+ \|\| )?"([^"]+)"\)/g)) keys.add(match[1]); // error messages go through t() in feedback()
assert.ok(keys.size >= 30, `found the component's strings (${keys.size})`);

const context = { console, setTimeout, addEventListener() {}, document: { documentElement: { lang: "en" }, addEventListener() {}, querySelectorAll: () => [] }, navigator: { languages: ["en"] }, localStorage: { getItem: () => null, setItem() {} }, location: { search: "" }, MutationObserver: class { observe() {} } };
context.window = context; context.globalThis = context; context.self = context;
for (const file of fs.readdirSync("assets").filter(name => /^i18n-.*\.js$/.test(name)).concat("i18n.js")) {
  try { vm.runInNewContext(fs.readFileSync(`assets/${file}`, "utf8"), context); } catch { /* i18n.js wires the DOM after its dictionaries are built */ }
}
const dictionaries = context.danzstakTranslations;
for (const language of ["it", "fr", "es"]) {
  const missing = [...keys].filter(key => !dictionaries?.[language]?.[key]);
  assert.deepEqual(missing, [], `${language}: every rail and comments string is translated`);
}

assert.match(source, /roots\.sort\(\(a, b\) => order === "newest" \? time\(b\) - time\(a\) : time\(a\) - time\(b\)\); \/\/ chronological only, never ranked/, "comments are Newest or Oldest only");
assert.doesNotMatch(source, /reactionTotal\s*-|relevan/i, "no ranking by reactions");
assert.match(source, /history\.pushState\(\{ \.\.\.\(history\.state \|\| \{\}\), danzstakComments: true \}/, "Back closes the comments first (the viewer's own history entry is kept)");

for (const page of ["feed.html", "profile.html"]) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /assets\/media-actions\.css\?v=\d+/, `${page} loads the rail styles`);
  assert.ok(html.indexOf("assets/media-actions.js?v=") > 0 && html.indexOf("assets/media-actions.js?v=") < html.indexOf("assets/media-viewer.js?v="), `${page} loads the rail before the viewer`);
}
const worker = fs.readFileSync("service-worker.js", "utf8");
assert.ok(worker.includes('"/assets/media-actions.js"') && worker.includes('"/assets/media-actions.css"'), "the offline shell caches the rail");
console.log(`Media actions checks passed: ${keys.size} strings translated in it/fr/es, comments chronological only, Back closes comments first, loaded on Mix and the profile before the viewer, cached offline.`);
