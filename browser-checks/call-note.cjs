"use strict";
// Task 30 (owner 2026-11-18): a 5th call button, Text; the note shows over the other person's video until they close it.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8027 node browser-checks/call-note.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8027").replace(/\/$/, "");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("https://api.danzstak.com/**", route => { const p = new URL(route.request().url()).pathname; return route.fulfill(json(p === "/auth/session" ? { authenticated: true, user: { sub: "me", email: "me@danzstak.invalid" } } : {})); });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#callNoteButton").waitFor({ state: "attached", timeout: 10000 });
      // A connected video call with an open data channel (stubbed).
      await page.evaluate(() => { document.body.dataset.callMode = "video"; document.getElementById("videoGrid").hidden = false; document.getElementById("mediaControls").hidden = false; });
      await page.evaluate("channel = { readyState: 'open', send(data) { window.__sent = data; } }");
      const buttons = await page.evaluate(() => [...document.querySelectorAll("#mediaControls > button")].filter(b => !b.hidden && getComputedStyle(b).display !== "none").map(b => { const r = b.getBoundingClientRect(); return { id: b.id, l: r.left, r: r.right, t: r.top, w: r.width, h: r.height }; }));
      assert.ok(buttons.some(b => b.id === "callNoteButton"), `${width}px: Text button in the call controls`);
      assert.ok(buttons.every(b => b.l >= 0 && b.r <= width && b.w >= 44 && b.h >= 44), `${width}px: all call buttons fit, 44px+ (${JSON.stringify(buttons)})`);
      assert.equal(new Set(buttons.map(b => Math.round(b.t))).size, 1, `${width}px: one row`);
      await page.locator("#callNoteButton").click();
      await page.locator(".call-note-sheet textarea").fill("Soundcheck at 5 <img src=x onerror=alert(1)>");
      await page.locator(".call-note-send").click();
      const sent = JSON.parse(await page.evaluate(() => window.__sent));
      assert.equal(sent.type, "call-note"); assert.match(sent.text, /^Soundcheck at 5/);
      // The other side receives it over its video.
      const handled = await page.evaluate(raw => window.danzstakCallNote.receive(raw, "Mary Smith"), JSON.stringify({ type: "call-note", id: "x", text: "Running 10 min late <b>sorry</b>", sentAt: Date.now() }));
      assert.equal(handled, true);
      const overlay = await page.evaluate(() => { const o = document.querySelector(".call-note-overlay"), c = document.getElementById("mediaControls").getBoundingClientRect(), r = o.getBoundingClientRect(); return { text: o.querySelector(".call-note-text").textContent, html: o.querySelector(".call-note-text").innerHTML, from: o.querySelector(".call-note-from").textContent, bottom: r.bottom, controlsTop: c.top, left: r.left, right: r.right }; });
      assert.equal(overlay.text, "Running 10 min late <b>sorry</b>", `${width}px: text only`);
      assert.doesNotMatch(overlay.html, /<b>/, `${width}px: no HTML rendered`);
      assert.equal(overlay.from, "Mary");
      assert.ok(overlay.bottom <= overlay.controlsTop && overlay.left >= 0 && overlay.right <= width, `${width}px: note sits above the controls, on screen (${JSON.stringify(overlay)})`);
      assert.equal(await page.evaluate(() => window.danzstakCallNote.receive("plain text", "x")), false, "plain chat messages still go to the chat");
      if (width === 390) { await page.waitForTimeout(900); await page.screenshot({ path: "docs/screenshots/call-note-390.png" }); }
      await page.locator(".call-note-dismiss").click();
      assert.equal(await page.locator(".call-note-overlay").count(), 0, `${width}px: ✕ closes the note`);
      assert.deepEqual(errors, [], `${width}px page errors`);
      await context.close();
    }
    console.log("Call note checks passed at 320/360/390/430px: Text button fits the row, note sent over the data channel, shown as text over the video until closed.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
