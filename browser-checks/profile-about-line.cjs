"use strict";
// Owner 2026-11-19 (About tab screenshot): "Location and work should be on the same line. Get rid of the bio button."
// Checks at 320/360/390/430: Location and Work sit side by side (same top, no overlap, no sideways overflow); a visitor
// who sees only one of them gets it full width; no "+ bio" button in About.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8133 node browser-checks/profile-about-line.cjs   (CAPTURE=dir for screenshots)
const { chromium } = require("playwright");
const path = require("node:path");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8133").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", them = "22222222-2222-4222-8222-222222222222";
const profileFor = owner => owner
  ? { memberId: me, name: "SFScoop", handle: "sfscoop", bio: "", location: "Momo, Italy", work: "Tech", website: "https://example.test/", isOwner: true, cloudProfile: true }
  : { memberId: them, name: "Night Shift", handle: "nightshift", bio: "", location: "Oakland, California, United States of America", work: "", isOwner: false, cloudProfile: true, friendStatus: "none" };
(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, headless: true });
  const failures = [];
  try {
    for (const owner of [true, false]) for (const width of [320, 360, 390, 430]) {
      const label = `${owner ? "owner" : "visitor"} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } } : p === "/profiles" ? { profile: profileFor(owner) } : p === "/secure-posts" ? { posts: [] } : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      await page.goto(`${base}/profile.html${owner ? "" : "?member=" + them}#about`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
      await page.locator('[role="tab"]', { hasText: "About" }).first().click().catch(() => {});
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const box = id => { const el = document.getElementById(id)?.closest(".detail"); if (!el || el.hidden || !el.getClientRects().length) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), left: b.left, right: b.right, width: b.width }; };
        const pair = document.querySelector(".detail-pair")?.getBoundingClientRect();
        return { loc: box("profileLocation"), work: box("profileWork"), pair: pair && { left: pair.left, width: pair.width }, bio: [...document.querySelectorAll("button")].some(b => /\+\s*bio/i.test(b.textContent) && b.getClientRects().length), overflow: document.documentElement.scrollWidth > innerWidth };
      });
      if (r.bio) failures.push(`${label}: a "+ bio" button is visible`);
      if (r.overflow) failures.push(`${label}: sideways overflow`);
      if (owner) {
        if (!r.loc || !r.work) failures.push(`${label}: Location or Work missing ${JSON.stringify(r)}`);
        else if (r.loc.top !== r.work.top || r.loc.right > r.work.left + 0.5) failures.push(`${label}: Location and Work are not on one line ${JSON.stringify(r)}`);
      } else if (!r.loc || r.work || Math.abs(r.loc.width - r.pair.width) > 1) failures.push(`${label}: visitor's lone Location is not full width ${JSON.stringify(r)}`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      if (process.env.CAPTURE && [360, 390].includes(width)) {
        await page.locator(".details").first().scrollIntoViewIfNeeded().catch(() => {});
        await page.screenshot({ path: path.join(process.env.CAPTURE, `about-${owner ? "owner" : "visitor"}-${width}.png`) });
      }
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Profile About line: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exit(1); }
  console.log("Profile About checks passed at 320/360/390/430 (owner and visitor): Location and Work on one line, no + bio.");
})();
