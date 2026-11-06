"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8016";
const previewCredentials = process.env.DANZSTAK_PREVIEW_USER && process.env.DANZSTAK_PREVIEW_PASSWORD
  ? { username: process.env.DANZSTAK_PREVIEW_USER, password: process.env.DANZSTAK_PREVIEW_PASSWORD }
  : null;
const widths = [320, 360, 390, 414, 430, 768, 1024];
const output = path.resolve(__dirname, "..", "docs", "screenshots", "issue-48");
const capture = process.env.UPDATE_SCREENSHOTS === "1";
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
  if (capture) fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const height = width < 700 ? 844 : 768;
      const context = await browser.newContext({ viewport: { width, height }, hasTouch: width < 700, isMobile: width < 700, serviceWorkers: "block", ...(previewCredentials ? { httpCredentials: previewCredentials } : {}) });
      const page = await context.newPage();
      await page.addInitScript(() => {
        window.__syncMediaRequests = [];
        const stream = new MediaStream();
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
          getUserMedia: async constraints => {
            window.__syncMediaRequests.push(constraints);
            return stream;
          }
        } });
        window.RTCPeerConnection = class MockPeerConnection {
          constructor() { this.iceGatheringState = "complete"; this.connectionState = "new"; this.localDescription = null; }
          addTrack() {}
          addEventListener() {}
          removeEventListener() {}
          createDataChannel() { return { addEventListener() {}, close() {} }; }
          async createOffer() { return { type: "offer", sdp: "test-offer" }; }
          async setLocalDescription(description) { this.localDescription = description; }
          close() { this.connectionState = "closed"; }
        };
      });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const endpoint = new URL(route.request().url()).pathname;
        if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: uuid(20), email: "owner@example.test" } });
        if (endpoint === "/calls/presence") return json(route, { ok: true });
        if (endpoint === "/calls/signal") return json(route, { accepted: true });
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
      if (capture && width === 390) await page.screenshot({ path: path.join(output, "sync-inbox-390.png"), fullPage: true });

      await page.locator(".conversation-user").first().click();
      await page.locator("body.is-conversation-open").waitFor();
      assert.equal(await page.locator("body").getAttribute("data-sync-screen"), "conversation");
      for (const id of ["headerPhone", "headerVideo"]) {
        const action = page.locator(`#${id}`);
        await action.waitFor({ state: "visible" });
        assert.equal(await action.isDisabled(), false, `${width}px ${id} must be enabled for a permitted contact`);
        const box = await action.boundingBox();
        assert.ok(box && box.width >= 44 && box.height >= 44, `${width}px ${id} must preserve a 44px touch target`);
        assert.ok(box.x >= 0 && box.x + box.width <= width, `${width}px ${id} is clipped by the viewport`);
        const hit = await page.evaluate(({ id, x, y }) => {
          const target = document.elementFromPoint(x, y);
          return target?.id === id || target?.closest?.(`#${id}`)?.id === id;
        }, { id, x: box.x + box.width / 2, y: box.y + box.height / 2 });
        assert.equal(hit, true, `${width}px ${id} must be hit-testable at its center`);
      }
      await assertViewport(page, width, "conversation");
      if (capture && width === 390) await page.screenshot({ path: path.join(output, "sync-conversation-390.png"), fullPage: true });

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
      if (capture && width === 390) await page.screenshot({ path: path.join(output, "sync-incoming-call-390.png"), fullPage: true });

      await page.evaluate(() => {
        document.getElementById("incomingCall").hidden = true;
        document.getElementById("incomingCall").style.removeProperty("display");
      });
      await page.locator("#headerVideo").click();
      await page.waitForTimeout(250);
      if (await page.locator("body").getAttribute("data-call-mode") !== "video") {
        const diagnostics = await page.evaluate(() => ({
          headerDisabled: document.getElementById("headerVideo")?.disabled,
          startDisabled: document.getElementById("startVideo")?.disabled,
          contact: document.getElementById("contactEmail")?.value,
          status: document.getElementById("callStatus")?.textContent,
          errors: window.__syncMediaRequests
        }));
        throw new Error(`${width}px Video action did not start: ${JSON.stringify(diagnostics)}`);
      }
      await page.waitForFunction(() => document.body.dataset.callMode === "video" || document.getElementById("callStatus")?.textContent?.startsWith("Could not call:"));
      const callMode = await page.locator("body").getAttribute("data-call-mode");
      const callStatus = (await page.locator("#callStatus").textContent()).trim();
      assert.equal(callMode, "video", `${width}px Video action failed to enter camera flow: ${callStatus}`);
      await page.waitForFunction(() => window.__syncMediaRequests.length === 1);
      const mediaRequest = await page.evaluate(() => window.__syncMediaRequests[0]);
      assert.equal(mediaRequest.audio, true, `${width}px video call must request microphone access`);
      assert.equal(typeof mediaRequest.video, "object", `${width}px video call must request camera access`);
      assert.equal(await page.locator("body").getAttribute("data-sync-screen"), "video-call");
      const videoBox = await page.locator("#videoGrid").boundingBox();
      assert.ok(videoBox && Math.round(videoBox.width) === width && Math.round(videoBox.height) === height, `${width}px active video must own the viewport`);
      await assertViewport(page, width, "active video");
      if (capture && width === 390) await page.screenshot({ path: path.join(output, "sync-active-video-390.png"), fullPage: true });
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
