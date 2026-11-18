"use strict";
// SYNC 16-G standalone, real Edge, phones at 360 and 390:
// - sync.html is installable: its manifest is SYNC's own (name, id, icons), fetched and parsed by the browser;
// - the install page fits the phone with 44px targets, and "Open SYNC" lands in the chat list (same session, no login);
// - launched as the installed app (display-mode standalone), it goes straight to the chats.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8157 node browser-checks/sync-standalone.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8157").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-standalone");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch (error) { console.error("screenshot", name, String(error.message).slice(0, 160)); } }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      await context.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.test" } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: "a@danzstak.test", name: "SFScoop", preview: "yo", updatedAt: new Date().toISOString(), canContact: true, unread: 1 }] }));
        return route.fulfill(json({}));
      });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${baseUrl}/sync.html`, { waitUntil: "load" });
      const manifest = await page.evaluate(async () => { const href = document.querySelector('link[rel="manifest"]').href; const r = await fetch(href); return { ok: r.ok, data: await r.json() }; });
      if (!manifest.ok || manifest.data.name !== "SYNC by DanzStak" || manifest.data.id !== "/sync") failures.push(`${label}: SYNC manifest wrong`);
      const icon = await page.evaluate(async () => { const r = await fetch("/assets/sync-icon-512.png"); const b = await createImageBitmap(await r.blob()); return [b.width, b.height]; });
      if (icon.join() !== "512,512") failures.push(`${label}: 512 icon is ${icon}`);
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, open: document.getElementById("syncOpen").getBoundingClientRect().height, title: document.title, text: document.querySelector(".sync-standalone-pitch").textContent }));
      if (layout.overflow) failures.push(`${label}: horizontal overflow`);
      if (layout.open < 44) failures.push(`${label}: Open SYNC under 44px`);
      if (!/Same account, no second login/.test(layout.text)) failures.push(`${label}: pitch missing`);
      await shot(page, `1-install-page-${width}`);
      await page.locator("#syncOpen").click();
      await page.waitForURL(/messages\.html\?app=sync/);
      const list = await page.locator(".conversation-row").first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
      if (!list) failures.push(`${label}: "Open SYNC" did not land in the chat list`);
      if (/login/.test(page.url())) failures.push(`${label}: asked to log in again`);
      // Launched as the installed app.
      const app = await context.newPage();
      await app.addInitScript(() => { const real = window.matchMedia.bind(window); window.matchMedia = q => q.includes("display-mode: standalone") ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q); });
      await app.goto(`${baseUrl}/sync.html`, { waitUntil: "domcontentloaded" });
      await app.waitForURL(/messages\.html\?app=sync/, { timeout: 8000 }).catch(() => failures.push(`${label}: the installed app did not go straight to the chats`));
      await app.locator(".conversation-row").first().waitFor({ timeout: 10000 }).catch(() => {});
      await shot(app, `2-launched-${width}`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`SYNC standalone: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("SYNC standalone checks passed (360, 390): own manifest and icons, install page fits, Open SYNC lands in the chats with the same session, installed launch goes straight to the chats.");
})().catch(error => { console.error(error); process.exitCode = 1; });
