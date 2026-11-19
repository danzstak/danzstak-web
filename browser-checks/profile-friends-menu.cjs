"use strict";
// Audit E10 (2026-11-19): on a friend's profile "Friends" was a dead, disabled button. Like Facebook it is
// "Friends ▾": tap → Unfriend / Block; Unfriend turns it back into Add friend.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/profile-friends-menu.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", friendId = "22222222-2222-4222-8222-222222222222";
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [], calls = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request(), p = new URL(request.url()).pathname;
        if (request.method() === "POST") calls.push(p);
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } }
          : p === "/profiles" ? { profile: { memberId: friendId, name: "Scene Friend", handle: "scenefriend", isOwner: false, cloudProfile: true } }
          : p === "/friends" ? { friends: [{ memberId: friendId, name: "Scene Friend" }] }
          : p === "/friends/remove" ? { removed: true }
          : p === "/secure-posts" ? { posts: [] } : {};
        route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      await page.goto(`${base}/profile.html?member=${friendId}`, { waitUntil: "domcontentloaded" });
      const button = page.locator(".profile-friend-action").first();
      await page.waitForFunction(() => document.querySelector(".profile-friend-action")?.dataset.state === "friends", null, { timeout: 8000 }).catch(() => failures.push(`${width}px: never showed the Friends state`));
      if (await button.isDisabled()) failures.push(`${width}px: the Friends button is disabled (dead)`);
      const label = await button.getAttribute("aria-label");
      if (!/Friend options/.test(label || "")) failures.push(`${width}px: accessible name is "${label}", not a Friend options button`);
      const box = await button.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      const dialog = page.locator("dialog.danzstak-confirm-dialog");
      if (!(await dialog.isVisible().catch(() => false))) { await page.waitForTimeout(400); }
      if (!(await dialog.isVisible().catch(() => false))) failures.push(`${width}px: tapping Friends ▾ opened no options`);
      else {
        const labels = await dialog.locator("button").allInnerTexts();
        if (!labels.includes("Unfriend") || !labels.includes("Block")) failures.push(`${width}px: options are ${labels.join(", ")}`);
        await dialog.getByRole("button", { name: "Unfriend" }).click();
        await page.waitForTimeout(600);
        if (!calls.includes("/friends/remove")) failures.push(`${width}px: Unfriend sent nothing`);
        if (await button.getAttribute("data-state") !== "none") failures.push(`${width}px: after Unfriend the button did not return to Add friend`);
      }
      if (errors.length) failures.push(`${width}px: script errors: ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Friends menu checks passed: Friends ▾ opens Unfriend / Block; Unfriend returns the button to Add friend.");
})();
