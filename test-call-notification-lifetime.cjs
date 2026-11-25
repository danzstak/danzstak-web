"use strict";
// Owner 2026-11-25 (screenshot: "Incoming DanzStak call · Sam is calling by video" still on the lock screen 18 minutes
// after the call): "The calling notification needs to go away after answering the phone". The service worker's ring loop
// (ringCallNotification) now closes the call notification once a call can't be ringing any more, even when the push that
// says "answered" never arrived. Runs the real function from service-worker.js with a fake clock and registration.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const worker = fs.readFileSync("service-worker.js", "utf8");
const source = worker.match(/const CALL_RING_REPEATS[\s\S]*?\r?\nasync function ringCallNotification[\s\S]*?\r?\n\}\r?\n/)[0];

async function run({ handledAfterMs = Infinity, closedByTapAfterMs = Infinity } = {}) {
  let now = 0;
  const shown = [], open = new Map();
  const registration = {
    async showNotification(title, options) { shown.push({ at: now, renotify: Boolean(options.renotify) }); open.set(options.tag, { close() { open.delete(options.tag); } }); },
    async getNotifications({ tag }) { if (now >= closedByTapAfterMs) open.delete(tag); return open.has(tag) ? [open.get(tag)] : []; }
  };
  const setTimeout = (fn, ms) => { now += ms; Promise.resolve().then(fn); };
  const callWasHandled = async () => now >= handledAfterMs;
  const ring = new Function("self", "setTimeout", "callWasHandled", "Date", `${source}; return ringCallNotification;`)({ registration }, setTimeout, callWasHandled, { now: () => now });
  await ring("Incoming DanzStak call", { tag: "call-1", data: { callId: "1" } });
  return { shown, stillOpen: open.size > 0, endedAt: now };
}

(async () => {
  // Nobody tells this phone the call was answered: it rings for 25 s, then the notification goes by 60 s.
  let result = await run();
  assert.equal(result.shown.length, 7, "rings: first show + 6 re-rings");
  assert.equal(result.stillOpen, false, "the call notification never stays on the lock screen");
  assert.ok(result.endedAt <= 60000, `gone within a minute (${result.endedAt} ms)`);
  // Answered on this phone after 10 s (the page marks it handled): it closes then, and doesn't ring again.
  result = await run({ handledAfterMs: 10000 });
  assert.equal(result.stillOpen, false);
  assert.ok(result.endedAt <= 12000, "closes as soon as it was answered");
  // Tapped (Accept on the notification): no more rings.
  result = await run({ closedByTapAfterMs: 6000 });
  assert.equal(result.stillOpen, false);
  assert.equal(result.shown.length, 2);
  console.log("Call notification lifetime checks passed: an unanswered or lost-answer call notification is gone within a minute, an answered call closes at once, a tapped one stops ringing.");
})().catch(error => { console.error(error); process.exitCode = 1; });
