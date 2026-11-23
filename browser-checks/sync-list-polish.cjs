"use strict";
// SYNC list at phone width (owner check 2026-11-18): title + one ⋮ (opens the SYNC settings sheet with Invite a
// friend, New video call, Call alerts, Phone and registered devices), no "Your saved conversations." sub-line,
// initials on DanzStak colours instead of gradients, and a broken profile picture falls back to the initial.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-list-polish.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-list-polish");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const now = Date.now(), iso = ms => new Date(ms).toISOString();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const chats = [
  { contactEmail: "drummer@danzstak.test", memberId: id(1), name: "Drummer", preview: "Soundcheck at 5", updatedAt: iso(now - 60000), unread: 2 },
  { contactEmail: "venue@danzstak.test", memberId: id(2), name: "The Pit (venue)", preview: "Advance sheet attached", updatedAt: iso(now - 3 * 86400000), unread: 0, picture: `${baseUrl}/__expired/avatar.jpg` },
  { contactEmail: "sfscoop@danzstak.test", memberId: id(3), name: "SFScoop", preview: "See you at the show", updatedAt: iso(now - 26 * 3600000), unread: 0 }
];
async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 4) throw error; await page.waitForTimeout(500); }
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 760 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${baseUrl}/__expired/**`, route => route.fulfill({ status: 403, body: "" }));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "me@danzstak.test", sub: id(9) } }));
        if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift" } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: chats }));
        if (p === "/calls/devices") return route.fulfill(json({ accountTag: "c".repeat(32), currentDeviceRegistered: true, devices: [] }));
        return route.fulfill(json(p === "/friends" ? { friends: [] } : {}));
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#conversationUsers .conversation-user").first().waitFor({ timeout: 15000 });
      await page.waitForTimeout(600);
      const state = await page.evaluate(() => {
        const visible = n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
        const header = [...document.querySelectorAll(".chat-heading-actions > *")].filter(visible);
        const title = document.getElementById("messagesTitle").getBoundingClientRect();
        const more = header[0]?.getBoundingClientRect();
        const avatars = [...document.querySelectorAll("#conversationUsers .conversation-list-avatar")].map(n => ({ tag: n.tagName, text: n.textContent.trim(), bg: getComputedStyle(n).backgroundImage, color: getComputedStyle(n).backgroundColor }));
        const strip = [...document.querySelectorAll("#chatContacts .chat-contact-avatar")].map(n => ({ tag: n.tagName, text: n.textContent.trim() }));
        return { header: header.map(n => n.getAttribute("aria-label")), overlap: more ? more.left < title.right : false, moreSize: more ? [Math.round(more.width), Math.round(more.height)] : null, noteVisible: visible(document.getElementById("syncSectionNote")), avatars, strip, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.deepEqual(state.header, ["More options"], `${width}px: the header has one ⋮`);
      assert.equal(state.overlap, false, `${width}px: nothing crowds the SYNC title`);
      assert.ok(state.moreSize[0] >= 44 && state.moreSize[1] >= 44, `${width}px: ⋮ is a 44px target (${state.moreSize})`);
      assert.equal(state.noteVisible, false, `${width}px: no "Your saved conversations." sub-line`);
      assert.equal(state.overflow, false, `${width}px: no sideways scroll`);
      for (const avatar of state.avatars) {
        assert.equal(avatar.bg, "none", `${width}px: no gradient avatar`);
        assert.equal(avatar.color, "rgb(18, 20, 24)", `${width}px: initial on DanzStak near-black`);
      }
      const venue = state.avatars.find(a => a.text === "T");
      assert.ok(venue && venue.tag === "SPAN", `${width}px: a broken picture falls back to the initial (${JSON.stringify(state.avatars)})`);
      assert.ok(state.strip.every(a => a.tag === "SPAN" ? a.text.length === 1 : true), `${width}px: no empty circle in the strip`);
      if ([360, 390].includes(width)) await shot(page, `list-${width}`);
      // ⋮ opens the settings sheet with the moved actions as rows.
      await page.getByRole("button", { name: "More options" }).click();
      const sheet = page.locator("dialog[open]");
      await sheet.waitFor();
      const text = await sheet.innerText();
      for (const label of ["Invite a friend", "New video call", "Call alerts", "Phone and registered devices"]) assert.match(text, new RegExp(label), `${width}px: ⋮ sheet has ${label}`);
      if ([360, 390].includes(width)) await shot(page, `more-${width}`);
      // Fix-it 18: no staves box behind the list; the list background is the page.
      const canvas = await page.evaluate(() => { const panel = document.querySelector(".chat-list-panel"); const s = getComputedStyle(panel); return { image: s.backgroundImage, radius: s.borderTopLeftRadius, watermark: getComputedStyle(panel, "::after").content }; });
      assert.equal(canvas.image, "none", `${width}px: no music-staff box on the chat list`);
      assert.equal(canvas.radius, "0px", `${width}px: the list is not a framed box`);
      assert.ok(["none", "normal"].includes(canvas.watermark), `${width}px: no watermark on the list (${canvas.watermark})`);
      assert.deepEqual(errors, [], `${width}px page errors`);
      await context.close();
    }
    // Fix-it 18: an empty chat list is one centred line + "Start a chat" (same action as the floating button).
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 760 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "me@danzstak.test", sub: id(9) } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [] }));
        if (p === "/calls/devices") return route.fulfill(json({ accountTag: "c".repeat(32), currentDeviceRegistered: true, devices: [] }));
        return route.fulfill(json(p === "/friends" ? { friends: [] } : {}));
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      const start = page.locator("#conversationUsers .sync-empty-start");
      await start.waitFor({ timeout: 15000 });
      const empty = await page.evaluate(() => {
        const line = document.querySelector("#conversationUsers .sync-empty-line"), button = document.querySelector(".sync-empty-start");
        const l = line.getBoundingClientRect(), b = button.getBoundingClientRect(), s = getComputedStyle(line);
        return { text: line.textContent.trim(), lineCenter: Math.round(l.left + l.width / 2), buttonCenter: Math.round(b.left + b.width / 2), height: b.height, shadow: s.boxShadow, bg: s.backgroundColor, panel: getComputedStyle(document.querySelector(".chat-list-panel")).backgroundImage };
      });
      assert.equal(empty.text, "No chats yet.", `${width}px: one short empty line`);
      assert.ok(Math.abs(empty.lineCenter - width / 2) <= 24 && Math.abs(empty.buttonCenter - width / 2) <= 24, `${width}px: empty state is centred (${JSON.stringify(empty)})`);
      assert.ok(empty.height >= 44, `${width}px: Start a chat is a 44px target`);
      assert.equal(empty.shadow, "none", `${width}px: the empty line is not a floating box`);
      assert.equal(empty.panel, "none", `${width}px: no staves box behind the empty state`);
      await page.evaluate(() => { window.__fabClicks = 0; document.querySelector(".sync-new-chat")?.addEventListener("click", () => window.__fabClicks++); });
      await start.click();
      assert.equal(await page.evaluate(() => window.__fabClicks), 1, `${width}px: Start a chat runs the new-chat button`);
      if ([360, 390].includes(width)) await shot(page, `empty-${width}`);
      assert.deepEqual(errors, [], `${width}px empty-state page errors`);
      await context.close();
    }
    console.log("SYNC list polish checks passed at 320/360/390/430px: one ⋮ in the header, actions in the sheet, no sub-line, initials on DanzStak colours, broken pictures fall back to the initial, no staves box, one-line empty state with Start a chat.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
