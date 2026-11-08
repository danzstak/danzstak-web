"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430];
const pages = [
  ["home", "feed.html?view=feed", ".post-composer"],
  ["friends", "feed.html?view=friends", ".friend-workspace-row"],
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
        if (name === "home") {
          const install = page.locator("body > .install-app-button");
          await install.waitFor({ state: "visible", timeout: 3000 });
          const headerControls = await page.evaluate(() => {
            const rect = selector => {
              const box = document.querySelector(selector)?.getBoundingClientRect();
              return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null;
            };
            const pivot = rect("#pivotButton");
            const installButton = rect("body > .install-app-button");
            const pivotTarget = pivot
              ? document.elementFromPoint((pivot.left + pivot.right) / 2, (pivot.top + pivot.bottom) / 2)
              : null;
            return {
              pivot,
              install: installButton,
              pivotTarget: Boolean(pivotTarget?.closest?.("#pivotButton")),
              pivotLabel: document.querySelector("#pivotButton")?.textContent?.trim() || ""
            };
          });
          assert.equal(headerControls.pivotLabel, "Pivot", `${width}px Pivot label must remain intact`);
          assert.ok(headerControls.pivot && headerControls.install, `${width}px Pivot and Install controls must both render`);
          assert.ok(headerControls.pivot.right + 4 <= headerControls.install.left, `${width}px Install overlaps Pivot: ${JSON.stringify(headerControls)}`);
          assert.equal(headerControls.pivotTarget, true, `${width}px Pivot center must remain clickable above other controls`);
          assert.ok(headerControls.pivot.width >= 68 && headerControls.pivot.height >= 38, `${width}px Pivot control is clipped: ${JSON.stringify(headerControls.pivot)}`);
          assert.ok(headerControls.install.width >= 36 && headerControls.install.height >= 36, `${width}px Install control is undersized: ${JSON.stringify(headerControls.install)}`);
        }
        if (name === "friends") {
          assert.equal(await page.locator(".friend-workspace-row").count(), 1, `${width}px accepted friend card is missing`);
          assert.match(await page.getByRole("tab", { name: /^Online/ }).textContent() || "", /1$/, `${width}px accepted online friend must appear in the Online tab`);
          assert.match(await page.locator(".friend-message-action").first().getAttribute("aria-label") || "", /^Message\b/, `${width}px accepted friend must open SYNC instead of offering a duplicate request`);
        }
        if (name === "notifications") {
          assert.equal(await page.locator(".notification-row").count(), 2, `${width}px populated notification sources did not remain visible together`);
          const notificationTargets = await page.locator(".notification-row a, .notification-row button").evaluateAll(elements => elements.map(element => {
            const rect = element.getBoundingClientRect();
            return { label: element.getAttribute("aria-label") || element.textContent?.trim() || "", width: rect.width, height: rect.height };
          }));
          assert.ok(notificationTargets.every(target => target.width >= 44 && target.height >= 44), `${width}px notification actions must retain 44px touch targets: ${JSON.stringify(notificationTargets)}`);
        }
        if (name === "chat") {
          assert.equal((await page.locator(".conversation-unread").textContent())?.trim(), "2", `${width}px unread chat badge is missing`);
          assert.equal(await page.locator("body > .chat-header").evaluate(element => getComputedStyle(element).display), "none", `${width}px SYNC must use one phone header, not the desktop header plus the list header`);
          const contactName = await page.locator(".chat-contact-name").first().evaluate(element => ({ text: element.textContent?.trim(), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
          assert.equal(contactName.text, "Tour Friend", `${width}px recent contact name changed unexpectedly`);
          assert.ok(contactName.scrollWidth <= contactName.clientWidth + 1, `${width}px recent contact name is visibly clipped: ${JSON.stringify(contactName)}`);
          const videoCall = await page.locator("#newVideoCall").boundingBox();
          assert.ok(videoCall && videoCall.width >= 44 && videoCall.height >= 44 && videoCall.x >= 0 && videoCall.x + videoCall.width <= width, `${width}px video-call action must remain visible and touchable`);
        }
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
        if (footerClearance) assert.ok(footerClearance.footerBottom <= footerClearance.navTop + 1, `${name} footer is covered by mobile navigation at ${width}px: ${JSON.stringify(footerClearance)}`);
        results.push(`${name}-${width}`);
        await context.close();
      }
    }
    const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
    const desktopPage = await desktop.newPage();
    await desktopPage.route("https://api.danzstak.com/**", route => {
      const url = new URL(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
    });
    await desktopPage.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
    await desktopPage.locator(".post-composer").waitFor({ state: "visible" });
    await desktopPage.locator(".topbar .install-app-button").waitFor({ state: "visible", timeout: 3000 });
    const desktopHeader = await desktopPage.evaluate(() => {
      const rect = selector => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null;
      };
      return {
        pivot: rect("#pivotButton"),
        install: rect(".topbar .install-app-button"),
        scrollWidth: document.documentElement.scrollWidth
      };
    });
    assert.ok(desktopHeader.pivot && desktopHeader.install, "desktop Pivot and Install controls must both render");
    assert.ok(desktopHeader.pivot.right <= desktopHeader.install.left || desktopHeader.install.right <= desktopHeader.pivot.left, `desktop Install overlaps Pivot: ${JSON.stringify(desktopHeader)}`);
    assert.ok(desktopHeader.scrollWidth <= 1366, `desktop header overflows: ${JSON.stringify(desktopHeader)}`);
    if (captureDir) await desktopPage.screenshot({ path: path.join(captureDir, "home-1366.png"), fullPage: true });
    results.push("home-1366");
    await desktop.close();
    console.log(`Core social mobile browser checks passed: ${results.length} page/viewport combinations.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
