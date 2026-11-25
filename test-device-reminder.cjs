"use strict";
// Owner 2026-11-19: members who skip SYNC verification get a "verify this device" notification. The browser behaviour is
// checked in browser-checks/device-reminder.cjs; this guards the wiring: no network or data leaves the page, the words are
// translated, Mix loads it before the notifications code, and the offline shell caches it.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const source = fs.readFileSync("assets/device-reminder.js", "utf8"), feed = fs.readFileSync("assets/feed-enhancements.js", "utf8"), html = fs.readFileSync("feed.html", "utf8");
assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|sendBeacon/, "reads only this browser's own SYNC credential");
assert.match(source, /indexedDB\.open\(DB_NAME, 1\)/, "the same database call-devices.js keeps the credential in");
assert.match(source, /open: \{ href: "\/sync\/\?device=register" \}/, "the whole row opens SYNC's verification");
assert.ok(html.indexOf("assets/device-reminder.js?v=") > 0 && html.indexOf("assets/device-reminder.js?v=") < html.indexOf("assets/feed-enhancements.js?v="), "Mix loads it before the notifications code");
assert.match(feed, /if \(reminderNeeded\) \{ rows\.push\(reminder\.row\(\)\); reminder\.markSeen\(\); \}/, "shown first in Notifications");
assert.match(feed, /notificationSourceCounts\.device = reminder && await reminder\.needed\(\)\.catch\(\(\) => false\) && reminder\.unread\(\) \? 1 : 0;/, "counted on the bell until seen");
assert.ok(fs.readFileSync("service-worker.js", "utf8").includes('"/assets/device-reminder.js"'), "cached offline");
const people = fs.readFileSync("assets/i18n-people.js", "utf8");
assert.match(source, /ds\.href = "\/sync\/\?device=register&ds=1";/, "the DS number offer opens SYNC's device panel at the DS number");
assert.match(fs.readFileSync("assets/sync-network-number.js", "utf8"), /if \(wantsNumber && !buy\.hidden\) \{ wantsNumber = false; buy\.scrollIntoView/, "SYNC shows the DS number button when arriving from the offer");
for (const key of ["Verify this device for SYNC calls", "Calls and voice messages need it. Texting already works.", "No phone number? Get a DS number"]) {
  assert.ok(source.includes(`t(${JSON.stringify(key)})`), `shows "${key}"`);
  assert.equal(people.split(`${JSON.stringify(key)}:`).length - 1, 3, `"${key}" translated for it, fr and es`);
}
console.log("Device reminder checks passed: no network, one row opening SYNC's verification, counted until seen, loaded before notifications, cached offline, translated.");
