"use strict";
// Task 34 (owner 2026-11-18): "Get SYNC as its own app" puts a SYNC icon on the home screen. Static contract; the real
// browser check is browser-checks/sync-own-app.cjs (manifest scope basics also live in test-sync-standalone.cjs).
const assert = require("node:assert/strict");
const fs = require("node:fs");
// Windows checkouts (CI) turn LF into CRLF; compare text, not line endings.
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const { build } = require("./scripts/build-sync-app.cjs");
const sync = JSON.parse(read("sync.webmanifest")), main = JSON.parse(read("manifest.webmanifest"));
const page = read("sync/index.html"), messages = read("messages.html"), app = read("assets/sync-app.js"), pwa = read("assets/pwa.js");
const worker = read("service-worker.js"), settings = read("assets/sync-settings.js"), bump = read("scripts/bump-versions.cjs"), i18n = read("assets/i18n-sync.js");

// One app per scope: SYNC under /sync/, DanzStak at /.
assert.equal(sync.scope, "/sync/"); assert.equal(main.scope, "/"); assert.equal(sync.id, "/sync");
assert.ok(sync.start_url.startsWith(sync.scope) && /app=sync/.test(sync.start_url));
assert.deepEqual(sync.related_applications, [{ platform: "webapp", url: "https://danzstak.com/sync.webmanifest" }], "lets SYNC's page ask whether SYNC is installed");
for (const icon of sync.icons) assert.ok(fs.existsSync(`.${icon.src}`), icon.src);

// /sync/ is generated from messages.html (one source), and must be up to date.
assert.equal(page, build(messages), "sync/index.html is out of date: run node scripts/build-sync-app.cjs");
assert.match(page, /<meta charset="UTF-8">\n<base href="\/">/, "relative links and assets resolve from the site root");
assert.match(page, /base-uri 'self'/); assert.doesNotMatch(page, /base-uri 'none'/);
assert.match(page, /<link rel="manifest" href="\/sync\.webmanifest">/);
assert.match(page, /<link rel="apple-touch-icon" href="assets\/sync-apple-touch-icon\.png\?v=\d+">/);
assert.match(page, /<meta name="apple-mobile-web-app-title" content="SYNC">/);
assert.doesNotMatch(page, /href="#/, "in-page links stay on /sync/ despite the base");
assert.match(messages, /base-uri 'none'/, "messages.html itself keeps base-uri 'none'");
assert.match(bump, /require\("\.\/build-sync-app\.cjs"\)\.write\(\{ dryRun: options\.dryRun \}\)/, "every version bump regenerates /sync/");

// Staying inside /sync/, and the install row.
assert.match(messages, /<script src="assets\/sync-app\.js\?v=\d+" defer><\/script>/); assert.match(messages, /<link rel="stylesheet" href="assets\/sync-app\.css\?v=\d+">/);
assert.match(app, /url\.pathname === "\/messages\.html"\) link\.href = HOME \+ url\.search \+ url\.hash/);
assert.match(read("assets/call-invite.js"), /location\.pathname\.startsWith\("\/sync\/"\) \? "\/sync\/" : "messages\.html"/);
// Sign-up (owner 2026-11-19: "save sync to their device and verify the number … it needs to be easy"): SYNC's own page
// saves the app first, then verifies the number; call-devices.js waits for the install sheet before it opens the number.
assert.match(read("assets/signup-onboarding.js"), /location\.href = `\/sync\/\?\$\{inSyncIcon \? "" : "install=1&"\}device=register`;/);
assert.match(read("assets/call-devices.js"), /if\(wantsRegister&&!state\.registered&&await\(window\.danzstakSyncApp\?\.afterInstall\?\.\(\)\?\?true\)&&!state\.registered\)openPanel\(\{auto:true,incoming:deviceParam==="answer"\}\)/);
assert.match(app, /afterInstall = new Promise\(resolve => \{ closed = \(\) => resolve\(!\(verifyAfter && verifyInApp\)\); \}\);/, "iPhone Safari leaves the number to the SYNC icon");
assert.match(settings, /window\.danzstakSyncApp\.openInstall\(\); else location\.href = "\/sync\/\?install=1";/);
assert.match(app, /if \(!inSyncApp\) \{ location\.href = `\$\{HOME\}\?install=1`; return; \}/, "outside /sync/ the row opens SYNC's own page, where its manifest applies");
for (const state of ["installed-here", "added", "prompt", "known-installed", "other-app", "waiting", "steps"]) assert.ok(app.includes(`"${state}"`) || app.includes(`${state}:`), state);
assert.match(app, /addEventListener\("beforeinstallprompt", event => \{ event\.preventDefault\(\); deferred = event;/);
// Inside the DanzStak app (owner 2026-11-19: "It should just save from the PWA"): an app can't install another app and an
// intent link to Chrome goes nowhere from inside it, so Android saves SYNC from DanzStak's own icon (its SYNC shortcut).
assert.doesNotMatch(app, /intent:\/\/|package=com\.android\.chrome/, "no link to a browser that goes nowhere");
assert.match(app, /isAndroid \? \["Press and hold the DanzStak icon on your home screen\.", "Drag SYNC to an empty spot\."\]/);
assert.ok(JSON.parse(read("manifest.webmanifest")).shortcuts.some(item => item.name === "SYNC" && item.url === "/sync/?app=sync"), "DanzStak's icon carries the SYNC shortcut");
assert.match(app, /if \(standalone\(\) && \(fromSyncIcon \|\| !launchApp\)\)/, "a window opened from a SYNC icon is SYNC");
assert.match(app, /if \(first\) \{ const params = new URLSearchParams\(location\.search\); params\.set\("device", "register"\);/, "the SYNC icon's first open verifies the number");
assert.doesNotMatch(app, /localStorage\.setItem\("danzstak_app_installed"/);

// pwa.js leaves SYNC's install offer alone and does not mark DanzStak installed from the SYNC app.
assert.match(pwa, /const syncAppPage = window\.location\.pathname\.startsWith\("\/sync\/"\);/);
assert.match(pwa, /window\.addEventListener\("beforeinstallprompt", event => \{\n  if \(syncAppPage\) return;/);
assert.match(pwa, /window\.addEventListener\("appinstalled", \(\) => \{\n  if \(syncAppPage\) return;/);
assert.match(pwa, /navigator\.standalone === true\) && !syncAppPage;/);

// Offline and notifications.
for (const file of ["/sync/", "/sync.webmanifest", "/assets/sync-app.js", "/assets/sync-app.css"]) assert.ok(worker.includes(`"${file}"`), `cached: ${file}`);
assert.match(worker, /destinationUrl\.pathname === "\/messages\.html"\) destinationUrl\.pathname = "\/sync\/";/, "SYNC notifications open /sync/");

// T3 (owner 2026-11-19): after device registration, offer SYNC as its own app; never in a call, never twice dismissed.
assert.match(app, /addEventListener\("danzstak:call-device-registered", \(\) => \{ placeVerifiedInstall\(\); setTimeout\(offerApp, 150\); \}\);/);
assert.match(app, /if \(inInstalledSync\(\) \|\| knownInstalled \|\| added \|\| dismissals\(\) >= 2 \|\| inCall\(\) \|\| offer\?\.open \|\| verifyAfter\) return false;/);
assert.match(app, /else location\.href = `\$\{HOME\}\?install=1\$\{resumeSetup \? "&setup=1" : ""\}`;/, "outside /sync/ the offer opens SYNC's own page");
// F16 (owner 2026-11-19): pop-up "Save the SYNC app to your home screen" (Save app / Not now), and "Add SYNC to home screen"
// stays directly under the verified text until SYNC is installed.
assert.match(app, /offer\.querySelector\("h2"\)\.textContent = t\("Save the SYNC app to your home screen"\);/);
assert.match(app, /offer\.querySelector\('\[data-action="install"\]'\)\.textContent = t\("Save app"\);/);
assert.match(app, /const show = Boolean\(status && document\.body\?\.classList\.contains\("sync-device-registered"\) && !inInstalledSync\(\) && !knownInstalled && !added\);/);
assert.match(app, /if \(status\.nextElementSibling !== button\) status\.after\(button\);/, "right under the verified text");
assert.match(read("assets/phone-setup.js"), /await window\.danzstakSyncApp\?\.offerClosed\?\.\(\); open\(\);/, "set up this phone waits for the offer");
for (const key of ["Save the SYNC app to your home screen", "Save app", "Get a SYNC icon on your home screen, straight to your chats.", "Add SYNC to home screen"]) assert.equal(i18n.split(`${JSON.stringify(key)}:`).length - 1, 5, `"${key}" translated`);

// Translations for the sheet.
for (const key of ["SYNC is installed on this phone", "Tap Share.", "Tap Add to Home Screen.", "Tap ⋮ at the top right of Chrome.", "Tap Install app (or Add to Home screen).", "Install SYNC", "Save SYNC to your home screen", "SYNC opens inside DanzStak, straight to your chats.", "Press and hold the DanzStak icon on your home screen.", "Drag SYNC to an empty spot.", "Open SYNC from your home screen to verify your number.", "In Safari's menu bar, choose File → Add to Dock.", "Next: verify your number"]) {
  assert.equal(i18n.split(`${JSON.stringify(key)}:`).length - 1, 5, `"${key}" translated for it, fr, es, de and pt`);
}
console.log("SYNC own-app checks passed: own /sync/ scope, generated /sync/ page up to date, links stay in SYNC, install row states, pwa.js stands aside, cached, notifications open SYNC, translations.");
