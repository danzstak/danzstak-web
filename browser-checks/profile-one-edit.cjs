"use strict";
// Audit E8/E9 (owner 2026-11-19: "4 of those 5 buttons do the same thing… 2 edit profile"): on your own profile the
// Edit button is the only way into Edit profile (tapping your name does nothing), and the composer has one
// Photo/video button. ?edit=identity still opens the editor at the name.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/profile-one-edit.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const fixture = p => p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } }
  : p === "/profiles" ? { profile: { memberId: me, name: "Night Shift", handle: "nightshift", bio: "", isOwner: true, cloudProfile: true } }
  : p === "/secure-posts" ? { posts: [] } : {};
async function open(browser, width, query = "") {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(fixture(new URL(route.request().url()).pathname)) }));
  await page.goto(`${base}/profile.html${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1800);
  return { context, page, errors };
}
const editorOpen = page => page.evaluate(() => { const panel = document.querySelector(".edit-profile-panel"); return Boolean(panel && !panel.hidden); });
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      let { context, page, errors } = await open(browser, width);
      const name = await page.locator("#profileName").boundingBox();
      await page.touchscreen.tap(name.x + name.width / 2, name.y + name.height / 2);
      await page.waitForTimeout(400);
      if (await editorOpen(page)) failures.push(`${width}px: tapping your name opened Edit profile`);
      const role = await page.locator("#profileName").getAttribute("role");
      if (role === "button") failures.push(`${width}px: your name is still a button`);
      if (/Tap your name/i.test(await page.evaluate(() => document.body.innerHTML))) failures.push(`${width}px: "Tap your name" is still in the page`);
      const labels = await page.$$eval(".profile-create-shortcut", nodes => nodes.map(n => n.getAttribute("aria-label")));
      if (labels.filter(l => /photo|video/i.test(l || "")).length !== 1) failures.push(`${width}px: composer media buttons: ${labels.join(", ")}`);
      await page.getByRole("button", { name: /Edit Profile/i }).first().click();
      await page.waitForTimeout(400);
      if (!(await editorOpen(page))) failures.push(`${width}px: the Edit button did not open Edit profile`);
      if (errors.length) failures.push(`${width}px: script errors: ${errors.join(" | ")}`);
      await context.close();
      ({ context, page, errors } = await open(browser, width, "?edit=identity"));
      const focused = await page.evaluate(() => document.activeElement?.name);
      if (!(await editorOpen(page)) || focused !== "name") failures.push(`${width}px: ?edit=identity did not open the editor at the name (focus: ${focused})`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Profile edit checks passed: the Edit button is the one way in, the name is plain text, one Photo/video button.");
})();
