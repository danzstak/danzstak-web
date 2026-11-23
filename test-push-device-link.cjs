"use strict";
// Owner 2026-11-19: "it's not ringing the device". Call pushes only go to subscriptions linked to a registered
// SYNC device. A subscription saved before the device registered stayed unlinked for the whole session, so the
// phone never rang with SYNC closed. The subscription must re-link as soon as the device is registered.
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const source = fs.readFileSync("assets/push-notifications.js", "utf8");

async function run() {
  const listeners = {}, posts = [], store = {};
  let linked = false;
  const context = {
    console, setTimeout: (fn, ms) => (ms === 2000 ? fn() : 0), clearTimeout() {}, AbortController, URLSearchParams,
    location: { search: "" }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    sessionStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
    Notification: { permission: "granted" }, PushManager: function () {},
    navigator: { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: async () => ({ toJSON: () => ({ endpoint: "https://fcm.googleapis.com/x", keys: { p256dh: "p", auth: "a" } }) }) } }) } },
    document: { addEventListener() {}, body: { classList: { contains: () => false } }, querySelector: () => null, getElementById: () => null },
    fetch: async (url, options) => { if (options?.method === "POST") posts.push(url); return { ok: true, json: async () => ({ subscribed: true, callingDeviceLinked: linked }) }; },
    addEventListener: (type, fn) => { (listeners[type] ||= []).push(fn); },
    dispatchEvent: () => true
  };
  context.window = context; context.globalThis = context;
  vm.createContext(context); vm.runInContext(source, context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(posts.length, 1, "the existing subscription syncs once on page load");
  assert.equal(store.danzstak_push_synced, "1", "not linked yet: the device is not registered");

  // The device finishes SYNC registration in this same session.
  linked = true;
  for (const fn of listeners["danzstak:call-device-ready"] || []) fn({ detail: { registered: true } });
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(posts.length, 2, "registering the device re-links the push subscription so calls ring with SYNC closed");
  assert.equal(store.danzstak_push_synced, "linked");

  for (const fn of listeners["danzstak:call-device-ready"] || []) fn({ detail: { registered: true } });
  for (let i = 0; i < 5; i++) await settle();
  assert.equal(posts.length, 2, "once linked, it is not re-sent on every page event");

  for (const fn of listeners["danzstak:call-device-ready"] || []) fn({ detail: { registered: false } });
  assert.equal(posts.length, 2, "an unregistered device does not force a re-link");
}

run().then(() => console.log("Push device link checks passed: a subscription re-links as soon as the device registers, so calls ring with SYNC closed."))
  .catch(error => { console.error(error); process.exit(1); });
