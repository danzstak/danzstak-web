"use strict";
// SYNC 16-D in real Edge (API mocked), phones at 360 and 390:
// - ticks: ✓ sent (grey), ✓✓ delivered (grey), ✓✓ read (blue) with accessible names;
// - "typing…" in the chat header and in the chat list when the server says so; it clears when typing stops;
// - "last seen today at …" when the contact is offline and shares it; nothing at all when they hide it;
// - typing is sent at most every 4 s while composing, and stopped on send;
// - SYNC settings → Privacy saves everyone/friends/nobody and read receipts to the account.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8154 node browser-checks/sync-ticks-typing.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8154").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-ticks-typing");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", FRIEND = "sfscoop@danzstak.test", FRIEND_ID = "44444444-4444-4444-8444-444444444444", OTHER = "bo@danzstak.test";
const uuid = i => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch {} }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [], typingPosts = [], privacyPosts = [];
      page.on("pageerror", error => errors.push(error.message));
      const server = { typing: false, friendOnline: false, hideLastSeen: false };
      const lastSeen = new Date(Date.now() - 5 * 60000).toISOString(), seenDay = new Date(lastSeen).toDateString() === new Date().toDateString() ? "today" : "yesterday";
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: uuid(20), email: ME } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [
          { contactEmail: FRIEND, memberId: FRIEND_ID, name: "SFScoop", preview: "See you at load-in", updatedAt: new Date().toISOString(), canContact: true, unread: 0, typing: server.typing },
          { contactEmail: OTHER, memberId: uuid(2), name: "Bo Static", preview: "ok", updatedAt: new Date(Date.now() - 3600000).toISOString(), canContact: true, unread: 0 }] }));
        if (p === "/friends") return route.fulfill(json({ friends: [{ email: FRIEND, memberId: FRIEND_ID, name: "SFScoop", status: "friends" }, { email: OTHER, memberId: uuid(2), name: "Bo Static", status: "friends" }] }));
        if (p === "/calls/directory") return route.fulfill(json({ users: [{ email: FRIEND, memberId: FRIEND_ID, name: "SFScoop", online: server.friendOnline, lastSeenAt: server.hideLastSeen ? "" : lastSeen }, { email: OTHER, memberId: uuid(2), name: "Bo Static", online: false, lastSeenAt: "" }] }));
        if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ canContact: true, typing: server.typing, messages: [
          { messageId: "1762000000001#" + uuid(101), senderEmail: ME, recipientEmail: FRIEND, content: "Read one", createdAt: new Date(Date.now() - 600000).toISOString(), read: true, delivered: true },
          { messageId: "1762000000002#" + uuid(102), senderEmail: ME, recipientEmail: FRIEND, content: "Delivered one", createdAt: new Date(Date.now() - 300000).toISOString(), read: false, delivered: true },
          { messageId: "1762000000003#" + uuid(103), senderEmail: ME, recipientEmail: FRIEND, content: "Sent one", createdAt: new Date(Date.now() - 60000).toISOString(), read: false, delivered: false }] }));
        if (p === "/messages/typing") { typingPosts.push({ at: Date.now(), body: request.postDataJSON() }); return route.fulfill(json({ typing: true }, 202)); }
        if (p === "/messages" && request.method() === "POST") return route.fulfill(json({ message: { messageId: "1762000000009#" + uuid(109), senderEmail: ME, recipientEmail: FRIEND, content: "hi", createdAt: new Date().toISOString() } }, 201));
        if (p === "/settings/presence") return route.fulfill(json({ onlineVisible: true, lastSeen: "everyone", readReceipts: true }));
        if (p === "/settings/sync-privacy") { privacyPosts.push(request.postDataJSON()); return route.fulfill(json(request.postDataJSON())); }
        if (p === "/calls/devices") return route.fulfill(json({ devices: [] }));
        if (p === "/calls/inbox") return route.fulfill(json({ events: [] }));
        return route.fulfill(json({}));
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      const rows = page.locator('.conversation-row[data-sync-section="chats"]');
      await rows.first().waitFor({ timeout: 15000 });
      // Header: offline friend who shares last seen.
      await rows.first().click();
      await page.waitForFunction(() => document.querySelectorAll("#messageList .message").length >= 3, null, { timeout: 8000 }).catch(() => failures.push(`${label}: thread did not load`));
      await page.waitForTimeout(500);
      const presence = await page.evaluate(() => { const el = document.getElementById("conversationPresence"); return { hidden: el.hidden, text: el.textContent }; });
      if (presence.hidden || !new RegExp(`^last seen ${seenDay} at `).test(presence.text)) failures.push(`${label}: header should say "last seen ${seenDay} at …" (${JSON.stringify(presence)})`);
      const ticks = await page.evaluate(() => [...document.querySelectorAll("#messageList .message-receipt")].map(r => ({ text: r.textContent, label: r.getAttribute("aria-label"), color: getComputedStyle(r).color })));
      const [read, delivered, sent] = ticks;
      if (!read || read.text !== "✓✓" || read.label !== "Read" || read.color !== "rgb(22, 135, 217)") failures.push(`${label}: read tick wrong ${JSON.stringify(read)}`);
      if (!delivered || delivered.text !== "✓✓" || delivered.label !== "Delivered" || delivered.color === "rgb(22, 135, 217)") failures.push(`${label}: delivered tick wrong ${JSON.stringify(delivered)}`);
      if (!sent || sent.text !== "✓" || sent.label !== "Sent") failures.push(`${label}: sent tick wrong ${JSON.stringify(sent)}`);
      await shot(page, `1-ticks-last-seen-${width}`);
      // typing… arrives on the next thread poll (every 3 s).
      server.typing = true;
      await page.waitForFunction(() => document.getElementById("conversationPresence")?.textContent === "typing…", null, { timeout: 8000 }).catch(() => failures.push(`${label}: header never showed typing…`));
      await shot(page, `2-typing-header-${width}`);
      server.typing = false;
      await page.waitForFunction(() => /^last seen/.test(document.getElementById("conversationPresence")?.textContent || ""), null, { timeout: 8000 }).catch(() => failures.push(`${label}: typing… did not clear`));
      // Composing: typing sent at most every 4 s, stopped on send.
      const input = page.locator("#messageInput");
      for (const ch of "load-in at 6") { await input.type(ch); await page.waitForTimeout(120); }
      const started = typingPosts.filter(x => x.body.typing !== false);
      if (!started.length) failures.push(`${label}: typing was never sent while composing`);
      for (let i = 1; i < started.length; i++) if (started[i].at - started[i - 1].at < 3900) failures.push(`${label}: typing sent twice within 4 s`);
      if (started[0]?.body.contactEmail !== FRIEND) failures.push(`${label}: typing went to the wrong chat`);
      await page.locator("#messageForm .message-send").click();
      await page.waitForTimeout(400);
      if (!typingPosts.some(x => x.body.typing === false)) failures.push(`${label}: typing not stopped on send ${process.env.DEBUG ? JSON.stringify(typingPosts.map(x => x.body)) + " input=" + await input.inputValue() : ""}`);
      // Contact hides last seen → nothing shown (not "Offline").
      server.hideLastSeen = true;
      await page.evaluate(() => history.back()); await page.waitForTimeout(300);
      await rows.nth(1).click(); await page.waitForTimeout(800);
      const hidden = await page.evaluate(() => { const el = document.getElementById("conversationPresence"); return { hidden: el.hidden, text: el.textContent }; });
      if (!hidden.hidden && hidden.text) failures.push(`${label}: a hidden last seen still shows "${hidden.text}"`);
      await page.evaluate(() => history.back()); await page.waitForTimeout(300);
      // List shows typing…
      server.typing = true;
      await page.evaluate(() => window.dispatchEvent(new Event("focus")));
      await page.waitForFunction(() => [...document.querySelectorAll(".conversation-copy small")].some(s => s.textContent === "typing…" && s.classList.contains("is-typing")), null, { timeout: 20000 }).catch(() => failures.push(`${label}: chat list never showed typing…`));
      await shot(page, `3-typing-list-${width}`);
      server.typing = false;
      // Privacy sheet.
      await page.locator("#syncSettings").click();
      await page.locator('[data-settings-row="privacy"]').click();
      await page.waitForFunction(() => document.querySelector(".sync-privacy-dialog")?.open);
      await page.locator('.sync-privacy-dialog input[value="friends"]').check();
      await page.locator('.sync-privacy-dialog input[role="switch"]').uncheck();
      await page.waitForTimeout(300);
      const sheet = await page.evaluate(() => { const d = document.querySelector(".sync-privacy-dialog"), r = d.getBoundingClientRect(); return { left: r.left, right: r.right, small: [...d.querySelectorAll("label,button")].filter(b => { const q = b.getBoundingClientRect(); return q.height > 0 && q.height < 43.5; }).map(b => b.textContent.trim() || b.getAttribute("aria-label")) }; });
      if (sheet.left < 0 || sheet.right > width + 0.5) failures.push(`${label}: privacy sheet overflows`);
      if (sheet.small.length) failures.push(`${label}: privacy targets under 44px: ${sheet.small.join(", ")}`);
      const sw = await page.evaluate(() => { const r = document.querySelector('.sync-privacy-dialog input[role="switch"]').getBoundingClientRect(); return { w: r.width, h: r.height }; });
      if (sw.w < 46 || sw.h > 30) failures.push(`${label}: the read-receipts switch is squashed (${sw.w}x${sw.h})`);
      const last = privacyPosts.at(-1);
      if (!last || last.lastSeen !== "friends" || last.readReceipts !== false) failures.push(`${label}: privacy not saved to the account (${JSON.stringify(privacyPosts)})`);
      await shot(page, `4-privacy-${width}`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      if (overflow) failures.push(`${label}: horizontal overflow`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`SYNC ticks/typing: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("SYNC ticks/typing checks passed (360, 390): sent/delivered/read ticks, typing… in header and list, last seen shown or hidden, typing throttled and stopped on send, privacy saved.");
})().catch(error => { console.error(error); process.exitCode = 1; });
