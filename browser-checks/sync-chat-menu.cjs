"use strict";
// Owner 2026-11-23 ("Images are funky", a screenshot of SYNC's chat ⋮ menu): four bare red icons, no words, the first
// row under the status line. Every row is an icon with its label beside it on one line, ink coloured (Delete chat red),
// 44px tall, the whole menu on screen and above the status line. Opened with a tap at the centre of ⋮, 320–430px, in
// English and Italian. API mocked.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-chat-menu.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-chat-menu");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const EXPECTED = { en: ["Make plans", "Wallpaper", "Ringtone", "Delete chat"], it: ["Organizza qualcosa", "Sfondo", "Suoneria", "Elimina chat"] };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch(channel ? { channel, headless: true } : { headless: true });
  const failures = [];
  try {
    for (const locale of ["en", "it"]) for (const width of [320, 360, 390, 430]) {
      const label = `${locale} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 760 }, locale: locale === "it" ? "it-IT" : "en-US", serviceWorkers: "block", hasTouch: true, isMobile: true });
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
      await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
      await page.locator(".conversation-user").first().evaluate(node => node.click());
      await page.locator("#conversationMore").waitFor({ state: "visible" });
      await page.waitForTimeout(600);
      const more = await page.locator("#conversationMore svg").boundingBox();
      await page.touchscreen.tap(more.x + more.width / 2, more.y + more.height / 2);
      await page.waitForTimeout(300);
      const menu = await page.evaluate(() => {
        const box = document.getElementById("conversationMenu"), b = box.getBoundingClientRect();
        const rows = [...box.children].filter(node => getComputedStyle(node).display !== "none").map(node => {
          const r = node.getBoundingClientRect(), text = node.querySelector(".ds-menu-label"), cs = getComputedStyle(node);
          const tr = text?.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { id: node.id, label: text?.textContent.trim() || "", icon: Boolean(node.querySelector("svg")), h: r.height, oneLine: tr ? tr.height < 26 && text.scrollWidth <= text.clientWidth + 1 : false, color: cs.color, onTop: node.contains(hit) };
        });
        return { open: !box.hidden, rows, inside: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight };
      });
      if (!menu.open) { failures.push(`${label}: a tap at the centre of ⋮ didn't open the menu`); await context.close(); continue; }
      const labels = menu.rows.map(row => row.label);
      if (labels.join("|") !== EXPECTED[locale].join("|")) failures.push(`${label}: rows say ${JSON.stringify(labels)}`);
      for (const row of menu.rows) {
        if (!row.icon) failures.push(`${label}: ${row.id} has no icon`);
        if (row.h < 44) failures.push(`${label}: ${row.id} is ${row.h}px tall`);
        if (!row.oneLine) failures.push(`${label}: ${row.id} label wraps or is cut`);
        if (!row.onTop) failures.push(`${label}: ${row.id} is covered by something else`);
        const red = row.color === "rgb(180, 35, 24)";
        if ((row.id === "headerDeleteChat") !== red) failures.push(`${label}: ${row.id} colour ${row.color}`);
      }
      if (!menu.inside) failures.push(`${label}: the menu runs off screen`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `menu-${locale}-${width}.png`) });
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log("SYNC chat menu checks passed at 320–430px in English and Italian: a centre tap on ⋮ opens it; every row has its icon and label on one line, 44px, ink (Delete chat red), nothing covering it, the menu on screen.");
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
