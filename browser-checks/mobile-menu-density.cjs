"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 768, 1366];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";

function fixture(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "menu-test@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "DanzStak Test Artist", username: "testartist", picture: "" } };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/settings/presence") return { visible: true };
  if (pathname === "/settings/posts") return { hiddenPostIds: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
      });
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      if (width <= 700) {
        await page.locator(".mobile-menu-control").click();
        await page.locator("body.mobile-menu-open").waitFor();
        await page.waitForTimeout(250);
      } else {
        await page.locator(".left").waitFor({ state: "visible" });
      }

      const geometry = await page.evaluate(() => {
        const drawer = document.querySelector(".left");
        const menu = drawer.querySelector(".menu");
        const rows = [...menu.querySelectorAll(":scope > a, :scope > button.menu-action")].filter(element => getComputedStyle(element).display !== "none");
        const headings = [...menu.querySelectorAll(".menu-section-heading")];
        const rowRects = rows.map(element => element.getBoundingClientRect());
        const drawerRect = drawer.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        return {
          bodyOverflow: getComputedStyle(document.body).overflow,
          drawer: { left: drawerRect.left, right: drawerRect.right, width: drawerRect.width, overflowY: getComputedStyle(drawer).overflowY },
          menu: { top: menuRect.top, bottom: menuRect.bottom, height: menuRect.height },
          rowHeights: rowRects.map(rect => Math.round(rect.height)),
          rowTops: rowRects.map(rect => Math.round(rect.top)),
          headingMargins: headings.map(element => ({ top: parseFloat(getComputedStyle(element).marginTop), bottom: parseFloat(getComputedStyle(element).marginBottom) })),
          closeVisible: getComputedStyle(document.querySelector(".menu-close")).display !== "none",
          horizontalOverflow: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) > innerWidth,
        };
      });

      assert.equal(errors.length, 0, `${width}px menu browser errors: ${errors.join(" | ")}`);
      assert.ok(!geometry.horizontalOverflow, `${width}px menu causes horizontal overflow: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.rowHeights.every(height => height >= 44 && height <= 52), `${width}px menu rows must remain 44-52px: ${JSON.stringify(geometry.rowHeights)}`);
      assert.ok(geometry.rowTops.every((top, index) => index === 0 || top >= geometry.rowTops[index - 1] + geometry.rowHeights[index - 1]), `${width}px menu rows overlap or reverse order`);
      assert.ok(geometry.headingMargins.every(margin => margin.top <= 12 && margin.bottom <= 8), `${width}px section headings use excessive spacing: ${JSON.stringify(geometry.headingMargins)}`);
      assert.ok(geometry.menu.height < geometry.rowHeights.reduce((sum, height) => sum + height, 0) + 220, `${width}px menu distributes rows across empty viewport space`);
      if (width <= 700) {
        assert.ok(geometry.drawer.left >= -1 && geometry.drawer.right <= width + 1, `${width}px drawer escapes the viewport: ${JSON.stringify(geometry.drawer)}`);
        assert.ok(geometry.drawer.width <= 340 && geometry.drawer.width >= Math.min(width * 0.8, 340), `${width}px drawer width is not compact and usable: ${JSON.stringify(geometry.drawer)}`);
        assert.equal(geometry.drawer.overflowY, "auto", `${width}px drawer must own its scrolling region`);
        assert.equal(geometry.bodyOverflow, "hidden", `${width}px background must not scroll while the menu is open`);
        assert.equal(geometry.closeVisible, true, `${width}px menu close control is missing`);
      } else {
        assert.ok(geometry.drawer.left >= 0 && geometry.drawer.right <= width + 1, `${width}px desktop menu escapes the viewport: ${JSON.stringify(geometry.drawer)}`);
        assert.equal(geometry.closeVisible, false, `${width}px desktop menu must not show the drawer close control`);
      }

      if (captureDir) {
        fs.mkdirSync(captureDir, { recursive: true });
        await page.screenshot({ path: path.join(captureDir, `mobile-menu-${width}.png`) });
      }
      await context.close();
    }
    console.log(`Mobile menu density browser checks passed: ${widths.length} viewport widths.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
