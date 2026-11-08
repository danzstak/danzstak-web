"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const widths = [390, 1366];

function fixture(pathname, identityState) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "liana@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: {
    memberId: "11111111-1111-4111-8111-111111111111",
    name: identityState === "named" ? "Liana" : "DanzStak member",
    handle: identityState === "handled" ? "liana" : "danzstak-member",
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
      for (const identityState of ["named", "handled", "new"]) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        const profileWrites = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/**", route => {
          const request = route.request();
          const pathname = new URL(request.url()).pathname;
          if (identityState === "new" && pathname === "/profiles" && request.method() === "POST") {
            const payload = request.postDataJSON();
            profileWrites.push(payload);
            return route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({ profile: { ...fixture("/profiles", "new").profile, name: payload.name } })
            });
          }
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(fixture(pathname, identityState))
          });
        });
        await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
        await page.locator("#storiesLoading").waitFor({ state: "detached" });
        await page.locator("img.story-create-avatar").waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
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
        if (identityState === "named") {
          await page.evaluate(() => {
            document.querySelector(".composer-avatar")?.remove();
            const image = document.querySelector("img.story-create-avatar");
            const placeholder = document.createElement("span");
            placeholder.className = "story-create-avatar";
            placeholder.textContent = "D";
            image?.replaceWith(placeholder);
            window.dispatchEvent(new CustomEvent("danzstak:posts-loaded", { detail: { posts: [{
              isOwner: true,
              userId: "11111111-1111-4111-8111-111111111111",
              authorName: "Liana",
              authorPicture: "/assets/danzstak-share-fb-v2.jpg"
            }] } }));
          });
          await page.locator("img.story-create-avatar").waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
          assert.equal(await page.locator("img.story-create-avatar").count(), 1, `${width}px Dailies hydration still depended on the Mix composer`);
        }
        if (identityState !== "new") {
          assert.equal(result.panelHidden, true, `${width}px an established ${identityState === "named" ? "visible name" : "username"} was blocked by identity setup`);
        } else {
          assert.equal(result.panelVisible, true, `${width}px a genuinely unnamed member did not receive simple onboarding`);
          await page.locator("#profileOnboardingName").fill("Liana");
          await page.locator("#profileOnboardingSave").click();
          await page.locator("#profileOnboarding").waitFor({ state: "hidden" });
          assert.deepEqual(profileWrites, [{ name: "Liana" }], `${width}px the visible-name form attempted to claim or replace a username`);
          assert.equal(await page.locator("#menuProfileName").textContent(), "Liana", `${width}px the visible name was changed to resolve an internal username conflict`);
        }
        await context.close();
      }
    }
    console.log(`Profile-onboarding browser checks passed at ${widths.join(", ")}px: established names and usernames enter Mix; only brand-new identities see dismissible setup.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
