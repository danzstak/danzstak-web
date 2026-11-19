"use strict";
// Task 34 (owner 2026-11-18): "Get SYNC as its own app" must put a SYNC icon on the home screen. SYNC now lives under
// /sync/ with its own manifest scope, so Chrome can install it next to DanzStak. Real browser at 320, 360, 390, 414, 430:
// - /sync/?app=sync loads the chat list with SYNC's manifest; links and assets still resolve from the site root;
// - the install row: browser prompt available → Install SYNC (and pwa.js leaves the prompt alone); no prompt on
//   Android / iPhone → the phone's own steps; inside the installed SYNC app → "SYNC is installed on this phone";
//   inside the DanzStak app on Android → hold the DanzStak icon and drag its SYNC shortcut out (no trip to a browser);
// - sign-up (owner 2026-11-19: "save sync to their device and verify the number … it needs to be easy"): the SYNC step
//   names both parts; Set up SYNC → save the app → "Next: verify your number" → the registration opens; on an iPhone the
//   number is verified inside the SYNC icon, whose first open goes straight to it;
// - from messages.html the row opens SYNC's own page; the old sync.html forwards to /sync/.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/sync-own-app.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-own-app");
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function open(browser, width, { ua = ANDROID, standalone = false, newMember = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, userAgent: ua, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  if (standalone) await context.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = query => query.includes("display-mode: standalone") ? { matches: true, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } } : real(query);
  });
  await context.route("https://api.danzstak.com/**", route => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.test" } }));
    if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: "a@danzstak.test", name: "SFScoop", preview: "Soundcheck at 6", updatedAt: new Date().toISOString(), canContact: true }] }));
    if (newMember && p === "/profiles") {
      if (route.request().method() === "POST") { context.named = { isOwner: true, cloudProfile: true, ...route.request().postDataJSON() }; return route.fulfill(json({ profile: context.named })); }
      return route.fulfill(json({ profile: context.named || { isOwner: true, cloudProfile: true, name: "DanzStak member", handle: "" } }));
    }
    return route.fulfill(json({}));
  });
  const page = await context.newPage();
  page.errors = []; page.missing = [];
  page.on("pageerror", error => page.errors.push(error.message));
  page.on("response", response => { if (response.status() >= 400 && response.url().startsWith(baseUrl)) page.missing.push(`${response.status()} ${response.url()}`); });
  return { context, page };
}
const sheet = page => page.evaluate(() => {
  const d = document.getElementById("syncInstallDialog");
  if (!d?.open) return null;
  const visible = el => el && !el.hidden && el.getBoundingClientRect().height > 0;
  const primary = d.querySelector(".sync-install-primary"), link = d.querySelector("a"), box = d.getBoundingClientRect();
  return { state: d.dataset.state, title: d.querySelector("h2").textContent, text: d.querySelector(".sync-install-text").textContent, steps: [...d.querySelectorAll(".sync-install-steps li")].map(li => li.textContent),
    primary: visible(primary) ? { text: primary.textContent, height: primary.getBoundingClientRect().height, go: primary.hasAttribute("data-next") } : null, link: Boolean(link),
    fits: box.left >= 0 && box.right <= innerWidth + 0.5 && document.documentElement.scrollWidth <= innerWidth };
});
async function openRow(page) {
  await page.waitForFunction(() => window.danzstakSyncSettings && window.danzstakSyncApp);
  await page.evaluate(() => window.danzstakSyncSettings.open());
  await page.locator('[data-settings-row="standalone"]').click();
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true }); // CI installs no bundled browser
  try {
    for (const width of [320, 360, 390, 414, 430]) {
      const label = `${width}px`, shots = width === 360 || width === 390;

      // 1. /sync/ is the SYNC app: chat list, SYNC manifest with its own scope, links resolve from the root.
      let { context, page } = await open(browser, width);
      await page.goto(`${baseUrl}/sync/?app=sync`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-row").first().waitFor({ timeout: 10000 });
      const app = await page.evaluate(async () => {
        const href = document.querySelector('link[rel="manifest"]').href, manifest = await (await fetch(href)).json(), main = await (await fetch("/manifest.webmanifest")).json();
        return { href: new URL(href).pathname, manifest, mainScope: main.scope, profile: new URL(document.querySelector('a[href="profile.html"]').href).pathname, skip: new URL(document.querySelector(".skip-link").href).pathname, overflow: document.documentElement.scrollWidth > innerWidth, title: document.title };
      });
      assert.equal(app.href, "/sync.webmanifest", `${label}: /sync/ uses SYNC's manifest`);
      assert.equal(app.manifest.scope, "/sync/", `${label}: SYNC has its own scope`);
      assert.notEqual(app.manifest.scope, app.mainScope, `${label}: SYNC's scope is not DanzStak's`);
      assert.ok(app.manifest.start_url.startsWith(app.manifest.scope), `${label}: SYNC starts inside its scope`);
      assert.equal(app.manifest.id, "/sync");
      assert.equal(app.profile, "/profile.html", `${label}: links still resolve from the site root`);
      assert.equal(app.skip, "/sync/", `${label}: the skip link stays on the page`);
      assert.equal(app.overflow, false, `${label}: no sideways scroll`);
      assert.equal(app.title, "SYNC by DanzStak");
      if (shots) await page.screenshot({ path: path.join(output, `1-sync-app-chats-${width}.png`) });

      // 2. Browser offers the install: Install SYNC → the prompt; pwa.js leaves it alone.
      const offered = await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        event.prompt = async () => { window.__prompted = true; };
        event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
        dispatchEvent(event);
        return event.defaultPrevented;
      });
      assert.equal(offered, true);
      await page.waitForTimeout(400); // pwa.js reacts asynchronously
      const pwa = await page.evaluate(async () => ({ button: !document.querySelector(".install-app-button")?.hidden, request: await window.danzstakRequestInstall?.(), prompted: window.__prompted === true }));
      assert.deepEqual(pwa, { button: false, request: "manual", prompted: false }, `${label}: DanzStak's own install (pwa.js) does not take SYNC's prompt`);
      await openRow(page);
      let state = await sheet(page);
      assert.equal(state?.state, "prompt", `${label}: prompt available → Install SYNC (${JSON.stringify(state)})`);
      assert.ok(state.primary?.text === "Install SYNC" && state.primary.height >= 44 && state.fits, `${label}: one 44px Install SYNC button, sheet fits`);
      if (shots) await page.screenshot({ path: path.join(output, `2-install-prompt-${width}.png`) });
      await page.locator("#syncInstallDialog .sync-install-primary").click();
      await page.waitForFunction(() => document.getElementById("syncInstallDialog").dataset.state === "added");
      assert.equal(await page.evaluate(() => window.__prompted), true, `${label}: the browser's install prompt was shown`);
      state = await sheet(page);
      assert.equal(state.title, "SYNC is on your home screen");
      assert.deepEqual(page.errors, [], `${label}: no page errors`); assert.deepEqual(page.missing, [], `${label}: no missing files under /sync/`);
      await context.close();

      // 3. From messages.html the row opens SYNC's own page; no prompt on Android → the phone's own steps.
      ({ context, page } = await open(browser, width));
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await openRow(page);
      await page.waitForURL(/\/sync\/$/, { timeout: 8000 });
      await page.waitForFunction(() => document.getElementById("syncInstallDialog")?.dataset.state === "steps", null, { timeout: 5000 });
      state = await sheet(page);
      assert.deepEqual(state.steps, ["Tap ⋮ at the top right of Chrome.", "Tap Install app (or Add to Home screen)."], `${label}: Android steps in Chrome's own words`);
      assert.ok(state.primary?.text === "Done" && state.fits, `${label}: Done, sheet fits`);
      if (shots) await page.screenshot({ path: path.join(output, `3-install-steps-android-${width}.png`) });
      await context.close();

      // 4. iPhone: Share → Add to Home Screen.
      ({ context, page } = await open(browser, width, { ua: IPHONE }));
      await page.goto(`${baseUrl}/sync/?install=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("syncInstallDialog")?.dataset.state === "steps", null, { timeout: 5000 });
      state = await sheet(page);
      assert.deepEqual(state.steps, ["Tap Share.", "Tap Add to Home Screen."], `${label}: iPhone steps`);
      if (shots) await page.screenshot({ path: path.join(output, `4-install-steps-iphone-${width}.png`) });
      await context.close();

      // 5. Inside the installed SYNC app: already installed; DanzStak itself is not marked installed by it.
      ({ context, page } = await open(browser, width, { standalone: true }));
      await page.goto(`${baseUrl}/sync/?app=sync`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-row").first().waitFor({ timeout: 10000 });
      // The SYNC icon's first open on an unverified device goes straight to verifying the number, once.
      await page.locator("#callingDevicesDialog[open]").waitFor({ timeout: 8000 });
      assert.equal(new URL(page.url()).searchParams.has("device"), false, `${label}: the first-run step leaves a clean address`);
      await page.locator("#closeCallingDevices").click();
      await openRow(page);
      state = await sheet(page);
      assert.equal(state?.state, "installed-here", `${label}: inside the SYNC app`);
      assert.equal(state.title, "SYNC is installed on this phone");
      assert.equal(await page.evaluate(() => localStorage.getItem("danzstak_app_installed")), null, `${label}: the SYNC app does not mark DanzStak installed`);
      if (shots) await page.screenshot({ path: path.join(output, `5-installed-${width}.png`) });
      await context.close();

      // 6. Inside the DanzStak app (standalone, launched on DanzStak's own pages): an app can't install another app, so
      // Android saves SYNC from DanzStak's own icon (its SYNC shortcut) — no "open Chrome" link that goes nowhere.
      ({ context, page } = await open(browser, width, { standalone: true }));
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await openRow(page);
      await page.waitForURL(/\/sync\/$/, { timeout: 8000 });
      await page.waitForFunction(() => document.getElementById("syncInstallDialog")?.open);
      state = await sheet(page);
      assert.equal(state.state, "other-app", `${label}: inside the DanzStak app`);
      assert.equal(state.title, "Save SYNC to your home screen");
      assert.deepEqual(state.steps, ["Press and hold the DanzStak icon on your home screen.", "Drag SYNC to an empty spot."], `${label}: saved from DanzStak's own icon`);
      assert.ok(state.link === false && state.primary?.text === "Done" && state.primary.height >= 44 && state.fits, `${label}: no browser link, one 44px Done, sheet fits`);
      const shortcut = await page.evaluate(async () => (await (await fetch("/manifest.webmanifest")).json()).shortcuts.find(item => item.name === "SYNC"));
      assert.equal(shortcut?.url, "/sync/?app=sync", `${label}: DanzStak's icon carries the SYNC shortcut`);
      if (shots) await page.screenshot({ path: path.join(output, `8-in-danzstak-app-${width}.png`) });
      await context.close();
      // Opened from that shortcut, the window is SYNC (straight to the chats, no offer to install it again).
      ({ context, page } = await open(browser, width, { standalone: true }));
      await page.goto(`${baseUrl}/feed.html`, { waitUntil: "domcontentloaded" });
      await page.goto(`${baseUrl}/sync/?app=sync`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakSyncApp?.offerApp);
      assert.equal(await page.evaluate(() => window.danzstakSyncApp.offerApp()), false, `${label}: the SYNC shortcut opens SYNC as its own app`);
      await context.close();

      // 10. Sign-up in the browser: one SYNC step names both parts; Set up SYNC saves the app, then verifies the number.
      ({ context, page } = await open(browser, width, { newMember: true }));
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".ds-onboard[open] input[name=name]").fill("Night Shift");
      await page.locator(".ds-onboard[open] .ds-go").click();
      await page.locator(".ds-onboard[open] .ds-steps").waitFor({ timeout: 5000 });
      const signup = await page.evaluate(() => {
        const d = document.querySelector(".ds-onboard[open]"), box = d.getBoundingClientRect(), go = d.querySelector("[data-now]").getBoundingClientRect();
        return { title: d.querySelector("h2").textContent, steps: [...d.querySelectorAll(".ds-steps li")].map(li => li.textContent), buttons: [...d.querySelectorAll("button")].map(b => [b.textContent, b.getBoundingClientRect().height >= 44]), fits: box.left >= 0 && box.right <= innerWidth + 0.5, green: getComputedStyle(d.querySelector("[data-now]")).backgroundColor, stacked: (() => { const later = d.querySelector("[data-later]").getBoundingClientRect(); return go.bottom <= later.top && Math.abs(go.width - later.width) < 1 && go.width >= box.width - 48; })(), tap: { x: go.left + go.width / 2, y: go.top + go.height / 2 } };
      });
      assert.equal(signup.title, "Set up SYNC on this device", `${label}: sign-up's SYNC step`);
      assert.deepEqual(signup.steps, ["Save the SYNC app to your home screen", "Verify your number with a text code"], `${label}: both parts, in order`);
      assert.deepEqual(signup.buttons, [["Later — text only", true], ["Set up SYNC", true]], `${label}: Later or Set up SYNC, 44px`);
      assert.ok(signup.stacked, `${label}: Set up SYNC on top, both full width (no wrapped row)`);
      assert.ok(signup.fits && signup.green === "rgb(21, 128, 61)", `${label}: fits, Set up SYNC is a green go button (${signup.green})`);
      if (shots) await page.screenshot({ path: path.join(output, `9-signup-sync-step-${width}.png`) });
      await page.touchscreen.tap(signup.tap.x, signup.tap.y);
      await page.waitForURL(/\/sync\/(\?device=register)?$/, { timeout: 8000 });
      await page.waitForFunction(() => document.getElementById("syncInstallDialog")?.open);
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        event.prompt = async () => { window.__prompted = true; };
        event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
        dispatchEvent(event);
      });
      await page.waitForFunction(() => document.getElementById("syncInstallDialog").dataset.state === "prompt");
      await page.waitForTimeout(1500); // call-devices.js is ready by now: the number waits for the app
      assert.equal(await page.locator("#callingDevicesDialog[open]").count(), 0, `${label}: verifying waits until the app step is done`);
      await page.locator("#syncInstallDialog .sync-install-primary").click();
      await page.waitForFunction(() => document.getElementById("syncInstallDialog").dataset.state === "added");
      state = await sheet(page);
      assert.ok(state.primary?.text === "Next: verify your number" && state.primary.go && state.primary.height >= 44, `${label}: then straight on to the number (${JSON.stringify(state.primary)})`);
      if (shots) { await page.waitForTimeout(300); await page.screenshot({ path: path.join(output, `10-signup-saved-next-${width}.png`) }); }
      await page.locator("#syncInstallDialog .sync-install-primary").click();
      await page.locator("#callingDevicesDialog[open]").waitFor({ timeout: 5000 });
      assert.equal(await page.locator("#syncAppOffer[open]").count(), 0, `${label}: no second offer in the same visit`);
      if (shots) await page.screenshot({ path: path.join(output, `11-signup-verify-${width}.png`) });
      assert.deepEqual(page.errors, [], `${label}: no page errors`);
      await context.close();
      // iPhone: Safari and a home-screen app keep their storage apart, so the number is verified inside the SYNC icon.
      ({ context, page } = await open(browser, width, { ua: IPHONE }));
      await page.goto(`${baseUrl}/sync/?install=1&device=register`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("syncInstallDialog")?.dataset.state === "steps", null, { timeout: 5000 });
      state = await sheet(page);
      assert.deepEqual(state.steps, ["Tap Share.", "Tap Add to Home Screen.", "Open SYNC from your home screen to verify your number."], `${label}: iPhone sign-up steps`);
      assert.equal(state.primary?.text, "Done");
      await page.locator("#syncInstallDialog .sync-install-primary").click();
      await page.waitForTimeout(1500);
      assert.equal(await page.locator("#callingDevicesDialog[open]").count(), 0, `${label}: iPhone Safari doesn't verify a number its home-screen app can't use`);
      await context.close();

      // 8. T3 (owner 2026-11-19): right after this device registers for calls, offer SYNC as its own app once.
      ({ context, page } = await open(browser, width));
      await page.goto(`${baseUrl}/sync/?app=sync`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-row").first().waitFor({ timeout: 10000 });
      await page.waitForFunction(() => window.danzstakSyncApp && window.danzstakPhoneSetup);
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        event.prompt = async () => { window.__prompted = true; };
        event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
        dispatchEvent(event);
        dispatchEvent(new CustomEvent("danzstak:call-device-registered"));
      });
      await page.locator("#syncAppOffer[open]").waitFor({ timeout: 3000 });
      await page.waitForTimeout(400);
      const offerState = await page.evaluate(() => {
        const d = document.getElementById("syncAppOffer"), box = d.getBoundingClientRect(), buttons = [...d.querySelectorAll("button")].map(b => ({ text: b.textContent, h: b.getBoundingClientRect().height }));
        return { title: d.querySelector("h2").textContent, text: d.querySelector(".sync-install-text").textContent, buttons, fits: box.left >= 0 && box.right <= innerWidth + 0.5, setupOpen: Boolean(document.querySelector(".phone-setup-dialog[open]")) };
      });
      assert.equal(offerState.title, "Save the SYNC app to your home screen", `${label}: the offer shows after registration`);
      assert.equal(offerState.text, "Get a SYNC icon on your home screen, straight to your chats.");
      assert.deepEqual(offerState.buttons.map(b => b.text), ["Save app", "Not now"]);
      assert.ok(offerState.buttons.every(b => b.h >= 44) && offerState.fits, `${label}: two 44px buttons, offer fits`);
      assert.equal(offerState.setupOpen, false, `${label}: "set up this phone" waits for the offer`);
      if (shots) await page.screenshot({ path: path.join(output, `6-offer-after-registration-${width}.png`) });
      await page.locator('#syncAppOffer [data-action="install"]').click();
      await page.waitForFunction(() => window.__prompted === true && !document.getElementById("syncAppOffer").open);
      await page.locator(".phone-setup-dialog[open]").waitFor({ timeout: 3000 });
      await context.close();

      // 9. F16 (owner 2026-11-19): after "Not now", "Add SYNC to home screen" stays directly under the verified text in
      // "Calls on this device" until SYNC is installed. The registered state is the body class call-devices.js renders
      // for a registered device (a real registration needs this phone's stored device key, outside this check).
      ({ context, page } = await open(browser, width));
      await page.goto(`${baseUrl}/sync/?app=sync`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-row").first().waitFor({ timeout: 10000 });
      await page.waitForFunction(() => window.danzstakSyncApp);
      assert.equal(await page.evaluate(() => Boolean(document.getElementById("syncVerifiedInstall") && !document.getElementById("syncVerifiedInstall").hidden)), false, `${label}: no install button before the device is registered`);
      await page.evaluate(() => {
        const event = new Event("beforeinstallprompt", { cancelable: true });
        event.prompt = async () => { window.__prompted = true; };
        event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
        dispatchEvent(event);
        document.body.classList.add("sync-device-registered");
        dispatchEvent(new CustomEvent("danzstak:call-device-registered"));
      });
      await page.locator("#syncAppOffer[open]").waitFor({ timeout: 3000 });
      await page.locator("#syncAppOffer .sync-offer-later").click();
      // "Set up this phone" follows the offer; close it (✕), as a member who wants to get on with it would.
      await page.locator(".phone-setup-dialog[open]").waitFor({ timeout: 3000 });
      await page.locator(".phone-setup-dialog[open] .call-setup-close").click();
      await page.waitForFunction(() => !document.querySelector(".phone-setup-dialog[open]"), null, { timeout: 3000 });
      await page.evaluate(() => { document.getElementById("deviceStatus").textContent = "This device is registered for calls and voice messages."; document.getElementById("callingDevicesDialog").showModal(); });
      await page.waitForTimeout(300);
      const under = await page.evaluate(() => {
        const status = document.getElementById("deviceStatus"), button = document.getElementById("syncVerifiedInstall"), r = button?.getBoundingClientRect(), s = status.getBoundingClientRect();
        return { next: status.nextElementSibling?.id || "", text: button?.textContent || "", tall: Boolean(r && r.height >= 44), below: Boolean(r && r.top >= s.bottom - 1 && r.top - s.bottom < 24), fits: Boolean(r && r.left >= 0 && r.right <= innerWidth + 0.5), sameWidth: Boolean(r && Math.abs(r.left - s.left) < 1.5 && Math.abs(r.right - s.right) < 1.5), inDialog: Boolean(button?.closest("#callingDevicesDialog")) };
      });
      assert.deepEqual(under, { next: "syncVerifiedInstall", text: "Add SYNC to home screen", tall: true, below: true, fits: true, sameWidth: true, inDialog: true }, `${label}: the button sits right under the verified text, as wide as it`);
      // Only the part under test: the rest of this dialog needs a real registered device (title, phone row).
      if (shots) { const s = await page.locator("#deviceStatus").boundingBox(), b = await page.locator("#syncVerifiedInstall").boundingBox(); await page.screenshot({ path: path.join(output, `7-under-verified-text-${width}.png`), clip: { x: 0, y: Math.max(0, s.y - 16), width, height: b.y + b.height + 16 - Math.max(0, s.y - 16) } }); }
      await page.locator("#syncVerifiedInstall").click();
      await page.waitForFunction(() => window.__prompted === true, null, { timeout: 3000 });
      await page.waitForFunction(() => document.getElementById("syncVerifiedInstall").hidden === true, null, { timeout: 3000 });
      assert.deepEqual(page.errors, [], `${label}: no page errors`);
      await context.close();

      // Two "Not now" and it never comes back; never during a call; never inside the installed SYNC app.
      ({ context, page } = await open(browser, width));
      await page.goto(`${baseUrl}/sync/?app=sync`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakSyncApp?.offerApp);
      for (const round of [1, 2]) {
        assert.equal(await page.evaluate(() => window.danzstakSyncApp.offerApp()), true, `${label}: offer ${round}`);
        await page.locator("#syncAppOffer .sync-offer-later").click();
      }
      assert.equal(await page.evaluate(() => window.danzstakSyncApp.offerApp()), false, `${label}: dismissed twice → never again`);
      assert.equal(await page.evaluate(() => { localStorage.removeItem("danzstak_sync_offer_dismissed"); document.body.dataset.callMode = "video"; const shown = window.danzstakSyncApp.offerApp(); delete document.body.dataset.callMode; return shown; }), false, `${label}: never in the way of a call`);
      await context.close();
      ({ context, page } = await open(browser, width, { standalone: true }));
      await page.goto(`${baseUrl}/sync/?app=sync`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakSyncApp?.offerApp);
      assert.equal(await page.evaluate(() => window.danzstakSyncApp.offerApp()), false, `${label}: not inside the SYNC app`);
      await context.close();

      if (width === 390) {
        // From messages.html: Add opens SYNC's own page with the install sheet; "set up this phone" carries on there.
        ({ context, page } = await open(browser, width));
        await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(() => window.danzstakSyncApp && window.danzstakPhoneSetup);
        await page.evaluate(() => dispatchEvent(new CustomEvent("danzstak:call-device-registered")));
        await page.locator("#syncAppOffer[open]").waitFor({ timeout: 3000 });
        await page.locator('#syncAppOffer [data-action="install"]').click();
        await page.waitForURL(/\/sync\/$/, { timeout: 8000 });
        await page.waitForFunction(() => document.getElementById("syncInstallDialog")?.open, null, { timeout: 5000 });
        await page.waitForTimeout(400);
        await page.locator("#syncInstallDialog .call-setup-close").click();
        await page.locator(".phone-setup-dialog[open]").waitFor({ timeout: 3000 });
        await context.close();
      }

      // 7. The old sync.html forwards: the browser to the install sheet, the installed app to the chats.
      ({ context, page } = await open(browser, width));
      await page.goto(`${baseUrl}/sync.html`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/sync\/$/, { timeout: 8000 });
      await page.waitForFunction(() => document.getElementById("syncInstallDialog")?.open, null, { timeout: 5000 });
      await context.close();
      ({ context, page } = await open(browser, width, { standalone: true }));
      await page.goto(`${baseUrl}/sync.html`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(/\/sync\/\?app=sync$/, { timeout: 8000 });
      await page.locator(".conversation-row").first().waitFor({ timeout: 10000 });
      await context.close();
    }
  } finally { await browser.close(); }
  console.log("SYNC own-app checks passed (320, 360, 390, 414, 430): /sync/ loads the chats with SYNC's own scope, Install SYNC uses the browser prompt, Android and iPhone steps in the phone's own words, installed state (first open verifies the number), inside the DanzStak app saved from its own icon's SYNC shortcut, sign-up's Set up SYNC (save the app, then straight to the number; iPhone verifies inside the icon), the own-app offer after device registration (prompt, setup waits, two Not now, never in a call or the SYNC app), messages.html and sync.html lead to /sync/.");
})().catch(error => { console.error(error); process.exitCode = 1; });
