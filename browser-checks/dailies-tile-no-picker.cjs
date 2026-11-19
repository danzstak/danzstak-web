"use strict";
// Audit A2 (owner 2026-11-19): Dailies come from posts. Tapping your Dailies tile never opens the phone's photo picker:
// with Dailies of your own it opens them full screen; without, it takes you to the Mix composer.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/dailies-tile-no-picker.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const img = "data:image/svg+xml;utf8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="700"><rect width="400" height="700" fill="#c63"/></svg>');
const story = { storyId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", memberId: me, displayName: "Tour Artist", content: "Load-in", audience: "public", mediaType: "image", mediaUrl: img, createdAt: new Date().toISOString(), isOwner: true };
const fixture = (p, mine) => p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "artist@example.test" } }
  : p === "/profiles" ? { profile: { memberId: me, name: "Tour Artist", handle: "tourartist", cloudProfile: true, isOwner: true } }
  : p === "/stories" ? { stories: mine ? [story] : [], reels: [], dailyTakeCount: 3 }
  : p === "/secure-posts" ? { posts: [] } : p === "/friends" ? { friends: [] } : p === "/calls/inbox" ? { events: [] } : {};
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const mine of [true, false]) for (const width of [360, 390]) {
      const label = `${mine ? "with" : "without"} own Dailies ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      let chooser = false;
      page.on("pageerror", error => errors.push(error.message));
      page.on("filechooser", () => { chooser = true; });
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(fixture(new URL(route.request().url()).pathname, mine)) }));
      await page.goto(`${base}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      const tile = page.locator(".story-create");
      await tile.waitFor({ timeout: 10000 });
      await page.waitForFunction(want => document.querySelector(".story-create")?.dataset.hasDailies === want, mine ? "true" : "false", { timeout: 8000 }).catch(() => failures.push(`${label}: tile never learned whether you have Dailies`));
      const box = await tile.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(700);
      if (chooser) failures.push(`${label}: tapping the Dailies tile opened the photo picker`);
      if (mine) {
        const open = await page.evaluate(() => document.getElementById("storyViewer")?.open === true);
        if (!open) failures.push(`${label}: your Dailies did not open in the viewer`);
      } else {
        const focused = await page.evaluate(() => document.activeElement?.id === "postText");
        if (!focused) failures.push(`${label}: the Mix composer did not open`);
      }
      if (errors.length) failures.push(`${label}: script errors: ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Dailies tile checks passed: no photo picker; your Dailies open full screen, or the composer when you have none.");
})();
