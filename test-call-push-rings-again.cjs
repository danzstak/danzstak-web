"use strict";
// Owner 2026-11-19 (screenshot of the call notification): "still not ringing". A web push plays the phone's notification
// sound once. While the call is still waiting, the service worker shows the call notification again (renotify) every few
// seconds so the phone sounds and vibrates again; it stops as soon as the notification is gone (answered, declined,
// dismissed, or closed by the call-resolved push). Quiet hours and non-call pushes never repeat.
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const source = fs.readFileSync("service-worker.js", "utf8");
async function run(payload, openFor) {
  const handlers = {}, shown = [], waits = [];
  let checks = 0;
  const worker = {
    location: { origin: "https://danzstak.com" }, addEventListener: (name, fn) => { handlers[name] = fn; },
    registration: { showNotification: async (title, options) => { shown.push(options); }, getNotifications: async () => (++checks <= openFor ? [{}] : []) },
    clients: { matchAll: async () => [] }
  };
  vm.runInNewContext(source, { self: worker, URL, setTimeout: (fn, ms) => { waits.push(ms); fn(); } });
  let pending;
  handlers.push({ data: { json: () => payload }, waitUntil: value => { pending = value; } });
  await pending;
  return { shown, waits };
}
(async () => {
  const call = { type: "call", tag: "call-11111111-1111-4111-8111-111111111111", title: "Incoming DanzStak call", body: "x" };
  let r = await run(call, 99);
  assert.equal(r.shown.length, 7, "an unanswered call rings 7 times (first + 6 repeats)");
  assert.ok(r.waits.every(ms => ms === 4000), "repeats every 4 seconds (about 25 s in all)");
  assert.ok(r.shown.every(o => o.renotify === true && o.requireInteraction === true && o.vibrate.length === 5));
  r = await run(call, 2);
  assert.equal(r.shown.length, 3, "stops as soon as the call notification is gone (answered, declined or ended)");
  r = await run({ ...call, silent: true }, 99);
  assert.equal(r.shown.length, 1, "quiet hours: shown once, silently, never repeated");
  r = await run({ type: "message", tag: "message-a", title: "m", body: "b" }, 99);
  assert.equal(r.shown.length, 1, "messages never repeat");
  console.log("Call push ring checks passed: a waiting call rings again every 4 s until answered, declined or ended; quiet hours and messages never repeat.");
})().catch(error => { console.error(error); process.exit(1); });
