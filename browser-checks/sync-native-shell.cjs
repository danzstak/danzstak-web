"use strict";
// Task 16-A (owner 2026-11-17): SYNC is an app-like shell. In a thread only the message list scrolls; the header and
// composer stay fixed and messages scroll UNDER the header, never over it. Scroll a 200-message thread and fail if any
// message box overlaps the header or composer, any element overflows the viewport width, or the page itself scrolls.
// API mocked. Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-native-shell.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-native-shell");
const widths = (process.env.WIDTHS || "320,360,375,390,414,430").split(",").map(Number);
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", FRIEND = "friend@danzstak.test";
const longWord = "Pneumonoultramicroscopicsilicovolcanoconiosis".repeat(3);
const messages = Array.from({ length: 200 }, (_, i) => ({
  messageId: `m-${String(i).padStart(4, "0")}`,
  senderEmail: i % 3 === 0 ? ME : FRIEND,
  recipientEmail: i % 3 === 0 ? FRIEND : ME,
  content: i === 150 ? `Load-in link https://example.com/${"a".repeat(120)} and ${longWord}` : i % 7 === 0 ? `See you at load-in, message ${i}. Bring the DI boxes and the spare XLR, the house has two channels short on the snake tonight.` : `Message ${i}`,
  createdAt: new Date(Date.UTC(2026, 10, 10 + Math.floor(i / 40), 12, i % 60)).toISOString(),
  status: "read"
}));

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}
// Every visible message box must sit between the header's bottom and the composer's top, as painted (elementFromPoint).
const layout = page => page.evaluate(() => {
  const header = document.getElementById("conversationHeader"), composer = document.getElementById("messageForm"), list = document.getElementById("messageList");
  const h = header.getBoundingClientRect(), c = composer.getBoundingClientRect(), l = list.getBoundingClientRect();
  const overlaps = [];
  for (const node of list.querySelectorAll(".message")) {
    const r = node.getBoundingClientRect();
    if (r.bottom <= l.top || r.top >= l.bottom) continue;
    if (r.top < h.bottom - 0.5 || r.bottom > c.top + 0.5) {
      // Partly hidden behind header/composer is fine only if the header/composer is painted on top of it.
      const probeY = r.top < h.bottom ? Math.max(r.top + 1, h.top + 1) : Math.min(r.bottom - 1, c.bottom - 1);
      const x = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), hit = document.elementFromPoint(x, Math.min(Math.max(probeY, 0), innerHeight - 1));
      if (hit && node.contains(hit)) overlaps.push({ id: node.dataset.messageId, top: Math.round(r.top), bottom: Math.round(r.bottom), header: Math.round(h.bottom), composer: Math.round(c.top) });
    }
  }
  const wide = [...document.querySelectorAll(".conversation *")].filter(node => { const r = node.getBoundingClientRect(); return r.width > 0 && getComputedStyle(node).visibility !== "hidden" && (r.right > innerWidth + 0.5 || r.left < -0.5) && !node.closest("#videoGrid, .media-controls, [hidden]"); }).map(node => `${node.tagName}.${node.className}`.slice(0, 60));
  return {
    pageScrolls: document.scrollingElement.scrollHeight > innerHeight + 1 || document.scrollingElement.scrollTop > 0 || scrollY > 0,
    horizontal: document.documentElement.scrollWidth > innerWidth,
    listScrolls: list.scrollHeight > list.clientHeight,
    headerTop: Math.round(h.top), headerVisible: h.height > 0 && h.bottom > 0, composerBottom: Math.round(c.bottom), composerVisible: c.height > 0 && c.bottom <= innerHeight + 0.5,
    bottomNavVisible: [...document.querySelectorAll(".ds-mobile-nav")].some(nav => { const r = nav.getBoundingClientRect(); return r.height > 0 && getComputedStyle(nav).display !== "none" && getComputedStyle(nav).visibility !== "hidden" && r.top < innerHeight; }),
    overlaps, wide: [...new Set(wide)].slice(0, 8),
    atBottom: list.scrollHeight - list.scrollTop - list.clientHeight < 4
  };
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of widths) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 760 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url()), p = url.pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: ME, sub: "33333333-3333-4333-8333-333333333333" } }));
        if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift", email: ME } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: FRIEND, memberId: "44444444-4444-4444-8444-444444444444", name: "Tour Friend", preview: "Message 199", updatedAt: messages.at(-1).createdAt, unread: 0 }] }));
        if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ messages, canContact: true, nextCursor: "" }));
        if (p === "/friends") return route.fulfill(json({ friends: [{ email: FRIEND, memberId: "44444444-4444-4444-8444-444444444444", name: "Tour Friend", status: "friends" }] }));
        if (p === "/calls/devices") return route.fulfill(json({ accountTag: "c".repeat(32), currentDeviceRegistered: false, devices: [] }));
        return route.fulfill(json({}));
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().waitFor({ timeout: 15000 });
      await page.locator(".conversation-user").first().evaluate(node => node.click());
      await page.waitForFunction(() => document.querySelectorAll("#messageList .message").length >= 200, null, { timeout: 15000 }).catch(async error => { console.error("messages:", await page.evaluate(() => document.querySelectorAll("#messageList .message").length), "errors:", errors.join(" | ")); throw error; });
      await page.waitForTimeout(500);
      let state = await layout(page);
      const check = (where, s) => {
        if (s.pageScrolls) failures.push(`${label} ${where}: the page itself scrolls`);
        if (s.horizontal) failures.push(`${label} ${where}: sideways scroll`);
        if (!s.headerVisible || s.headerTop < -0.5) failures.push(`${label} ${where}: header scrolled away (top ${s.headerTop})`);
        if (!s.composerVisible) failures.push(`${label} ${where}: composer not on screen (bottom ${s.composerBottom})`);
        if (s.bottomNavVisible) failures.push(`${label} ${where}: global bottom nav shows inside a thread`);
        if (s.overlaps.length) failures.push(`${label} ${where}: ${s.overlaps.length} message(s) painted over header/composer, e.g. ${JSON.stringify(s.overlaps[0])}`);
        if (s.wide.length) failures.push(`${label} ${where}: wider than the screen: ${s.wide.join(", ")}`);
      };
      if (!state.atBottom) failures.push(`${label}: thread does not open at the latest message`);
      check("open", state);
      await shot(page, `thread-open-${width}`);
      // Scroll the list through the whole thread, checking at each stop.
      for (const fraction of [0.75, 0.5, 0.25, 0]) {
        await page.evaluate(f => { const list = document.getElementById("messageList"); list.scrollTop = (list.scrollHeight - list.clientHeight) * f; }, fraction);
        await page.waitForTimeout(150);
        check(`scrolled ${fraction}`, await layout(page));
      }
      // Touch-scrolling the page itself (the owner's bug) must not move the header.
      await page.mouse.move(width / 2, 400);
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(250);
      state = await layout(page);
      check("wheel", state);
      await page.evaluate(() => { const list = document.getElementById("messageList"); list.scrollTop = list.scrollHeight * 0.4; });
      await page.waitForTimeout(250);
      // Bubbles: date chips between days, time inside the bubble without "You ·", jump-to-latest when scrolled up.
      const bubbles = await page.evaluate(() => ({
        chips: document.querySelectorAll("#messageList .message-date-chip").length,
        meta: document.querySelector("#messageList .message.mine .message-meta")?.textContent.trim() || "",
        jump: !document.querySelector(".sync-jump-latest")?.hidden
      }));
      if (bubbles.chips < 5) failures.push(`${label}: date chips missing (${bubbles.chips})`);
      if (/^You\b|·\s*You/.test(bubbles.meta)) failures.push(`${label}: bubble meta still names the sender: "${bubbles.meta}"`);
      if (!bubbles.jump) failures.push(`${label}: no jump-to-latest button when scrolled up`);
      await shot(page, `thread-scrolled-${width}`);
      await page.locator(".sync-jump-latest").click();
      await page.waitForTimeout(700);
      if (!(await layout(page)).atBottom) failures.push(`${label}: jump-to-latest did not reach the latest message`);
      // Keyboard: Android shrinks the viewport; iOS scrolls the page instead. Neither may move the header or hide the composer.
      await page.locator("#messageInput").focus().catch(() => {});
      await page.setViewportSize({ width, height: 420 });
      await page.waitForTimeout(400);
      state = await layout(page);
      check("keyboard (viewport 420px)", state);
      if (!state.atBottom) failures.push(`${label} keyboard: the latest message is not kept in view`);
      await page.evaluate(() => window.scrollTo(0, 300));
      await page.waitForTimeout(300);
      check("keyboard (page pushed up)", await layout(page));
      await shot(page, `thread-keyboard-${width}`);
      await page.setViewportSize({ width, height: 760 });
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`SYNC native shell: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log(`SYNC native shell checks passed at ${widths.join(", ")}px: 200-message thread, opens at the latest message, only the list scrolls, nothing over the header or composer, no sideways overflow, no bottom nav in a thread.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
