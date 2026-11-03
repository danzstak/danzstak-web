"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const bootstrap = fs.readFileSync("assets/display-preferences.js", "utf8");
const settings = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const classes = new Set(["dark-mode"]);
const removed = [];
const storage = new Map([["danzstak_dark_mode", "1"], ["danzstak_reduce_motion", "1"], ["danzstak_language", "it"]]);
const context = vm.createContext({
  document: { documentElement: { classList: { add: value => classes.add(value), remove: value => classes.delete(value), toggle: (value, on) => on ? classes.add(value) : classes.delete(value) }, lang: "en" } },
  location: { pathname: "/profile.html", search: "" },
  localStorage: { getItem: key => storage.get(key) || null, removeItem: key => { removed.push(key); storage.delete(key); } },
  navigator: { language: "en" },
  URLSearchParams
});

vm.runInContext(bootstrap, context);
assert.equal(classes.has("dark-mode"), false, "a legacy device preference must not re-enable dark mode");
assert.equal(classes.has("reduce-motion"), true, "light-only rendering must preserve the independent reduced-motion preference");
assert.equal(context.document.documentElement.lang, "it", "light-only rendering must preserve the selected language");
assert.deepEqual(removed, ["danzstak_dark_mode"], "the retired device preference must be cleared");
assert.doesNotMatch(settings, /settingRow\("moon",\s*"Dark mode"/);
assert.doesNotMatch(settings, /data\.darkMode[^\n]*classList\.toggle\("dark-mode"/);
assert.match(settings, /darkMode: false/, "account saves must migrate older servers to the light-only value");

console.log("Light-mode checks passed: legacy preferences are retired while language and reduced-motion choices remain intact.");
