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
assert.match(css, /header\.topbar #pivotButton,header\.topbar \.pivot-header-button\{display:none!important\}/, "Pivot leaves the header");
assert.match(css, /\.install-app-button\{display:none!important\}/, "the orange install arrow leaves the header");
assert.match(js, /pivot\.setAttribute\("data-pivot-trigger", ""\);/, "Pivot is in the Menu");
assert.match(js, /install\.querySelector\("\.menu-label"\)\.textContent = t\("Install DanzStak"\);/, "Install is in the Menu");
assert.match(js, /if \(install\.hidden !== next\) install\.hidden = next;/, "the Menu install item never loops on its own hidden writes");
console.log("App bar checks passed.");
