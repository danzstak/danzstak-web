"use strict";
// Owner 2026-11-24: "when on the text screen of danzstak … user hits the back button on their phone it exits out it
// should go to the mix". SYNC opened as the first page of the installed DanzStak app (a message notification, the
// icon's SYNC shortcut) had nothing behind it, so the phone's Back closed the app. Now Back closes an open chat first,
// then goes to Mix; it never cuts a call off; SYNC's own app and a SYNC reached from Mix keep their normal Back.
// The installed app is stood in for (display-mode standalone), and the phone's Back reaches the page the way Chrome
// delivers it to a CloseWatcher (Esc in a desktop browser). API mocked. 360 and 390px, centre taps.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/sync-back-to-mix.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const MIX = /\/feed\.html\?view=feed$/;

async function open(browser, width, { installed = true, syncApp = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 780 }, serviceWorkers: "block", hasTouch: true, isMobile: width < 700 });
  await context.addInitScript(({ installed, syncApp }) => {
    if (installed) {
      const real = window.matchMedia.bind(window);
      window.matchMedia = query => /display-mode:\s*standalone/.test(query)
        ? { matches: true, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }
        : real(query);
    }
    // The phone answers whether SYNC's own app is installed.
    navigator.getInstalledRelatedApps = async () => syncApp ? [{ platform: "webapp", url: `${location.origin}/sync.webmanifest` }] : [];
    try {
      localStorage.setItem("danzstak_sync_first_run", "1"); // SYNC opened on this phone before (no "verify your number" sheet)
      if (syncApp) localStorage.setItem("danzstak_sync_app_installed", "1");
    } catch {}
  }, { installed, syncApp });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "me@x.test", sub: "33333333-3333-4333-8333-333333333333" } }));
    if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: "adam@x.test", memberId: "44444444-4444-4444-8444-444444444444", name: "Adam3", preview: "hi", updatedAt: new Date().toISOString(), canContact: true }] }));
    if (p === "/messages") return route.fulfill(json({ messages: [], canContact: true }));
    if (p === "/calls/devices") return route.fulfill(json({ accountTag: "c".repeat(32), currentDeviceRegistered: true, devices: [] }));
    return route.fulfill(json({}));
  });
  return { context, page, errors };
}

// The phone's Back button, as Chrome hands it to the page.
async function back(page) {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
}

async function tapCentre(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const onTop = await locator.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), { x, y });
  assert.ok(onTop, "something covers the centre of the chat row");
  await page.touchscreen.tap(x, y);
}

(async () => {
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch(channel && channel !== "bundled" ? { channel, headless: true } : { headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      // 1. A message notification opened SYNC as the app's first page: Back goes to Mix, not out of the app.
      for (const first of ["/sync/", "/messages.html"]) {
        const { context, page, errors } = await open(browser, width);
        await page.goto(base + first, { waitUntil: "domcontentloaded" });
        await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
        await back(page);
        if (!MIX.test(page.url())) failures.push(`${width}px ${first} first: Back stayed on ${page.url()} (on a phone the app closes) instead of Mix`);
        if (errors.length) failures.push(`${width}px ${first} first: page errors ${errors.join(" | ")}`);
        await context.close();
      }

      // 2. A chat open (tapped, or opened by the notification): Back closes it first, then goes to Mix.
      for (const first of ["/sync/", "/sync/?contact=adam%40x.test"]) {
        const { context, page } = await open(browser, width);
        await page.goto(base + first, { waitUntil: "domcontentloaded" });
        await page.locator(".conversation-user").first().waitFor({ state: "attached", timeout: 15000 });
        if (!first.includes("contact=")) { await page.waitForTimeout(300); await tapCentre(page, page.locator(".conversation-user").first()); }
        await page.waitForFunction(() => document.body.classList.contains("is-conversation-open"), null, { timeout: 8000 }).catch(() => {});
        if (!await page.evaluate(() => document.body.classList.contains("is-conversation-open"))) { failures.push(`${width}px ${first}: the chat didn't open`); await context.close(); continue; }
        await back(page);
        const chatClosed = await page.evaluate(() => !document.body.classList.contains("is-conversation-open"));
        if (!chatClosed || MIX.test(page.url())) failures.push(`${width}px ${first}: the first Back should close the chat and stay in SYNC (chat closed ${chatClosed}, ${page.url()})`);
        await back(page);
        if (!MIX.test(page.url())) failures.push(`${width}px ${first}: the second Back should reach Mix, got ${page.url()}`);
        await context.close();
      }

      // 3. During a call Back never leaves SYNC (leaving would hang up).
      {
        const { context, page } = await open(browser, width);
        await page.goto(base + "/sync/", { waitUntil: "domcontentloaded" });
        await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
        await page.evaluate(() => { document.body.dataset.callMode = "phone"; });
        await back(page);
        await back(page);
        if (MIX.test(page.url())) failures.push(`${width}px in a call: Back left SYNC and would hang up`);
        await context.close();
      }

      // 4. Mix's SYNC tab: Mix is behind SYNC, so the normal Back reaches it, and nothing else steps in.
      {
        const { context, page } = await open(browser, width);
        await page.goto(base + "/feed.html?view=feed", { waitUntil: "domcontentloaded" });
        const tab = page.locator('nav[data-app-tabs] a[data-tab="sync"]');
        await tab.waitFor({ timeout: 15000 });
        await page.waitForTimeout(500);
        const box = await tab.locator("svg").boundingBox();
        await Promise.all([page.waitForURL(/messages\.html/, { timeout: 10000 }), page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)]);
        await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
        await back(page); // no CloseWatcher here: Esc changes nothing
        if (!/messages\.html/.test(page.url())) failures.push(`${width}px from Mix: something other than the history took Back (${page.url()})`);
        await page.goBack({ waitUntil: "domcontentloaded" });
        if (!MIX.test(page.url())) failures.push(`${width}px from Mix: Back went to ${page.url()} instead of Mix`);
        await context.close();
      }

      // 5. SYNC's own app (installed, started from its icon): Back leaves it like any messenger.
      {
        const { context, page } = await open(browser, width, { syncApp: true });
        await page.goto(base + "/sync/?app=sync", { waitUntil: "domcontentloaded" });
        await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
        await page.waitForTimeout(300);
        await back(page);
        if (MIX.test(page.url())) failures.push(`${width}px SYNC's own app: Back opened Mix inside SYNC's app`);
        await context.close();
      }
    }

    // 6. A computer: no Back button to catch; Esc stays SYNC's own.
    {
      const { context, page } = await open(browser, 1280);
      await page.goto(base + "/sync/", { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
      await back(page);
      if (MIX.test(page.url())) failures.push("1280px: Esc left SYNC on a computer");
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log("SYNC Back checks passed at 360 and 390px: SYNC opened first in the installed app (a notification, the SYNC shortcut) goes to Mix on the phone's Back, an open chat closes first, a call is never cut off, Mix's SYNC tab keeps the normal Back, SYNC's own app and computers are left alone.");
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
