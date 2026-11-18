"use strict";
// Edit profile is its own screen (task 19, owner 2026-11-18): full screen with a top bar (Back, title, Save), nothing
// of the profile showing through, no explanation lines, plain rows with chevrons, no Moving Day box, sticky
// Cancel/Save on phones, device Back returns to the profile at the same scroll spot, profile.html?edit=1 opens it.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8151 node browser-checks/profile-edit-screen.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8151").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/profile-edit-screen");
const widths = (process.env.WIDTHS || "320,360,390,430,768,1366").split(",").map(Number);
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const me = "11111111-1111-4111-8111-111111111111";
const posts = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, postId: `p${i}`, authorId: me, authorName: "Night Shift", text: `Show night ${i + 1}: loading in at 6, doors at 8, three bands, one van.`, createdAt: new Date(Date.now() - i * 3600000).toISOString(), visibility: "public" }));

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}
async function open(browser, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 700 }, serviceWorkers: "block", hasTouch: width < 760, isMobile: width < 760, deviceScaleFactor: 2 });
  const page = await ctx.newPage(), state = { errors: [], saves: [] };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: me, email: "me@danzstak.test" } }));
    if (p === "/profiles" && request.method() === "POST") { state.saves.push(JSON.parse(request.postData() || "{}")); return route.fulfill(json({ profile: { ...JSON.parse(request.postData() || "{}"), isOwner: true, cloudProfile: true } })); }
    if (p === "/profiles") return route.fulfill(json({ profile: { memberId: me, isOwner: true, cloudProfile: true, name: "Night Shift", handle: "nightshift", bio: "Oakland punk.", location: "Oakland", work: "", website: "" } }));
    if (p === "/secure-posts" || p === "/posts") return route.fulfill(json({ posts }));
    return route.fulfill(json({}));
  });
  return { ctx, page, state };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const label = `${width}px`, phone = width < 761;
      const { ctx, page, state } = await open(browser, width);
      await page.goto(`${baseUrl}/profile.html`, { waitUntil: "domcontentloaded" });
      const edit = page.locator('button[data-icon="edit"]').first();
      await edit.waitFor({ timeout: 15000 });
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo(0, Math.min(260, document.documentElement.scrollHeight - innerHeight)));
      await page.waitForTimeout(150);
      const before = await page.evaluate(() => window.scrollY);
      await edit.evaluate(button => button.click());
      const panel = page.locator(".edit-profile-panel");
      await panel.waitFor({ state: "visible" });
      assert.match(new URL(page.url()).search, /edit=1/, `${label}: the screen has its own address`);
      const layout = await page.evaluate(() => {
        const panel = document.querySelector(".edit-profile-panel"), r = panel.getBoundingClientRect(), bar = panel.querySelector(".edit-screen-bar").getBoundingClientRect();
        const covered = [[innerWidth / 2, innerHeight - 4], [4, innerHeight / 2], [innerWidth - 4, 60]].every(([x, y]) => panel.contains(document.elementFromPoint(x, y)));
        const text = panel.textContent;
        const sections = [...panel.querySelectorAll(".profile-edit-section")].map(section => { const cs = getComputedStyle(section), summary = section.querySelector("summary"); return { top: cs.borderTopWidth, left: cs.borderLeftWidth, radius: cs.borderTopLeftRadius, height: summary.getBoundingClientRect().height, chevron: getComputedStyle(summary, "::after").borderRightWidth }; });
        const actions = panel.querySelector(".edit-actions").getBoundingClientRect();
        return { rect: [r.left, r.top, r.width, r.height], bar: [bar.top, bar.height], title: panel.querySelector(".edit-screen-bar h2").textContent, save: panel.querySelector(".edit-screen-save").getAttribute("aria-label") || panel.querySelector(".edit-screen-save").textContent, covered, sections,
          sublines: ["This is the name friends and other members will see", "Choose the name you want"].filter(line => text.includes(line)), movingDay: /Moving Day/.test(text), actionsBottom: innerHeight - actions.bottom, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      assert.deepEqual(layout.rect.map(Math.round), [0, 0, width, 700], `${label}: full screen`);
      assert.equal(Math.round(layout.bar[0]), 0, `${label}: top bar at the top`);
      assert.equal(layout.covered, true, `${label}: nothing of the profile, app bar or tabs shows through`);
      assert.equal(layout.title, "Edit Profile"); assert.equal(layout.save.trim(), "Save", `${label}: Save in the top bar`);
      assert.deepEqual(layout.sublines, [], `${label}: no explanation lines`);
      assert.equal(layout.movingDay, false, `${label}: no Moving Day box (Pivot lives in Menu)`);
      for (const section of layout.sections) {
        assert.deepEqual([section.top, section.left, section.radius], ["0px", "0px", "0px"], `${label}: rows, not bordered boxes`);
        assert.ok(section.height >= 44, `${label}: 44px+ rows`); assert.equal(section.chevron, "2px", `${label}: chevron`);
      }
      if (phone) assert.ok(Math.abs(layout.actionsBottom) <= 1, `${label}: Cancel/Save stick to the bottom (${layout.actionsBottom})`);
      assert.equal(layout.overflow, false, `${label}: sideways scroll`);
      if ([360, 390].includes(width)) {
        await shot(page, `1-edit-screen-${width}`);
        await panel.locator(".profile-edit-section summary").filter({ hasText: "More profile details" }).click();
        await shot(page, `2-details-open-${width}`);
      }
      // Device Back returns to the profile at the same scroll spot.
      await page.goBack();
      await panel.waitFor({ state: "hidden" });
      assert.doesNotMatch(new URL(page.url()).search, /edit=1/);
      await page.waitForTimeout(120);
      const after = await page.evaluate(() => window.scrollY);
      assert.ok(Math.abs(after - before) <= 2, `${label}: same scroll spot (${before} -> ${after})`);
      // Save in the top bar saves and closes the screen.
      await edit.evaluate(button => button.click());
      await panel.waitFor({ state: "visible" });
      await panel.locator("[name=bio]").evaluate(field => { field.closest("details").open = true; });
      await panel.locator("[name=bio]").fill("Oakland punk, three chords.");
      await panel.locator(".edit-screen-save").click();
      await panel.waitFor({ state: "hidden" });
      assert.equal(state.saves.at(-1)?.bio, "Oakland punk, three chords.");
      assert.doesNotMatch(new URL(page.url()).search, /edit=1/, `${label}: saving leaves the screen`);
      // profile.html?edit=1 opens straight into Edit profile; Back still lands on the profile.
      await page.goto(`${baseUrl}/profile.html?edit=1`, { waitUntil: "domcontentloaded" });
      await panel.waitFor({ state: "visible", timeout: 15000 });
      await page.goBack();
      await panel.waitFor({ state: "hidden" });
      assert.ok(new URL(page.url()).pathname.endsWith("/profile.html"), `${label}: Back from a direct link stays on the profile`);
      assert.deepEqual(state.errors, [], `${label}: page errors`);
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`Edit profile screen checks passed (${widths.join(", ")}px): full screen with Back / title / Save, nothing showing through, no explanation lines, rows with chevrons, no Moving Day box, sticky Cancel/Save on phones, Back to the same scroll spot, Save closes, ?edit=1 opens it.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
