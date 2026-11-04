"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 390, 414, 430];
const pages = [
  ["home", "feed.html?view=feed"],
  ["friends", "feed.html?view=friends"],
  ["notifications", "feed.html?view=notifications"],
  ["chat", "messages.html"],
  ["profile", "profile.html"],
];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";

function fixture(pathname) {
  const profile = { memberId: "11111111-1111-4111-8111-111111111111", name: "DanzStak Test Artist", username: "testartist", bio: "Independent artist testing the DanzStak mobile experience.", picture: "", cover: "", website: "https://example.com" };
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "test-artist@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/conversations") return { conversations: [] };
  if (pathname === "/calls/devices") return { devices: [] };
  if (pathname === "/calls/inbox") return { events: [] };
  if (pathname === "/settings/presence") return { visible: true };
  if (pathname === "/settings/posts") return { hiddenPostIds: [] };
  if (pathname === "/profile-video") return { video: null };
  if (pathname === "/engagement") return { reactions: [], comments: [], savedPostIds: [], shares: [], views: {} };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  try {
    for (const width of widths) {
      for (const [name, target] of pages) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/**", route => {
          const url = new URL(route.request().url());
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
        });
        await page.goto(`http://127.0.0.1:8016/${target}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(700);
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          mobileNavs: [...document.querySelectorAll(".ds-mobile-nav")].filter(element => getComputedStyle(element).display !== "none").length,
          visibleDialogs: [...document.querySelectorAll("dialog,[role=dialog]")].filter(element => !element.hidden && getComputedStyle(element).display !== "none").length,
        }));
        assert.equal(errors.length, 0, `${name} ${width}px browser errors: ${errors.join(" | ")}`);
        assert.ok(geometry.scrollWidth <= width && geometry.bodyWidth <= width, `${name} overflows at ${width}px: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.mobileNavs <= 1, `${name} renders duplicate mobile navigation at ${width}px`);
        assert.equal(geometry.visibleDialogs, 0, `${name} opens an unsolicited dialog at ${width}px`);
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(50);
        const footerClearance = await page.evaluate(() => {
          const footer = document.querySelector(".site-ownership"), nav = [...document.querySelectorAll(".ds-mobile-nav,.topnav")].find(element => getComputedStyle(element).position === "fixed" && getComputedStyle(element).display !== "none");
          if (!footer || !nav) return null;
          const footerRect = footer.getBoundingClientRect(), navRect = nav.getBoundingClientRect();
          return { footerBottom: footerRect.bottom, navTop: navRect.top };
        });
        if (footerClearance) assert.ok(footerClearance.footerBottom <= footerClearance.navTop, `${name} footer is covered by mobile navigation at ${width}px: ${JSON.stringify(footerClearance)}`);
        if (captureDir) {
          fs.mkdirSync(captureDir, { recursive: true });
          await page.screenshot({ path: path.join(captureDir, `${name}-${width}.png`), fullPage: true });
        }
        results.push(`${name}-${width}`);
        await context.close();
      }
    }
    console.log(`Core social mobile browser checks passed: ${results.length} page/viewport combinations.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
