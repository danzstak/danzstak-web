"use strict";
// Task 16-G: SYNC can launch on its own. Static contract; real-browser check: browser-checks/sync-standalone.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const sync = JSON.parse(fs.readFileSync("sync.webmanifest", "utf8"));
const main = JSON.parse(fs.readFileSync("manifest.webmanifest", "utf8"));
const page = fs.readFileSync("sync.html", "utf8"), js = fs.readFileSync("assets/sync-standalone.js", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8"), settings = fs.readFileSync("assets/sync-settings.js", "utf8"), i18n = fs.readFileSync("assets/i18n-sync.js", "utf8");
assert.equal(sync.name, "SYNC by DanzStak"); assert.equal(sync.short_name, "SYNC");
assert.equal(sync.id, "/sync", "its own app identity, separate from DanzStak");
assert.notEqual(sync.id, main.id || "/");
assert.equal(sync.start_url, "/sync/?app=sync", "starts straight in the chat list");
// Task 34: its own scope, so Chrome installs SYNC next to DanzStak (one app per scope). Same origin: same account, no second login.
assert.equal(sync.scope, "/sync/");
assert.notEqual(sync.scope, main.scope, "SYNC's scope is not DanzStak's");
assert.ok(sync.start_url.startsWith(sync.scope), "SYNC starts inside its own scope");
for (const shortcut of sync.shortcuts) assert.ok(shortcut.url.startsWith(sync.scope), `shortcut ${shortcut.name} stays in SYNC`);
assert.equal(sync.display, "standalone");
for (const size of ["192x192", "512x512"]) assert.ok(sync.icons.some(i => i.sizes === size && i.src.startsWith("/assets/sync-icon")), `own ${size} icon`);
assert.ok(sync.icons.some(i => i.purpose === "maskable"));
for (const icon of sync.icons) assert.ok(fs.existsSync("." + icon.src), icon.src);
assert.ok(main.shortcuts.some(s => s.name === "SYNC" && s.url === "/sync/?app=sync"), "DanzStak's own shortcut opens SYNC");
assert.match(page, /<link rel="manifest" href="\/sync\.webmanifest">/);
assert.match(page, /<link rel="apple-touch-icon" href="assets\/sync-apple-touch-icon\.png\?v=\d+">/);
assert.match(js, /if \(standalone\) \{ location\.replace\("\/sync\/\?app=sync"\); return; \}/, "launched as the app, it goes straight to the chats");
assert.match(js, /location\.replace\("\/sync\/\?install=1"\);/, "task 34: the old page forwards to SYNC's own install sheet");
assert.doesNotMatch(page + js, /tel:|phone number is shown|login\.html|password/i, "no second login, no phone numbers");
for (const file of ["/sync.html", "/sync.webmanifest", "/assets/sync-standalone.js", "/assets/sync-icon-192.png"]) assert.ok(worker.includes(`"${file}"`), `cached: ${file}`);
assert.match(settings, /add\(\{ id: "standalone", label: "Get SYNC as its own app"/);
for (const lang of ["it", "fr", "es"]) { const b = i18n.slice(i18n.indexOf(`"${lang}": {`), i18n.indexOf("\n}", i18n.indexOf(`"${lang}": {`))); for (const k of ["Install SYNC", "Open SYNC", "Get SYNC as its own app"]) assert.ok(b.includes(JSON.stringify(k) + ":"), `${lang}: ${k}`); }
console.log("SYNC standalone checks passed: own manifest id/name/icons and its own /sync/ scope, starts in the chat list, same account, DanzStak shortcut, sync.html forwards, cached, it/fr/es.");
