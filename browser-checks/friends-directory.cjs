"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const captureDir = path.resolve(process.env.DANZSTAK_CAPTURE_DIR || "docs/screenshots/friends-directory");
const widths = process.env.DANZSTAK_TEST_WIDTHS ? process.env.DANZSTAK_TEST_WIDTHS.split(",").map(Number) : [320, 360, 390, 430, 768, 1366];
const friendCount = Math.max(1, Number(process.env.DANZSTAK_FRIEND_COUNT) || 10);
const uuid = number => `${String(number).padStart(8, "0")}-1111-4111-8111-${String(number).padStart(12, "0")}`;
const friends = Array.from({ length: friendCount }, (_, index) => ({
  memberId: uuid(index + 2), email: `friend${index + 1}@example.test`, name: `Friend ${index + 1}`, picture: ""
}));
const incoming = [{ memberId: uuid(40), email: "incoming@example.test", name: "Incoming Artist", picture: "" }];
const outgoing = [{ memberId: uuid(41), email: "outgoing@example.test", name: "Tour Contact", picture: "" }];
const discovery = [{ memberId: uuid(50), email: "sigmund@example.test", name: "Sigmund", picture: "", friendStatus: "none", online: false }];

async function captureViewport(page, file, width) {
  let failure;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height: 900 }, animations: "disabled", caret: "hide" });
      return;
    } catch (error) {
      failure = error;
      await page.waitForTimeout(200);
    }
  }
  throw failure;
}

function payload(url) {
  const route = url.pathname;
  if (route === "/auth/session") return { authenticated: true, user: { sub: uuid(1), email: "artist@example.test" } };
  if (route === "/profiles") return { profile: { memberId: uuid(1), name: "Test Artist", username: "testartist", picture: "", cover: "" } };
  if (route === "/friends") return { friends, incoming, outgoing };
  if (route === "/calls/directory") return { users: friends.map((friend, index) => ({ ...friend, online: index < 3, friendStatus: "friends" })) };
  if (route === "/people") return { users: url.searchParams.get("query")?.toLowerCase().includes("sig") ? discovery : [] };
  if (route === "/stories") return { stories: [], reels: [] };
  if (route === "/secure-posts") return { posts: [] };
  if (route === "/groups") return { groups: [] };
  if (route === "/news") return { articles: [] };
  if (route === "/notifications" || route === "/engagement-notifications") return { notifications: [] };
  if (route === "/settings/posts") return { hiddenPostIds: [] };
  if (route === "/settings/presence") return { visible: true };
  if (route === "/engagement") return { reactions: [], comments: [], savedPostIds: [], shares: [], views: {} };
  return {};
}

(async () => {
  fs.mkdirSync(captureDir, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      console.log(`Checking Friends at ${width}px…`);
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block", reducedMotion: "reduce" });
      const page = await context.newPage();
      page.setDefaultTimeout(5000);
      const errors = [];
      let currentFriends = friends.map(friend => ({ ...friend }));
      let currentIncoming = incoming.map(person => ({ ...person }));
      let currentOutgoing = outgoing.map(person => ({ ...person }));
      const friendActions = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.pathname === "/friends" && request.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ friends: currentFriends, incoming: currentIncoming, outgoing: currentOutgoing }) });
        if (url.pathname === "/friends/respond" && request.method() === "POST") {
          const body = request.postDataJSON();
          friendActions.push({ route: url.pathname, body });
          const person = currentIncoming.find(candidate => candidate.email === body.email);
          currentIncoming = currentIncoming.filter(candidate => candidate.email !== body.email);
          if (body.accept === true && person) currentFriends.push(person);
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ updated: true }) });
        }
        if (url.pathname === "/friends/remove" && request.method() === "POST") {
          const body = request.postDataJSON();
          friendActions.push({ route: url.pathname, body });
          currentFriends = currentFriends.filter(candidate => candidate.memberId !== body.memberId);
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ removed: true }) });
        }
        if (url.pathname === "/friends/request" && request.method() === "POST") {
          const body = request.postDataJSON();
          friendActions.push({ route: url.pathname, body });
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ requested: true }) });
        }
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload(url)) });
      });
      await page.goto(`${baseUrl}/feed.html?view=friends`, { waitUntil: "domcontentloaded" });
      await page.locator(".friend-workspace-row").first().waitFor({ state: "visible" });
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      assert.equal(await page.locator(".friend-workspace-row").count(), friendCount, `${width}px all-friends count`);
      assert.equal(await page.locator(".friend-remove-action").count(), friendCount, `${width}px remove actions exist only inside More menus`);
      const friendSurfaces = await page.locator(".friend-workspace-row").evaluateAll(rows => rows.map(row => {
        const style = getComputedStyle(row);
        const controls = [...row.querySelectorAll("button,summary")].filter(element => getComputedStyle(element).display !== "none").map(element => {
          const rect = element.getBoundingClientRect();
          return { label: element.getAttribute("aria-label") || element.textContent?.trim() || "", width: rect.width, height: rect.height };
        });
        return {
          background: style.backgroundColor,
          radius: style.borderRadius,
          leftBorder: style.borderLeftWidth,
          rightBorder: style.borderRightWidth,
          controls
        };
      }));
      assert.ok(friendSurfaces.every(row => row.background === "rgba(0, 0, 0, 0)" && row.radius === "0px" && row.leftBorder === "0px" && row.rightBorder === "0px"), `${width}px Friends must use one fluid page canvas: ${JSON.stringify(friendSurfaces)}`);
      assert.ok(friendSurfaces.flatMap(row => row.controls).every(control => control.width >= 44 && control.height >= 44), `${width}px Friends controls must retain 44px touch targets: ${JSON.stringify(friendSurfaces)}`);
      const visibleRemovals = await page.locator(".friend-remove-action").evaluateAll(elements => elements.filter(element => getComputedStyle(element).display !== "none" && element.getBoundingClientRect().width > 0).length);
      assert.equal(visibleRemovals, 0, `${width}px remove action must start hidden`);
      // Viewport captures keep the fixed phone navigation in its actual position.
      // Chromium's stitched full-page capture is both visually misleading for fixed
      // elements and intermittently fails on the long populated Friends list.
      await captureViewport(page, path.join(captureDir, `friends-all-${width}-${friendCount}.png`), width);
      await page.getByRole("tab", { name: /^Online/ }).click();
      console.log("  online");
      assert.equal(await page.locator(".friend-workspace-row").count(), Math.min(3, friendCount), `${width}px online filter`);
      await page.getByRole("tab", { name: /^Requests/ }).click();
      console.log("  requests");
      assert.equal(await page.getByRole("button", { name: "Accept" }).count(), 1, `${width}px incoming request action`);
      assert.equal(await page.getByText("Pending", { exact: true }).count(), 1, `${width}px outgoing request state`);
      await page.getByRole("button", { name: "Accept" }).click();
      await page.getByRole("tab", { name: new RegExp(`^All friends ${friendCount + 1}$`) }).waitFor();
      assert.deepEqual(friendActions.at(-1), { route: "/friends/respond", body: { email: incoming[0].email, accept: true } }, `${width}px accept must call the friend-response API with the selected member`);
      await page.getByRole("tab", { name: /^All friends/ }).click();
      const firstFriendRow = page.locator(".friend-workspace-row").filter({ hasText: "Friend 1" }).first();
      await firstFriendRow.locator(".friend-more-menu summary").click();
      await firstFriendRow.getByRole("button", { name: "Remove friend" }).click();
      await page.locator(".choice-action-dialog .choice-action-button", { hasText: "Remove friend" }).click();
      await page.getByRole("tab", { name: new RegExp(`^All friends ${friendCount}$`) }).waitFor();
      assert.deepEqual(friendActions.at(-1), { route: "/friends/remove", body: { memberId: friends[0].memberId } }, `${width}px remove must call the friend-removal API with the selected member`);
      await page.getByRole("searchbox", { name: "Search people" }).fill(`Friend ${friendCount}`);
      assert.equal(await page.locator(".friend-workspace-row").count(), 1, `${width}px local friend search`);
      console.log("  local search");
      await page.getByRole("tab", { name: /^Find friends/ }).click();
      await page.getByRole("searchbox", { name: "Search people" }).fill("Sig");
      console.log("  discovery search");
      await page.getByText("Sigmund", { exact: true }).waitFor({ timeout: 5000 });
      const requestButton = page.getByRole("button", { name: /Send friend request to Sigmund/ });
      assert.equal(await requestButton.count(), 1, `${width}px member discovery`);
      await requestButton.click();
      await page.waitForFunction(() => document.querySelector('.danzstak-app-feedback')?.textContent?.includes("Friend request sent"));
      assert.deepEqual(friendActions.at(-1), { route: "/friends/request", body: { memberId: discovery[0].memberId } }, `${width}px discovery request must call the request API with the selected member`);
      const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth, tabs: [...document.querySelectorAll(".friends-directory-tab")].map(element => ({ text: element.textContent, height: element.getBoundingClientRect().height })) }));
      assert.ok(geometry.scrollWidth <= width && geometry.bodyWidth <= width, `${width}px overflow: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.tabs.every(tab => tab.height >= 44), `${width}px tab touch target: ${JSON.stringify(geometry.tabs)}`);
      await captureViewport(page, path.join(captureDir, `friends-${width}-${friendCount}.png`), width);
      await context.close();
    }
    console.log(`Friends directory browser checks passed at ${widths.join(", ")}px.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
