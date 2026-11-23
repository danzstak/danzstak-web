"use strict";
// SYNC 16-E in real Edge (API mocked), phones at 360 and 390:
// - long-press menu has Reply and Forward; Edit only for my messages under 15 minutes old;
// - Reply shows the reply bar; sending carries replyToId; the new bubble shows the quote; tapping a quote jumps to the original;
// - swipe right on a bubble (touch) starts a reply;
// - Forward picker allows at most 5 chats and posts one forward action; a forwarded copy shows "Forwarded".
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8155 node browser-checks/sync-reply-forward.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8155").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-reply-forward");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", FRIEND = "sfscoop@danzstak.test";
const uuid = i => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const mid = (ms, i) => `${String(ms).padStart(13, "0")}#${uuid(i)}`;
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch {} }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [], posts = [];
      page.on("pageerror", error => errors.push(error.message));
      const now = Date.now(), oldAt = now - 60 * 60000, newAt = now - 2 * 60000;
      const chats = ["sfscoop", "bo", "cy", "dee", "eli", "fox", "gil"].map((n, i) => ({ contactEmail: `${n}@danzstak.test`, memberId: uuid(i + 1), name: n === "sfscoop" ? "SFScoop" : n.toUpperCase(), preview: "hey", updatedAt: new Date(now - i * 60000).toISOString(), canContact: true, unread: 0 }));
      const thread = [
        { messageId: mid(oldAt, 101), senderEmail: FRIEND, recipientEmail: ME, content: "Load-in is at 6, doors at 8", createdAt: new Date(oldAt).toISOString() },
        { messageId: mid(oldAt + 1000, 102), senderEmail: ME, recipientEmail: FRIEND, content: "Old message of mine", createdAt: new Date(oldAt + 1000).toISOString(), read: true, delivered: true },
        { messageId: mid(newAt - 1000, 104), senderEmail: FRIEND, recipientEmail: ME, content: "Forwarded flyer text", createdAt: new Date(newAt - 1000).toISOString(), forwarded: true },
        { messageId: mid(newAt, 103), senderEmail: ME, recipientEmail: FRIEND, content: "Fresh message of mine", createdAt: new Date(newAt).toISOString(), delivered: true, replyTo: { messageId: mid(oldAt, 101), senderEmail: FRIEND, snippet: "Load-in is at 6, doors at 8" } }
      ];
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: uuid(20), email: ME } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: chats }));
        if (p === "/friends") return route.fulfill(json({ friends: chats.map(c => ({ email: c.contactEmail, memberId: c.memberId, name: c.name, status: "friends" })) }));
        if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ canContact: true, messages: thread }));
        if (p === "/messages" && request.method() === "POST") {
          const body = request.postDataJSON(); posts.push(body);
          if (body.action === "forward") return route.fulfill(json({ forwarded: body.recipients.length, results: body.recipients.map(r => ({ recipient: r, ok: true })) }));
          const original = thread.find(m => m.messageId === body.replyToId);
          return route.fulfill(json({ message: { messageId: mid(Date.now(), 200 + posts.length), senderEmail: ME, recipientEmail: FRIEND, content: body.content, createdAt: new Date().toISOString(), ...(original ? { replyTo: { messageId: original.messageId, senderEmail: original.senderEmail, snippet: original.content } } : {}) } }, 201));
        }
        if (p === "/calls/devices") return route.fulfill(json({ devices: [] }));
        if (p === "/calls/inbox") return route.fulfill(json({ events: [] }));
        return route.fulfill(json({}));
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator('.conversation-row[data-sync-section="chats"]').first().waitFor({ timeout: 15000 });
      await page.locator('.conversation-row[data-sync-section="chats"]').first().click();
      await page.waitForFunction(() => document.querySelectorAll("#messageList .message").length >= 4, null, { timeout: 8000 }).catch(() => failures.push(`${label}: thread did not load`));
      const bubble = text => page.locator("#messageList .message", { hasText: text }).first();
      const menuFor = async text => { const box = await bubble(text).boundingBox(); await bubble(text).dispatchEvent("contextmenu", { clientX: box.x + 20, clientY: box.y + box.height - 6 }); await page.waitForSelector(".message-reaction-palette"); return page.evaluate(() => [...document.querySelectorAll(".message-reaction-palette button")].map(b => b.className)); };
      // Menu contents.
      let menu = await menuFor("Old message of mine");
      if (!menu.some(c => c.includes("message-reply-choice")) || !menu.some(c => c.includes("message-forward-choice"))) failures.push(`${label}: Reply/Forward missing from the menu`);
      if (menu.some(c => c.includes("message-edit-choice"))) failures.push(`${label}: Edit offered on a message older than 15 minutes`);
      await page.keyboard.press("Escape"); await page.evaluate(() => document.querySelector(".message-reaction-palette")?.remove());
      menu = await menuFor("Fresh message of mine");
      if (!menu.some(c => c.includes("message-edit-choice"))) failures.push(`${label}: Edit missing on a fresh message`);
      await page.evaluate(() => document.querySelector(".message-reaction-palette")?.remove());
      // Existing quote + Forwarded label.
      const quote = await page.evaluate(() => { const q = document.querySelector("#messageList .message-quote"); return q ? { text: q.textContent, h: q.getBoundingClientRect().height } : null; });
      if (!quote || !/Load-in is at 6/.test(quote.text)) failures.push(`${label}: quote not rendered`);
      else if (quote.h < 43.5) failures.push(`${label}: quote tap target under 44px`);
      if (!(await page.locator("#messageList .message-forwarded").count())) failures.push(`${label}: Forwarded label missing`);
      await shot(page, `1-quote-forwarded-${width}`);
      // Tap the quote → jumps to the original.
      await page.locator("#messageList .message-quote").first().click();
      await page.waitForTimeout(300);
      if (!(await page.evaluate(() => document.activeElement?.classList.contains("is-jump-target") || !!document.querySelector(".message.is-jump-target")))) failures.push(`${label}: tapping the quote did not jump to the original`);
      // Reply from the menu, send.
      await menuFor("Load-in is at 6");
      await page.locator(".message-reaction-palette .message-reply-choice").click();
      const barOn = await page.evaluate(() => { const b = document.getElementById("messageReplyBar"); return b && !b.hidden ? b.textContent : ""; });
      if (!/Replying to SFScoop/.test(barOn)) failures.push(`${label}: reply bar not shown (${barOn})`);
      await shot(page, `2-reply-bar-${width}`);
      await page.locator("#messageInput").fill("See you there");
      await page.locator("#messageForm .message-send").click();
      await page.waitForTimeout(600);
      const sent = posts.find(b => b.content === "See you there");
      if (!sent || sent.replyToId !== mid(oldAt, 101)) failures.push(`${label}: reply not sent with replyToId (${JSON.stringify(sent)})`);
      if (await page.evaluate(() => !document.getElementById("messageReplyBar").hidden)) failures.push(`${label}: reply bar stayed open after send`);
      const newQuote = await page.evaluate(() => [...document.querySelectorAll("#messageList .message")].pop()?.querySelector(".message-quote")?.textContent || "");
      if (!/Load-in/.test(newQuote)) failures.push(`${label}: the sent reply shows no quote`);
      await shot(page, `3-reply-sent-${width}`);
      // Swipe right (touch) → reply.
      const box = await bubble("Old message of mine").boundingBox();
      const y = box.y + box.height / 2, x0 = box.x + 30;
      await bubble("Old message of mine").evaluate((el, { x0, y }) => {
        const ev = (type, x) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", clientX: x, clientY: y, pointerId: 7 }));
        ev("pointerdown", x0); for (let d = 10; d <= 80; d += 10) ev("pointermove", x0 + d); ev("pointerup", x0 + 80);
      }, { x0, y });
      const swiped = await page.evaluate(() => { const b = document.getElementById("messageReplyBar"); return b && !b.hidden ? b.textContent : ""; });
      if (!/Old message of mine/.test(swiped)) failures.push(`${label}: swipe right did not start a reply`);
      await page.locator(".message-reply-cancel").click();
      // Forward to at most 5.
      await menuFor("Load-in is at 6");
      await page.locator(".message-reaction-palette .message-forward-choice").click();
      await page.waitForFunction(() => document.querySelector(".sync-forward-dialog")?.open);
      const boxes = page.locator(".sync-forward-dialog .sync-forward-list input");
      const n = await boxes.count();
      if (n !== 6) failures.push(`${label}: forward picker should list the 6 other chats, found ${n}`);
      for (let i = 0; i < 5; i++) await boxes.nth(i).check();
      if (!(await boxes.nth(5).isDisabled())) failures.push(`${label}: a 6th chat can be picked`);
      const sheet = await page.evaluate(() => { const r = document.querySelector(".sync-forward-dialog").getBoundingClientRect(); return { l: r.left, r: r.right }; });
      if (sheet.l < 0 || sheet.r > width + 0.5) failures.push(`${label}: forward sheet overflows`);
      const sendBox = await page.evaluate(() => { const b = document.querySelector(".sync-forward-dialog [data-send]"); const r = b.getBoundingClientRect(); return { clipped: b.scrollWidth > b.clientWidth + 1, right: r.right, h: r.height, text: b.textContent }; });
      if (sendBox.clipped || sendBox.right > width || sendBox.h < 43.5) failures.push(`${label}: forward Send button clipped or too small (${JSON.stringify(sendBox)})`);
      await shot(page, `4-forward-picker-${width}`);
      await page.locator(".sync-forward-dialog [data-send]").click();
      await page.waitForTimeout(600);
      const fwd = posts.find(b => b.action === "forward");
      if (!fwd || fwd.recipients.length !== 5 || fwd.messageId !== mid(oldAt, 101) || fwd.contactEmail !== FRIEND) failures.push(`${label}: forward request wrong (${JSON.stringify(fwd)})`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)) failures.push(`${label}: horizontal overflow`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`SYNC reply/forward: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("SYNC reply/forward checks passed (360, 390): menu Reply/Forward, Edit only under 15 min, quote + jump, reply bar + replyToId, swipe to reply, Forwarded label, forward to at most 5.");
})().catch(error => { console.error(error); process.exitCode = 1; });
