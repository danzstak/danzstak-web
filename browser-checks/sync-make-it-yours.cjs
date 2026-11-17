"use strict";
// SYNC 16-H "Make it yours" in real Edge (API mocked), phones at 360 and 390:
// settings → Make it yours; pick Metal accent, square bubbles, XL text, dark theme, custom reaction → each previews live,
// saves to the account, applies to the real thread, the reaction menu uses the member's emoji, Reset works per line,
// and the look comes back after a reload with the API offline (device cache). Contrast of own bubbles ≥ 4.5.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8156 node browser-checks/sync-make-it-yours.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8156").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-make-it-yours");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const ME = "me@danzstak.test", FRIEND = "sfscoop@danzstak.test";
const uuid = i => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
const rgb = text => (String(text).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
const lum = c => { const v = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch {} }

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [], saved = [];
      let offline = false;
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (offline && p === "/settings/sync-prefs") return route.abort();
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: uuid(20), email: ME } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: FRIEND, memberId: uuid(1), name: "SFScoop", preview: "yo", updatedAt: new Date().toISOString(), canContact: true, unread: 0 }] }));
        if (p === "/friends") return route.fulfill(json({ friends: [{ email: FRIEND, memberId: uuid(1), name: "SFScoop", status: "friends" }] }));
        if (p === "/messages" && request.method() === "GET") return route.fulfill(json({ canContact: true, messages: [
          { messageId: `${Date.now() - 9000}#${uuid(101)}`, senderEmail: FRIEND, recipientEmail: ME, content: "Soundcheck at 5?", createdAt: new Date(Date.now() - 9000).toISOString() },
          { messageId: `${Date.now() - 5000}#${uuid(102)}`, senderEmail: ME, recipientEmail: FRIEND, content: "On my way with the cables.", createdAt: new Date(Date.now() - 5000).toISOString(), delivered: true }] }));
        if (p === "/settings/sync-prefs" && request.method() === "POST") { saved.push(request.postDataJSON().prefs); return route.fulfill(json({ prefs: request.postDataJSON().prefs })); }
        if (p === "/settings/sync-prefs") return route.fulfill(json({ prefs: saved.at(-1) || {} }));
        if (p === "/calls/devices") return route.fulfill(json({ devices: [] }));
        if (p === "/calls/inbox") return route.fulfill(json({ events: [] }));
        return route.fulfill(json({}));
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakSyncPrefs && document.getElementById("syncSettings"), null, { timeout: 15000 });
      await page.locator("#syncSettings").click();
      await page.locator('[data-settings-row="make-it-yours"]').click();
      await page.waitForFunction(() => document.querySelector(".myo-dialog")?.open);
      const pick = async (section, text) => page.locator(".myo-line", { has: page.locator("h3", { hasText: section }) }).locator("button", { hasText: text }).first().click();
      await page.locator('.myo-accent[aria-label="Metal"]').click();
      await pick("Bubbles", "Square");
      await pick("Text size", "XL");
      await pick("Theme", "Dark");
      const reaction = page.locator(".myo-reactions input").nth(5);
      await reaction.fill("🔥"); await reaction.dispatchEvent("change");
      await page.waitForTimeout(700);
      const preview = await page.evaluate(() => { const m = document.querySelector(".myo-preview .message.mine"), s = getComputedStyle(m); return { bg: s.backgroundColor, color: s.color, radius: s.borderRadius, size: s.fontSize }; });
      if (preview.radius !== "3px") failures.push(`${label}: preview not square (${preview.radius})`);
      if (preview.size !== "19px") failures.push(`${label}: preview text not XL (${preview.size})`);
      if (ratio(rgb(preview.bg), rgb(preview.color)) < 4.5) failures.push(`${label}: own bubble contrast ${ratio(rgb(preview.bg), rgb(preview.color)).toFixed(2)}`);
      const last = saved.at(-1);
      if (!last || last.accent !== "metal" || last.bubbles !== "square" || last.textSize !== 3 || last.theme !== "dark" || last.reactions[5] !== "🔥") failures.push(`${label}: not saved to the account (${JSON.stringify(last)})`);
      const sheet = await page.evaluate(() => { const d = document.querySelector(".myo-dialog"), r = d.getBoundingClientRect(); return { l: r.left, r: r.right, small: [...d.querySelectorAll("button,input")].filter(b => { const q = b.getBoundingClientRect(); return q.height > 0 && q.height < 43.5 && b.type !== "checkbox"; }).map(b => b.textContent.trim() || b.getAttribute("aria-label") || b.type) }; });
      if (sheet.l < 0 || sheet.r > width + 0.5) failures.push(`${label}: sheet overflows`);
      if (sheet.small.length) failures.push(`${label}: targets under 44px: ${sheet.small.join(", ")}`);
      await shot(page, `1-make-it-yours-${width}`);
      // Reset one line.
      await page.locator(".myo-line", { has: page.locator("h3", { hasText: "Text size" }) }).locator(".myo-reset").click();
      await page.waitForTimeout(600);
      if (saved.at(-1)?.textSize !== 1 || saved.at(-1)?.accent !== "metal") failures.push(`${label}: Reset should only reset its own line`);
      await page.locator(".myo-dialog .call-setup-close").click();
      // The real thread.
      await page.locator('.conversation-row[data-sync-section="chats"]').first().waitFor({ timeout: 10000 }).catch(async () => { await shot(page, "debug-" + width); failures.push(`${label}: chat list missing; errors: ${errors.join(" | ")}; list: ${await page.evaluate(() => document.getElementById("conversationUsers")?.textContent.slice(0, 200))}`); });
      if (!(await page.locator('.conversation-row[data-sync-section="chats"]').count())) { await context.close(); continue; }
      await page.locator('.conversation-row[data-sync-section="chats"]').first().click();
      await page.waitForFunction(() => document.querySelectorAll("#messageList .message").length >= 2, null, { timeout: 8000 }).catch(() => failures.push(`${label}: thread did not load`));
      const thread = await page.evaluate(() => { const m = document.querySelector("#messageList .message.mine"), s = getComputedStyle(m), send = getComputedStyle(document.querySelector("#messageForm .message-send")); return { bg: s.backgroundColor, color: s.color, radius: s.borderRadius, dark: document.documentElement.classList.contains("dark-mode"), send: send.backgroundColor }; });
      if (thread.radius !== "3px" || !thread.dark) failures.push(`${label}: thread doesn't follow the look ${JSON.stringify(thread)}`);
      if (thread.send !== "rgb(158, 27, 27)") failures.push(`${label}: send button not in the Metal accent (${thread.send})`);
      if (ratio(rgb(thread.bg), rgb(thread.color)) < 4.5) failures.push(`${label}: thread bubble contrast too low`);
      const box = await page.locator("#messageList .message").first().boundingBox();
      await page.locator("#messageList .message").first().dispatchEvent("contextmenu", { clientX: box.x + 20, clientY: box.y + box.height - 6 });
      const emojis = await page.evaluate(() => [...document.querySelectorAll(".message-reaction-palette button")].map(b => b.textContent).slice(0, 6));
      if (emojis[5] !== "🔥") failures.push(`${label}: reaction menu doesn't use my reactions (${emojis.join(" ")})`);
      await shot(page, `2-thread-${width}`);
      await page.evaluate(() => document.querySelector(".message-reaction-palette")?.remove());
      // Offline reload: the device cache keeps the look.
      offline = true;
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakSyncPrefs);
      const after = await page.evaluate(() => ({ accent: document.documentElement.dataset.syncAccent, bubbles: document.documentElement.dataset.syncBubbles }));
      if (after.accent !== "metal" || after.bubbles !== "square") failures.push(`${label}: the look was lost offline (${JSON.stringify(after)})`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Make it yours: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("Make it yours checks passed (360, 390): live preview, saved to the account, per-line Reset, applied to the thread, my reactions in the menu, works offline after reload, contrast ≥ 4.5.");
})().catch(error => { console.error(error); process.exitCode = 1; });
