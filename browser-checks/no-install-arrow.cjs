"use strict";
// Fix-it 18 (Walkthrough 2): no install down-arrow in any signed-in top bar (profile, SYNC, Mix) and no
// Privacy/Terms footer on the profile; install lives in Menu → Install DanzStak.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8027 node browser-checks/no-install-arrow.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8027").replace(/\/$/, "");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      for (const page of ["profile.html", "messages.html", "feed.html"]) {
        const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", isMobile: true, hasTouch: true });
        const tab = await context.newPage();
        await tab.route("https://api.danzstak.com/**", route => {
          const p = new URL(route.request().url()).pathname;
          if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "me@danzstak.test", sub: "me" } }));
          if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Night Shift", handle: "nightshift" } }));
          return route.fulfill(json({}));
        });
        await tab.goto(`${baseUrl}/${page}`, { waitUntil: "domcontentloaded" });
        await tab.waitForFunction(() => document.querySelector(".install-app-button"), null, { timeout: 15000 });
        // Simulate the browser offering install (beforeinstallprompt), which used to reveal the arrow.
        await tab.evaluate(() => { const e = new Event("beforeinstallprompt"); e.prompt = () => Promise.resolve(); e.userChoice = Promise.resolve({ outcome: "dismissed" }); e.preventDefault = () => {}; window.dispatchEvent(e); });
        await tab.waitForTimeout(400);
        const state = await tab.evaluate(() => {
          const visible = n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden"; };
          return {
            install: [...document.querySelectorAll(".install-app-button")].filter(visible).length,
            exists: document.querySelectorAll(".install-app-button").length,
            legal: [...document.querySelectorAll("a")].filter(a => /privacy|terms/i.test(a.getAttribute("href") || "") && visible(a)).length
          };
        });
        assert.equal(state.install, 0, `${width}px ${page}: no install arrow in the top bar`);
        assert.ok(state.exists >= 1, `${width}px ${page}: the hidden button stays for Menu → Install DanzStak`);
        if (page === "profile.html") assert.equal(state.legal, 0, `${width}px profile: no Privacy/Terms footer`);
        await context.close();
      }
    }
    console.log("No install arrow checks passed at 320/360/390/430px on profile, SYNC and Mix; no profile footer.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
