"use strict";
// L4 (owner 2026-11-20: "When app is closed it doesn't ring. Only rings when on sync"). With every DanzStak page closed,
// a call push must still reach this browser's service worker and show the call with Accept and Decline. When the caller
// hangs up, the ring stops.
//
// Owner 2026-11-24: "notification for incoming calls stay on top even after answering". Two more cases, each with its own call:
//   6. the call is answered in the app before its push arrives (the app's own inbox check can win the race): the late push
//      must not put the call up again;
//   7. the call is answered on a page the service worker doesn't control (after a hard reload): the notification closes and
//      the worker's re-ring (every 4 s) doesn't bring it back.
//
// The push is delivered the way the browser's push service does it (DevTools ServiceWorker.deliverPushMessage), with no
// DanzStak page open, so the worker wakes up on its own. The payload is built by call-signaling's own localizedPush, in
// Italian (the Bologna and Italy testers), exactly as notifyCall sends it. Which subscriptions get a call push is covered
// by test-push-link-server.cjs (a subscription saved right after registration is a call target).
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/call-push-closed.cjs
// (Edge by default; DANZSTAK_BROWSER_CHANNEL=chromium for full Chromium. The headless shell has no notifications.)
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const origin = new URL(baseUrl).origin;
const CALL = "66666666-6666-4666-8666-666666666666", CALLER = "77777777-7777-4777-8777-777777777777", ME = "11111111-1111-4111-8111-111111111111";

// call-signaling's push copy, from the template itself.
function serverPushCopy() {
  const lines = fs.readFileSync("infrastructure/call-signaling/template.yaml", "utf8").split(/\r?\n/);
  const start = lines.findIndex(line => line === "        ZipFile: |");
  const source = [];
  for (const line of lines.slice(start + 1)) { if (!line.startsWith("          ")) break; source.push(line.slice(10)); }
  const command = name => class { constructor(input) { this.input = input; this.commandName = name; } };
  class Unused { async send() { throw new Error("not used"); } }
  const sdk = names => Object.fromEntries(names.map(name => [name, command(name)]));
  const fakeRequire = id => {
    if (id === "node:crypto" || id === "node:https") return require(id);
    if (id === "@aws-sdk/client-dynamodb") return { DynamoDBClient: Unused, ...sdk(["GetItemCommand", "PutItemCommand", "QueryCommand", "DeleteItemCommand", "ScanCommand", "UpdateItemCommand", "TransactWriteItemsCommand"]) };
    if (id === "@aws-sdk/client-cognito-identity-provider") return { CognitoIdentityProviderClient: Unused, ...sdk(["ListUsersCommand"]) };
    if (id === "@aws-sdk/client-kms") return { KMSClient: Unused, ...sdk(["GetPublicKeyCommand", "SignCommand"]) };
    if (id === "@aws-sdk/client-s3") return { S3Client: Unused, ...sdk(["GetObjectCommand", "PutObjectCommand", "DeleteObjectCommand"]) };
    if (id === "@aws-sdk/s3-request-presigner") return { getSignedUrl: async () => "" };
    throw new Error(`Unexpected module: ${id}`);
  };
  const shim = { exports: {} };
  new Function("require", "module", "exports", "process", "Buffer", "URL", "console", `${source.join("\n")}\nmodule.exports.__test={localizedPush};`)(fakeRequire, shim, shim.exports, { env: {} }, Buffer, URL, console);
  return shim.exports.__test.localizedPush;
}

(async () => {
  const localizedPush = serverPushCopy();
  const copy = localizedPush("it", "call", "Tour Friend", "video");
  // notifyCall's payload (call-signaling): {type:'call',...copy,tag:`call-${callId}`,url,silent}.
  const callPush = { type: "call", ...copy, tag: `call-${CALL}`, url: `/messages.html?member=${CALLER}`, silent: false };
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "allow" });
    // The member allowed notifications (Chromium's headless shell can't show them at all; Edge and full Chromium can).
    await context.grantPermissions(["notifications"], { origin });
    await context.route("https://api.danzstak.com/**", route => {
      const p = new URL(route.request().url()).pathname;
      const reply = body => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-danzstak-device-id,x-danzstak-device-token", "access-control-allow-methods": "GET,POST,OPTIONS" }, body: "" });
      if (p === "/auth/session") return reply({ authenticated: true, user: { sub: ME, email: "closed@danzstak.invalid" } });
      if (p === "/calls/inbox") return reply({ events: [] });
      if (p === "/conversations") return reply({ conversations: [] });
      return reply({});
    });

    // 1. DanzStak is opened once, so its service worker is installed (what the installed app does on first launch).
    const app = await context.newPage();
    await app.goto(`${baseUrl}/privacy.html`, { waitUntil: "load" });
    const installed = await app.evaluate(async () => { const registration = await navigator.serviceWorker.register("/service-worker.js"); await navigator.serviceWorker.ready; return registration.scope; });
    assert.equal(installed, `${origin}/`, "the service worker covers the whole app");

    // 2. Every DanzStak page closes. DevTools stays attached to a blank tab, which stands in for the browser's push service.
    const blank = await context.newPage();
    await blank.goto("about:blank");
    const cdp = await context.newCDPSession(blank);
    const registrations = [];
    cdp.on("ServiceWorker.workerRegistrationUpdated", event => registrations.push(...event.registrations));
    await cdp.send("ServiceWorker.enable");
    await app.close();
    assert.deepEqual(context.pages().map(page => page.url()), ["about:blank"], "no DanzStak page is open");
    for (let i = 0; i < 20 && !registrations.some(item => item.scopeURL === `${origin}/` && !item.isDeleted); i++) await blank.waitForTimeout(250);
    const registration = registrations.find(item => item.scopeURL === `${origin}/` && !item.isDeleted);
    assert.ok(registration, "the app's service worker registration is known to the browser");

    const latestWorker = async () => { const all = context.serviceWorkers(); return all[all.length - 1] || await context.waitForEvent("serviceworker", { timeout: 10000 }); };
    const shown = async () => (await latestWorker()).evaluate(async tag => (await self.registration.getNotifications({ tag })).map(n => ({ title: n.title, body: n.body, tag: n.tag, requireInteraction: n.requireInteraction, actions: n.actions.map(a => ({ action: a.action, title: a.title })), data: n.data })), callPush.tag);
    const waitFor = async (test, label) => { let last; for (let i = 0; i < 40; i++) { try { last = await shown(); if (test(last)) return last; } catch { /* the worker is starting */ } await blank.waitForTimeout(250); } assert.fail(`${label}: ${JSON.stringify(last)}`); };

    // 3. A call comes in while the app is closed: the push wakes the worker and the call shows with Accept and Decline.
    await cdp.send("ServiceWorker.deliverPushMessage", { origin, registrationId: registration.registrationId, data: JSON.stringify(callPush) });
    const [call] = await waitFor(list => list.length === 1, "the call notification shows with every page closed");
    assert.equal(call.title, copy.title, "the server's own title, in the member's language");
    assert.equal(call.body, copy.body);
    assert.ok(/Tour Friend/.test(call.body), "says who is calling");
    assert.equal(call.requireInteraction, true, "stays until answered or declined");
    assert.deepEqual(call.actions, [{ action: "answer", title: copy.answerTitle }, { action: "decline", title: copy.declineTitle }], "Accept and Decline, as the server names them");
    assert.equal(call.data.callId, CALL, "Accept and Decline know which call");
    assert.equal(call.data.url, `/messages.html?member=${CALLER}`, "Accept opens SYNC on the caller's chat");
    assert.deepEqual(context.pages().map(page => page.url()), ["about:blank"], "the ring didn't need any page");

    // 4. Still ringing a few seconds later (the worker re-shows it every 4 s for 25 s)...
    await blank.waitForTimeout(4500);
    assert.equal((await shown()).length, 1, "the call keeps ringing while nobody answers");

    // 5. ...until the caller hangs up: call-signaling's cancel push closes it, and the ring stops.
    await cdp.send("ServiceWorker.deliverPushMessage", { origin, registrationId: registration.registrationId, data: JSON.stringify({ type: "call-resolved", tag: callPush.tag, callId: CALL, reason: "cancelled" }) });
    await waitFor(list => list.length === 0, "the caller hung up: the call notification closes");
    await blank.waitForTimeout(4500);
    assert.equal((await shown()).length, 0, "and it doesn't ring again");

    // 6. Answered in the app first, push afterwards: the notification never shows.
    const pushFor = callId => JSON.stringify({ ...callPush, tag: `call-${callId}` });
    const count = async tag => (await latestWorker()).evaluate(async tag => (await self.registration.getNotifications({ tag })).length, tag);
    const LATE = "88888888-8888-4888-8888-888888888888", HARD = "99999999-9999-4999-8999-999999999999";
    const sync = await context.newPage();
    await sync.goto(`${baseUrl}/privacy.html`, { waitUntil: "load" });
    await sync.addScriptTag({ url: "/assets/call-ringer.js" });
    assert.equal(await sync.evaluate(() => Boolean(navigator.serviceWorker.controller)), true, "an ordinary page is controlled");
    await sync.evaluate(id => window.danzstakCallRinger.handled(id), LATE);
    await sync.waitForTimeout(500);
    await cdp.send("ServiceWorker.deliverPushMessage", { origin, registrationId: registration.registrationId, data: pushFor(LATE) });
    await blank.waitForTimeout(1500);
    assert.equal(await count(`call-${LATE}`), 0, "a call answered in the app before its push arrived doesn't come back as a notification");

    // 7. A page the worker doesn't control answers: its notification closes, and the re-ring doesn't bring it back.
    await cdp.send("ServiceWorker.deliverPushMessage", { origin, registrationId: registration.registrationId, data: pushFor(HARD) });
    for (let i = 0; i < 40 && await count(`call-${HARD}`).catch(() => 0) !== 1; i++) await blank.waitForTimeout(250);
    assert.equal(await count(`call-${HARD}`), 1, "the second call rings");
    const hard = await context.newPage();
    await hard.goto(`${baseUrl}/privacy.html`, { waitUntil: "load" });
    const hardCdp = await context.newCDPSession(hard);
    await hardCdp.send("Page.enable");
    await Promise.all([hard.waitForEvent("load"), hardCdp.send("Page.reload", { ignoreCache: true })]);
    assert.equal(await hard.evaluate(() => navigator.serviceWorker.controller), null, "a hard reload leaves the page outside the worker");
    await hard.addScriptTag({ url: "/assets/call-ringer.js" });
    await hard.evaluate(id => window.danzstakCallRinger.handled(id), HARD);
    for (let i = 0; i < 20 && await count(`call-${HARD}`) !== 0; i++) await blank.waitForTimeout(250);
    assert.equal(await count(`call-${HARD}`), 0, "answering on a page the worker doesn't control closes the call notification");
    await blank.waitForTimeout(4500);
    assert.equal(await count(`call-${HARD}`), 0, "and the worker's re-ring doesn't bring it back");
    await context.close();
  } finally { await browser.close(); }
  console.log("Closed-app call push checks passed: with every DanzStak page closed, a call push wakes the service worker and shows the caller with Accept and Decline in the member's language, it keeps ringing, and the caller's hang-up stops it; a call answered in the app stays closed when its push arrives late, and answering on a page outside the worker closes it for good.");
})().catch(error => { console.error(error); process.exit(1); });
