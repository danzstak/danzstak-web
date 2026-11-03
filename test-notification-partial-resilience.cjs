"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("assets/feed-enhancements.js", "utf8");
const helperStart = source.indexOf("async function readArrayResponse(");
const helperEnd = source.indexOf("\nasync function refreshNotificationCount", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "the bounded notification response reader must exist");
const context = vm.createContext({ Array });
vm.runInContext(source.slice(helperStart, helperEnd), context);

(async () => {
  const missing = await context.readArrayResponse(null, "notifications");
  assert.deepEqual(JSON.parse(JSON.stringify(missing)), { available: false, items: [] });

  const invalid = await context.readArrayResponse({ ok: true, json: async () => { throw new Error("bad JSON"); } }, "notifications");
  assert.deepEqual(JSON.parse(JSON.stringify(invalid)), { available: false, items: [] },
    "malformed optional data must not collapse notifications from a healthy source");

  const healthy = await context.readArrayResponse({ ok: true, json: async () => ({ notifications: [{ type: "message" }] }) }, "notifications");
  assert.equal(healthy.available, true);
  assert.equal(healthy.items.length, 1);

  const wrongShape = await context.readArrayResponse({ ok: true, json: async () => ({ notifications: {} }) }, "notifications");
  assert.equal(wrongShape.available, true);
  assert.equal(wrongShape.items.length, 0, "a healthy empty response should remain distinct from an unavailable source");

  const block = source.slice(source.indexOf('if (name === "Notifications")'), source.indexOf('if (name === "Friends")'));
  assert.match(block, /if \(!socialSource\.available && !engagementSource\.available\) throw new Error/,
    "the drawer should fail only when both primary notification sources are unavailable");
  assert.match(block, /const notificationSourcesComplete = socialSource\.available && engagementSource\.available/);
  assert.match(block, /Some notifications are temporarily unavailable\.[\s\S]*Retry notifications/,
    "partial notification results need an honest warning and retry action");
  assert.match(block, /const directory = directorySource\.items;[\s\S]*const friends = friendsSource\.items;/,
    "optional profile enrichment failures must preserve valid notifications");
  assert.doesNotMatch(block, /directoryResponse\?\.ok \? \(await directoryResponse\.json\(\)\)/,
    "optional directory JSON must not be allowed to collapse the drawer");

  console.log("Notification partial-resilience checks passed: healthy sources remain visible and unavailable sources are disclosed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
