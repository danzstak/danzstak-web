"use strict";
// Owner 2026-11-19 (his profile next to Facebook's): "Friends should be a 50% stacked to the right of the 3 buttons".
// Real browser, touch, own profile at 320/360/390/430px: the friends' photos sit at the right end of the action row
// (after edit, shop and share), each overlapping the next by half (36px faces, 18px apart), all on screen and on one row
// with the buttons; it is named "N friends"; a tap at its centre opens the Friends tab.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/profile-facepile.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const svg = colour => `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${colour}"/></svg>`;
const FRIENDS = ["#ff5a1f", "#3366ff", "#22aa66", "#aa22aa", "#999999"].map((colour, i) => ({ email: `f${i}@x.test`, memberId: `2222222${i}-2222-4222-8222-222222222222`, name: `Friend ${i}`, picture: `${base}/__face-${i}.svg` }));

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${base}/__face-*.svg`, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: svg(FRIENDS[Number(route.request().url().match(/face-(\d)/)[1])].email.length ? "#ff5a1f" : "#000") }));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const json = body => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
        if (p === "/auth/session") return json({ authenticated: true, user: { sub: me } });
        if (p === "/profiles" || p === "/profile") return json({ profile: { memberId: me, name: "SFScoop", username: "sfscoop", handle: "sfscoop", isOwner: true, cloudProfile: true, bio: "Maker of DanzStak." } });
        if (p === "/friends") return json({ friends: FRIENDS });
        return json({});
      });
      await page.goto(`${base}/profile.html`, { waitUntil: "domcontentloaded" });
      const shown = await page.waitForFunction(() => { const pile = document.querySelector(".profile-actions .profile-facepile"); return pile && !pile.hidden && pile.querySelectorAll("img").length === 4; }, null, { timeout: 10000 }).then(() => true).catch(() => false);
      if (!shown) { failures.push(`${label}: the friends facepile did not show`); await context.close(); continue; }
      await page.waitForTimeout(300);
      const layout = await page.evaluate(() => {
        const row = document.querySelector(".profile-actions"), pile = row.querySelector(".profile-facepile");
        const box = el => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; };
        const buttons = [...row.children].filter(el => el !== pile && !el.hidden && el.getBoundingClientRect().width > 0).map(box);
        const faces = [...pile.querySelectorAll(".ds-facepile__face")].map(box), p = box(pile);
        const hit = document.elementFromPoint(p.l + p.w / 2, p.t + p.h / 2);
        return { buttons, faces, pile: p, label: pile.getAttribute("aria-label"), vw: innerWidth, hit: Boolean(hit?.closest(".profile-facepile")) };
      });
      const lastButton = layout.buttons.reduce((max, b) => Math.max(max, b.r), 0);
      if (layout.buttons.length < 2) failures.push(`${label}: the action buttons are missing (${layout.buttons.length})`);
      if (layout.pile.l < lastButton - 0.5) failures.push(`${label}: the facepile is not to the right of the buttons`);
      if (layout.pile.r > layout.vw + 0.5) failures.push(`${label}: the facepile runs off screen`);
      if (layout.buttons.some(b => Math.abs((b.t + b.b) / 2 - (layout.pile.t + layout.pile.b) / 2) > 6)) failures.push(`${label}: the facepile is not on the buttons' row`);
      const steps = layout.faces.slice(1).map((face, i) => face.l - layout.faces[i].l);
      if (layout.faces.length !== 4 || steps.some(step => Math.abs(step - layout.faces[0].w / 2) > 1.5)) failures.push(`${label}: faces must overlap by half (${JSON.stringify(steps)}, ${layout.faces.length} faces)`);
      if (layout.label !== "5 friends") failures.push(`${label}: named "${layout.label}"`);
      if (!layout.hit || layout.pile.h < 44) failures.push(`${label}: the facepile must be a 44px target reachable at its centre`);
      if (width === 390) await page.screenshot({ path: "docs/screenshots/profile-facepile-390.png" });
      await page.touchscreen.tap(layout.pile.l + layout.pile.w / 2, layout.pile.t + layout.pile.h / 2);
      // 5a3: the pile opens the one Friends screen.
      const friendsOpen = await page.waitForURL(/\/friends\.html(\?|$)/, { timeout: 5000 }).then(() => true).catch(() => false);
      if (!friendsOpen) failures.push(`${label}: tapping the facepile did not open the Friends screen`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log("Profile facepile checks passed at 320, 360, 390, 430px: friends' photos stacked by half at the right end of the action row, on screen, named \"N friends\", a tap opens the Friends screen.");
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
