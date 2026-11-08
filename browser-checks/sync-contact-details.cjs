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

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, hasTouch: width < 700, isMobile: width < 700, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  let blockedMemberId = "";
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: uuid(20), email: "owner@example.test" } });
    if (endpoint === "/conversations") return json(route, { conversations: [{ contactEmail: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", picture: "", preview: "See you Friday", updatedAt: "2026-11-07T18:20:00.000Z", online: true, canContact: true }] });
    if (endpoint === "/friends") return json(route, { friends: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", picture: "" }] });
    if (endpoint === "/calls/directory") return json(route, { users: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", picture: "", online: true }] });
    if (endpoint === "/messages" && route.request().method() === "GET") return json(route, { messages: Array.from({ length: 24 }, (_, index) => ({ messageId: uuid(100 + index), senderEmail: index % 2 ? "owner@example.test" : "alice@example.test", recipientEmail: index % 2 ? "alice@example.test" : "owner@example.test", content: `Message ${index + 1}`, createdAt: `2026-11-07T18:${String(index).padStart(2, "0")}:00.000Z`, read: true })), canContact: true });
    if (endpoint === "/friends/block") {
      blockedMemberId = JSON.parse(route.request().postData() || "{}").memberId || "";
      return json(route, { ok: true });
    }
    if (["/calls/presence", "/calls/devices"].includes(endpoint)) return json(route, endpoint.endsWith("devices") ? { devices: [] } : { ok: true });
    if (endpoint === "/calls/inbox") return json(route, { events: [] });
    return json(route, {});
  });

  try {
    await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
    await page.locator(".conversation-user").first().click();
    await page.locator("#messageList .message").last().waitFor();
    await page.locator("#messageInput").fill("Draft stays here while I check the contact");
    await page.locator("#messageList").evaluate(element => { element.scrollTop = Math.max(1, element.scrollHeight - element.clientHeight - 40); });
    const beforeScroll = await page.locator("#messageList").evaluate(element => element.scrollTop);
    await page.locator("#conversationName").click();
    const dialog = page.locator("#contactDetailsDialog");
    await dialog.waitFor({ state: "visible" });
    assert.equal((await page.locator("#contactDetailsName").textContent()).trim(), "Alice Rivera");
    assert.equal((await page.locator("#contactDetailsPresence").textContent()).trim(), "Online");
    assert.match(await page.locator("#contactDetailsProfile").getAttribute("href"), new RegExp(`profile\\.html\\?member=${uuid(1)}$`));
    const dialogBox = await dialog.boundingBox();
    assert.ok(dialogBox && dialogBox.x >= 0 && dialogBox.x + dialogBox.width <= width, `${width}px contact details must remain inside the viewport`);
    for (const label of ["Back to conversation", "View profile", "Voice call", "Video call", "Block member"]) {
      const control = dialog.getByRole(/profile/i.test(label) ? "link" : "button", { name: new RegExp(label, "i") });
      const box = await control.boundingBox();
      assert.ok(box && (width >= 700 || (box.width >= 44 && box.height >= 44)), `${label} needs a phone touch target`);
    }
    if (screenshot) { fs.mkdirSync(path.dirname(screenshot), { recursive: true }); await page.screenshot({ path: screenshot, fullPage: true }); }
    await page.getByRole("button", { name: "Back to conversation" }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await page.locator("#messageInput").inputValue(), "Draft stays here while I check the contact", "contact details must preserve the draft");
    const afterScroll = await page.locator("#messageList").evaluate(element => element.scrollTop);
    assert.ok(Math.abs(afterScroll - beforeScroll) <= 1, "contact details must preserve the exact thread scroll position");

    await page.locator("#conversationName").click();
    await page.evaluate(() => { window.danzstakConfirm = async () => true; });
    await page.getByRole("button", { name: "Block member" }).click();
    await page.waitForFunction(() => !document.body.classList.contains("is-conversation-open"));
    assert.equal(blockedMemberId, uuid(1), "blocking must submit the opaque member ID only");
    assert.deepEqual(errors, [], `contact details must not raise browser errors: ${errors.join(" | ")}`);
    console.log(`SYNC contact-details browser check passed at ${width}px: identity, actions, Back, draft/scroll preservation, and confirmed blocking.`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
