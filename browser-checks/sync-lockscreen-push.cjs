"use strict";
// Task 16-F lock-screen push, real Edge with the real service worker. A push can't come from a real push service here, so
// the check dispatches the same PushEvent / NotificationEvent the browser would, inside the worker:
// - a call push shows a sticky notification with Accept and Decline; Decline POSTs /calls/decline with that callId,
//   without opening a window, and closes the notification;
// - a booking-reply push opens SYNC on that booking thread (/sync/?section=bookings&outreach=<id>);
// - a message push opens that exact chat (/sync/?member=<id>; task 34: SYNC notifications open SYNC's own address, so
//   the installed SYNC app takes them when there is one).
// Phones at 360 and 390 (screenshots of where each tap lands). Run: DANZSTAK_BASE_URL=http://127.0.0.1:8153 node browser-checks/sync-lockscreen-push.cjs
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1"; // let context.route see the worker's own fetches
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8153").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-lockscreen-push");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const CALL = "33333333-3333-4333-8333-333333333333", OUTREACH = "outreach_ABCDEFGHIJKLMNOP", MEMBER = "44444444-4444-4444-8444-444444444444";
async function settled(page, read) { for (let i = 0; i < 6; i++) { await page.waitForLoadState("domcontentloaded").catch(() => {}); await page.waitForTimeout(800); try { return await page.evaluate(read); } catch {} } return null; }
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch {} }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch(channel && channel !== "bundled" ? { channel, headless: true } : { headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "allow", hasTouch: true, isMobile: true, deviceScaleFactor: 2, permissions: ["notifications"] });
      const declines = [];
      await context.route("https://api.danzstak.com/**", route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        const cors = { "access-control-allow-origin": baseUrl, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "POST, OPTIONS" };
        if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
        if (p === "/calls/decline") { declines.push(request.postDataJSON?.() || JSON.parse(request.postData() || "{}")); return route.fulfill({ ...json({ declined: true }, 202), headers: { "access-control-allow-origin": baseUrl, "access-control-allow-credentials": "true" } }); }
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.test" } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: "sfscoop@danzstak.test", memberId: MEMBER, name: "SFScoop", preview: "yo", updatedAt: new Date().toISOString(), canContact: true, unread: 1 }] }));
        if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ messages: [{ messageId: "m1", senderEmail: "sfscoop@danzstak.test", recipientEmail: "me@danzstak.test", content: "Soundcheck at 5?", createdAt: new Date().toISOString(), read: true }], canContact: true }));
        if (p === "/friends") return route.fulfill(json({ friends: [{ email: "sfscoop@danzstak.test", memberId: MEMBER, name: "SFScoop", status: "friends" }] }));
        if (p === "/calls/directory") return route.fulfill(json({ users: [{ email: "sfscoop@danzstak.test", memberId: MEMBER, name: "SFScoop", online: true }] }));
        if (p === "/calls/devices") return route.fulfill(json({ devices: [] }));
        if (p === "/calls/inbox") return route.fulfill(json({ events: [] }));
        return route.fulfill(json({}));
      });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      // The PWA reloads once when the worker takes control; wait that out, then confirm the worker is ready.
      let ready = "";
      for (let attempt = 0; attempt < 4 && ready !== true; attempt++) {
        ready = await page.evaluate(async () => { try { await navigator.serviceWorker.register("/service-worker.js"); await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller || "no controller yet"; } catch (error) { return String(error); } }).catch(error => String(error.message || error));
        if (ready !== true) { await page.waitForLoadState("domcontentloaded").catch(() => {}); await page.waitForTimeout(1500); }
      }
      if (ready !== true) { failures.push(`${label}: service worker did not start (${ready})`); await context.close(); continue; }
      let worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker", { timeout: 10000 }).catch(() => null);
      if (!worker) { failures.push(`${label}: no service worker`); await context.close(); continue; }
      const live = async () => { const all = context.serviceWorkers(); return all[all.length - 1] || await context.waitForEvent("serviceworker", { timeout: 10000 }); };
      const push = async payload => (await live()).evaluate(async data => { const event = new PushEvent("push", { data: JSON.stringify(data) }); const waits = []; event.waitUntil = p => waits.push(p); self.dispatchEvent(event); await Promise.race([Promise.all(waits), new Promise(resolve => setTimeout(resolve, 1500))]); /* a call keeps ringing for 25 s: read it while it rings */ return (await self.registration.getNotifications()).map(n => ({ title: n.title, tag: n.tag, requireInteraction: n.requireInteraction, actions: (n.actions || []).map(a => a.action + ":" + a.title), data: n.data })); }, payload);
      const click = async (tag, action = "") => (await live()).evaluate(async ({ tag, action }) => { // A synthetic tap has no user activation, so focus() is stubbed and the window the worker would open/navigate to is recorded.
        if (!self.__focusStub) { self.__focusStub = true; WindowClient.prototype.focus = async function () { return this; }; const navigate = WindowClient.prototype.navigate; WindowClient.prototype.navigate = function (url) { self.__destination = url; return navigate.call(this, url); }; self.clients.openWindow = async url => { self.__destination = url; return null; }; }
        self.__destination = "";
        const [notification] = await self.registration.getNotifications({ tag }); if (!notification) return { left: -1, destination: "" }; const event = new NotificationEvent("notificationclick", { notification, action }); const waits = []; event.waitUntil = p => waits.push(p); self.dispatchEvent(event); await Promise.all(waits.map(p => p.catch?.(e => String(e)))); return { left: (await self.registration.getNotifications({ tag })).length, destination: self.__destination }; }, { tag, action });

      // 1. Call: Accept + Decline, sticky; Decline → server, no window.
      const shown = await push({ type: "call", title: "Incoming DanzStak call", body: "SFScoop is calling by video.", tag: `call-${CALL}`, url: `/messages.html?member=${MEMBER}`, answerTitle: "Accept", declineTitle: "Decline", dismissTitle: "Dismiss" });
      const call = shown.find(n => n.tag === `call-${CALL}`);
      if (!call) failures.push(`${label}: call notification not shown`);
      else {
        if (call.actions.join("|") !== "answer:🟢 Accept|decline:🔴 Decline") failures.push(`${label}: call actions are ${call.actions.join("|")}`);
        if (!call.requireInteraction) failures.push(`${label}: the call notification is not sticky`);
      }
      const pagesBefore = context.pages().length;
      const { left, destination: declineDestination } = await click(`call-${CALL}`, "decline");
      await new Promise(r => setTimeout(r, 400));
      if (declineDestination) failures.push(`${label}: Decline tried to open ${declineDestination}`);
      if (left !== 0) failures.push(`${label}: Decline did not close the notification (${left})`);
      if (declines.length !== 1 || declines[0].callId !== CALL) failures.push(`${label}: Decline did not reach /calls/decline (${JSON.stringify(declines)})`);
      if (context.pages().length !== pagesBefore) failures.push(`${label}: Decline opened a window`);
      // 2. Booking reply → the booking thread.
      await push({ type: "booking", title: "Club Lux answered your pitch", body: "We have the 14th open", tag: `booking-${OUTREACH}`, url: `/messages.html?section=bookings&outreach=${OUTREACH}` });
      const bookingTap = await click(`booking-${OUTREACH}`);
      if (!String(bookingTap.destination).endsWith(`/sync/?section=bookings&outreach=${OUTREACH}`)) failures.push(`${label}: booking tap goes to "${bookingTap.destination}"`);
      if (bookingTap.destination) await page.goto(bookingTap.destination, { waitUntil: "domcontentloaded" });
      const booking = await settled(page, () => ({ url: location.href, section: document.body.dataset.syncScreen || document.querySelector(".chat-filters .active")?.dataset.chatFilter || "" })) || {};
      if (!/bookings/.test(booking.section)) failures.push(`${label}: booking push did not open the bookings section (${JSON.stringify(booking)})`);
      await shot(page, `1-booking-tap-${width}`);
      // 3. Message → that chat.
      await push({ type: "message", title: "New DanzStak message", body: "SFScoop sent you a message.", tag: "message-abc", url: `/messages.html?member=${MEMBER}` });
      const messageTap = await click("message-abc");
      if (!String(messageTap.destination).endsWith(`/sync/?member=${MEMBER}`)) failures.push(`${label}: message tap goes to "${messageTap.destination}"`);
      if (messageTap.destination) await page.goto(messageTap.destination, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(800);
      const chat = await settled(page, () => ({ url: location.href, open: document.body.classList.contains("is-conversation-open"), name: document.getElementById("conversationName")?.textContent || "" })) || {};
      if (!(chat.open && /SFScoop/.test(chat.name))) failures.push(`${label}: message push did not open that chat (${JSON.stringify(chat)})`);
      await shot(page, `2-message-tap-${width}`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`SYNC lock-screen push: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("SYNC lock-screen push checks passed (360, 390): call notification with Accept/Decline, Decline reaches the server without opening a window, booking reply opens the booking thread, message opens the chat.");
})().catch(error => { console.error(error); process.exitCode = 1; });
