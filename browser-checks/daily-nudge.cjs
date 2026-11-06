"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_NUDGE_ORIGIN || "http://127.0.0.1:8025").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/issue-25-daily-nudge");
const widths = [320, 360, 390, 414, 430, 768, 1024, 1366];
fs.mkdirSync(output, { recursive: true });

function fixture(url) {
  if (url.pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111" } };
  if (url.pathname === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Nudge Test Member", handle: "nudge-test", cloudProfile: true } };
  if (url.pathname === "/stories") return { stories: [], reels: [] };
  if (url.pathname === "/news") return { items: [] };
  if (url.pathname === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (url.pathname === "/people") return { people: [] };
  if (url.pathname === "/notifications") return { notifications: [] };
  if (url.pathname === "/conversations") return { conversations: [] };
  return { posts: [], items: [] };
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--disable-gpu"] });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", reducedMotion: "reduce" });
      await context.addInitScript(() => {
        if (sessionStorage.getItem("nudgeFixture") === "ready") return;
        localStorage.clear();
        localStorage.setItem("danzstak_daily_nudge_seed_v1", "00000000000000000000000000000001");
        localStorage.setItem("danzstak_language", "en");
        sessionStorage.setItem("nudgeFixture", "ready");
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
      await page.goto(`${origin}/feed.html?nudge-check=${width}`, { waitUntil: "domcontentloaded" });
      const surface = page.locator(".daily-nudge");
      await surface.waitFor({ state: "visible" });
      const result = await surface.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const button = element.querySelector("button").getBoundingClientRect();
        const header = document.querySelector(".topbar").getBoundingClientRect();
        const feed = document.querySelector("#newsFeedView").getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          left: rect.left, right: rect.right, width: rect.width, height: rect.height,
          buttonWidth: button.width, buttonHeight: button.height,
          overlapsHeaderControls: rect.top < header.bottom - 1,
          overlapsFeed: rect.bottom > feed.top + 1,
          parentId: element.parentElement?.id,
          position: style.position,
          documentWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          text: element.querySelector("p").textContent.trim(),
          label: element.getAttribute("aria-label")
        };
      });
      assert.ok(result.left >= 0 && result.right <= width + 0.5, `${width}px nudge must stay inside the viewport`);
      assert.ok(result.buttonWidth >= 44 && result.buttonHeight >= 44, `${width}px dismiss target must be 44px`);
      assert.equal(result.documentWidth, result.viewport, `${width}px page must not overflow`);
      assert.equal(result.overlapsHeaderControls, false, `${width}px nudge must not block the header`);
      assert.equal(result.overlapsFeed, false, `${width}px nudge must not cover the feed`);
      assert.equal(result.parentId, "yourMixMain", `${width}px nudge must be inside the primary content flow`);
      assert.notEqual(result.position, "fixed", `${width}px nudge must not be a floating overlay`);
      assert.ok(result.text.length > 10 && result.label === "Daily Nudge", `${width}px nudge needs readable semantics`);
      assert.equal(errors.length, 0, `${width}px page errors: ${errors.join("; ")}`);
      await page.screenshot({ path: path.join(output, `daily-nudge-${width}.png`), fullPage: false });
      await surface.locator("button").click();
      await surface.waitFor({ state: "detached" });
      await page.reload({ waitUntil: "domcontentloaded" });
      assert.equal(await page.locator(".daily-nudge").count(), 0, `${width}px reload must not show a second nudge that day`);
      await context.close();
    }

    const context = await browser.newContext({ viewport: { width: 320, height: 844 }, serviceWorkers: "block" });
    await context.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("danzstak_daily_nudge_seed_v1", "00000000000000000000000000000002");
      localStorage.setItem("danzstak_language", "it");
    });
    const page = await context.newPage();
    await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
    await page.goto(`${origin}/feed.html?nudge-language=1`, { waitUntil: "domcontentloaded" });
    const surface = page.locator(".daily-nudge");
    await surface.waitFor({ state: "visible" });
    const index = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("danzstak_daily_nudge_choices_v1")))[0]);
    assert.equal(await surface.getAttribute("aria-label"), "Pensiero del giorno");
    assert.equal(await surface.locator("p").textContent(), await page.evaluate(index => window.DanzStakDailyNudgeCore.text(index, "it"), index));
    await page.evaluate(() => { document.documentElement.lang = "ja"; });
    await page.waitForFunction(index => document.querySelector(".daily-nudge p")?.textContent === window.DanzStakDailyNudgeCore.text(index, "ja"), index);
    assert.equal(await surface.getAttribute("aria-label"), "今日のひとこと");
    assert.equal(await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("danzstak_daily_nudge_choices_v1")))[0]), index, "language changes must preserve the selected thought");
    await context.close();

    const timedContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", reducedMotion: "reduce" });
    await timedContext.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem("danzstak_daily_nudge_seed_v1", "00000000000000000000000000000003");
    });
    const timedPage = await timedContext.newPage();
    await timedPage.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
    await timedPage.goto(`${origin}/feed.html?nudge-timer=1`, { waitUntil: "domcontentloaded" });
    await timedPage.locator(".daily-nudge").waitFor({ state: "visible" });
    await timedPage.waitForTimeout(7250);
    assert.equal(await timedPage.locator(".daily-nudge").count(), 0, "the unfocused nudge must leave after about seven seconds");
    await timedContext.close();

    console.log(`Daily Nudge browser checks passed at ${widths.join(", ")}px: compact geometry, 44px dismissal, once-per-day persistence, localization and no overflow.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
