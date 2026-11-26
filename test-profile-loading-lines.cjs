"use strict";
// LANG (owner 2026-11-25: "Italian has to be Italian the whole thing"). The profile's loading lines show only while a
// slow phone waits for posts, so the language sweep caught "Loading posts…" in Italian only now and then (PR #782's CI).
// Every "Loading …" line the profile draws must have an Italian, French and Spanish translation.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const win = { addEventListener() {}, removeEventListener() {} };
const context = vm.createContext({ window: win, addEventListener() {}, document: { documentElement: { lang: "en", setAttribute() {} }, addEventListener() {}, readyState: "loading", querySelectorAll: () => [] }, navigator: { languages: ["en"] }, localStorage: { getItem() {}, setItem() {} }, MutationObserver: class { observe() {} }, console });
for (const file of ["languages.js", "i18n-sync.js", "i18n-music.js", "i18n-people.js", "i18n-events.js", "i18n.js"]) vm.runInContext(fs.readFileSync(`assets/${file}`, "utf8"), context);
const dictionaries = win.danzstakTranslations;

const source = fs.readFileSync("assets/profile-editor.js", "utf8");
const lines = [...new Set([...source.matchAll(/"(Loading [^"]{2,60}…)"/g)].map(match => match[1]))];
assert.ok(lines.includes("Loading posts…") && lines.includes("Loading media…"), "the profile's loading lines are found");
for (const line of lines) for (const lang of ["it", "fr", "es"]) {
  const translated = dictionaries[lang]?.[line];
  assert.ok(translated && translated !== line, `${lang}: "${line}" has no translation`);
}
console.log(`Profile loading lines translated in it/fr/es: ${lines.join(", ")}`);
