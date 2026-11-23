"use strict";
// Owner 2026-11-23 (his profile on the phone): "Text hangs on till refresh behind the profile picture". After Edit profile
// → Save, "Profile saved to your DanzStak account." went into the page's loading line under the cover, which was then left
// on show, half under the profile picture, until the page was reloaded.
// Real browser, touch, own profile at 320/360/390/430px:
//   - Edit (centre tap) → Save (centre tap): the result shows as a short message that goes away by itself (gone within 5 s);
//   - the loading line under the cover stays hidden, and nothing is left between the cover and the name;
//   - a failed save says why and keeps the editor open, and the loading line still stays hidden.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/profile-save-status.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const profile = { memberId: me, name: "Eroticon", username: "eroticon", handle: "eroticon", isOwner: true, cloudProfile: true, bio: "All that and some" };

async function centreTap(page, locator, label) {
  const spot = await locator.evaluate(node => { node.scrollIntoView({ block: "center" }); const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, hit: node.contains(document.elementFromPoint(x, y)) }; });
  assert.ok(spot.hit, `${label}: covered where it's tapped`);
  await page.touchscreen.tap(spot.x, spot.y);
}

async function run(browser, width, fail) {
  const tag = `${width}px${fail ? " failed save" : ""}`;
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    if (p === "/auth/session") return json({ authenticated: true, user: { sub: me } });
    if (p === "/profiles" && request.method() !== "GET") return fail ? json({ error: "Couldn't save your profile right now. Try again in a minute." }, 503) : json({ profile });
    if (p === "/profiles") return json({ profile });
    return json({});
  });
  await page.goto(`${base}/profile.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#profileContent").waitFor({ state: "visible", timeout: 10000 });
  const edit = page.locator('.profile-actions button[data-icon="edit"]').first();
  await centreTap(page, edit, `${tag} Edit`);
  const form = page.locator("form.edit-profile-panel");
  await form.waitFor({ state: "visible", timeout: 5000 });
  await centreTap(page, form.locator("button[type=submit]"), `${tag} Save`);
  const toast = page.locator(".danzstak-app-feedback").filter({ hasText: fail ? "Couldn't save your profile" : "Profile saved to your DanzStak account." }).first();
  await toast.waitFor({ state: "visible", timeout: 5000 });
  const line = () => page.evaluate(() => { const status = document.getElementById("profileStatus"); return { hidden: status.hidden, shown: status.getClientRects().length > 0 }; });
  assert.deepEqual(await line(), { hidden: true, shown: false }, `${tag}: the loading line under the cover stays hidden`);
  if (fail) assert.equal(await form.isVisible(), true, `${tag}: the editor stays open to fix it`);
  else {
    assert.equal(await form.isVisible(), false, `${tag}: the editor closes after saving`);
    await toast.waitFor({ state: "hidden", timeout: 5000 });
    assert.deepEqual(await line(), { hidden: true, shown: false }, `${tag}: nothing comes back under the cover`);
    const gap = await page.evaluate(() => {
      return [...document.querySelectorAll(".card > *")].filter(el => el.getClientRects().length && !el.matches(".cover, #profileContent")).map(el => el.id || el.className);
    });
    assert.deepEqual(gap, [], `${tag}: nothing else shows between the cover and the profile`);
  }
  await context.close();
  assert.deepEqual(errors, [], `${tag}: page errors`);
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) await run(browser, width, false);
    await run(browser, 390, true);
  } finally { await browser.close(); }
  console.log("Profile save checks passed: Edit → Save shows a short message that goes away by itself, the loading line under the cover never comes back (320-430px), and a failed save says why with the editor still open.");
})().catch(error => { console.error(error); process.exit(1); });
