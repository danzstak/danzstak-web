"use strict";
// Regression (owner's Claude, 2026-11-18): the one-top-bar change hid .topnav on phones while .topnav was the phone
// bottom tab bar, so Mix had no tabs. Since audit 36 B2 the phone tab bar on every page, Mix included, is the shared
// component (app-tabs.js / app-tabs.css). Mix's .topnav may be hidden on phones only where that bar replaces it
// (body.has-app-tabs), and Mix must load the shared bar.
const fs = require("node:fs");
const assert = require("node:assert");
const css = fs.readdirSync("assets").filter(n => n.endsWith(".css")).map(n => [n, fs.readFileSync(`assets/${n}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]);
for (const [name, text] of css) {
  for (const m of text.matchAll(/([^{}]*\.topnav[^{}]*)\{([^}]*)\}/g)) {
    const selector = m[1].trim().split(",").pop().trim(), body = m[2];
    if (!/display\s*:\s*none/.test(body) || /\.topnav\s+[.#\w]|\.topnav\s*>|\.topnav[.:\[]/.test(selector)) continue;
    assert.ok(/body\.has-app-tabs\b/.test(selector), `${name}: "${selector}" hides the phone bottom tabs without the shared tab bar in its place`);
  }
}
const feed = fs.readFileSync("feed.html", "utf8"), tabs = fs.readFileSync("assets/app-tabs.js", "utf8");
assert.match(feed, /assets\/app-tabs\.js\?v=\d+/, "Mix loads the shared phone tab bar");
assert.match(tabs, /document\.body\.classList\.add\("has-app-tabs"\)/, "the shared bar marks the page only once it is drawn");
console.log("Phone bottom tabs are never hidden: Mix's own tab row is hidden only where the shared tab bar replaces it.");
