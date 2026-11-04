"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const widths = [701, 768, 820, 880, 1024];

function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "tablet-test@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Tablet Test Artist", username: "tabletartist", bio: "", picture: "", cover: "" } };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/settings/presence") return { visible: true };
  if (pathname === "/settings/posts") return { hiddenPostIds: [] };
  if (pathname === "/profile-video") return { video: null };
  if (pathname === "/engagement") return { reactions: [], comments: [], savedPostIds: [], shares: [], views: {} };
  if (pathname === "/calls/inbox") return { events: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url());
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
      });
      await page.goto("http://127.0.0.1:8016/feed.html?view=feed", { waitUntil: "domcontentloaded" });
      await page.locator("#postComposer").waitFor({ state: "visible" });
      const geometry = await page.evaluate(() => {
        const rect = selector => {
          const element = document.querySelector(selector), box = element?.getBoundingClientRect();
          return box ? { left: box.left, right: box.right, width: box.width } : null;
        };
        return {
          viewport: innerWidth,
          documentWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          layout: rect(".layout"),
          main: rect("main"),
          composer: rect("#postComposer"),
          actions: rect("#postComposer .composer-actions"),
          publish: rect("#publishBtn"),
          certification: rect(".original-content-certification")
        };
      });
      assert.equal(errors.length, 0, `${width}px browser errors: ${errors.join(" | ")}`);
      assert.ok(geometry.documentWidth <= width && geometry.bodyWidth <= width, `${width}px feed overflows: ${JSON.stringify(geometry)}`);
      for (const key of ["layout", "main", "composer", "actions", "publish", "certification"]) {
        const box = geometry[key];
        assert.ok(box && box.left >= -0.5 && box.right <= width + 0.5, `${width}px ${key} escapes viewport: ${JSON.stringify(geometry)}`);
      }
      await context.close();
    }
    console.log(`Feed tablet layout checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
