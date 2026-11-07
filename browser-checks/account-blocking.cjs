"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");

const widths = [320, 390, 414, 768, 1024];
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const own = { memberId: "11111111-1111-4111-8111-111111111111", name: "Privacy Test Artist", handle: "privacytest" };
const friend = { memberId: "22222222-2222-4222-8222-222222222222", email: "friend@danzstak.invalid", name: "Tour Friend", picture: "" };
const blocked = { memberId: "33333333-3333-4333-8333-333333333333", name: "Blocked Member", picture: "", blockedAt: "2026-11-05T00:00:00.000Z" };

function commonFixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: own.memberId, email: "owner@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: { ...own, isOwner: true, cloudProfile: true } };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [friend], incoming: [], outgoing: [] };
  if (pathname === "/calls/directory") return { users: [{ ...friend, online: true, friendStatus: "friends" }] };
  if (pathname === "/people") return { users: [] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/settings/presence") return { onlineVisible: true, allowTags: true, callAlerts: true, messageAlerts: true, darkMode: false, reduceMotion: false, dataSaver: false, language: "en" };
  if (pathname === "/settings/posts") return { hidden: [], pinned: [], saved: [], muted: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      let blockBody = null;
      const friendContext = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      const friendPage = await friendContext.newPage();
      const friendErrors = [];
      friendPage.on("pageerror", error => friendErrors.push(error.message));
      await friendPage.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === "/friends/block" && request.method() === "POST") {
          blockBody = JSON.parse(request.postData() || "{}");
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ blocked: true, memberId: friend.memberId }) });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(commonFixture(url.pathname)) });
      });
      await friendPage.goto(`${baseUrl}/feed.html?view=friends`, { waitUntil: "domcontentloaded" });
      await friendPage.locator(".friend-more-action").waitFor({ state: "visible" });
      await friendPage.locator(".friend-more-action").click();
      const choices = friendPage.locator(".choice-action-dialog .choice-action-button");
      assert.equal(await choices.count(), 2, `${width}px friend privacy dialog must offer remove and block`);
      await friendPage.getByRole("button", { name: "Block member", exact: true }).click();
      await friendPage.waitForFunction(() => document.querySelector(".choice-action-dialog") === null);
      assert.deepEqual(blockBody, { memberId: friend.memberId }, `${width}px block request must contain only the opaque member ID`);
      assert.equal(friendErrors.length, 0, `${width}px Friends errors: ${friendErrors.join(" | ")}`);
      const friendGeometry = await friendPage.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
      assert.ok(friendGeometry.scrollWidth <= width && friendGeometry.bodyWidth <= width, `${width}px Friends block controls overflow: ${JSON.stringify(friendGeometry)}`);
      await friendContext.close();

      let unblocked = false, unblockBody = null;
      const settingsContext = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      const settingsPage = await settingsContext.newPage();
      const settingsErrors = [];
      settingsPage.on("pageerror", error => settingsErrors.push(error.message));
      await settingsPage.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === "/friends/blocked") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ members: unblocked ? [] : [blocked] }) });
        if (url.pathname === "/friends/unblock" && request.method() === "POST") {
          unblockBody = JSON.parse(request.postData() || "{}");
          unblocked = true;
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ unblocked: true, memberId: blocked.memberId }) });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(commonFixture(url.pathname)) });
      });
      await settingsPage.goto(`${baseUrl}/feed.html?view=settings`, { waitUntil: "domcontentloaded" });
      const unblock = settingsPage.getByRole("button", { name: "Unblock Blocked Member" });
      await unblock.waitFor({ state: "visible" });
      const box = await unblock.boundingBox();
      assert.ok(box && (width > 520 || box.height >= 44), `${width}px unblock control is too small: ${JSON.stringify(box)}`);
      await unblock.click();
      await settingsPage.getByRole("button", { name: "Unblock", exact: true }).click();
      await settingsPage.getByText("No blocked members.", { exact: true }).waitFor({ state: "visible" });
      assert.deepEqual(unblockBody, { memberId: blocked.memberId }, `${width}px unblock request must contain only the opaque member ID`);
      assert.equal(settingsErrors.length, 0, `${width}px Settings errors: ${settingsErrors.join(" | ")}`);
      const settingsGeometry = await settingsPage.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, rows: document.querySelectorAll(".blocked-member-row").length }));
      assert.ok(settingsGeometry.scrollWidth <= width && settingsGeometry.bodyWidth <= width, `${width}px blocked-member Settings overflow: ${JSON.stringify(settingsGeometry)}`);
      await settingsContext.close();
    }
    console.log(`Account-blocking browser checks passed at ${widths.join(", ")}px: friend choice, opaque requests, Settings unblock, touch geometry, and zero overflow.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
