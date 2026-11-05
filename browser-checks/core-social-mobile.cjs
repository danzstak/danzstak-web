"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430];
const pages = [
  ["home", "feed.html?view=feed", ".post-composer"],
  ["friends", "feed.html?view=friends", ".friend-directory-row"],
  ["notifications", "feed.html?view=notifications", ".notification-row"],
  ["chat", "messages.html", ".conversation-row"],
  ["profile", "profile.html", ".profile"],
];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";

function fixture(pathname) {
  const profile = { memberId: "11111111-1111-4111-8111-111111111111", name: "DanzStak Test Artist", username: "testartist", bio: "Independent artist testing the DanzStak mobile experience.", picture: "", cover: "", website: "https://example.com" };
  const friend = { memberId: "22222222-2222-4222-8222-222222222222", email: "tour-friend@danzstak.invalid", name: "Tour Friend", picture: "" };
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "test-artist@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [friend], incoming: [], outgoing: [] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [{ ...friend, online: true, canContact: true, friendStatus: "friends" }] };
  if (pathname === "/notifications") return { notifications: [{ type: "friend_request", email: friend.email, createdAt: "2026-11-04T20:15:00.000Z", unread: true }] };
  if (pathname === "/engagement-notifications") return { notifications: [{ type: "reaction", memberId: friend.memberId, name: friend.name, postId: "33333333-3333-4333-8333-333333333333", preview: "Love", createdAt: "2026-11-04T20:20:00.000Z", unread: true }] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/conversations") return { conversations: [{ ...friend, contactEmail: friend.email, preview: "The tour route looks good.", updatedAt: "2026-11-04T20:10:00.000Z", unread: 2, online: true, canContact: true }] };
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
      for (const [name, target, populatedSelector] of pages) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/**", route => {
          const url = new URL(route.request().url());
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
        });
        await page.goto(`${baseUrl}/${target}`, { waitUntil: "domcontentloaded" });
        await page.locator(populatedSelector).first().waitFor({ state: "visible" });
        await page.waitForTimeout(100);
        if (name === "friends") {
          assert.match(await page.locator(".feed-online-row button").first().getAttribute("aria-label") || "", /^Message\b/, `${width}px accepted online friend must not offer a duplicate friend request`);
          assert.equal(await page.locator(".friend-directory-row").count(), 1, `${width}px accepted friend card is missing`);
        }
        if (name === "notifications") {
          assert.equal(await page.locator(".notification-row").count(), 2, `${width}px populated notification sources did not remain visible together`);
          const notificationTargets = await page.locator(".notification-row a, .notification-row button").evaluateAll(elements => elements.map(element => {
            const rect = element.getBoundingClientRect();
            return { label: element.getAttribute("aria-label") || element.textContent?.trim() || "", width: rect.width, height: rect.height };
          }));
          assert.ok(notificationTargets.every(target => target.width >= 44 && target.height >= 44), `${width}px notification actions must retain 44px touch targets: ${JSON.stringify(notificationTargets)}`);
        }
        if (name === "chat") assert.equal((await page.locator(".conversation-unread").textContent())?.trim(), "2", `${width}px unread chat badge is missing`);
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          mobileNavs: [...document.querySelectorAll(".ds-mobile-nav")].filter(element => getComputedStyle(element).display !== "none").length,
          visibleDialogs: [...document.querySelectorAll("dialog,[role=dialog]")].filter(element => !element.hidden && getComputedStyle(element).display !== "none").length,
          skipLink: (() => {
            const element = document.querySelector(".skip-link");
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return { focused: element.matches(":focus"), top: rect.top, bottom: rect.bottom, transform: getComputedStyle(element).transform, activeTag: document.activeElement?.tagName || "" };
          })(),
        }));
        assert.equal(errors.length, 0, `${name} ${width}px browser errors: ${errors.join(" | ")}`);
        assert.ok(geometry.scrollWidth <= width && geometry.bodyWidth <= width, `${name} overflows at ${width}px: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.mobileNavs <= 1, `${name} renders duplicate mobile navigation at ${width}px`);
        assert.equal(geometry.visibleDialogs, 0, `${name} opens an unsolicited dialog at ${width}px`);
        assert.ok(!geometry.skipLink?.focused, `${name} moves initial focus to the keyboard-only skip link at ${width}px: ${JSON.stringify(geometry.skipLink)}`);
        assert.ok(!geometry.skipLink || geometry.skipLink.bottom <= 0, `${name} exposes the keyboard-only skip link without keyboard navigation at ${width}px: ${JSON.stringify(geometry.skipLink)}`);
        if (captureDir) {
          fs.mkdirSync(captureDir, { recursive: true });
          // Viewport captures preserve fixed-element composition accurately; Chromium's
          // stitched full-page mode can paint offscreen fixed skip links and navigation
          // at misleading document coordinates.
          await page.screenshot({ path: path.join(captureDir, `${name}-${width}.png`), clip: { x: 0, y: 0, width, height: 844 } });
        }
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(50);
        const footerClearance = await page.evaluate(() => {
          const footer = document.querySelector(".site-ownership"), nav = [...document.querySelectorAll(".ds-mobile-nav,.topnav")].find(element => getComputedStyle(element).position === "fixed" && getComputedStyle(element).display !== "none");
          if (!footer || !nav) return null;
          const footerRect = footer.getBoundingClientRect(), navRect = nav.getBoundingClientRect();
          return { footerBottom: footerRect.bottom, navTop: navRect.top };
        });
        if (footerClearance) assert.ok(footerClearance.footerBottom <= footerClearance.navTop, `${name} footer is covered by mobile navigation at ${width}px: ${JSON.stringify(footerClearance)}`);
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
