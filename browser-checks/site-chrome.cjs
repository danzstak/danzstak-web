"use strict";
// Whole-site fix-it items (owner 2026-11-17), Mix / Music HQ / Events / Settings at 360 and 390px (plus 320/430):
// - no © footer at the bottom of signed-in pages (it's in Settings with Privacy and Terms);
// - no explanatory sub-line under workspace titles;
// - links that leave DanzStak (SoundCloud, Mixcloud, YouTube) open outside the app (new tab / system app).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/site-chrome.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const prefix = process.env.SHOTS || "after";
const output = path.resolve("docs/screenshots/site-chrome");
const ownerId = "11111111-1111-4111-8111-111111111111";
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const posts = [{ postId: "33333333-3333-4333-8333-333333333331", userId: ownerId, authorName: "Night Shift", content: "New mix up: https://soundcloud.com/nightshift/warehouse-set", createdAt: "2026-11-16T21:30:00.000Z", audience: "public", isOwner: true }];
function fixture(p) {
  if (p === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "artist@example.test" } };
  if (p === "/profiles") return { profile: { memberId: ownerId, name: "Night Shift", handle: "nightshift", isOwner: true, cloudProfile: true } };
  if (p === "/secure-posts") return { posts };
  if (p === "/stories") return { stories: [], reels: [] };
  if (p === "/settings/posts") return { hiddenPostIds: [] };
  if (p === "/settings/presence") return { visible: true };
  return {};
}
const visible = page => page.evaluate(selector => { const n = document.querySelector(selector); if (!n) return false; const r = n.getBoundingClientRect(); return r.height > 0 && getComputedStyle(n).display !== "none"; }, "footer.site-ownership");
const subline = page => page.evaluate(() => { const n = document.getElementById("featureDescription"); if (!n) return ""; return getComputedStyle(n).display !== "none" && n.getBoundingClientRect().height > 0 ? n.textContent.trim() : ""; });

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of (process.env.WIDTHS || "320,360,390,430").split(",").map(Number)) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill(json(fixture(new URL(route.request().url()).pathname))));
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator("#feed .post").first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1200);
      if (await visible(page)) failures.push(`${label} Mix: © footer still at the bottom of a signed-in page`);
      const link = await page.evaluate(() => { const a = [...document.querySelectorAll("#feed a[href*='soundcloud.com']")][0]; return a ? { target: a.target, rel: a.rel } : null; });
      if (!link) failures.push(`${label} Mix: the SoundCloud link did not render`);
      else if (link.target !== "_blank" || !/noopener/.test(link.rel)) failures.push(`${label} Mix: SoundCloud link opens inside DanzStak (${JSON.stringify(link)})`);
      if ([360, 390].includes(width)) { await page.evaluate(() => scrollTo(0, document.body.scrollHeight)); await page.waitForTimeout(200); await page.screenshot({ path: path.join(output, `${prefix}-mix-bottom-${width}.png`) }); }
      for (const [view, name] of [["hq", "Music HQ"], ["events", "Events"]]) {
        await page.goto(`${baseUrl}/feed.html?view=${view}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1500);
        const text = await subline(page);
        if (text) failures.push(`${label} ${name}: explanatory sub-line under the title: "${text.slice(0, 60)}"`);
        if ([360, 390].includes(width)) await page.screenshot({ path: path.join(output, `${prefix}-${view}-${width}.png`), clip: { x: 0, y: 0, width, height: 420 } });
      }
      await page.goto(`${baseUrl}/feed.html#settings`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      const settings = await page.evaluate(() => ({ owner: Boolean(document.querySelector(".settings-ownership")), privacy: Boolean(document.querySelector(".settings-links a[href='privacy.html']")), sub: (() => { const n = document.getElementById("featureDescription"); return n && getComputedStyle(n).display !== "none" ? n.textContent.trim() : ""; })() }));
      if (!settings.owner || !settings.privacy) failures.push(`${label} Settings: © line or Privacy link missing ${JSON.stringify(settings)}`);
      if (/Manage account privacy/.test(settings.sub)) failures.push(`${label} Settings: explanatory sub-line still shown`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) { console[process.env.AUDIT_ONLY ? "log" : "error"](`Site chrome: ${unique.length} problem(s)\n- ${unique.join("\n- ")}`); if (!process.env.AUDIT_ONLY) process.exitCode = 1; return; }
  console.log("Site chrome checks passed: no © footer in the app (it's in Settings), no explanatory sub-lines, external links open outside DanzStak.");
})().catch(error => { console.error(error); process.exitCode = 1; });
