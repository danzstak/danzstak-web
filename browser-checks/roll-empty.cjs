"use strict";
// Audit 36 D5: The Roll's empty state in Mix had its text glued to the left edge of the screen while "The Roll" heading
// above it sat 12px in. Checks at 320/360/390/430px with no Roll videos: the empty-state text starts where the heading's
// text starts, inside the screen, and nothing scrolls sideways.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const url = new URL(route.request().url());
        const body = url.pathname === "/auth/session" ? { authenticated: true, user: { sub: me } }
          : url.pathname === "/profiles" ? { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true } }
          : url.pathname === "/secure-posts" ? { posts: [] } : url.pathname === "/stories" ? { stories: [], reels: [] } : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".reels-rail .reels-empty", { timeout: 8000 });
      const state = await page.evaluate(() => {
        const textLeft = element => { const range = document.createRange(); range.selectNodeContents(element); return Math.round(range.getBoundingClientRect().left); };
        const empty = document.querySelector(".reels-rail .reels-empty"), heading = empty.closest(".reels-rail").querySelector(".reels-heading h3");
        return { empty: textLeft(empty), heading: textLeft(heading), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.ok(state.empty >= 8, `${width}px: the empty-state text is inset from the screen edge ${JSON.stringify(state)}`);
      assert.ok(Math.abs(state.empty - state.heading) <= 1, `${width}px: the empty-state text lines up with "The Roll" ${JSON.stringify(state)}`);
      assert.equal(state.overflow, false, `${width}px: no sideways scroll`);
      assert.deepEqual(errors, [], `${width}px: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    console.log("Roll empty-state checks passed at 320, 360, 390, 430px: the text lines up with \"The Roll\" heading, inset from the edge.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
