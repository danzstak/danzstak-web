"use strict";
// Fix-it 18 (Walkthrough 2): no install down-arrow in signed-in top bars; Menu → Install DanzStak still works.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const pwa = fs.readFileSync("assets/pwa.js", "utf8");
const appBar = fs.readFileSync("assets/app-bar.js", "utf8");
assert.match(pwa, /const signedInPage = syncAppPage \|\| \/\(\?:feed\|profile\|messages\)\\\.html\$\/i/, "profile, SYNC (also its own /sync/ app, task 34) and Mix are signed-in pages");
assert.match(pwa, /if \(signedInPage\) installButton\.style\.setProperty\("display", "none", "important"\);/, "the install arrow never shows on signed-in pages");
assert.match(appBar, /document\.querySelector\("\.install-app-button"\)\?\.click\(\)/, "Menu → Install DanzStak still drives the hidden button");
for (const page of ["profile.html", "messages.html", "feed.html"]) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /assets\/pwa\.js\?v=433/, `${page} loads the fixed pwa.js`);
}
console.log("No install arrow checks passed: hidden on profile, SYNC and Mix; Menu install still works.");
