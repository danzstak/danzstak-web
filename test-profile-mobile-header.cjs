"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const profile = fs.readFileSync("profile.html", "utf8");
const mobile = fs.readFileSync("assets/mobile-design-system.css", "utf8");

assert.match(profile, /assets\/mobile-design-system\.css\?v=14/,
  "the profile must load the shared mobile application shell");
assert.match(profile, /<nav class="ds-mobile-nav" aria-label="DanzStak mobile navigation">[\s\S]*?data-icon="home"[\s\S]*?data-icon="users"[\s\S]*?data-icon="chat"[\s\S]*?data-icon="bell"[\s\S]*?data-icon="menu"/,
  "the profile must expose the same five primary mobile destinations as the rest of DanzStak");
assert.match(mobile, /body\.profile-page>header \.brand span,body\.profile-page>header \.header-actions\{display:none\}/,
  "desktop account actions must not consume the phone profile header");
assert.match(mobile, /body\.profile-page>header \.brand img\{width:34px;height:34px;/,
  "the phone profile header must use the compact official brand mark");
assert.doesNotMatch(profile, /\.header-actions\{display:grid;grid-template-columns:repeat\(3/,
  "the retired three-text-button phone header must not remain as a competing layout");
assert.match(profile, /html,body\{max-width:100%;overflow-x:hidden;overflow-x:clip\}/,
  "profile content must not create a browser-level horizontal scrollbar on phones");
assert.match(profile, /main,\.card,\.profile\{min-width:0;max-width:100%\}/,
  "profile containers must shrink within the phone viewport");
assert.match(fs.readFileSync("assets/profile-editor.css", "utf8"), /\.profile-tabs\{[^}]*overflow-x:auto/,
  "profile tabs must keep their own intentional horizontal scrolling");

console.log("Profile mobile-header checks passed: the compact shared app shell replaces desktop text navigation on phones.");
