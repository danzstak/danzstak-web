"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8020";
const uuid = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const incomingText = "Load-in is 5 PM.\nBring the orange backdrop 🎸 https://example.test/advance?day=1";
const outgoingText = "Copy that — see you at soundcheck.";
const width = Number(process.env.DANZSTAK_VIEWPORT_WIDTH || 390);
const screenshot = String(process.env.DANZSTAK_SCREENSHOT || "");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width, height: width < 700 ? 844 : 900 },
    hasTouch: width < 700,
    isMobile: width < 700,
    serviceWorkers: "block"
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseUrl });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: uuid(20), email: "owner@example.test" } });
    if (endpoint === "/calls/presence") return json(route, { ok: true });
    if (endpoint === "/conversations") return json(route, { conversations: [
      { contactEmail: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", preview: incomingText, updatedAt: "2026-11-07T18:00:00.000Z", unread: 1, canContact: true }
    ] });
    if (endpoint === "/friends") return json(route, { friends: [
      { email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", picture: "" }
    ] });
    if (endpoint === "/calls/directory") return json(route, { users: [
      { email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", online: true }
    ] });
    if (endpoint === "/messages" && route.request().method() === "GET") return json(route, { messages: [
      { messageId: uuid(40), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: incomingText, createdAt: "2026-11-07T17:59:00.000Z" },
      { messageId: uuid(41), senderEmail: "owner@example.test", recipientEmail: "alice@example.test", content: outgoingText, createdAt: "2026-11-07T18:00:00.000Z", read: true }
    ], canContact: true });
    if (endpoint === "/calls/devices") return json(route, { devices: [] });
    if (endpoint === "/calls/inbox") return json(route, { events: [] });
    return json(route, {});
  });

  try {
    await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
    await page.locator(".conversation-user").first().click();
    const messages = page.locator("#messageList .message");
    await assert.doesNotReject(() => messages.nth(1).waitFor({ state: "visible" }));
    assert.equal(await messages.count(), 2, "both incoming and outgoing messages must render");

    const incoming = messages.nth(0);
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async text => { window.__copiedMessageText = text; } }
      });
    });
    await incoming.locator(".message-meta").click({ button: "right" });
    const incomingCopy = page.locator(".message-copy-choice");
    await incomingCopy.waitFor({ state: "attached", timeout: 3000 });
    await incomingCopy.click();
    assert.equal(await page.evaluate(() => window.__copiedMessageText), incomingText, "Copy must preserve the exact incoming message including line breaks, emoji, and URL");
    assert.equal((await page.locator("#callStatus").textContent()).trim(), "Copied.", "successful Copy must give visible feedback");

    const outgoing = messages.nth(1);
    await outgoing.locator(".message-meta").click({ button: "right" });
    assert.equal(await page.locator(".message-copy-choice").isVisible(), true, "outgoing messages must expose Copy too");
    const paletteBox = await page.locator(".message-reaction-palette").boundingBox();
    assert.ok(paletteBox && paletteBox.x >= 0 && paletteBox.x + paletteBox.width <= width, `${width}px action palette must remain inside the viewport`);
    const copyBox = await page.locator(".message-copy-choice").boundingBox();
    assert.ok(copyBox && (width >= 700 || (copyBox.width >= 44 && copyBox.height >= 44)), `${width}px Copy must retain a usable touch target`);
    if (screenshot) {
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true });
    }
    await page.locator(".message-reaction-palette").evaluate(node => node.remove());

    const incomingTextNode = incoming.locator(".message-text");
    await incomingTextNode.click({ button: "right" });
    assert.equal(await page.locator(".message-reaction-palette").count(), 0, "native context menu on message text must not be replaced by DanzStak actions");

    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async () => { throw new Error("denied"); } }
      });
    });
    await incoming.locator(".message-meta").click({ button: "right" });
    await page.locator(".message-copy-choice").click();
    assert.equal(await page.evaluate(() => window.getSelection().toString()), incomingText, "clipboard denial must select the complete visible message for manual copy");
    assert.equal((await page.locator("#callStatus").textContent()).trim(), "Select the message text and copy it.", "clipboard denial must explain the manual recovery path");
    assert.deepEqual(errors, [], `message Copy must not raise browser errors: ${errors.join(" | ")}`);
    console.log(`Message Copy browser checks passed at ${width}px: incoming/outgoing Copy, exact text, bounded actions, native partial selection, and denied-clipboard recovery.`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
