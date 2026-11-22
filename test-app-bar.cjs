"use strict";
// One top bar on every page (fix-it 18, owner 2026-11-17). Real browser: browser-checks/app-bar.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const js = fs.readFileSync("assets/app-bar.js", "utf8");
const css = fs.readFileSync("assets/app-bar.css", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
for (const page of ["feed.html", "bazaar.html", "booking.html", "booking-selections.html", "epk.html", "moving-day.html", "record-stores.html", "store.html"]) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /<script src="assets\/app-bar\.js\?v=\d+" defer><\/script>/, `${page} loads the app bar`);
  assert.match(html, /<link rel="stylesheet" href="assets\/app-bar\.css\?v=\d+">/, `${page} styles the app bar`);
  if (page !== "feed.html") assert.match(html, /assets\/top-search\.js/, `${page} has search in the bar`);
}
assert.ok(worker.includes('"/assets/app-bar.js"') && worker.includes('"/assets/app-bar.css"'));
assert.match(js, /iconLink\("ds-app-bar-bell", "feed\.html#notifications", "Notifications"/, "bell opens notifications");
assert.match(js, /iconLink\("ds-app-bar-sync", "messages\.html", "SYNC"/, "SYNC in the bar");
// Directive F15j: Pivot is back in the bar (between Search and the bell), one orange icon; the Menu keeps it too.
assert.match(js, /iconLink\("ds-app-bar-pivot", "feed\.html\?view=feed&pivot=open", "Pivot your data", icons\.pivot\), iconLink\("ds-app-bar-bell"/, "Pivot sits before the bell on every tool page");
assert.match(css, /\.ds-app-bar-pivot svg\{color:#ff5a1f\}/, "Pivot is orange");
assert.match(css, /grid-template-columns:40px minmax\(0,1fr\) 44px 44px 44px!important/, "Mix's phone bar has room for Pivot");
const iconPaths = source => (source.match(/M3 12a9 9 0 0 1 9-9[^"]*"[\s\S]*?M8 16H3v5/) || [""])[0].match(/M[^"]+/g);
assert.deepEqual(iconPaths(js), iconPaths(fs.readFileSync("assets/icon-buttons.js", "utf8")), "one Pivot icon: app-bar.js draws the same paths as icon-buttons.js");
assert.match(css, /\.install-app-button\{display:none!important\}/, "the orange install arrow leaves the header");
assert.match(js, /pivot\.setAttribute\("data-pivot-trigger", ""\);/, "Pivot is in the Menu");
assert.match(js, /install\.querySelector\("\.menu-label"\)\.textContent = t\("Install DanzStak"\);/, "Install is in the Menu");
assert.match(js, /if \(install\.hidden !== next\) install\.hidden = next;/, "the Menu install item never loops on its own hidden writes");
assert.match(js, /const result = await window\.danzstakRequestInstall\(\);[\s\S]*?window\.danzstakOpenInstallHelp\?\.\(\);/, "one install item: browser prompt, else the install steps");
assert.match(js, /next = standalone \|\| \(/, "the item stays in the Menu until DanzStak runs installed");
console.log("App bar checks passed.");
