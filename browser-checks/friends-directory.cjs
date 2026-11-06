"use strict";

const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const { chromium } = require("playwright-core");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8018").replace(/\/$/, "");
const widths = [320, 360, 390, 430, 768, 1366];
const screenshotDir = join(__dirname, "..", "docs", "screenshots", "issue-54");
mkdirSync(screenshotDir, { recursive: true });

const member = index => ({
  memberId: `${String(index).padStart(8, "0")}-1111-4111-8111-${String(index).padStart(12, "0")}`,
  email: `friend${index}@danzstak.invalid`,
  name: index === 1 ? "SFScoop" : `Tour Friend ${String(index).padStart(3, "0")}`,
  handle: `tourfriend${index}`,
  picture: "",
  friendStatus: "friends",
  connectedAt: "2026-11-05T00:00:00.000Z"
});
const friends = Array.from({ length: 100 }, (_, index) => member(index + 1));
const incoming = [
  { ...member(201), friendStatus: "incoming", name: "Liana Rossi" },
  { ...member(202), friendStatus: "incoming", name: "Sigmund Stage" }
];
const directory = [
  ...friends.map((person, index) => ({ ...person, online: index < 10 })),
  ...incoming.map(person => ({ ...person, online: true }))
];

function payload(pathname, url) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "owner@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Issue 54 Owner", handle: "issue54", isOwner: true, cloudProfile: true } };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends, incoming, outgoing: [] };
  if (pathname === "/calls/directory") return { users: directory };
  if (pathname === "/people") {
    const query = String(url.searchParams.get("query") || "").toLowerCase();
    return { users: directory.filter(person => person.name.toLowerCase().includes(query)).slice(0, 20) };
  }
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/settings/presence") return { onlineVisible: true, allowTags: true, callAlerts: true, messageAlerts: true, reduceMotion: false, dataSaver: false, language: "en" };
  if (pathname === "/settings/posts") return { hidden: [], pinned: [], saved: [], muted: [] };
  if (pathname === "/conversations") return { conversations: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request();
        const url = new URL(request.url());
        if (url.pathname === "/friends/respond" && request.method() === "POST") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ accepted: JSON.parse(request.postData() || "{}").accept === true }) });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload(url.pathname, url)) });
      });
      await page.goto(`${baseUrl}/feed.html?view=friends`, { waitUntil: "domcontentloaded" });
      await page.getByRole("tab", { name: "All Friends (100)" }).waitFor({ state: "visible" });
      assert.equal(await page.locator(".friend-directory-row").count(), 24, `${width}px should page the initial 100-friend directory`);
      assert.equal(await page.getByRole("button", { name: /Message \(SYNC\):/ }).count(), 24, `${width}px should expose one clear SYNC action per visible friend`);
      assert.equal(await page.getByRole("button", { name: /More options for/ }).count(), 24, `${width}px should use safe More menus instead of exposed delete buttons`);

      const invite = page.getByRole("button", { name: "Invite a Friend" });
      await invite.click();
      const inviteDialog = page.getByRole("dialog", { name: "Invite a Friend" });
      await inviteDialog.waitFor({ state: "visible" });
      assert.equal(await inviteDialog.getByRole("textbox", { name: "Invitation message" }).inputValue().then(value => value.includes("DANZSTAK")), true, `${width}px invitation should provide editable copy`);
      assert.equal(await inviteDialog.getByRole("button", { name: "Text message (SMS)" }).isVisible(), true);
      assert.equal(await inviteDialog.getByRole("button", { name: "Share via apps" }).isVisible(), true);
      assert.equal(await inviteDialog.getByRole("button", { name: "Copy invitation link" }).isVisible(), true);
      const inviteGeometry = await inviteDialog.evaluate(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
      });
      assert.ok(inviteGeometry.left >= 0 && inviteGeometry.right <= width, `${width}px invite dialog must fit horizontally`);
      assert.ok(inviteGeometry.top >= 0 && inviteGeometry.bottom <= inviteGeometry.viewportHeight, `${width}px invite dialog must fit vertically`);
      if (width === 390) await page.screenshot({ path: join(screenshotDir, "friends-invite-390.png"), fullPage: false });
      await inviteDialog.getByRole("button", { name: "Close invitation" }).click();
      assert.equal(await invite.evaluate(element => document.activeElement === element), true, `${width}px closing invite should restore focus`);

      await page.getByRole("tab", { name: "Online (10)" }).click();
      assert.equal(await page.locator(".friend-directory-row").count(), 10, `${width}px Online tab should contain accepted online friends only`);
      await page.getByRole("tab", { name: "Requests (2)" }).click();
      assert.equal(await page.locator(".friend-request-row").count(), 2, `${width}px Requests tab should show pending requests`);
      assert.equal(await page.getByRole("button", { name: "Confirm" }).count(), 2);
      assert.equal(await page.getByRole("button", { name: "Delete" }).count(), 2);
      if (width === 390) await page.screenshot({ path: join(screenshotDir, "friends-requests-390.png"), fullPage: true });

      await page.getByRole("tab", { name: "All Friends (100)" }).click();
      const search = page.getByRole("searchbox", { name: "Search friends" });
      await search.fill("SFScoop");
      assert.equal(await page.locator(".friend-directory-row").count(), 1, `${width}px friend filter should update without a reload`);
      await search.fill("");

      await page.getByRole("tab", { name: "Find Friends" }).click();
      const peopleSearch = page.getByRole("searchbox", { name: "Search people by name" });
      await peopleSearch.fill("Liana");
      await page.locator(".friend-name-results").getByText("Liana Rossi", { exact: true }).waitFor({ state: "visible" });
      assert.equal(await page.getByRole("searchbox", { name: "Search friends" }).isVisible(), false, `${width}px Find Friends should have only one search control`);

      await peopleSearch.focus();
      await page.evaluate(users => window.danzstakApplyFriendsDirectoryPresence?.(users), directory.map((person, index) => ({
        memberId: person.memberId,
        online: index % 2 === 0
      })));
      assert.equal(await peopleSearch.inputValue(), "Liana", `${width}px presence refresh must preserve the Find Friends query`);
      assert.equal(await page.locator(".friend-name-results").getByText("Liana Rossi", { exact: true }).isVisible(), true, `${width}px presence refresh must preserve Find Friends results`);
      assert.equal(await peopleSearch.evaluate(element => document.activeElement === element), true, `${width}px presence refresh must preserve Find Friends focus`);
      if (width === 390) await page.screenshot({ path: join(screenshotDir, "friends-find-390.png"), fullPage: true });

      const geometry = await page.evaluate(() => ({
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        tabList: (() => {
          const rect = document.querySelector(".friends-tabs")?.getBoundingClientRect();
          return rect ? { left: rect.left, right: rect.right, scrollWidth: document.querySelector(".friends-tabs").scrollWidth, clientWidth: document.querySelector(".friends-tabs").clientWidth } : null;
        })(),
        tabs: [...document.querySelectorAll(".friends-tab")].map(tab => {
          const rect = tab.getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
        }),
        rows: [...document.querySelectorAll(".user-search-result")].map(row => ({ left: row.getBoundingClientRect().left, right: row.getBoundingClientRect().right })),
        actions: [...document.querySelectorAll(".user-search-result button, .friend-request-actions button")].map(button => ({ height: button.getBoundingClientRect().height }))
      }));
      assert.ok(geometry.documentWidth <= width && geometry.bodyWidth <= width, `${width}px Friends overflow: ${JSON.stringify(geometry)}`);
      assert.equal(geometry.tabs.length, 4, `${width}px should render all four Friends tabs`);
      assert.ok(geometry.tabs.every(tab => tab.height >= 44), `${width}px tabs should retain 44px touch geometry`);
      assert.ok(geometry.tabs.every(tab => tab.left >= geometry.tabList.left - 0.5 && tab.right <= geometry.tabList.right + 0.5), `${width}px all Friends tabs should remain visible without horizontal scrolling`);
      assert.ok(geometry.tabList.scrollWidth <= geometry.tabList.clientWidth + 1, `${width}px Friends tabs should not require horizontal scrolling`);
      assert.ok(geometry.rows.every(row => row.left >= 0 && row.right <= width + 0.5), `${width}px search rows should remain in the viewport`);
      if (width <= 430) assert.ok(geometry.actions.every(action => action.height >= 44), `${width}px Friends actions should retain 44px touch geometry`);
      assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);

      await page.getByRole("tab", { name: "All Friends (100)" }).click();
      if (width === 390) {
        await page.getByRole("button", { name: "More options for SFScoop" }).click();
        await page.getByRole("dialog").waitFor({ state: "visible" });
        await page.screenshot({ path: join(screenshotDir, "friends-more-390.png"), fullPage: true });
        await page.keyboard.press("Escape");
        await page.getByRole("tab", { name: "All Friends (100)" }).focus();
        await page.keyboard.press("ArrowRight");
        assert.match(await page.locator('[role="tab"][aria-selected="true"]').textContent(), /^Online/, "keyboard arrows should move between friend views");
        await page.getByRole("tab", { name: "All Friends (100)" }).click();
      }
      await page.screenshot({ path: join(screenshotDir, `friends-after-${width}.png`), fullPage: true });
      await context.close();
    }
    console.log(`Issue 54 Friends browser checks passed at ${widths.join(", ")}px: 100-friend paging, online-only filtering, requests, local search, member discovery, touch geometry and zero overflow.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
