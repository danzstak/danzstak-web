"use strict";
// "Set up this phone" (16-B3 starter, owner 2026-11-17): after SMS registration the window closes and a short skippable
// setup opens once per device. Real-browser check: browser-checks/sync-phone-setup.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const setup = fs.readFileSync("assets/phone-setup.js", "utf8");
const css = fs.readFileSync("assets/call-setup.css", "utf8");
const html = fs.readFileSync("messages.html", "utf8");
const worker = fs.readFileSync("service-worker.js", "utf8");
const devices = fs.readFileSync("assets/call-devices.js", "utf8");

assert.match(devices, /const dialog=byId\("callingDevicesDialog"\);if\(dialog\)\{delete dialog\.dataset\.required;if\(dialog\.open\)dialog\.close\(\);\}window\.dispatchEvent\(new CustomEvent\("danzstak:call-device-registered"\)\)/, "registration closes its window on success, then announces it");
assert.match(setup, /window\.addEventListener\("danzstak:call-device-registered", \(\) => setTimeout\(async \(\) => \{ await window\.danzstakSyncApp\?\.offerClosed\?\.\(\); open\(\); \}, 250\)\);/, "setup opens after registration, once the SYNC own-app offer closes (T3)");
assert.match(setup, /if \(dialog\?\.open\) return;/, "never restarts a running setup");
assert.match(setup, /if \(localStorage\.getItem\(DONE_KEY\) === "1"\) return;/, "once per device");
assert.match(setup, /if \(window\.danzstakCallSetup\?\.isComputer\) list\.push\(\{ id: "audio"/, "audio check step only on computers");
assert.match(setup, /url\.searchParams\.set\("messageMember", memberId\);/, "the invite link is the member's SYNC link");
assert.doesNotMatch(setup, /phone(Number|number)|maskedNumber|tel:/, "the share step never touches a phone number");
assert.match(css, /\.phone-setup-dialog button\[hidden\]\{display:none!important\}/);
assert.match(css, /@media\(max-width:560px\)\{\.phone-setup-dialog\{inset:auto 0 0 0;/, "bottom sheet on phones");
assert.match(html, /<script src="assets\/phone-setup\.js\?v=\d+" defer><\/script>/);
assert.ok(worker.includes('"/assets/phone-setup.js"'));
console.log("Set up this phone checks passed: closes registration, once per device, computer-only audio step, invite link without a number, bottom sheet.");
