"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const widths = [390, 1366];

function fixture(pathname, established) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "liana@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: {
    memberId: "11111111-1111-4111-8111-111111111111",
    name: established ? "Liana" : "DanzStak member",
    handle: "danzstak-member",
    picture: `${baseUrl}/assets/danzstak-share-fb-v2.jpg`
  } };
  if (pathname === "/stories") return { dailyTakeCount: 0, stories: [], reels: [] };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [] };
  if (["/calls/directory", "/people"].includes(pathname)) return { users: [] };
  if (["/notifications", "/engagement-notifications"].includes(pathname)) return { notifications: [] };
  if (pathname === "/news") return { articles: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      for (const established of [true, false]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        const profileWrites = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/**", route => {
          const request = route.request();
          const pathname = new URL(request.url()).pathname;
          if (!established && pathname === "/profiles" && request.method() === "POST") {
            const payload = request.postDataJSON();
            profileWrites.push(payload);
            const firstAttempt = profileWrites.length === 1;
            return route.fulfill({
              status: firstAttempt ? 409 : 200,
              contentType: "application/json",
              body: JSON.stringify(firstAttempt
                ? { error: "That username is already taken. Try liana.2 or another username.", suggestion: "liana.2" }
                : { profile: { ...fixture("/profiles", false).profile, name: payload.name, handle: payload.handle } })
            });
          }
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixture(pathname, established))
          });
        });
        await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
        await page.locator("#storiesLoading").waitFor({ state: "detached" });
        await page.waitForFunction(() => {
          const daily = document.querySelector(".story-create-avatar");
          return daily?.tagName === "IMG" && daily.complete && daily.naturalWidth > 0;
        }, { timeout: 5000 });
        const result = await page.evaluate(() => {
          const panel = document.getElementById("profileOnboarding");
          const daily = document.querySelector(".story-create-avatar");
          const panelRect = panel.getBoundingClientRect();
          return {
            panelHidden: panel.hidden,
            panelVisible: !panel.hidden && panelRect.width > 0 && panelRect.height > 0,
            dailyIsImage: daily?.tagName === "IMG",
            dailyLoaded: daily?.tagName === "IMG" && daily.complete && daily.naturalWidth > 0,
            overflow: document.documentElement.scrollWidth > innerWidth
          };
        });
        assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);
        assert.equal(result.overflow, false, `${width}px identity state overflows horizontally`);
        assert.equal(result.dailyIsImage, true, `${width}px Dailies did not use the signed profile image`);
        assert.equal(result.dailyLoaded, true, `${width}px Dailies profile image failed to load`);
        if (established) {
          assert.equal(result.panelHidden, true, `${width}px an established visible name was blocked by internal username setup`);
        } else {
          assert.equal(result.panelVisible, true, `${width}px a genuinely unnamed member did not receive simple onboarding`);
          await page.locator("#profileOnboardingName").fill("Liana");
          await page.locator("#profileOnboardingSave").click();
          await page.locator("#profileOnboardingNext").waitFor({ state: "visible" });
          assert.deepEqual(profileWrites, [
            { name: "Liana", handle: "liana" },
            { name: "Liana", handle: "liana.2" }
          ], `${width}px a duplicate generated username did not retry once with the server suggestion`);
          assert.match(await page.locator("#profileOnboardingStatus").textContent(), /name is ready/i, `${width}px the shared display name did not complete onboarding`);
          assert.equal(await page.locator("#menuProfileName").textContent(), "Liana", `${width}px the visible name was changed to resolve an internal username conflict`);
        }
        await context.close();
      }
    }
    console.log(`Profile-onboarding browser checks passed at ${widths.join(", ")}px: established names enter Mix; only unnamed members see setup.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
