"use strict";
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("playwright-core");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8142").replace(/\/$/, "");
const widths = [320, 390, 430, 1366];
const screenshotDir = join(__dirname, "..", "docs", "screenshots", "issue-30-invite-friends");
mkdirSync(screenshotDir, { recursive: true });

function responseFor(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "owner@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Invite Owner", handle: "inviteowner", isOwner: true, cloudProfile: true } };
  if (pathname === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (pathname === "/calls/directory") return { users: [] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/conversations") return { conversations: [] };
  if (pathname === "/messages") return { messages: [] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/settings/presence") return { onlineVisible: true, callAlerts: true, messageAlerts: true };
  if (pathname === "/settings/posts") return { hidden: [], pinned: [], saved: [], muted: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      for (const [pagePath, triggerName] of [["feed.html?view=friends", "Invite a Friend"], ["messages.html", "Invite a Friend"]]) {
        const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/**", route => {
          const url = new URL(route.request().url());
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(responseFor(url.pathname)) });
        });
        await page.goto(`${baseUrl}/${pagePath}`, { waitUntil: "domcontentloaded" });
        const trigger = page.getByRole("button", { name: triggerName }).first();
        await trigger.waitFor({ state: "visible" });
        await trigger.click();
        const dialog = page.getByRole("dialog", { name: "Invite a Friend" });
        await dialog.waitFor({ state: "visible" });
        const message = dialog.getByRole("textbox", { name: "Invitation message" });
        await message.fill("Ciao Sigmund!");
        assert.equal(await message.inputValue(), "Ciao Sigmund!", `${pagePath} invitation copy should be editable`);
        assert.equal(await dialog.getByText("https://danzstak.com/", { exact: true }).isVisible(), true);
        const geometry = await page.evaluate(() => {
          const modal = document.querySelector(".invite-friends-dialog").getBoundingClientRect();
          const buttons = [...document.querySelectorAll(".invite-friends-actions button")].map(button => button.getBoundingClientRect().height);
          return { modal: { left: modal.left, right: modal.right, top: modal.top, bottom: modal.bottom }, width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth, buttons };
        });
        assert.ok(geometry.documentWidth <= width, `${pagePath} at ${width}px should not overflow`);
        assert.ok(geometry.modal.left >= 0 && geometry.modal.right <= width && geometry.modal.top >= 0 && geometry.modal.bottom <= geometry.height, `${pagePath} at ${width}px dialog must fit the viewport`);
        assert.ok(geometry.buttons.every(height => height >= 44), `${pagePath} at ${width}px invite actions need 44px targets`);
        if (width === 390) await page.screenshot({ path: join(screenshotDir, `${pagePath.startsWith("feed") ? "friends" : "sync"}-390.png`) });
        await dialog.getByRole("button", { name: "Close invitation" }).click();
        assert.equal(await trigger.evaluate(element => document.activeElement === element), true, `${pagePath} should restore focus after close`);
        assert.deepEqual(errors, [], `${pagePath} at ${width}px page errors: ${errors.join(" | ")}`);
        await context.close();
      }
    }
    console.log("Invite-friend browser checks passed on Friends and SYNC at 320, 390, 430, and 1366px.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
