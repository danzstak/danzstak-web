"use strict";
// Directive F4c (owner 2026-11-19): "when a user clicks on the profile picture that is not the account owner they should
// be able to do a horizontal swipe to see previous profile pictures; if it's the account owner it should open to edit".
// Checks with real touch at 360/390px, tapping the centre of the big profile picture:
// - a visitor: the pictures open full screen on the current one with "1 / 3"; swiping left twice shows the oldest
//   ("3 / 3"), right goes back one ("2 / 3"); an up/down swipe does not change picture; ✕ closes;
// - the owner: the tap opens "Change profile picture", not the viewer; "Past profile pictures" lists the earlier ones,
//   and Delete (confirmed) sends that picture's id and takes it off the list.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", artist = "22222222-2222-4222-8222-222222222222";
const svg = colour => `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${colour}"/></svg>`;
const PICTURES = [
  { id: "a".repeat(24), url: `${base}/__pic-now.svg`, at: "2026-11-18T10:00:00.000Z", current: true },
  { id: "b".repeat(24), url: `${base}/__pic-2025.svg`, at: "2025-06-01T10:00:00.000Z" },
  { id: "c".repeat(24), url: `${base}/__pic-2024.svg`, at: "2024-02-01T10:00:00.000Z" }
];

async function open(browser, width, owner) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [], deleted = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`${base}/__pic-*.svg`, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(route.request().url().includes("now") ? "#ff5a1f" : route.request().url().includes("2025") ? "#3366ff" : "#22aa66") }));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), url = new URL(request.url());
    const json = body => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    if (url.pathname === "/auth/session") return json({ authenticated: true, user: { sub: me } });
    if (url.pathname === "/profiles/pictures") {
      if (request.method() === "DELETE") { deleted.push(url.searchParams.get("id")); return json({ deleted: true }); }
      return json({ isOwner: owner, pictures: PICTURES });
    }
    if (url.pathname === "/profiles" || url.pathname === "/profile") {
      return json({ profile: owner
        ? { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true, picture: PICTURES[0].url }
        : { memberId: artist, name: "Tour Friend", username: "tourfriend", handle: "tourfriend", isOwner: false, cloudProfile: true, picture: PICTURES[0].url } });
    }
    return json({});
  });
  await page.goto(`${base}/profile.html${owner ? "" : `?member=${artist}`}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.getElementById("profileInitial")?.classList.contains("has-photo") || getComputedStyle(document.getElementById("profileInitial")).backgroundImage.includes("__pic-now"), null, { timeout: 8000 });
  await page.waitForTimeout(400);
  return { context, page, errors, deleted };
}

async function tapAvatarCentre(page) {
  const point = await page.evaluate(() => {
    const avatar = document.getElementById("profileInitial"); avatar.scrollIntoView({ block: "center" });
    const r = avatar.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { x, y, hit: Boolean(document.elementFromPoint(x, y)?.closest("#profileInitial")) };
  });
  assert.equal(point.hit, true, "the centre of the profile picture is not covered");
  await page.touchscreen.tap(point.x, point.y);
}
async function swipe(page, dx, dy) {
  const cdp = await page.context().newCDPSession(page), x = 195, y = 420;
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (let step = 1; step <= 8; step += 1) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + dx * step / 8, y: y + dy * step / 8 }] }); await new Promise(resolve => setTimeout(resolve, 16)); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForTimeout(450);
}
const viewer = page => page.evaluate(() => {
  const root = document.querySelector(".ds-media-viewer"); if (!root) return null;
  const slides = root.querySelectorAll(".ds-media-viewer-slide"), index = Number(root.dataset.index || 0);
  return { count: root.querySelector(".ds-media-viewer-count")?.textContent.trim() || "", src: (slides[index]?.querySelector("img")?.getAttribute("src") || "").split("/").pop(), sideways: root.classList.contains("ds-media-viewer--x") };
});

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [360, 390]) {
      // Visitor
      let label = `${width}px visitor`;
      let run = await open(browser, width, false);
      const role = await run.page.evaluate(() => [document.getElementById("profileInitial").getAttribute("role"), document.getElementById("profileInitial").getAttribute("aria-label")]);
      assert.deepEqual(role, ["button", "Profile pictures of Tour Friend"], `${label}: the picture is a named button`);
      await tapAvatarCentre(run.page);
      await run.page.waitForSelector(".ds-media-viewer", { timeout: 5000 });
      await run.page.waitForTimeout(300);
      assert.deepEqual(await viewer(run.page), { count: "1 / 3", src: "__pic-now.svg", sideways: true }, `${label}: opens on the current picture`);
      await swipe(run.page, -240, 0); await swipe(run.page, -240, 0);
      assert.deepEqual(await viewer(run.page), { count: "3 / 3", src: "__pic-2024.svg", sideways: true }, `${label}: two swipes left show the oldest`);
      await swipe(run.page, 240, 0);
      assert.deepEqual(await viewer(run.page), { count: "2 / 3", src: "__pic-2025.svg", sideways: true }, `${label}: a swipe right goes back one`);
      await swipe(run.page, 0, -220);
      assert.equal((await viewer(run.page)).count, "2 / 3", `${label}: an up/down swipe doesn't change picture`);
      const close = await run.page.locator(".ds-media-viewer-close").boundingBox();
      await run.page.touchscreen.tap(close.x + close.width / 2, close.y + close.height / 2);
      await run.page.waitForSelector(".ds-media-viewer", { state: "detached", timeout: 5000 });
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();

      // Owner
      label = `${width}px owner`;
      run = await open(browser, width, true);
      await tapAvatarCentre(run.page);
      await run.page.waitForSelector(".profile-photo-sheet[open]", { timeout: 5000 });
      assert.equal(await run.page.locator(".ds-media-viewer").count(), 0, `${label}: the owner's tap edits, it doesn't open the viewer`);
      assert.equal(await run.page.locator(".profile-photo-sheet h2").textContent(), "Change profile picture");
      const past = await run.page.locator('.profile-photo-sheet [data-choice="past"]').boundingBox();
      await run.page.touchscreen.tap(past.x + past.width / 2, past.y + past.height / 2);
      await run.page.waitForSelector(".profile-photo-sheet .profile-past-picture", { timeout: 5000 });
      assert.equal(await run.page.locator(".profile-photo-sheet .profile-past-picture").count(), 2, `${label}: the two earlier pictures, not the current one`);
      const bin = await run.page.evaluate(() => { const button = document.querySelector(".profile-photo-sheet .profile-past-delete"); const r = button.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; });
      assert.ok(bin.w >= 44 && bin.h >= 44, `${label}: Delete is a 44px target`);
      await run.page.touchscreen.tap(bin.x, bin.y);
      await run.page.waitForSelector(".danzstak-confirm-dialog[open]", { timeout: 5000 });
      await run.page.locator(".danzstak-confirm-dialog[open] button", { hasText: "Delete this picture" }).click();
      await run.page.waitForFunction(() => document.querySelectorAll(".profile-photo-sheet .profile-past-picture").length === 1, null, { timeout: 5000 });
      assert.deepEqual(run.deleted, ["b".repeat(24)], `${label}: Delete sends that picture's id`);
      assert.deepEqual(run.errors, [], `${label}: page errors ${run.errors.join(" | ")}`);
      await run.context.close();
    }
    console.log("Profile picture checks passed at 360 and 390px: a visitor's tap on the picture opens the member's pictures full screen and swipes sideways through earlier ones (1 / 3 → 3 / 3 → 2 / 3, up/down doesn't change); the owner's tap opens Change profile picture, where Past profile pictures can be deleted.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
