"use strict";
// Profile with no bio and no posts (fix-it 18, owner 2026-11-17): no instructional bio placeholder — visitors see
// nothing, the owner sees one small "+ bio" that opens the editor; an empty wall shows one friendly "No posts yet" line.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/profile-empty.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const prefix = process.env.SHOTS || "after";
const output = path.resolve("docs/screenshots/profile-empty");
const ownerId = "11111111-1111-4111-8111-111111111111", visitorId = "22222222-2222-4222-8222-222222222222";
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const owner of [true, false]) for (const width of [320, 360, 390, 430]) {
      const who = owner ? "owner" : "visitor", label = `${who} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: owner ? ownerId : visitorId, email: "a@example.test" } }
          : p === "/profiles" ? { profile: { memberId: ownerId, name: "Night Shift", handle: "nightshift", bio: "", isOwner: owner, cloudProfile: true } }
          : p === "/secure-posts" ? { posts: [] } : p === "/stories" ? { stories: [] } : {};
        route.fulfill(json(body));
      });
      await page.goto(`${baseUrl}/profile.html${owner ? "" : "?member=" + ownerId}#posts`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1800);
      const state = await page.evaluate(() => {
        const visible = n => n && n.getBoundingClientRect().height > 0 && getComputedStyle(n).display !== "none";
        const add = document.querySelector(".profile-add-bio");
        return { placeholder: /Add a short bio so people know more about you/.test(document.body.innerText), addBio: visible(add), addBioHeight: add?.getBoundingClientRect().height || 0, empty: [...document.querySelectorAll(".profile-empty-wall, .profile-tab-message")].some(n => visible(n) && /No posts yet/.test(n.textContent)) };
      });
      if (state.placeholder) failures.push(`${label}: instructional bio placeholder is shown`);
      // Owner 2026-11-19: "+ bio" is for the account holder only and opens the long-form bio.
      if (owner && (!state.addBio || state.addBioHeight < 43.5)) failures.push(`${label}: owner has no 44px "+ bio"`);
      if (!owner && state.addBio) failures.push(`${label}: a visitor sees "+ bio"`);
      if (owner && state.addBio) {
        await page.locator(".profile-add-bio").click();
        await page.waitForTimeout(500);
        if (!(await page.evaluate(() => ["story", "bio"].includes(document.activeElement?.getAttribute("name"))))) failures.push(`${label}: "+ bio" does not land in the bio field`);
        await page.keyboard.press("Escape").catch(() => {});
      }
      if (owner && !state.empty) failures.push(`${label}: empty wall shows nothing under the composer`);
      if ([360, 390].includes(width)) await page.screenshot({ path: path.join(output, `${prefix}-${who}-${width}.png`) });
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) { console[process.env.AUDIT_ONLY ? "log" : "error"](`Profile empty states: ${unique.length} problem(s)\n- ${unique.join("\n- ")}`); if (!process.env.AUDIT_ONLY) process.exitCode = 1; return; }
  console.log("Profile empty-state checks passed: no bio placeholder, owner-only 44px \"+ bio\" opens the bio, empty wall says \"No posts yet\".");
})().catch(error => { console.error(error); process.exitCode = 1; });
