"use strict";
// Directive F13 (owner 2026-11-19, screenshot of a Tribe page): "no '← Back to Tribes' text button (the app bar back arrow
// does it); no huge '✓ Joined' bar (a small 'Joined ▾' chip with Leave…); pill tabs instead of boxed tabs; no box inside
// a box", and "Only Elders see Tribe controls". Real browser, touch, 320/360/390/430px:
// - an open Tribe is its own screen: the Tribes list, the "Tribes" panel title and the old text button are gone; the bar
//   shows ← (44px, centre tap) that goes back to the list and then leaves; system Back does the same; ← also leaves when
//   another tab opens; the bar never overflows (the logo steps aside at 320px);
// - one flat page: no border or rounded box around it or around the composer; the cover runs edge to edge;
// - pill tabs on one row, 44px, a centre tap selects one;
// - the founder sees a plain "Joined" label; a member's "Joined ▾" opens Leave Tribe (confirmed, then a green Join);
//   a visitor sees one green "Join" pill and no composer; only Elders see the cover tools.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/tribe-page.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", tribeId = "33333333-3333-4333-8333-333333333333";
const cdn = "https://dk7kawr758jtd.cloudfront.net";
const cover = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="600"><rect width="800" height="600" fill="#ff5a1f"/><rect x="800" width="800" height="600" fill="#123"/></svg>';
const cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true" };

async function open(browser, width, role) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [], memberships = [];
  page.on("pageerror", error => errors.push(error.message));
  const tribe = { id: tribeId, name: "Bay Area Hardcore", category: "Local Scenes", description: "Shows, rides and flyers.", memberCount: 12, isOwner: role === "founder", isElder: role === "founder", coverUrl: `${cdn}/users/x/cover.svg`, coverPosition: { x: 50, y: 50, zoom: 1 } };
  let joined = role !== "visitor";
  await page.route(`${cdn}/**`, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: cover }));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    const reply = body => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET,POST", "access-control-allow-headers": "content-type" } });
    if (path === "/auth/session") return reply({ authenticated: true, user: { sub: me, email: "me@danzstak.test" } });
    if (path === "/profiles") return reply({ profile: { memberId: me, name: "Night Shift", handle: "nightshift", cloudProfile: true, isOwner: true } });
    if (path === "/groups" && method === "GET") return reply({ groups: [{ ...tribe, joined }] });
    if (path === "/groups/membership" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      if (body.action === "list") return reply({ groupIds: joined ? [tribeId] : [] });
      memberships.push(body); joined = body.joined; return reply({ ok: true });
    }
    if (path === "/groups/membership") return reply({ groupIds: joined ? [tribeId] : [] });
    if (path === "/secure-posts") return reply({ posts: [] });
    if (path === "/stories") return reply({ stories: [], reels: [] });
    return reply({});
  });
  return { context, page, errors, memberships };
}
const centreTap = async (page, locator) => {
  await locator.scrollIntoViewIfNeeded({ timeout: 8000 });
  const box = await locator.boundingBox({ timeout: 8000 }), x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await locator.evaluate((element, point) => element.contains(document.elementFromPoint(point.x, point.y)), { x, y });
  await page.touchscreen.tap(x, y);
  return { box, hit };
};
const screen = page => page.evaluate(() => {
  const visible = element => Boolean(element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
  const rect = element => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
  const detail = document.querySelector(".tribe-detail"), back = document.querySelector(".ds-app-bar-screen-back"), bar = document.querySelector("header.topbar");
  const box = element => { const cs = getComputedStyle(element); return { border: [cs.borderTopWidth, cs.borderRightWidth, cs.borderLeftWidth].map(parseFloat).some(w => w > 0), radius: parseFloat(cs.borderTopLeftRadius), shadow: cs.boxShadow !== "none" }; };
  return {
    open: visible(detail), list: [...document.querySelectorAll(".group-card")].some(visible), title: visible(document.getElementById("featureTitle")), oldBack: Boolean(document.querySelector(".tribe-back")),
    back: visible(back) ? { ...rect(back), hit: back.contains(document.elementFromPoint(rect(back).left + rect(back).width / 2, rect(back).top + rect(back).height / 2)) } : null,
    barFits: bar ? [...bar.children].filter(visible).every(child => rect(child).right <= innerWidth + 0.5 && rect(child).left >= -0.5) && bar.scrollWidth <= bar.clientWidth + 1 : false,
    pageOverflow: document.documentElement.scrollWidth > innerWidth + 0.5,
    detailBox: visible(detail) ? box(detail) : null, composerBox: document.querySelector(".tribe-composer") && visible(document.querySelector(".tribe-composer")) ? box(document.querySelector(".tribe-composer")) : null,
    cover: visible(document.querySelector(".tribe-hero-cover")) ? rect(document.querySelector(".tribe-hero-cover")) : null,
    tabs: [...document.querySelectorAll(".tribe-nav button")].filter(visible).map(button => ({ ...rect(button), radius: parseFloat(getComputedStyle(button).borderTopLeftRadius), text: button.textContent, selected: button.getAttribute("aria-selected") })),
    chip: (() => { const chip = document.querySelector(".tribe-joined-chip"); return visible(chip) ? { tag: chip.tagName, text: chip.textContent.trim(), ...rect(chip) } : null; })(),
    join: (() => { const join = document.querySelector(".tribe-join"); return visible(join) ? { text: join.textContent.trim(), background: getComputedStyle(join).backgroundColor, ...rect(join) } : null; })(),
    composer: visible(document.querySelector(".tribe-composer")), coverTools: Boolean(document.querySelector(".tribe-cover-tools, .tribe-cover-edit, .tribe-cover-move"))
  };
});

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  const expect = (ok, message) => { if (!ok) failures.push(message); };
  try {
    for (const width of [320, 360, 390, 430]) {
      // Founder (Elder): opened from the Tribes list with a tap, so system Back has a step to go back to.
      let label = `${width}px founder`;
      let run = await open(browser, width, "founder");
      try {
        await run.page.goto(`${base}/feed.html?view=groups#groups`, { waitUntil: "domcontentloaded" });
        await run.page.locator(".group-card .group-open").first().waitFor({ timeout: 15000 });
        await centreTap(run.page, run.page.locator(".group-card .group-open").first());
        await run.page.locator(".tribe-hero").waitFor({ timeout: 8000 });
        await run.page.waitForTimeout(400);
        let state = await screen(run.page);
        expect(state.open && !state.list && !state.title && !state.oldBack, `${label}: the open Tribe isn't its own screen ${JSON.stringify({ list: state.list, title: state.title, oldBack: state.oldBack })}`);
        expect(state.back && state.back.width >= 44 && state.back.height >= 44 && state.back.hit, `${label}: no 44px ← in the bar ${JSON.stringify(state.back)}`);
        expect(state.barFits && !state.pageOverflow, `${label}: the bar or the page overflows sideways`);
        expect(state.detailBox && !state.detailBox.border && !state.detailBox.radius && !state.detailBox.shadow, `${label}: a box around the Tribe ${JSON.stringify(state.detailBox)}`);
        expect(state.composerBox && !state.composerBox.border && !state.composerBox.radius && !state.composerBox.shadow, `${label}: a box around the composer ${JSON.stringify(state.composerBox)}`);
        expect(state.cover && Math.abs(state.cover.left) < 0.5 && Math.abs(state.cover.right - width) < 0.5, `${label}: the cover doesn't run edge to edge ${JSON.stringify(state.cover)}`);
        expect(state.tabs.length === 3 && state.tabs.every(tab => tab.height >= 44 && tab.radius >= 20 && Math.abs(tab.top - state.tabs[0].top) < 1 && tab.right <= width + 0.5), `${label}: the tabs aren't one row of 44px pills ${JSON.stringify(state.tabs)}`);
        expect(state.chip && state.chip.tag === "SPAN" && state.chip.text === "Joined" && state.chip.height >= 44 && state.chip.width < width / 2, `${label}: the founder doesn't get a small plain "Joined" ${JSON.stringify(state.chip)}`);
        expect(state.coverTools, `${label}: the founder lost the cover tools`);
        const crew = await centreTap(run.page, run.page.locator(".tribe-nav button", { hasText: "The Crew" }));
        await run.page.waitForTimeout(200);
        expect(crew.hit && (await screen(run.page)).tabs.find(tab => tab.text === "The Crew")?.selected === "true", `${label}: a centre tap on a pill tab doesn't select it`);
        if (width === 390) await run.page.screenshot({ path: "docs/screenshots/tribe-page/founder-390.png" });
        await centreTap(run.page, run.page.locator(".ds-app-bar-screen-back"));
        await run.page.locator(".group-card").first().waitFor({ timeout: 8000 });
        await run.page.waitForTimeout(300);
        state = await screen(run.page);
        expect(state.list && !state.open && state.title && !state.back, `${label}: ← doesn't go back to the Tribes list and leave ${JSON.stringify({ list: state.list, open: state.open, title: state.title, back: state.back })}`);
        // System Back from a Tribe opened with a tap goes back to the list too.
        await centreTap(run.page, run.page.locator(".group-card .group-open").first());
        await run.page.locator(".tribe-hero").waitFor({ timeout: 8000 });
        await run.page.goBack();
        await run.page.waitForTimeout(500);
        state = await screen(run.page);
        expect(state.list && !state.open && !state.back, `${label}: system Back doesn't go back to the Tribes list ${JSON.stringify({ list: state.list, open: state.open, back: state.back })}`);
        // ← leaves when another tab (Events, in the bottom tab bar) opens while a Tribe is on show.
        await centreTap(run.page, run.page.locator(".group-card .group-open").first());
        await run.page.locator(".tribe-hero").waitFor({ timeout: 8000 });
        await centreTap(run.page, run.page.locator('a[href="feed.html?view=events"]').filter({ visible: true }).last());
        await run.page.waitForTimeout(800);
        expect(!(await screen(run.page)).back, `${label}: ← stays in the bar after leaving for Events`);
        expect(!run.errors.length, `${label}: page errors ${run.errors.join(" | ")}`);
      } catch (error) { failures.push(`${label}: ${error.message.split("\n")[0]}`); }
      await run.context.close();

      // A member: "Joined ▾" → Leave Tribe (confirmed) → a green Join; no cover tools.
      label = `${width}px member`;
      run = await open(browser, width, "member");
      try {
        await run.page.goto(`${base}/feed.html?view=groups&tribe=${tribeId}#groups`, { waitUntil: "domcontentloaded" });
        await run.page.locator(".tribe-hero").waitFor({ timeout: 15000 });
        await run.page.waitForTimeout(400);
        let state = await screen(run.page);
        expect(!state.coverTools, `${label}: cover tools show to someone who isn't an Elder`);
        expect(state.chip && state.chip.tag === "SUMMARY" && state.chip.text === "Joined" && state.chip.height >= 44 && state.chip.width < width / 2, `${label}: no small "Joined ▾" chip ${JSON.stringify(state.chip)}`);
        expect(state.back, `${label}: no ← in the bar on a Tribe opened from a link`);
        await centreTap(run.page, run.page.locator("summary.tribe-joined-chip"));
        const leave = await centreTap(run.page, run.page.locator(".tribe-leave"));
        expect(leave.hit && leave.box.height >= 44, `${label}: Leave Tribe isn't a reachable 44px row`);
        await run.page.locator(".danzstak-confirm-actions button").last().waitFor({ timeout: 5000 });
        await centreTap(run.page, run.page.locator(".danzstak-confirm-actions button").last());
        await run.page.locator(".tribe-join").waitFor({ timeout: 8000 });
        state = await screen(run.page);
        expect(JSON.stringify(run.memberships) === JSON.stringify([{ groupId: tribeId, joined: false }]), `${label}: Leave didn't send one leave ${JSON.stringify(run.memberships)}`);
        expect(state.join && state.join.text === "Join" && state.join.background === "rgb(21, 128, 61)" && state.join.height >= 44, `${label}: after leaving there's no green Join ${JSON.stringify(state.join)}`);
        expect(!run.errors.length, `${label}: page errors ${run.errors.join(" | ")}`);
      } catch (error) { failures.push(`${label}: ${error.message.split("\n")[0]}`); }
      await run.context.close();

      // A visitor: one green Join pill, no composer, no cover tools; Join sends one join.
      label = `${width}px visitor`;
      run = await open(browser, width, "visitor");
      try {
        await run.page.goto(`${base}/feed.html?view=groups&tribe=${tribeId}#groups`, { waitUntil: "domcontentloaded" });
        await run.page.locator(".tribe-hero").waitFor({ timeout: 15000 });
        await run.page.waitForTimeout(400);
        let state = await screen(run.page);
        expect(state.join && state.join.text === "Join" && state.join.background === "rgb(21, 128, 61)" && !state.chip && !state.composer && !state.coverTools, `${label}: not one green Join without composer or tools ${JSON.stringify({ join: state.join, chip: state.chip, composer: state.composer, tools: state.coverTools })}`);
        const join = await centreTap(run.page, run.page.locator(".tribe-join"));
        await run.page.locator(".tribe-joined-chip").waitFor({ timeout: 8000 });
        expect(join.hit && JSON.stringify(run.memberships) === JSON.stringify([{ groupId: tribeId, joined: true }]), `${label}: Join didn't send one join ${JSON.stringify(run.memberships)}`);
        if (width === 390) await run.page.screenshot({ path: "docs/screenshots/tribe-page/joined-390.png" });
        expect(!run.errors.length, `${label}: page errors ${run.errors.join(" | ")}`);
      } catch (error) { failures.push(`${label}: ${error.message.split("\n")[0]}`); }
      await run.context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Tribe page checks passed at 320/360/390/430px: its own screen with ← in the bar (back to the list, system Back too, gone on another tab), one flat page edge to edge, pill tabs, a plain Joined for the founder, Joined ▾ → Leave for members, a green Join for visitors, cover tools for Elders only.");
})();
