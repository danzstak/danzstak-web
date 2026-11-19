"use strict";
// Audit A4/A5 (2026-11-19): Saved crashed on load (a variable used before it was declared) and Record Stores crashed
// for a member with no saved store list. Every screen here must load for a brand-new member with no script errors.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/load-crashes.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const fixture = p => p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "new@example.test" } }
  : p === "/profiles" ? { profile: { memberId: me, name: "New Member", handle: "newmember", cloudProfile: true, isOwner: true } }
  : p === "/secure-posts" ? { posts: [] } : p === "/stories" ? { stories: [], reels: [] } : {};
const screens = [
  ["feed.html#saved", /No saved posts yet/],
  ["feed.html#friends", null], ["feed.html#photos", null], ["feed.html#videos", null], ["feed.html#settings", null],
  ["feed.html#events", null], ["feed.html#groups", null], ["feed.html#hq", null], ["feed.html#notifications", null],
  ["record-stores.html", /build a private outreach list/i]
];
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const [path, expected] of screens) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(fixture(new URL(route.request().url()).pathname)) }));
      await page.goto(`${base}/${path}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      if (errors.length) failures.push(`${path}: script errors: ${[...new Set(errors)].join(" | ")}`);
      const body = await page.evaluate(() => document.body.innerText);
      if (/Cannot read properties|before initialization|is not a function|\bundefined\b/.test(body)) failures.push(`${path}: raw error text on screen`);
      if (expected && !expected.test(body)) failures.push(`${path}: expected ${expected} on screen`);
      if (path === "record-stores.html") {
        await page.locator("#recordStoreLocation").fill("");
        await page.locator("#recordStoreForm button[type=submit], #recordStoreForm [type=submit]").first().click();
        await page.waitForTimeout(300);
        if (!/Type a city or region first/.test(await page.locator("#recordStoreStatus").innerText())) failures.push("record-stores.html: an empty search says nothing");
      }
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log(`Load checks passed: ${screens.length} screens open for a new member with no script errors (Saved and Record Stores included).`);
})();
