"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("assets/app-downloads.js", "utf8");
const feed = fs.readFileSync("feed.html", "utf8");
const landing = fs.readFileSync("index.html", "utf8");

assert.match(source, /openInstallHelp\(platform, opener = document\.activeElement\)/,
  "the install dialog must remember the control that opened it");
assert.match(source, /apple \? installHelpClose : installHelpAction\)\.focus\(\{ preventScroll: true \}\)/,
  "the dialog must focus the visible primary action");
assert.match(source, /installHelpAction\.hidden = true;\s*installHelpClose\.focus\(\{ preventScroll: true \}\)/,
  "manual-install fallback must move focus before hiding the action");
assert.match(source, /installHelp\.addEventListener\("close"[\s\S]*?installHelpOpener\?\.isConnected[\s\S]*?installHelpOpener\.focus/,
  "closing install help must return focus to its opener");
for (const [name, page] of Object.entries({ feed, landing })) {
  assert.match(page, /assets\/app-downloads\.js\?v=293/, `${name} must load the updated install dialog behavior`);
}

console.log("App install dialog checks passed: initial focus, fallback focus, and opener restoration are explicit.");
