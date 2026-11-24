"use strict";
// Owner 2026-11-24: "duckduckgo has issues with the app install, there is no way to install the app from duckduck", "its only
// a bookmark", "chrome works great install or create short cut". DuckDuckGo never offers a site's install, so DanzStak's
// Install button said "use your browser's menu" and DuckDuckGo's menu only makes a bookmark that opens in DuckDuckGo (and
// on Android has no notifications, so SYNC can't ring there). Now, in DuckDuckGo (and apps' own browsers), every install
// button says so and hands over to Chrome. Real browser with DuckDuckGo's user agent, centre taps, 320–430px:
//   1. landing page → Install on Android: "Install DanzStak from Chrome", the bookmark line, three steps, Open in Chrome
//      (green, full width), Copy link, Close; nothing past the screen or overlapping, 44px targets;
//      Open in Chrome follows an intent link into Chrome for this page; if the page is still here 2 s later, a note says
//      Chrome didn't open; Copy link copies this page's link and says to paste it in Chrome;
//   2. the same in Italian;
//   3. SYNC → "Get SYNC as its own app": "Install SYNC from Chrome", Open in Chrome opens /sync/?install=1 in Chrome,
//      Copy link copies it;
//   4. DuckDuckGo on an iPhone: "from Safari", no Open in Chrome, Copy link is the button;
//   5. Chrome on Android is unchanged: no hand-over anywhere;
//   6. "phone not ringing with the app closed" (same evening): DuckDuckGo on Android has no web notifications, so a phone
//      registered for calls there can never ring with SYNC closed. SYNC says so on its chat list ("This browser can't ring
//      for calls when SYNC is closed. Chrome can.") with a green Open in Chrome that opens SYNC's install page in Chrome.
// Run: node scripts/static-server.cjs 8150 . then DANZSTAK_BASE_URL=http://127.0.0.1:8150 node browser-checks/install-elsewhere.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/install-elsewhere");
const DUCK_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile DuckDuckGo/5 Safari/537.36";
const DUCK_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 DuckDuckGo/7 Safari/605.1.15";
const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const PHYSICAL = "77777777-7777-4777-8777-777777777777";
const CREDENTIAL = { deviceId: "11111111-1111-4111-8111-111111111111", deviceToken: "a".repeat(43), accountTag: "a".repeat(32), physicalDeviceId: PHYSICAL };
const DEVICES = { accountTag: CREDENTIAL.accountTag, currentDeviceRegistered: true, currentPhysicalDeviceId: PHYSICAL, devices: [{ deviceId: CREDENTIAL.deviceId, name: "Night Shift", allowCalls: true, current: true, otpVerified: true, lastUsedAt: new Date().toISOString() }] };

async function open(browser, width, { ua = DUCK_ANDROID, locale = "en-US", signedIn = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, userAgent: ua, locale, serviceWorkers: "block", hasTouch: true, isMobile: true, permissions: ["clipboard-read", "clipboard-write"] });
  // DuckDuckGo on Android runs in Android's web view, which has no web notifications or push (the test browser has both).
  if (ua === DUCK_ANDROID) await context.addInitScript(() => { delete window.Notification; delete window.PushManager; });
  // The intent link can't leave a test browser: record where it pointed and stop it there.
  await context.addInitScript(() => {
    window.__intents = [];
    document.addEventListener("click", event => { const link = event.target.closest?.("a[href]"); if (link && link.href.startsWith("intent:")) { window.__intents.push(link.href); event.preventDefault(); } }, true);
  });
  await context.route("https://api.danzstak.com/**", route => {
    const p = new URL(route.request().url()).pathname;
    if (p === "/auth/session") return route.fulfill(signedIn ? json({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.test" } }) : json({ authenticated: false }, 401));
    if (p === "/calls/devices") return route.fulfill(json(DEVICES));
    if (p === "/calls/devices/share/preview") return route.fulfill(json({ eligible: false }));
    if (p === "/calls/inbox") return route.fulfill(json({ events: [] }));
    if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: "a@danzstak.test", name: "SFScoop", preview: "Soundcheck at 6", updatedAt: new Date().toISOString(), canContact: true }] }));
    return route.fulfill(json({}));
  });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", error => page.errors.push(error.message));
  return { context, page };
}
// Centre of the element (its icon when it has one), and whether a tap there lands on it.
const centre = (page, selector) => page.evaluate(selector => {
  const el = document.querySelector(selector), icon = el?.querySelector("svg") || el;
  if (!el) return null;
  el.scrollIntoView({ block: "center" }); // a long sheet: the row may be below the fold, as a finger would scroll to it
  const r = icon.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  return { x, y, hit: el.contains(document.elementFromPoint(x, y)) };
}, selector);
async function tap(page, selector, failures, label) {
  const spot = await centre(page, selector);
  if (!spot) { failures.push(`${label}: ${selector} is missing`); return; }
  if (!spot.hit) failures.push(`${label}: ${selector} is covered at its centre`);
  await page.touchscreen.tap(spot.x, spot.y);
}
// The open sheet: its words and whether its buttons fit, don't overlap and are big enough.
const layout = (page, dialogSelector, buttons) => page.evaluate(([dialogSelector, buttons]) => {
  const d = document.querySelector(dialogSelector);
  if (!d?.open) return null;
  const shown = el => el && !el.hidden && getComputedStyle(el).display !== "none" && el.getBoundingClientRect().height > 0;
  const boxes = buttons.map(selector => d.querySelector(selector)).filter(shown).map(el => ({ text: el.textContent.trim(), r: el.getBoundingClientRect(), style: getComputedStyle(el).backgroundColor }));
  const overlap = boxes.some((a, i) => boxes.some((b, j) => j > i && a.r.left < b.r.right - 0.5 && b.r.left < a.r.right - 0.5 && a.r.top < b.r.bottom - 0.5 && b.r.top < a.r.bottom - 0.5));
  const box = d.getBoundingClientRect();
  return {
    title: d.querySelector("h2")?.textContent.trim(),
    text: (d.querySelector("#installHelpText, .sync-install-text")?.textContent || "").trim(),
    steps: [...d.querySelectorAll("li")].filter(shown).map(li => li.textContent.trim()),
    buttons: boxes.map(b => ({ text: b.text, height: Math.round(b.r.height), width: Math.round(b.r.width), green: b.style })),
    overlap,
    fits: box.left >= -0.5 && box.right <= innerWidth + 0.5 && boxes.every(b => b.r.left >= -0.5 && b.r.right <= innerWidth + 0.5 && b.r.bottom <= innerHeight + 0.5) && document.documentElement.scrollWidth <= innerWidth,
    note: (d.querySelector(".install-help-note, .sync-install-note")?.textContent || "").trim()
  };
}, [dialogSelector, buttons]);
const GREEN = "rgb(21, 128, 61)";

async function landing(browser, width, locale = "en-US") {
  const label = `${width}px ${locale} landing`, failures = [], italian = locale.startsWith("it");
  const { context, page } = await open(browser, width, { locale });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-app-platform="android"]').waitFor();
  await page.waitForFunction(() => window.danzstakInstallElsewhere !== undefined && typeof window.danzstakOpenInstallHelp === "function");
  await tap(page, '[data-app-platform="android"]', failures, label);
  await page.locator("#installHelp[open]").waitFor({ timeout: 5000 }).catch(() => failures.push(`${label}: Install on Android opened nothing`));
  const sheet = await layout(page, "#installHelp", ["#installHelpAction", "#installHelpCopy", "#installHelpClose"]);
  const want = italian
    ? { title: "Installa DanzStak da Chrome", line: "DuckDuckGo può aggiungere solo un segnalibro, non l’app.", open: "Apri in Chrome", copy: "Copia link", copied: "Link copiato. Incollalo in Chrome.", stuck: "Chrome non si è aperto. Tocca Copia link, poi incollalo in Chrome." }
    : { title: "Install DanzStak from Chrome", line: "DuckDuckGo can only add a bookmark, not the app.", open: "Open in Chrome", copy: "Copy link", copied: "Link copied. Paste it in Chrome.", stuck: "Chrome didn't open. Tap Copy link, then paste it in Chrome." };
  if (!sheet) { failures.push(`${label}: no install sheet`); await context.close(); return failures; }
  if (sheet.title !== want.title) failures.push(`${label}: title "${sheet.title}", want "${want.title}"`);
  if (!sheet.text.startsWith(want.line) || !/Chrome/.test(sheet.text)) failures.push(`${label}: the sheet should say DuckDuckGo only makes a bookmark and Chrome installs the app ("${sheet.text}")`);
  if (sheet.steps.length !== 3) failures.push(`${label}: expected 3 steps, got ${JSON.stringify(sheet.steps)}`);
  const [openButton, copyButton] = sheet.buttons;
  if (openButton?.text !== want.open || copyButton?.text !== want.copy || sheet.buttons.length !== 3) failures.push(`${label}: buttons ${JSON.stringify(sheet.buttons.map(b => b.text))}`);
  if (openButton && openButton.green !== GREEN) failures.push(`${label}: Open in Chrome should be the green go button (${openButton.green})`);
  if (sheet.buttons.some(b => b.height < 44)) failures.push(`${label}: a button is under 44px ${JSON.stringify(sheet.buttons)}`);
  if (sheet.overlap || !sheet.fits) failures.push(`${label}: the sheet's buttons overlap or run off the screen`);
  if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `landing-${locale}-${width}.png`) });
  // Open in Chrome: an intent link to this page in Chrome; still here after 2 s → the note.
  await tap(page, "#installHelpAction", failures, label);
  await page.waitForTimeout(2300);
  const intents = await page.evaluate(() => window.__intents);
  const host = new URL(baseUrl).host, scheme = new URL(baseUrl).protocol.slice(0, -1);
  if (intents.length !== 1 || intents[0] !== `intent://${host}/#Intent;scheme=${scheme};package=com.android.chrome;end`) failures.push(`${label}: Open in Chrome should open this page in Chrome (${JSON.stringify(intents)})`);
  let after = await layout(page, "#installHelp", []);
  if (after?.note !== want.stuck) failures.push(`${label}: after Chrome didn't open, the note should say "${want.stuck}" ("${after?.note}")`);
  await tap(page, "#installHelpCopy", failures, label);
  await page.waitForTimeout(300);
  after = await layout(page, "#installHelp", []);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  if (after?.note !== want.copied || clip !== `${baseUrl}/`) failures.push(`${label}: Copy link should copy ${baseUrl}/ and say "${want.copied}" (note "${after?.note}", clipboard "${clip}")`);
  if (page.errors.length) failures.push(`${label}: page errors ${page.errors.join(" | ")}`);
  await context.close();
  return failures;
}

async function sync(browser, width) {
  const label = `${width}px SYNC`, failures = [];
  const { context, page } = await open(browser, width, { signedIn: true });
  await page.goto(`${baseUrl}/sync/?app=sync`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.danzstakSyncSettings && window.danzstakSyncApp && window.danzstakInstallElsewhere !== undefined, null, { timeout: 15000 });
  await page.evaluate(() => window.danzstakSyncSettings.open());
  await page.locator('[data-settings-row="standalone"]').waitFor();
  await tap(page, '[data-settings-row="standalone"]', failures, label);
  await page.locator("#syncInstallDialog[open]").waitFor({ timeout: 5000 }).catch(() => failures.push(`${label}: Get SYNC as its own app opened nothing`));
  await page.waitForFunction(() => document.getElementById("syncInstallDialog")?.dataset.state === "elsewhere", null, { timeout: 3000 }).catch(() => {});
  const sheet = await layout(page, "#syncInstallDialog", [".sync-install-primary", ".sync-install-secondary", ".call-setup-close"]);
  if (!sheet) { failures.push(`${label}: no install sheet`); await context.close(); return failures; }
  if (sheet.title !== "Install SYNC from Chrome") failures.push(`${label}: title "${sheet.title}"`);
  if (!sheet.text.startsWith("DuckDuckGo can only add a bookmark, not the app.")) failures.push(`${label}: text "${sheet.text}"`);
  if (sheet.steps.length !== 3) failures.push(`${label}: steps ${JSON.stringify(sheet.steps)}`);
  const texts = sheet.buttons.map(b => b.text);
  if (texts[0] !== "Open in Chrome" || texts[1] !== "Copy link") failures.push(`${label}: buttons ${JSON.stringify(texts)}`);
  if (sheet.buttons[0]?.green !== GREEN) failures.push(`${label}: Open in Chrome should be green (${sheet.buttons[0]?.green})`);
  if (sheet.buttons.some(b => b.height < 44) || sheet.overlap || !sheet.fits) failures.push(`${label}: buttons overlap, run off the screen or are under 44px ${JSON.stringify(sheet.buttons)}`);
  if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `sync-${width}.png`) });
  await tap(page, ".sync-install-primary", failures, label);
  await page.waitForTimeout(300);
  const host = new URL(baseUrl).host, scheme = new URL(baseUrl).protocol.slice(0, -1);
  const intents = await page.evaluate(() => window.__intents);
  if (intents.length !== 1 || intents[0] !== `intent://${host}/sync/?install=1#Intent;scheme=${scheme};package=com.android.chrome;end`) failures.push(`${label}: Open in Chrome should open SYNC's install page in Chrome (${JSON.stringify(intents)})`);
  await tap(page, ".sync-install-secondary", failures, label);
  await page.waitForTimeout(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
  const after = await layout(page, "#syncInstallDialog", []);
  if (clip !== `${baseUrl}/sync/?install=1` || after?.note !== "Link copied. Paste it in Chrome.") failures.push(`${label}: Copy link copied "${clip}", note "${after?.note}"`);
  if (page.errors.length) failures.push(`${label}: page errors ${page.errors.join(" | ")}`);
  await context.close();
  return failures;
}

async function syncCallAlerts(browser, width) {
  const label = `${width}px SYNC call alerts`, failures = [];
  const { context, page } = await open(browser, width, { signedIn: true });
  // A phone registered for SYNC calls: the credential call-devices.js keeps in IndexedDB.
  await page.goto(`${baseUrl}/manifest.webmanifest`);
  await page.evaluate(credential => new Promise((resolve, reject) => { const open = indexedDB.open("danzstak-call-device", 1); open.onupgradeneeded = () => open.result.createObjectStore("credentials"); open.onsuccess = () => { const tx = open.result.transaction("credentials", "readwrite"); tx.objectStore("credentials").put([credential], "accounts"); tx.oncomplete = () => { open.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; }), CREDENTIAL);
  await page.goto(`${baseUrl}/sync/?app=sync`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.danzstakSyncDeviceRegistered?.() === true, null, { timeout: 15000 }).catch(() => failures.push(`${label}: the phone never counted as registered`));
  await page.locator('.call-alerts-prompt[data-reason="browser"]').waitFor({ timeout: 8000 }).catch(() => failures.push(`${label}: SYNC never said this browser can't ring with SYNC closed`));
  await page.waitForTimeout(600); // the chat list finishes loading around it
  const bar = await page.evaluate(() => {
    const bar = document.querySelector('.call-alerts-prompt[data-reason="browser"]'), go = bar?.querySelector(".primary");
    if (!bar || !go) return null;
    const r = go.getBoundingClientRect(), b = bar.getBoundingClientRect();
    return { text: bar.querySelector("span").textContent, wide: bar.querySelector("span").getBoundingClientRect().width >= b.width * 0.6, go: go.textContent, height: r.height, green: getComputedStyle(go).backgroundColor, fits: b.left >= -0.5 && b.right <= innerWidth + 0.5 && r.right <= innerWidth + 0.5 && document.documentElement.scrollWidth <= innerWidth };
  });
  if (bar) {
    if (bar.text !== "This browser can't ring for calls when SYNC is closed. Chrome can.") failures.push(`${label}: line "${bar.text}"`);
    if (!bar.wide) failures.push(`${label}: the line is squeezed into a narrow column beside the button`);
    if (bar.go !== "Open in Chrome" || bar.green !== GREEN || bar.height < 44 || !bar.fits) failures.push(`${label}: the button should be a green 44px Open in Chrome that fits ${JSON.stringify(bar)}`);
    if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `sync-call-alerts-${width}.png`) });
    await tap(page, '.call-alerts-prompt[data-reason="browser"] .primary', failures, label);
    await page.waitForTimeout(300);
    const host = new URL(baseUrl).host, scheme = new URL(baseUrl).protocol.slice(0, -1);
    const intents = await page.evaluate(() => window.__intents);
    if (intents.length !== 1 || intents[0] !== `intent://${host}/sync/?install=1#Intent;scheme=${scheme};package=com.android.chrome;end`) failures.push(`${label}: Open in Chrome should open SYNC's install page in Chrome (${JSON.stringify(intents)})`);
  }
  if (page.errors.length) failures.push(`${label}: page errors ${page.errors.join(" | ")}`);
  await context.close();
  return failures;
}

async function iphone(browser) {
  const label = "390px DuckDuckGo iPhone", failures = [];
  const { context, page } = await open(browser, 390, { ua: DUCK_IPHONE });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.danzstakInstallElsewhere !== undefined && typeof window.danzstakOpenInstallHelp === "function");
  await tap(page, '[data-app-platform="apple"]', failures, label);
  await page.locator("#installHelp[open]").waitFor({ timeout: 5000 }).catch(() => failures.push(`${label}: Install on iPhone opened nothing`));
  const sheet = await layout(page, "#installHelp", ["#installHelpAction", "#installHelpCopy", "#installHelpClose"]);
  if (sheet?.title !== "Install DanzStak from Safari") failures.push(`${label}: title "${sheet?.title}"`);
  if (/bookmark/.test(sheet?.text || "") || !/Safari/.test(sheet?.text || "")) failures.push(`${label}: text "${sheet?.text}"`);
  const texts = (sheet?.buttons || []).map(b => b.text);
  if (texts.join() !== "Copy link,Close") failures.push(`${label}: an iPhone gets Copy link and Close, no Open in Chrome (${JSON.stringify(texts)})`);
  if (page.errors.length) failures.push(`${label}: page errors ${page.errors.join(" | ")}`);
  await context.close();
  return failures;
}

async function chromeUnchanged(browser) {
  const label = "390px Chrome on Android", failures = [];
  const { context, page } = await open(browser, 390, { ua: CHROME_ANDROID });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.danzstakInstallElsewhere !== undefined && typeof window.danzstakOpenInstallHelp === "function");
  if (await page.evaluate(() => window.danzstakInstallElsewhere) !== null) failures.push(`${label}: Chrome must not be sent to Chrome`);
  await tap(page, '[data-app-platform="android"]', failures, label);
  await page.locator("#installHelp[open]").waitFor({ timeout: 5000 }).catch(() => {});
  const sheet = await layout(page, "#installHelp", ["#installHelpAction", "#installHelpCopy", "#installHelpClose"]);
  if (sheet?.title !== "Install DanzStak on Android" || sheet.buttons.some(b => /Copy link|Open in Chrome/.test(b.text))) failures.push(`${label}: Chrome's install help changed ${JSON.stringify(sheet)}`);
  if (page.errors.length) failures.push(`${label}: page errors ${page.errors.join(" | ")}`);
  await context.close();
  return failures;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch({ ...(channel && channel !== "bundled" ? { channel } : {}), headless: true });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) failures.push(...await landing(browser, width), ...await sync(browser, width), ...await syncCallAlerts(browser, width));
    failures.push(...await landing(browser, 390, "it-IT"), ...await iphone(browser), ...await chromeUnchanged(browser));
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Install elsewhere: ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exitCode = 1; return; }
  console.log("Install elsewhere checks passed (320–430px): in DuckDuckGo the install buttons say it only makes a bookmark and hand over to Chrome (Open in Chrome follows an intent link, a note when it doesn't open, Copy link copies the page), in English and Italian, on the landing page and in SYNC; SYNC says DuckDuckGo can't ring with SYNC closed and opens Chrome; an iPhone is sent to Safari; Chrome is unchanged.");
})().catch(error => { console.error(error); process.exitCode = 1; });
