"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8021";
const width = Number(process.env.DANZSTAK_VIEWPORT_WIDTH || 390);
const screenshot = String(process.env.DANZSTAK_SCREENSHOT || "");
const uuid = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, hasTouch: width < 700, isMobile: width < 700, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: uuid(20), email: "owner@example.test" } });
    if (endpoint === "/conversations") return json(route, { conversations: [{ contactEmail: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", preview: "Perfect. See you Friday.", updatedAt: "2026-11-07T18:24:00.000Z", online: true, canContact: true }] });
    if (endpoint === "/friends") return json(route, { friends: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera" }] });
    if (endpoint === "/calls/directory") return json(route, { users: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", online: true }] });
    if (endpoint === "/messages" && route.request().method() === "GET") return json(route, { messages: [
      { messageId: uuid(101), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: "The club confirmed Friday night.", createdAt: "2026-11-07T18:20:00.000Z", read: true },
      { messageId: uuid(102), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: "Soundcheck is at 5 PM.", createdAt: "2026-11-07T18:21:00.000Z", read: true },
      { messageId: uuid(103), senderEmail: "owner@example.test", recipientEmail: "alice@example.test", content: "Great. I added it to the tour calendar.", createdAt: "2026-11-07T18:22:00.000Z", read: true },
      { messageId: uuid(104), senderEmail: "owner@example.test", recipientEmail: "alice@example.test", content: "I’ll send the stage plot tonight.", createdAt: "2026-11-07T18:23:00.000Z", read: true },
      { messageId: uuid(105), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: "Perfect. See you Friday.", createdAt: "2026-11-07T18:24:00.000Z", read: true }
    ], canContact: true });
    if (["/calls/presence", "/calls/devices"].includes(endpoint)) return json(route, endpoint.endsWith("devices") ? { devices: [] } : { ok: true });
    if (endpoint === "/calls/inbox") return json(route, { events: [] });
    return json(route, {});
  });

  try {
    await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
    await page.locator(".conversation-user").first().click();
    const messages = page.locator("#messageList .message");
    await messages.last().waitFor();
    assert.equal(await messages.count(), 5);
    const style = await page.locator("#messageList").evaluate(element => {
      const computed = getComputedStyle(element);
      return { backgroundColor: computed.backgroundColor, backgroundImage: computed.backgroundImage, overflowX: element.scrollWidth > element.clientWidth };
    });
    assert.equal(style.backgroundImage, "none", "conversation canvas must not use wallpaper noise");
    assert.equal(style.backgroundColor, "rgb(237, 242, 244)");
    assert.equal(style.overflowX, false, "conversation must not overflow horizontally");
    const firstIncoming = await messages.nth(0).evaluate(element => ({ background: getComputedStyle(element).backgroundColor, radius: getComputedStyle(element).borderTopLeftRadius }));
    const groupedIncoming = await messages.nth(1).evaluate(element => ({ background: getComputedStyle(element).backgroundColor, radius: getComputedStyle(element).borderTopLeftRadius }));
    const firstOutgoing = await messages.nth(2).evaluate(element => ({ background: getComputedStyle(element).backgroundColor, radius: getComputedStyle(element).borderTopRightRadius }));
    const groupedOutgoing = await messages.nth(3).evaluate(element => ({ background: getComputedStyle(element).backgroundColor, radius: getComputedStyle(element).borderTopRightRadius }));
    assert.equal(firstIncoming.background, "rgb(255, 255, 255)");
    assert.equal(groupedIncoming.radius, "5px");
    assert.equal(firstOutgoing.background, "rgb(217, 239, 255)");
    assert.equal(groupedOutgoing.radius, "5px");
    const composer = await page.locator("#messageForm").boundingBox();
    assert.ok(composer && composer.y + composer.height <= (width < 700 ? 844 : 900), "fixed conversation composer must remain visible");
    if (screenshot) { fs.mkdirSync(path.dirname(screenshot), { recursive: true }); await page.screenshot({ path: screenshot, fullPage: true }); }
    assert.deepEqual(errors, [], `thread styling must not raise browser errors: ${errors.join(" | ")}`);
    console.log(`SYNC WhatsApp-familiar thread check passed at ${width}px: clean canvas, grouped bubbles, composer fit, and no overflow.`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
