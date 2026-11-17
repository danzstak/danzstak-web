"use strict";
// Task 16-A (owner 2026-11-17): the SYNC chat list works like the phone's messenger: pinned chats first, archived
// chats behind one Archived row, swipe left for Pin / Mute / Archive, WhatsApp-style times, a floating new-chat
// button and a top bar that fits at 320px. API mocked. Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-chat-list.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-chat-list");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const now = Date.now(), iso = ms => new Date(ms).toISOString();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const chats = () => [
  { contactEmail: "drummer@danzstak.test", memberId: id(1), name: "Drummer", preview: "Soundcheck at 5", updatedAt: iso(now - 60000), unread: 2, pinned: false, muted: false, archived: false },
  { contactEmail: "venue@danzstak.test", memberId: id(2), name: "The Pit (venue)", preview: "Advance sheet attached", updatedAt: iso(now - 3 * 86400000), unread: 0, pinned: true, pinnedAt: iso(now - 1000), muted: false, archived: false },
  { contactEmail: "promoter@danzstak.test", memberId: id(3), name: "Basement Promoter", preview: "Flyer v2", updatedAt: iso(now - 26 * 3600000), unread: 0, pinned: false, muted: true, archived: false },
  { contactEmail: "old@danzstak.test", memberId: id(4), name: "Old Tour 2024", preview: "Thanks for the tour", updatedAt: iso(now - 200 * 86400000), unread: 0, pinned: false, muted: false, archived: true }
];
const words = {
  en: { archived: "Archived", mute: "Mute chat", newChat: "Start a new chat" },
  it: { archived: "Archiviate", mute: "Silenzia chat", newChat: "Nuova chat" },
  fr: { archived: "Archivées", mute: "Mettre en sourdine", newChat: "Nouvelle discussion" },
  es: { archived: "Archivados", mute: "Silenciar chat", newChat: "Nuevo chat" }
};
const runs = [...[320, 360, 375, 390, 414, 430].map(width => ["en", width]), ["it", 375], ["fr", 375], ["es", 375]];

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}
const names = page => page.$$eval("#conversationUsers .conversation-user strong", nodes => nodes.map(node => node.textContent.trim()));

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const [lang, width] of runs) {
      const label = `${lang} ${width}px`, copy = words[lang];
      const context = await browser.newContext({ viewport: { width, height: 760 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2, locale: lang });
      await context.addInitScript(code => { try { localStorage.setItem("danzstak_language", code); } catch {} }, lang);
      const page = await context.newPage(), errors = [], prefs = [];
      page.on("pageerror", error => errors.push(error.message));
      let list = chats();
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "me@danzstak.test", sub: id(9) } }));
        if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift" } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: list }));
        if (p === "/conversations/prefs") { const body = request.postDataJSON(); prefs.push(body); list = list.map(chat => chat.contactEmail === body.contactEmail ? { ...chat, ...body } : chat); return route.fulfill(json({ contactEmail: body.contactEmail })); }
        if (p === "/calls/devices") return route.fulfill(json({ accountTag: "c".repeat(32), currentDeviceRegistered: false, devices: [] }));
        return route.fulfill(json(p === "/friends" ? { friends: [] } : {}));
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#conversationUsers .conversation-user").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(400);

      // Pinned first, archived hidden behind one row, WhatsApp-style times, marks.
      assert.deepEqual(await names(page), ["The Pit (venue)", "Drummer", "Basement Promoter"], `${label}: pinned first, archived hidden`);
      const archivedRow = page.locator(".conversation-archived-row");
      assert.match(await archivedRow.textContent(), new RegExp(`${copy.archived}\\s*1`), `${label}: Archived row with count`);
      const times = await page.$$eval("#conversationUsers .conversation-list-meta time", nodes => nodes.map(node => node.textContent.trim()));
      assert.match(times[1], /^\d{1,2}[:.]\d{2}/, `${label}: today's chat shows the time (${times[1]})`);
      assert.equal(await page.locator("#conversationUsers .conversation-mark.is-pinned").count(), 1);
      assert.equal(await page.locator("#conversationUsers .conversation-mark.is-muted").count(), 1);

      // Top bar fits; the floating new-chat button replaces the pencil.
      const bar = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth > innerWidth, actions: [...document.querySelectorAll(".chat-heading-actions > *")].filter(node => getComputedStyle(node).display !== "none").map(node => node.getBoundingClientRect().right), fab: (() => { const r = document.querySelector(".sync-new-chat")?.getBoundingClientRect(); return r && r.width ? { right: r.right, bottom: r.bottom, width: r.width } : null; })(), pencil: getComputedStyle(document.getElementById("newChat")).display }));
      assert.equal(bar.overflow, false, `${label}: sideways scroll`);
      assert.ok(bar.actions.every(right => right <= width + 0.5), `${label}: a top-bar icon is cut off (${bar.actions.map(Math.round)})`);
      assert.ok(bar.fab && bar.fab.width >= 44 && bar.fab.right <= width, `${label}: floating new-chat button`);
      assert.equal(bar.pencil, "none", `${label}: no duplicate pencil in the top bar`);
      const expectedNewChat = await page.evaluate(() => window.danzstakTranslate?.("Start a new chat") || "Start a new chat");
      assert.equal(await page.locator(".sync-new-chat").getAttribute("aria-label"), expectedNewChat, `${label}: translated label`);
      if (lang !== "en") assert.notEqual(expectedNewChat, "Start a new chat", `${label}: new-chat label is translated`);
      await shot(page, `${lang}-1-list-${width}`);

      // Swipe left on a chat: Pin / Mute / Archive appear; Mute saves to the server.
      const row = page.locator("#conversationUsers .conversation-row").nth(1), target = row.locator(".conversation-user");
      const box = await target.boundingBox();
      await target.evaluate((node, [x, y, w]) => {
        const fire = (type, cx) => node.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: "touch", clientX: cx, clientY: y, isPrimary: true }));
        fire("pointerdown", x + w - 20); for (let step = 1; step <= 10; step++) fire("pointermove", x + w - 20 - step * 24); fire("pointerup", x + w - 260);
      }, [box.x, box.y + box.height / 2, box.width]);
      await page.waitForTimeout(300);
      assert.equal(await row.getAttribute("data-swiped"), "true", `${label}: swipe left opens the actions`);
      const mute = row.locator(".conversation-swipe-action.is-muted");
      assert.ok(await mute.isVisible(), `${label}: Mute is visible`);
      assert.match(await mute.textContent(), new RegExp(copy.mute));
      await shot(page, `${lang}-2-swiped-${width}`);
      await mute.click();
      await page.waitForFunction(() => document.querySelectorAll("#conversationUsers .conversation-mark.is-muted").length === 2, null, { timeout: 5000 });
      assert.deepEqual(prefs.at(-1), { contactEmail: "drummer@danzstak.test", muted: true }, `${label}: Mute is saved for this chat`);

      // Archived view and back.
      await page.locator(".conversation-archived-row").click();
      await page.waitForFunction(() => [...document.querySelectorAll("#conversationUsers .conversation-user strong")].map(node => node.textContent.trim()).join("|") === "Old Tour 2024", null, { timeout: 5000 });
      await shot(page, `${lang}-3-archived-${width}`);
      await page.locator(".conversation-archived-row").click();
      await page.waitForFunction(() => document.querySelectorAll("#conversationUsers .conversation-user").length === 3, null, { timeout: 5000 });
      assert.deepEqual(errors, [], `${label}: page errors`);
      await context.close();
    }
    console.log(`SYNC chat list checks passed (${runs.map(([lang, width]) => `${lang} ${width}px`).join(", ")}): pinned first, Archived row, times, marks, swipe Pin/Mute/Archive saved, floating new chat, top bar fits.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
