"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8021";
const width = Number(process.env.DANZSTAK_VIEWPORT_WIDTH || 390);
const screenshot = String(process.env.DANZSTAK_SCREENSHOT || "");
const uuid = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
const texts = [
  "Ciao, il locale ha confermato il soundcheck.",
  "Great — what time should we arrive?",
  "Alle 17:00. Porta anche il fondale arancione.",
  "Copy that. I will tell the band.",
  "Perfetto, ci vediamo venerdì!",
  "See you Friday 🎸"
];

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({
    viewport: { width, height: width < 700 ? 844 : 900 },
    hasTouch: width < 700,
    isMobile: width < 700,
    serviceWorkers: "block"
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: uuid(20), email: "owner@example.test" } });
    if (endpoint === "/calls/presence") return json(route, { ok: true });
    if (endpoint === "/conversations") return json(route, { conversations: [
      { contactEmail: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", preview: texts[5], updatedAt: "2026-11-07T18:06:00.000Z", unread: 3, canContact: true }
    ] });
    if (endpoint === "/friends") return json(route, { friends: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", picture: "" }] });
    if (endpoint === "/calls/directory") return json(route, { users: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", online: true }] });
    if (endpoint === "/messages" && route.request().method() === "GET") return json(route, { messages: texts.map((content, index) => ({
      messageId: uuid(40 + index),
      senderEmail: index % 2 === 0 ? "alice@example.test" : "owner@example.test",
      recipientEmail: index % 2 === 0 ? "owner@example.test" : "alice@example.test",
      content,
      createdAt: `2026-11-07T18:0${index + 1}:00.000Z`,
      read: true
    })), canContact: true });
    if (endpoint === "/calls/devices") return json(route, { devices: [] });
    if (endpoint === "/calls/inbox") return json(route, { events: [] });
    return json(route, {});
  });

  try {
    await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
    await page.locator(".conversation-user").first().click();
    const messages = page.locator("#messageList .message");
    await messages.nth(5).waitFor({ state: "visible" });
    assert.equal(await messages.count(), 6, "the six-message bilingual fixture must render");
    await page.evaluate(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText: async text => { window.__batchCopyText = text; } }
      });
    });

    await messages.nth(5).locator(".message-meta").click({ button: "right" });
    await page.getByRole("button", { name: "Select message" }).click();
    for (const index of [0, 3, 1, 4, 2]) await messages.nth(index).click();
    assert.equal((await page.locator("#messageSelectionCount").textContent()).trim(), "6 selected", "selection count must follow the six chosen bubbles");
    assert.equal(await page.locator("#messageList .message.is-selected").count(), 6, "all six chosen bubbles need a visible selected state");

    const toolbarBox = await page.locator("#messageSelectionToolbar").boundingBox();
    assert.ok(toolbarBox && toolbarBox.x >= 0 && toolbarBox.x + toolbarBox.width <= width, `${width}px selection toolbar must remain inside the viewport`);
    for (const action of ["Copy selected", "Cancel selection"]) {
      const box = await page.getByRole("button", { name: action }).boundingBox();
      assert.ok(box && (width >= 700 || (box.width >= 44 && box.height >= 44)), `${width}px ${action} needs a 44px touch target`);
    }
    if (screenshot) {
      fs.mkdirSync(path.dirname(screenshot), { recursive: true });
      await page.screenshot({ path: screenshot, fullPage: true });
    }

    await page.getByRole("button", { name: "Copy selected" }).click();
    const copied = await page.evaluate(() => window.__batchCopyText);
    const blocks = copied.split("\n\n");
    assert.equal(blocks.length, 6, "batch Copy must produce one plain-text block per message");
    assert.deepEqual(blocks.map(block => block.split("\n").slice(1).join("\n")), texts, "batch Copy must use timestamp order, not tap order");
    assert.deepEqual(blocks.map(block => block.split(" · ")[0]), ["Alice Rivera", "You", "Alice Rivera", "You", "Alice Rivera", "You"], "batch Copy must use short visible speaker labels");
    assert.equal(/@example\.test|https?:\/\//.test(copied), false, "batch Copy must not leak account emails or attachment URLs");
    assert.equal(await page.locator("#messageSelectionToolbar").isHidden(), true, "successful Copy must exit selection mode");
    assert.equal((await page.locator("#callStatus").textContent()).trim(), "Copied 6 messages.", "successful batch Copy must give exact feedback");
    assert.deepEqual(errors, [], `batch Copy must not raise browser errors: ${errors.join(" | ")}`);
    console.log(`Message batch-Copy browser check passed at ${width}px: six mixed English/Italian messages, chronological output, visible labels, privacy, and touch geometry.`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
