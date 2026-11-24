"use strict";
// Directive L1 (owner 2026-11-19): a tester's profile "did not load" and device registration showed nothing while
// /auth/refresh kept succeeding and every signed-in call answered 401. Never fail silently:
//  1. a 401 followed by a working refresh is sent again and the page loads normally;
//  2. refresh works but the call still answers 401 (cookie not kept) → the "Sign in again" sheet, the profile page
//     stays (no blank page, no jump to the landing page), the typed words survive Sign in and come back afterwards;
//  3. a session that ended (refresh 401) in a tab that had one → the same sheet, in Italian for an Italian phone;
//  4. a signed-out visitor (never had a session in this tab) still goes to the shop / landing page, no sheet.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/session-guard.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const launch = process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true };
const cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true" };
const json = (route, status, body) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });

// mode: "recovers" (first /profiles 401, refresh ok, then fine), "cookie-lost" (refresh ok, every call 401),
// "ended" (refresh 401 after a session was seen), "visitor" (refresh 401, nothing seen).
async function mockApi(page, state) {
  await page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE", "access-control-allow-headers": "content-type,x-danzstak-device-id,x-danzstak-device-token" } });
    if (path === "/auth/login") { state.loginOpened++; state.mode = "ok"; return route.fulfill({ status: 302, headers: { location: `${base}/` } }); }
    if (path === "/auth/refresh") { state.refreshes++; return json(route, state.mode === "ended" || state.mode === "visitor" ? 401 : 200, { ok: true }); }
    const signedIn = state.mode === "ok" || (state.mode === "recovers" && state.refreshes > 0);
    if (path === "/auth/session") return signedIn ? json(route, 200, { authenticated: true, user: { sub: me, email: "a@example.test" } }) : json(route, 401, { error: "Authentication required." });
    if (path === "/calls/presence") { if (signedIn || state.mode === "ended") return json(route, 200, {}); return json(route, 401, { error: "Authentication required." }); }
    if (!signedIn) return json(route, 401, { error: "Authentication required." });
    if (path === "/profiles") return json(route, 200, { profile: { userId: me, displayName: "Test Member", username: "testmember" }, profiles: [] });
    return json(route, 200, {});
  });
}

async function sheetText(page) {
  return page.evaluate(() => document.querySelector(".session-guard__panel")?.innerText || "");
}

(async () => {
  const browser = await chromium.launch(launch);
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) {
      const open = async (mode, locale = "en-US") => {
        const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, locale, serviceWorkers: "block" });
        const page = await context.newPage(), state = { mode, refreshes: 0, loginOpened: 0 }, errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await mockApi(page, state);
        return { context, page, state, errors };
      };

      // 1. One 401, the refresh works, the call is sent again: the profile loads, no sheet.
      {
        const { context, page, state, errors } = await open("recovers");
        await page.goto(`${base}/profile.html`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => /Test Member/.test((document.body?.innerText || "")), null, { timeout: 10000 }).catch(() => {});
        if (!/Test Member/.test(await page.evaluate(() => (document.body?.innerText || "")))) failures.push(`${width}px recovers: the profile did not load after the refresh`);
        if (await page.locator(".session-guard").count()) failures.push(`${width}px recovers: the sign-in sheet showed although the refresh fixed the session`);
        if (!/\/profile\.html/.test(page.url())) failures.push(`${width}px recovers: left the profile for ${page.url()}`);
        if (state.refreshes < 1) failures.push(`${width}px recovers: no refresh after the 401`);
        if (errors.length) failures.push(`${width}px recovers: script errors: ${errors.join(" | ")}`);
        await context.close();
      }

      // 2. Refresh works, calls still 401 (the Washington tester): the sheet, the page stays, Sign in keeps the words.
      {
        const { context, page, state, errors } = await open("cookie-lost");
        await page.goto(`${base}/profile.html`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".session-guard__panel", { timeout: 10000 }).catch(() => {});
        const text = await sheetText(page);
        if (!/Sign in again to keep going/.test(text)) failures.push(`${width}px cookie lost: no "Sign in again" sheet (page: ${JSON.stringify((await page.evaluate(() => (document.body?.innerText || ""))).replace(/\s+/g, " ").slice(0, 160))})`);
        if (!/\/profile\.html/.test(page.url())) failures.push(`${width}px cookie lost: the page went to ${page.url()} instead of staying`);
        if (await page.locator(".session-guard").count() > 1) failures.push(`${width}px cookie lost: more than one sheet`);
        if (state.refreshes > 3) failures.push(`${width}px cookie lost: ${state.refreshes} refreshes (calls failing together should share one)`);
        // The sheet fits the screen and its buttons are tappable at their centre.
        const box = await page.locator(".session-guard__panel").count() ? await page.locator(".session-guard__panel").boundingBox() : null;
        if (!box) { if (errors.length) failures.push(`${width}px cookie lost: script errors: ${errors.join(" | ")}`); await context.close(); continue; }
        if (box && (box.x < 0 || box.x + box.width > width + 0.5 || box.y + box.height > 800.5)) failures.push(`${width}px cookie lost: sheet off screen ${JSON.stringify(box)}`);
        for (const selector of [".session-guard__go", ".session-guard__later"]) {
          const b = await page.locator(selector).boundingBox();
          if (!b || b.height < 44) { failures.push(`${width}px cookie lost: ${selector} smaller than 44px`); continue; }
          const hit = await page.evaluate(([x, y, s]) => document.elementFromPoint(x, y)?.closest(s) !== null, [b.x + b.width / 2, b.y + b.height / 2, selector]);
          if (!hit) failures.push(`${width}px cookie lost: the centre of ${selector} isn't the button`);
        }
        // Words typed on the page come back after signing in.
        await page.evaluate(() => { const area = document.createElement("textarea"); area.id = "guardDraftProbe"; area.value = "half-written post"; document.body.append(area); });
        await page.locator(".session-guard__go").tap();
        await page.waitForURL(url => !/\/profile\.html/.test(String(url)), { timeout: 10000 }).catch(() => {});
        if (state.loginOpened !== 1) failures.push(`${width}px cookie lost: Sign in did not open the sign-in page (${state.loginOpened})`);
        const kept = await page.evaluate(() => [sessionStorage.getItem("danzstak_return_to"), sessionStorage.getItem("danzstak_session_drafts")]).catch(() => [null, null]);
        await page.waitForURL(/\/profile\.html/, { timeout: 10000 }).catch(() => {});
        if (!/\/profile\.html/.test(page.url())) failures.push(`${width}px cookie lost: after signing in landed on ${page.url()}, not back on the profile (stored ${JSON.stringify(kept)})`);
        else {
          // The field appears late, the way a composer does once the profile has loaded on a slow phone (CI's Edge
          // run on 2026-11-24 drew the page after both of the guard's old attempts): its words still come back.
          await page.waitForTimeout(2500);
          await page.evaluate(() => { const area = document.createElement("textarea"); area.id = "guardDraftProbe"; document.body.append(area); });
          await page.waitForFunction(() => document.getElementById("guardDraftProbe")?.value === "half-written post", null, { timeout: 4000 }).catch(() => {});
          if (await page.evaluate(() => document.getElementById("guardDraftProbe")?.value) !== "half-written post") failures.push(`${width}px cookie lost: the typed words did not come back after signing in`);
        }
        if (errors.length) failures.push(`${width}px cookie lost: script errors: ${errors.join(" | ")}`);
        await context.close();
      }

      // 3. The session ended in a tab that had one, Italian phone: Italian sheet; "Not now" closes it and stays.
      {
        const { context, page, errors } = await open("ended", "it-IT");
        await page.addInitScript(() => { try { sessionStorage.setItem("danzstak_session_seen", "1"); localStorage.setItem("danzstak_language", "it"); } catch {} });
        await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector(".session-guard__panel", { timeout: 10000 }).catch(() => {});
        const text = await sheetText(page);
        if (!/Accedi di nuovo per continuare/.test(text)) failures.push(`${width}px ended (it): no Italian sheet, got ${JSON.stringify(text)}`);
        if (/Sign in again/.test(text)) failures.push(`${width}px ended (it): English words on the Italian sheet`);
        if (await page.locator(".session-guard").count()) {
          await page.locator(".session-guard__later").tap();
          await page.waitForTimeout(400);
          if (await page.locator(".session-guard").count()) failures.push(`${width}px ended (it): "Non ora" did not close the sheet`);
          if (!/\/messages\.html/.test(page.url())) failures.push(`${width}px ended (it): "Non ora" left the page for ${page.url()}`);
        }
        if (errors.length) failures.push(`${width}px ended (it): script errors: ${errors.join(" | ")}`);
        await context.close();
      }

      // 4. A signed-out visitor on a shared profile still goes to that member's shop, with no sheet.
      {
        const { context, page } = await open("visitor");
        await page.route(`${base}/shop.html**`, route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>shop</title><p>shop</p>" }));
        await page.goto(`${base}/profile.html?member=${me}`, { waitUntil: "domcontentloaded" });
        await page.waitForURL(/shop\.html/, { timeout: 10000 }).catch(() => {});
        if (!/shop\.html/.test(page.url())) failures.push(`${width}px visitor: stayed on ${page.url()} instead of the member's shop`);
        await context.close();
      }
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Session guard checks passed: a 401 refreshes and retries once; a lost session shows one translated sign-in sheet, keeps the page and the typed words, and brings the member back; signed-out visitors still reach the shop.");
})();
