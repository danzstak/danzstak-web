"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 768, 1024, 1366];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR
  ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR)
  : path.resolve(__dirname, "..", "docs", "screenshots", "issue-78-account-security");
const ownerId = "11111111-1111-4111-8111-111111111111";
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

function responseFor(endpoint) {
  if (endpoint === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "artist@example.test" } };
  if (endpoint === "/profiles" || endpoint === "/profile") return { profile: { memberId: ownerId, name: "Tour Artist", username: "tourartist", isOwner: true } };
  if (endpoint === "/auth/sessions") return { devices: [
    { deviceId: ownerId, label: "Chrome on Android", current: true, lastUsedAt: 1793970000, expiresAt: 1796562000 },
    { deviceId: "22222222-2222-4222-8222-222222222222", label: "Safari on iPhone or iPad", current: false, lastUsedAt: 1793883600, expiresAt: 1796475600 }
  ] };
  if (endpoint === "/stories") return { stories: [], reels: [] };
  if (endpoint === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (endpoint === "/calls/directory" || endpoint === "/people") return { users: [] };
  if (endpoint === "/calls/devices") return { devices: [] };
  if (endpoint === "/calls/inbox") return { events: [] };
  if (endpoint === "/conversations") return { conversations: [] };
  if (endpoint === "/secure-posts") return { posts: [] };
  if (endpoint === "/groups") return { groups: [] };
  if (endpoint === "/news") return { articles: [] };
  if (endpoint === "/notifications" || endpoint === "/engagement-notifications") return { notifications: [] };
  if (endpoint === "/settings/presence") return { onlineVisible: true, callAlerts: true, messageAlerts: true, language: "en" };
  if (endpoint === "/settings/posts") return { pinned: [], saved: [], muted: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    fs.mkdirSync(captureDir, { recursive: true });
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", hasTouch: width < 700 });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => json(route, responseFor(new URL(route.request().url()).pathname)));
      await page.goto(`${baseUrl}/feed.html?view=settings&security=1`, { waitUntil: "domcontentloaded" });
      const panel = page.locator("#accountSecurityPanel");
      await panel.locator(".account-security-device").first().waitFor({ state: "visible" });

      assert.equal(await page.getByRole("heading", { name: "Signed-in devices" }).isVisible(), true);
      assert.equal(await panel.locator(".account-security-device").count(), 2, `${width}px must show both active sessions`);
      assert.equal(await panel.getByRole("button", { name: "Sign out Safari on iPhone or iPad" }).isVisible(), true);
      assert.equal(await panel.getByRole("button", { name: "Sign out Chrome on Android" }).count(), 0, "the current session must not revoke itself from its row");
      assert.equal(await panel.getByRole("button", { name: "Sign out other devices" }).isVisible(), true);
      assert.doesNotMatch(await panel.textContent(), /artist@example\.test|sessionHash/i, "private account identifiers must not render");

      const geometry = await page.evaluate(() => {
        const panel = document.querySelector("#accountSecurityPanel").getBoundingClientRect();
        const actions = [...document.querySelectorAll("#accountSecurityPanel button:not([hidden])")].map(button => {
          const box = button.getBoundingClientRect();
          return { left: box.left, right: box.right, width: box.width, height: box.height };
        });
        return { panel: { left: panel.left, right: panel.right }, actions, documentWidth: document.documentElement.scrollWidth };
      });
      assert.ok(geometry.panel.left >= -0.5 && geometry.panel.right <= width + 0.5, `${width}px security panel overflows: ${JSON.stringify(geometry.panel)}`);
      assert.ok(geometry.actions.every(action => action.left >= geometry.panel.left - 1 && action.right <= geometry.panel.right + 1), `${width}px security action escapes its panel`);
      if (width < 700) assert.ok(geometry.actions.every(action => action.height >= 43), `${width}px security actions must retain phone touch targets`);
      assert.ok(geometry.documentWidth <= width, `${width}px document has horizontal overflow`);
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      await page.screenshot({ path: path.join(captureDir, `settings-${width}.png`), fullPage: true });

      if (width === 320) {
        await page.evaluate(() => window.danzstakSetLanguage("it"));
        await page.waitForFunction(() => document.querySelector("#accountSecurityHeading")?.textContent === "Dispositivi connessi");
        assert.equal(await page.getByRole("button", { name: "Controlla i dispositivi connessi" }).isVisible(), true);
        assert.ok((await page.evaluate(() => document.documentElement.scrollWidth)) <= width, "Italian account security must not overflow at 320px");
        await page.screenshot({ path: path.join(captureDir, "settings-it-320.png"), fullPage: true });
      }
      await context.close();
    }

    const exportContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", acceptDownloads: true });
    const exportPage = await exportContext.newPage();
    const exportPosts = Array.from({ length: 250 }, (_, index) => ({ postId: `post-${index}`, isOwner: false, content: `Post ${index}`, createdAt: "2026-11-08T12:00:00.000Z" }));
    await exportPage.route("https://api.danzstak.com/**", route => {
      const url = new URL(route.request().url());
      if (url.pathname === "/secure-posts") return json(route, { posts: exportPosts });
      if (url.pathname === "/engagement") return json(route, { myReaction: url.searchParams.get("postId") === "post-249" ? "Fire" : "", comments: [] });
      if (url.pathname === "/groups/membership") return json(route, { groupIds: [] });
      return json(route, responseFor(url.pathname));
    });
    await exportPage.goto(`${baseUrl}/feed.html?view=settings`, { waitUntil: "domcontentloaded" });
    const exportButton = exportPage.getByRole("button", { name: "Download my DanzStak data" });
    await exportButton.waitFor({ state: "visible" });
    const [download] = await Promise.all([exportPage.waitForEvent("download"), exportButton.click()]);
    const archive = JSON.parse(fs.readFileSync(await download.path(), "utf8"));
    assert.equal(archive.reactions.some(reaction => reaction.postId === "post-249" && reaction.reaction === "Fire"), true, "account export omitted activity beyond the former 200-post ceiling");
    assert.equal(archive.incompleteSources.length, 0, "the complete 250-post fixture was reported as incomplete");
    await exportContext.close();

    console.log(`Account-security browser checks passed at ${widths.join(", ")}px; the generated account archive retains activity beyond 200 posts.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
