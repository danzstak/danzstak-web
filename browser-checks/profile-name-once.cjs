"use strict";
// F14 (owner 2026-11-19): "Dachshund Records" showed as the name and again as the bio line under it.
// A bio that only repeats the name (any case, spacing or punctuation) is hidden; a real bio still shows.
// Checks the owner and a visitor at 320/360/390/430.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8133 node browser-checks/profile-name-once.cjs   (CAPTURE=dir for screenshots)
const { chromium } = require("playwright");
const path = require("node:path");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8133").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", them = "22222222-2222-4222-8222-222222222222";
const cases = [
  { label: "bio equals name", bio: "  dachshund   RECORDS. ", shows: false },
  { label: "real bio", bio: "Dachshund Records presses punk 7-inches in Oakland.", shows: true }
];
(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  try {
    for (const item of cases) for (const owner of [true, false]) for (const width of [320, 360, 390, 430]) {
      const label = `${item.label}, ${owner ? "owner" : "visitor"} ${width}px`;
      const profile = { memberId: owner ? me : them, name: "Dachshund Records", handle: "dachshund", bio: item.bio, location: "", work: "", isOwner: owner, cloudProfile: true, friendStatus: "none" };
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } } : p === "/profiles" ? { profile } : p === "/secure-posts" ? { posts: [] } : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      await page.goto(`${base}/profile.html${owner ? "" : "?member=" + them}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => /Dachshund/.test(document.getElementById("profileName")?.textContent || ""), null, { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => {
        const visible = el => el && !el.hidden && el.getClientRects().length && getComputedStyle(el).visibility !== "hidden";
        const header = document.getElementById("profileContent");
        const names = [...(header?.querySelectorAll("h1,h2,p,span,div") || [])].filter(el => visible(el) && el.children.length === 0 && /^\W*dachshund\W*records\W*$/i.test(el.textContent.trim())).length;
        return { bio: visible(document.querySelector(".profile-bio")), names, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      if (r.bio !== item.shows) failures.push(`${label}: bio line ${r.bio ? "shown" : "hidden"}, expected ${item.shows ? "shown" : "hidden"}`);
      if (!item.shows && r.names !== 1) failures.push(`${label}: the name shows ${r.names} times in the header`);
      if (r.overflow) failures.push(`${label}: sideways overflow`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      if (process.env.CAPTURE && [360, 390].includes(width)) await page.screenshot({ path: path.join(process.env.CAPTURE, `name-once-${item.shows ? "bio" : "same"}-${owner ? "owner" : "visitor"}-${width}.png`) });
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Profile name once: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exit(1); }
  console.log("Profile name-once checks passed at 320/360/390/430 (owner and visitor): a bio that repeats the name is hidden, a real bio shows.");
})();
