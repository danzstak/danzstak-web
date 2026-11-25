"use strict";
// UIKIT screen 4b part 2 (docs/tasks/39-modern-look.md, CLAUDE.md F9): the profile's action row is kit icon buttons.
// At 320/360/390/430px, owner and visitor, Day and Night, plus Italian:
// - the row is the kit row (.ds.ds-actions); every control is a round 44px kit icon button with a sprite icon and a
//   name for screen readers, and a tap on its centre lands on it (elementFromPoint);
// - one primary action in green: Edit on your own profile, Add friend on someone else's; the rest are quiet (white);
// - the visitor's Share lives in ⋯, which opens a kit sheet (Day on the not-yet-moved page) whose Share profile opens the
//   share sheet;
// - the friends' faces sit at the end of the row, on the row, inside the screen; no sideways scroll;
// - Night keeps the row on Day (no dark buttons on the light page until the whole profile moves).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8135 node browser-checks/profile-actions-kit.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8135").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", them = "22222222-2222-4222-8222-222222222222";
const FRIENDS = [1, 2, 3, 4].map(n => ({ memberId: `3333333${n}-3333-4333-8333-333333333333`, name: `Friend ${n}`, picture: "" }));
const GO = "rgb(21, 128, 61)", WHITE = "rgb(255, 255, 255)";

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  const runs = [];
  for (const owner of [true, false]) for (const width of [320, 360, 390, 430]) for (const scheme of ["light", "dark"]) runs.push({ owner, width, scheme, lang: "en" });
  runs.push({ owner: true, width: 390, scheme: "light", lang: "it" }, { owner: false, width: 360, scheme: "dark", lang: "it" });
  try {
    for (const { owner, width, scheme, lang } of runs) {
      const label = `${owner ? "owner" : "visitor"} ${width}px ${scheme} ${lang}`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, locale: lang === "it" ? "it-IT" : "en-US", serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const profile = owner
          ? { memberId: me, name: "Dachshund Records", handle: "dachshund", bio: "Techno from Bologna.", isOwner: true, cloudProfile: true }
          : { memberId: them, name: "Night Shift", handle: "nightshift", bio: "", isOwner: false, cloudProfile: true };
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } }
          : p === "/profiles" ? { profile } : p === "/secure-posts" ? { posts: [] }
          : p === "/friends" ? { friends: owner ? FRIENDS : [], outgoing: [], incoming: [], count: 4 }
          : p === "/friends/of" ? { friends: FRIENDS.slice(0, 2), mutualCount: 2, listVisible: false } : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      try {
        await page.goto(`${base}/profile.html${owner ? "" : "?member=" + them}`, { waitUntil: "domcontentloaded" });
        await page.waitForFunction(owner => {
          const row = document.querySelector(".profile-actions"), pile = row?.querySelector(".profile-facepile");
          return row && pile && !pile.hidden && (owner || row.querySelector(".profile-friend-action") && row.querySelector(".profile-more"));
        }, owner, { timeout: 20000, polling: 200 });
        await page.waitForTimeout(300);
        const row = await page.evaluate(() => {
          const row = document.querySelector(".profile-actions"), box = row.getBoundingClientRect();
          const shown = [...row.children].filter(el => !el.hidden && el.getClientRects().length);
          const controls = shown.filter(el => !el.classList.contains("profile-facepile")).map(el => {
            const r = el.getBoundingClientRect(), s = getComputedStyle(el);
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { icon: el.dataset.icon, kit: el.classList.contains("ds-icon-btn"), w: Math.round(r.width), h: Math.round(r.height), radius: s.borderRadius,
              background: s.backgroundColor, sprite: Boolean(el.querySelector(":scope > svg.ds-icon use[href*='icons.svg#']")), name: el.getAttribute("aria-label") || "",
              words: el.textContent.trim(), hit: hit === el || el.contains(hit), right: r.right, mid: r.top + r.height / 2 };
          });
          const pile = row.querySelector(".profile-facepile").getBoundingClientRect();
          return { kit: row.matches(".ds.ds-actions"), left: box.left, right: box.right, controls, pile: { l: pile.left, r: pile.right, mid: pile.top + pile.height / 2 }, overflow: document.documentElement.scrollWidth > innerWidth, vw: innerWidth };
        });
        if (!row.kit) failures.push(`${label}: the action row is not the kit row`);
        if (row.overflow) failures.push(`${label}: sideways scroll`);
        for (const c of row.controls) {
          const tag = `${label} [${c.icon}]`;
          if (!c.kit || c.w !== 44 || c.h !== 44 || c.radius !== "50%") failures.push(`${tag}: not a round 44px kit icon button (${c.w}x${c.h}, ${c.radius})`);
          if (!c.sprite) failures.push(`${tag}: no kit sprite icon`);
          if (!c.name) failures.push(`${tag}: no accessible name`);
          if (c.words) failures.push(`${tag}: words on the button ("${c.words}")`);
          if (!c.hit) failures.push(`${tag}: its centre is covered`);
        }
        const [first, ...rest] = row.controls;
        const expected = owner ? ["edit", "store", "share"] : ["person-add", "chat", "more"];
        const icons = row.controls.map(c => c.icon);
        if (JSON.stringify(icons) !== JSON.stringify(expected)) failures.push(`${label}: row is ${JSON.stringify(icons)}, expected ${JSON.stringify(expected)}`);
        if (first?.background !== GO) failures.push(`${label}: the primary action is not green (${first?.background})`);
        if (rest.some(c => c.background !== WHITE)) failures.push(`${label}: a secondary button is not quiet Day white ${JSON.stringify(rest.map(c => c.background))}`);
        const last = row.controls.reduce((max, c) => Math.max(max, c.right), 0);
        if (row.pile.l < last - 0.5 || row.pile.r > row.vw + 0.5 || Math.abs(row.pile.mid - first.mid) > 6) failures.push(`${label}: the friends' faces are not at the end of the row on screen (${JSON.stringify(row.pile)})`);
        if (lang === "it") {
          const words = owner ? /Modifica|profilo/i : /^(Scrivi a|Invia un messaggio a) Night Shift$/;
          const named = owner ? first.name : row.controls.find(c => c.icon === "chat")?.name;
          if (!words.test(named || "")) failures.push(`${label}: not translated ("${named}")`);
        }
        if (!owner) {
          // ⋯ → kit sheet (Day) → Share profile → the share sheet.
          const more = row.controls.find(c => c.icon === "more");
          const box = await page.locator(".profile-actions .profile-more").boundingBox();
          await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          await page.locator(".ds-sheet.is-open .profile-more-share").waitFor({ timeout: 5000 });
          await page.waitForTimeout(400);
          const sheet = await page.evaluate(() => {
            const panel = document.querySelector(".ds-sheet.is-open .ds-sheet__panel"), item = panel.querySelector(".profile-more-share"), r = item.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return { background: getComputedStyle(panel).backgroundColor, text: item.textContent.trim(), h: r.height, hit: item.contains(hit), x: r.left + r.width / 2, y: r.top + r.height / 2 };
          });
          if (sheet.background !== WHITE) failures.push(`${label}: the ⋯ sheet is not Day (${sheet.background})`);
          if (sheet.text !== (lang === "it" ? "Condividi profilo" : "Share profile")) failures.push(`${label}: the ⋯ sheet says "${sheet.text}"`);
          if (sheet.h < 44 || !sheet.hit) failures.push(`${label}: Share profile is not a clear 44px target`);
          if (more && !more.hit) failures.push(`${label}: ⋯ centre covered`);
          await page.touchscreen.tap(sheet.x, sheet.y);
          await page.waitForFunction(() => document.querySelector(".profile-share-dialog")?.open, null, { timeout: 5000 }).catch(() => failures.push(`${label}: Share profile did not open the share sheet`));
        }
        if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      } catch (error) { failures.push(`${label}: ${error.message.split("\n")[0]}`); }
      finally { await context.close(); }
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log(`Profile action row on the kit: ${runs.length} runs (owner/visitor, 320–430px, Day/Night, Italian).`);
})();
