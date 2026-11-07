"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const widths = [320, 360, 390, 414, 430, 768, 1366];
const member = {
  memberId: "22222222-2222-4222-8222-222222222222",
  email: "long-name-contact@danzstak.invalid",
  contactEmail: "long-name-contact@danzstak.invalid",
  name: "Alexandria International Touring Collective",
  picture: "",
  preview: "The updated tour schedule and soundcheck details are ready to review.",
  updatedAt: "2026-11-07T12:30:00.000Z",
  unread: 99,
  online: true,
  canContact: true,
  friendStatus: "friends",
};

function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "sync-test@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "SYNC Test Artist", username: "synctest" } };
  if (pathname === "/conversations") return { conversations: [member] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [member] };
  if (pathname === "/calls/devices") return { devices: [] };
  if (pathname === "/calls/inbox") return { events: [] };
  if (pathname === "/settings/presence") return { visible: true };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: width <= 768, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      const row = page.locator('.conversation-row[data-sync-section="chats"]').first();
      await row.waitFor({ state: "visible" });
      const geometry = await row.evaluate(element => {
        const button = element.querySelector(".conversation-user").getBoundingClientRect();
        const avatar = element.querySelector(".conversation-avatar-wrap").getBoundingClientRect();
        const copy = element.querySelector(".conversation-copy").getBoundingClientRect();
        const meta = element.querySelector(".conversation-list-meta").getBoundingClientRect();
        const name = element.querySelector(".conversation-copy strong");
        const preview = element.querySelector(".conversation-copy small");
        return {
          button: { left: button.left, right: button.right, top: button.top, bottom: button.bottom, height: button.height },
          avatar: { left: avatar.left, right: avatar.right, top: avatar.top, bottom: avatar.bottom },
          copy: { left: copy.left, right: copy.right, top: copy.top, bottom: copy.bottom },
          meta: { left: meta.left, right: meta.right, top: meta.top, bottom: meta.bottom },
          nameOverflow: getComputedStyle(name).textOverflow,
          previewOverflow: getComputedStyle(preview).textOverflow,
          callActionsDisplay: getComputedStyle(element.querySelector(".conversation-call-actions")).display,
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      assert.equal(errors.length, 0, `${width}px SYNC browser errors: ${errors.join(" | ")}`);
      assert.ok(geometry.avatar.right <= geometry.copy.left, `${width}px avatar overlaps conversation text: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.copy.right <= geometry.meta.left, `${width}px conversation text overlaps timestamp/unread state: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.avatar.left >= geometry.button.left && geometry.meta.right <= geometry.button.right, `${width}px conversation content escapes its action: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.button.height >= 44, `${width}px conversation action is smaller than 44px: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.nameOverflow, "ellipsis", `${width}px long contact names must truncate cleanly`);
      assert.equal(geometry.previewOverflow, "ellipsis", `${width}px long previews must truncate cleanly`);
      assert.equal(geometry.callActionsDisplay, "none", `${width}px voice/video controls must not crowd the Chats list`);
      assert.ok(geometry.pageWidth <= width, `${width}px SYNC page overflows horizontally: ${JSON.stringify(geometry)}`);
      await page.getByRole("tab", { name: "Calls" }).click();
      const callRow = page.locator('.conversation-row[data-sync-section="calls"]').first();
      await callRow.waitFor({ state: "visible" });
      const callTargets = await callRow.locator(".conversation-call").evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { display: getComputedStyle(element).display, width: rect.width, height: rect.height };
      }));
      assert.equal(callTargets.length, 2, `${width}px Calls must retain voice and video actions`);
      const minimumTarget = width <= 768 ? 44 : 38;
      assert.ok(callTargets.every(target => target.display !== "none" && target.width >= minimumTarget && target.height >= minimumTarget), `${width}px Calls actions must remain visible usable targets: ${JSON.stringify(callTargets)}`);
      await page.getByRole("tab", { name: "Chats" }).click();
      await row.waitFor({ state: "visible" });
      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.locator(".chat-sidebar").screenshot({ path: path.join(captureDir, `sync-inbox-${width}.png`) });
      }
      await context.close();
    }
    console.log(`SYNC conversation-row browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
