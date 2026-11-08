"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const captureDir = path.resolve(process.env.DANZSTAK_CAPTURE_DIR || "docs/screenshots/invite-friends");
const widths = process.env.DANZSTAK_TEST_WIDTHS ? process.env.DANZSTAK_TEST_WIDTHS.split(",").map(Number) : [320, 360, 390, 430, 768, 1366];
const uuid = value => `${String(value).padStart(8, "0")}-1111-4111-8111-${String(value).padStart(12, "0")}`;

function payload(url) {
  if (url.pathname === "/auth/session") return { authenticated: true, user: { sub: uuid(1), email: "artist@example.test" } };
  if (url.pathname === "/profiles") return { profile: { memberId: uuid(1), name: "Test Artist", username: "testartist" } };
  if (url.pathname === "/friends") return { friends: [{ memberId: uuid(2), email: "friend@example.test", name: "Friend One" }], incoming: [], outgoing: [] };
  if (url.pathname === "/calls/directory") return { users: [{ memberId: uuid(2), email: "friend@example.test", name: "Friend One", friendStatus: "friends", online: true }] };
  if (url.pathname === "/messages/users" || url.pathname === "/messages/conversations") return { users: [], conversations: [] };
  if (url.pathname === "/settings/presence") return { visible: true };
  if (url.pathname === "/settings/posts") return { hiddenPostIds: [] };
  if (url.pathname === "/engagement") return { reactions: [], comments: [], savedPostIds: [], shares: [], views: {} };
  if (url.pathname === "/stories") return { stories: [], reels: [] };
  if (url.pathname === "/secure-posts") return { posts: [] };
  if (url.pathname === "/groups") return { groups: [] };
  if (url.pathname === "/news") return { articles: [] };
  if (url.pathname.includes("notifications")) return { notifications: [] };
  return {};
}

async function prepare(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: async data => { window.__sharedInvite = data; } });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async value => { window.__copiedInvite = value; } } });
  });
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload(url)) });
  });
}

async function exercise(page, button, label, screenshotPath) {
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Invite a friend" });
  await dialog.waitFor({ state: "visible" });
  const textarea = dialog.getByRole("textbox", { name: "Invitation message" });
  await textarea.fill("Come to DanzStak with me.");
  const sms = dialog.getByRole("link", { name: "Text message" });
  const href = await sms.getAttribute("href");
  assert.match(href, /^sms:\?body=/, `${label}: Android SMS handoff`);
  assert.ok(decodeURIComponent(href).includes("Come to DanzStak with me.\nhttps://danzstak.com/"), `${label}: edited invitation and public URL`);
  await dialog.getByRole("button", { name: "Share via apps" }).click();
  assert.equal(await page.evaluate(() => window.__sharedInvite?.url), "https://danzstak.com/", `${label}: native share URL`);
  await dialog.getByRole("button", { name: "Copy invitation link" }).click();
  assert.equal(await page.evaluate(() => window.__copiedInvite), "https://danzstak.com/", `${label}: copy fallback URL`);
  assert.equal(await dialog.getByRole("status").textContent(), "Invitation link copied.", `${label}: copy feedback`);
  const targets = await dialog.locator(".invite-action").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().height));
  assert.ok(targets.every(height => height >= 44), `${label}: invite target below 44px: ${JSON.stringify(targets)}`);
  if (screenshotPath) await page.screenshot({ path: screenshotPath, fullPage: true });
  await dialog.getByRole("button", { name: "Close" }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await button.evaluate(element => element === document.activeElement), true, `${label}: focus returns to opener`);
}

(async () => {
  fs.mkdirSync(captureDir, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, locale: "en-US", serviceWorkers: "block" });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await prepare(page);

      await page.goto(`${baseUrl}/feed.html?view=friends`, { waitUntil: "domcontentloaded" });
      const friendsInvite = page.getByRole("button", { name: "Invite a friend" });
      await friendsInvite.waitFor({ state: "visible" });
      await exercise(page, friendsInvite, `${width}px Friends`, path.join(captureDir, `friends-invite-${width}.png`));

      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      const syncInvite = page.getByRole("button", { name: "Invite a friend" });
      await syncInvite.waitFor({ state: "visible" });
      await exercise(page, syncInvite, `${width}px SYNC`, path.join(captureDir, `sync-invite-${width}.png`));

      const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(geometry.scrollWidth <= width, `${width}px horizontal overflow: ${JSON.stringify(geometry)}`);
      assert.deepEqual(errors, [], `${width}px browser errors: ${errors.join(" | ")}`);
      await context.close();
    }

    const iosContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: "en-US",
      serviceWorkers: "block",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    });
    const iosPage = await iosContext.newPage();
    iosPage.setDefaultTimeout(7000);
    await prepare(iosPage);
    await iosPage.goto(`${baseUrl}/feed.html?view=friends`, { waitUntil: "domcontentloaded" });
    await iosPage.getByRole("button", { name: "Invite a friend" }).click();
    const iosDialog = iosPage.getByRole("dialog", { name: "Invite a friend" });
    await iosDialog.getByRole("textbox", { name: "Invitation message" }).fill("Come to DanzStak with me.");
    const iosHref = await iosDialog.getByRole("link", { name: "Text message" }).getAttribute("href");
    assert.match(iosHref, /^sms:&body=/, "iPhone SMS handoff uses the iOS URI form");
    assert.ok(decodeURIComponent(iosHref).includes("Come to DanzStak with me.\nhttps://danzstak.com/"), "iPhone handoff retains edited text and public URL");
    await iosContext.close();

    console.log(`Invite Friends browser checks passed at ${widths.join(", ")}px in Friends and SYNC.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
