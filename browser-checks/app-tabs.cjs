"use strict";
// Audit 36 B2 + E11 (directive F6): one bottom tab bar on every signed-in page. Before: Mix drew its own bar and every
// other page a hand-written copy 9px to the left; Moving Day lit Bazaar and Mix -> Friends lit nothing; Tour Manager,
// Support, Trusted contacts, Privacy and Terms had no bar. Checks at 320/360/390/430px (and 1366px for desktop):
// - every signed-in page shows exactly one bar: six tabs at the same place as on Mix, the right one lit (one map in
//   assets/app-tabs.js), 44px targets, no sideways scroll; Mix's own .topnav is not also shown on phones;
// - on Mix, tapping the centre of each icon opens that screen without a reload (Music HQ, Events, Menu opens and closes
//   with focus back on the Menu tab, Mix), Bazaar and SYNC go to their pages;
// - Privacy shows the bar only when signed in; desktop shows no bottom bar.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const PAGES = [
  ["feed.html?view=feed", "mix"], ["feed.html?view=hq", "hq"], ["feed.html?view=events", "events"], ["feed.html#friends", "menu"],
  ["feed.html#groups", "menu"], ["feed.html#saved", "menu"], ["profile.html", "menu"], ["bazaar.html", "bazaar"], ["product.html?id=x", "bazaar"],
  ["store.html", "bazaar"], ["event.html?id=x", "events"], ["epk.html", "hq"], ["booking.html", "hq"], ["booking-selections.html", "hq"],
  ["record-stores.html", "hq"], ["moving-day.html", "menu"], ["support.html", "menu"], ["trusted-contacts.html", "menu"],
  ["privacy.html", "menu"], ["terms.html", "menu"], ["messages.html", "sync"]
];

async function open(browser, width, path, { signedIn = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    const body = pathname === "/auth/session" ? (signedIn ? { authenticated: true, user: { sub: me, email: "night@danzstak.invalid" } } : { authenticated: false })
      : (pathname === "/profiles" || pathname === "/profile") ? { profile: { memberId: me, name: "Night Shift", handle: "nightshift", username: "nightshift", isOwner: true, cloudProfile: true } } : {};
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
  await page.goto(`${base}/${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  return { context, page, errors };
}

const barState = page => page.evaluate(() => {
  const shown = element => element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden";
  const bars = [...document.querySelectorAll("nav.ds-mobile-nav")].filter(shown);
  const bar = bars[0];
  const links = bar ? [...bar.querySelectorAll("a[data-tab]")] : [];
  return {
    bars: bars.length, topnavShown: Boolean(shown(document.querySelector(".topbar .topnav")) && document.querySelector(".topbar .topnav").getBoundingClientRect().bottom > innerHeight - 80),
    tabs: links.map(link => link.dataset.tab), lit: links.filter(link => link.getAttribute("aria-current") === "page").map(link => link.dataset.tab),
    centers: links.map(link => { const box = link.querySelector("svg").getBoundingClientRect(); return Math.round(box.left + box.width / 2); }),
    sizes: links.map(link => { const box = link.getBoundingClientRect(); return [Math.round(box.width), Math.round(box.height)]; }),
    bottom: bar ? Math.round(bar.getBoundingClientRect().bottom) : 0, viewport: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth
  };
});

async function tapTab(page, id) {
  const box = await page.locator(`nav.ds-mobile-nav a[data-tab="${id}"] svg`).boundingBox();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(600);
}
const feedState = page => page.evaluate(() => ({
  lit: document.querySelector("nav.ds-mobile-nav a[aria-current=page]")?.dataset.tab || "",
  screen: document.getElementById("featureView")?.hidden ? "" : document.getElementById("featureView")?.dataset.workspaceName || "",
  menu: document.body.classList.contains("mobile-menu-open"), expanded: document.querySelector('nav.ds-mobile-nav a[data-tab="menu"]')?.getAttribute("aria-expanded"),
  focus: document.activeElement?.dataset?.tab || document.activeElement?.className || "", page: location.pathname.split("/").pop()
}));

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      let reference = null;
      for (const [path, expected] of PAGES) {
        const label = `${width}px ${path}`;
        const { context, page, errors } = await open(browser, width, path);
        const state = await barState(page);
        assert.equal(state.bars, 1, `${label}: exactly one bottom tab bar`);
        assert.equal(state.topnavShown, false, `${label}: Mix's own tab row is not shown as a second bar`);
        assert.deepEqual(state.tabs, ["mix", "hq", "events", "bazaar", "sync", "menu"], `${label}: the six tabs in order`);
        assert.deepEqual(state.lit, [expected], `${label}: ${expected} is the lit tab (got ${JSON.stringify(state.lit)})`);
        assert.ok(state.sizes.every(([w, h]) => w >= 44 && h >= 44), `${label}: 44px tab targets ${JSON.stringify(state.sizes)}`);
        assert.ok(Math.abs(state.bottom - state.viewport) <= 1, `${label}: the bar sits on the bottom edge`);
        assert.equal(state.overflow, false, `${label}: no sideways scroll`);
        reference ||= state.centers;
        assert.ok(state.centers.every((x, index) => Math.abs(x - reference[index]) <= 1), `${label}: icons sit where they sit on Mix ${JSON.stringify({ here: state.centers, mix: reference })}`);
        const step = width / 6;
        assert.ok(state.centers.every((x, index) => Math.abs(x - (index + 0.5) * step) <= 6), `${label}: each icon is centred in its sixth of the bar ${JSON.stringify(state.centers)}`);
        assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
        await context.close();
      }

      // Mix: the tabs open Mix's own screens without a reload; tap the centre of each icon.
      const label = `${width}px Mix`;
      const { context, page, errors } = await open(browser, width, "feed.html?view=feed");
      await page.evaluate(() => { window.__sameDocument = true; });
      for (const [id, screen] of [["hq", "HQ"], ["events", "Events"], ["mix", ""]]) {
        await tapTab(page, id);
        const state = await feedState(page);
        assert.deepEqual([state.lit, state.screen, state.page], [id, screen, "feed.html"], `${label}: ${id} tab opens ${screen || "Mix"} ${JSON.stringify(state)}`);
      }
      assert.equal(await page.evaluate(() => window.__sameDocument), true, `${label}: Mix's tabs switch screens without reloading the page`);
      await tapTab(page, "menu");
      let state = await feedState(page);
      assert.deepEqual([state.menu, state.lit, state.expanded], [true, "menu", "true"], `${label}: the Menu tab opens the menu ${JSON.stringify(state)}`);
      await tapTab(page, "menu");
      state = await feedState(page);
      assert.deepEqual([state.menu, state.lit, state.expanded], [false, "mix", "false"], `${label}: a second tap closes the menu ${JSON.stringify(state)}`);
      assert.equal(state.focus, "menu", `${label}: closing the menu puts focus back on the Menu tab, not on a hidden button`);
      assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
      await tapTab(page, "bazaar");
      await page.waitForURL(url => url.pathname.endsWith("/bazaar.html"), { timeout: 8000 });
      await tapTab(page, "sync");
      await page.waitForURL(url => url.pathname.endsWith("/messages.html"), { timeout: 8000 });
      await context.close();

      // Public pages: the bar only for members who are signed in.
      const visitor = await open(browser, width, "privacy.html", { signedIn: false });
      assert.equal((await barState(visitor.page)).bars, 0, `${width}px privacy.html signed out: no tab bar`);
      await visitor.context.close();
    }
    const desktop = await open(browser, 1366, "bazaar.html");
    assert.equal((await barState(desktop.page)).bars, 0, "1366px: no bottom tab bar on desktop");
    await desktop.context.close();
    console.log(`App tab bar checks passed at 320, 360, 390, 430px on ${PAGES.length} screens: one bar, the same six tabs in the same place, the right tab lit, 44px targets; Mix's tabs switch screens in place, Menu opens and closes; public pages show it only when signed in; none on desktop.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
