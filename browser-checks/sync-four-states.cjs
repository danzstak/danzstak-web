"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8016";
const widths = [320, 360, 390, 414, 430, 768, 1024];
const output = path.resolve(__dirname, "..", "docs", "screenshots", "issue-48");
const uuid = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

async function assertViewport(page, width, state) {
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth
  }));
  assert.ok(geometry.documentWidth <= width && geometry.bodyWidth <= width, `${width}px ${state} overflows: ${JSON.stringify(geometry)}`);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const height = width < 700 ? 844 : 768;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const endpoint = new URL(route.request().url()).pathname;
        if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: uuid(20), email: "owner@example.test" } });
        if (endpoint === "/calls/presence") return json(route, { ok: true });
        if (endpoint === "/conversations") return json(route, { conversations: [
          { contactEmail: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", preview: "See you at soundcheck", updatedAt: "2026-11-04T18:00:00.000Z", unread: 2, canContact: true }
        ] });
        if (endpoint === "/friends") return json(route, { friends: [
          { email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", picture: "" },
          { email: "marco@example.test", memberId: uuid(2), name: "Marco Bell", picture: "" }
        ] });
        if (endpoint === "/calls/directory") return json(route, { users: [
          { email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", online: true },
          { email: "marco@example.test", memberId: uuid(2), name: "Marco Bell", online: false }
        ] });
        if (endpoint === "/messages" && route.request().method() === "GET") return json(route, { messages: [
          { messageId: uuid(40), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", text: "Load-in is confirmed for 5 PM.", createdAt: "2026-11-04T18:00:00.000Z" }
        ], canContact: true });
        if (endpoint === "/calls/devices") return json(route, { devices: [] });
        if (endpoint === "/calls/inbox") return json(route, { events: [] });
        return json(route, {});
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().waitFor({ state: "visible" });
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      assert.equal((await page.locator("#messagesTitle").textContent()).trim(), "SYNC");
      assert.deepEqual(await page.locator("[data-chat-filter]").allTextContents(), ["Chats", "Calls", "Contacts"]);
      assert.equal(await page.locator(".conversation-row").count(), 1, "Chats must contain saved conversations, not every directory contact");
      await page.getByRole("tab", { name: "Calls" }).click();
      await page.locator('.conversation-row[data-sync-section="calls"]').first().waitFor();
      assert.equal(await page.locator('.conversation-row[data-sync-section="calls"]').count(), 2, "Calls must use real permitted contacts");
      assert.equal(await page.locator('.conversation-row[data-sync-section="calls"] .conversation-call').count(), 4, "each permitted contact needs visible voice and video actions");
      await page.getByRole("tab", { name: "Contacts" }).click();
      await page.locator('.conversation-row[data-sync-section="contacts"]').first().waitFor();
      assert.equal(await page.locator('.conversation-row[data-sync-section="contacts"]').count(), 2, "Contacts must use the existing permitted directory");
      await page.getByRole("tab", { name: "Chats" }).click();
      await page.locator('.conversation-row[data-sync-section="chats"]').first().waitFor();
      await assertViewport(page, width, "inbox");
      if (width === 390) await page.screenshot({ path: path.join(output, "sync-inbox-390.png"), fullPage: true });

      await page.locator(".conversation-user").first().click();
      await page.locator("body.is-conversation-open").waitFor();
      assert.equal(await page.locator("body").getAttribute("data-sync-screen"), "conversation");
      await assertViewport(page, width, "conversation");
      if (width === 390) await page.screenshot({ path: path.join(output, "sync-conversation-390.png"), fullPage: true });

      await page.evaluate(() => {
        document.body.dataset.syncScreen = "incoming-call";
        const incoming = document.getElementById("incomingCall");
        incoming.hidden = false;
        incoming.style.setProperty("display", "flex", "important");
        document.getElementById("incomingLabel").textContent = "Incoming call: Alice Rivera";
      });
      assert.equal(await page.locator("#incomingCall").evaluate(node => getComputedStyle(node).position), "fixed");
      assert.equal(await page.locator("#incomingCall").evaluate(node => Math.round(node.getBoundingClientRect().height)), height);
      await assertViewport(page, width, "incoming call");
      if (width === 390) await page.screenshot({ path: path.join(output, "sync-incoming-call-390.png"), fullPage: true });

      await page.evaluate(() => {
        document.getElementById("incomingCall").hidden = true;
        document.getElementById("incomingCall").style.removeProperty("display");
        document.body.dataset.callMode = "video";
        document.body.dataset.syncScreen = "video-call";
        document.getElementById("videoGrid").hidden = false;
        document.getElementById("mediaControls").hidden = false;
      });
      const videoBox = await page.locator("#videoGrid").boundingBox();
      assert.ok(videoBox && Math.round(videoBox.width) === width && Math.round(videoBox.height) === height, `${width}px active video must own the viewport`);
      await assertViewport(page, width, "active video");
      if (width === 390) await page.screenshot({ path: path.join(output, "sync-active-video-390.png"), fullPage: true });
      await context.close();
    }
    console.log(`SYNC four-state verification passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
