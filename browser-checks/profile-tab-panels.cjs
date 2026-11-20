"use strict";
// T0-A10b (found 2026-11-19 while fixing A10): your own profile showed the About block (Location / Work / Website,
// "Not added") above Posts, Friends, Photos and Videos. The editor hid it, but `.details{display:block!important}` in
// profile-polish.css beat the hidden attribute. Each tab shows only its own panel: About shows the details, every
// other tab never does, and nothing marked hidden on the profile page is still drawn.
// Checks owner and visitor at 320/360/390/430/1366px.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const viewports = [[320, 568], [360, 780], [390, 844], [430, 932], [1366, 900]];
const me = "11111111-1111-4111-8111-111111111111", them = "22222222-2222-4222-8222-222222222222";
const profileFor = owner => owner
  ? { memberId: me, name: "Night Shift", handle: "nightshift", isOwner: true, cloudProfile: true }
  : { memberId: them, name: "Tour Friend", handle: "tourfriend", location: "Oakland, California", isOwner: false, cloudProfile: true, friendStatus: "none" };
const postsFor = owner => [{ postId: "photo-1", userId: owner ? me : them, authorName: owner ? "Night Shift" : "Tour Friend", content: "Gig photo", createdAt: "2026-11-18T10:00:00.000Z", audience: "public", isOwner: owner, mediaType: "image", mediaUrl: `${base}/assets/danzstak-share-fb-v2.jpg`, commentPolicy: "everyone" }];

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const owner of [true, false]) for (const [width, height] of viewports) {
      const who = owner ? "owner" : "visitor";
      const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 700, hasTouch: width < 700, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const pathname = new URL(route.request().url()).pathname;
        const body = pathname === "/auth/session" ? { authenticated: true, user: { sub: me, email: "night@danzstak.invalid" } }
          : (pathname === "/profiles" || pathname === "/profile") ? { profile: profileFor(owner) }
          : pathname === "/secure-posts" ? { posts: postsFor(owner) } : {};
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      await page.goto(`${base}/profile.html${owner ? "" : "?member=" + them}#posts`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-profile-tab="Posts"][aria-selected="true"]').waitFor({ timeout: 15000 });
      for (const tab of ["Posts", "Friends", "Photos", "Videos", "About"]) {
        const label = `${who} ${width}px ${tab}`;
        // 5a3: a real tap on Friends opens the one Friends screen (checked after this loop); keyboard and scripted
        // selection still switch the tab in place, which is what this panel check needs.
        if (tab === "Friends") await page.locator('[data-profile-tab="Friends"]').evaluate(element => element.click());
        else await page.locator(`[data-profile-tab="${tab}"]`).click();
        await page.waitForTimeout(500);
        const view = await page.evaluate(() => {
          const details = document.querySelector(".details");
          const drawn = element => element.getClientRects().length > 0;
          const stillDrawn = [...document.querySelectorAll("[hidden]")].filter(element => drawn(element) && getComputedStyle(element).display !== "none")
            .map(element => `${element.tagName.toLowerCase()}${element.id ? "#" + element.id : ""}${element.classList.length ? "." + [...element.classList].join(".") : ""}`);
          return { selected: document.querySelector("[data-profile-tab][aria-selected='true']")?.dataset.profileTab || "", detailsDrawn: Boolean(details && drawn(details)), detailsText: details?.innerText.replace(/\s+/g, " ").trim() || "", stillDrawn, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.equal(view.selected, tab, `${label}: the tab is selected`);
        if (tab === "About") {
          assert.equal(view.detailsDrawn, true, `${label}: About shows the profile details`);
          assert.match(view.detailsText, owner ? /Location/i : /Oakland/, `${label}: About lists the details`);
        } else assert.equal(view.detailsDrawn, false, `${label}: the About details must not show on ${tab}: "${view.detailsText}"`);
        assert.deepEqual(view.stillDrawn, [], `${label}: elements marked hidden are still drawn`);
        assert.equal(view.overflow, false, `${label}: no sideways scroll`);
      }
      assert.deepEqual(errors, [], `${who} ${width}px: page errors: ${errors.join(" | ")}`);
      await page.locator('[data-profile-tab="Friends"]').click();
      await page.waitForURL(/\/friends\.html/, { timeout: 10000 });
      await context.close();
    }
    console.log(`Profile tab panel checks passed at ${viewports.map(([width]) => width).join(", ")}px for owner and visitor: the About details show on About only, nothing marked hidden is drawn, and a tap on Friends opens the Friends screen.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
