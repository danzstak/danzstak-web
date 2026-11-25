"use strict";
// UIKIT screen 4b part 1 (docs/tasks/39-modern-look.md, CLAUDE.md F9): the profile's tabs are the kit pill row and its
// About details are kit facts (icon, small label, value). At 320/360/390/430px, owner and visitor, Day and Night:
// - every pill is at least 44px high, a tap on its centre selects it (elementFromPoint hits the pill), no sideways scroll;
// - on a phone the pill row runs edge to edge;
// - About shows Location and Work on one line and Website below, each with its icon; a visitor never sees "Not added";
// - Night on a page that hasn't moved keeps the pills and About on Day (no dark block on a light page);
// - the Friends tab chosen from the keyboard shows one row to the Friends screen, never a second friends list;
// - Italian: the labels and the row are translated.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8135 node browser-checks/profile-kit.cjs   (CAPTURE=dir for screenshots)
const { chromium } = require("playwright");
const path = require("node:path");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8135").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", them = "22222222-2222-4222-8222-222222222222";

function profileFor(owner) {
  return owner
    ? { memberId: me, name: "Dachshund Records", handle: "dachshund", bio: "Techno from Bologna.", location: "Bologna, Italy", work: "DJ & Techno Producer", website: "", story: "Started in 1996.", isOwner: true, cloudProfile: true }
    : { memberId: them, name: "Night Shift", handle: "nightshift", bio: "", location: "Oakland", work: "", website: "nightshift.example", isOwner: false, cloudProfile: true, friendStatus: "friends" };
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  const runs = [];
  for (const owner of [true, false]) for (const width of [320, 360, 390, 430]) for (const scheme of ["light", "dark"]) runs.push({ owner, width, scheme, lang: "en" });
  runs.push({ owner: true, width: 390, scheme: "light", lang: "it" }, { owner: false, width: 360, scheme: "dark", lang: "it" });
  try {
    for (const run of runs) {
      const { owner, width, scheme, lang } = run, label = `${owner ? "owner" : "visitor"} ${width}px ${scheme} ${lang}`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, colorScheme: scheme, locale: lang === "it" ? "it-IT" : "en-US", serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "a@example.test" } }
          : p === "/profiles" ? { profile: profileFor(owner) } : p === "/secure-posts" ? { posts: [] } : {};
        return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
      });
      try {
        await page.goto(`${base}/profile.html${owner ? "" : "?member=" + them}`, { waitUntil: "domcontentloaded" });
        await page.locator('.profile-tabs [data-profile-tab="Posts"][aria-selected="true"]').waitFor({ timeout: 15000 });
        await page.waitForTimeout(400);
        // Pills: kit classes, 44px, edge to edge on a phone, Day colours in Night.
        const pills = await page.evaluate(() => {
          const nav = document.querySelector(".profile-tabs"), box = nav.getBoundingClientRect();
          return {
            kit: nav.classList.contains("ds") && nav.classList.contains("ds-pills"), left: box.left, right: box.right,
            background: getComputedStyle(nav).backgroundColor,
            items: [...nav.querySelectorAll("[data-profile-tab]")].filter(el => el.getClientRects().length).map(el => ({ name: el.dataset.profileTab, kit: el.classList.contains("ds-pill"), height: el.getBoundingClientRect().height })),
            overflow: document.documentElement.scrollWidth > innerWidth
          };
        });
        if (!pills.kit) failures.push(`${label}: the tabs are not the kit pill row`);
        if (pills.items.some(item => !item.kit || item.height < 44)) failures.push(`${label}: a pill is not a 44px kit pill ${JSON.stringify(pills.items)}`);
        if (pills.left > 0.5 || pills.right < width - 0.5) failures.push(`${label}: the pill row does not run edge to edge (${pills.left}–${pills.right})`);
        if (pills.background !== "rgb(255, 255, 255)") failures.push(`${label}: the pill row is not on Day white (${pills.background})`);
        if (pills.overflow) failures.push(`${label}: sideways scroll`);
        // Centre tap on About (scroll the pill into view first, like a thumb would).
        const about = page.locator('.profile-tabs [data-profile-tab="About"]');
        await about.scrollIntoViewIfNeeded();
        const box = await about.boundingBox();
        const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-profile-tab]")?.dataset.profileTab || "", [box.x + box.width / 2, box.y + box.height / 2]);
        if (hit !== "About") failures.push(`${label}: the centre of About is covered by ${hit || "something else"}`);
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.locator('.profile-tabs [data-profile-tab="About"][aria-selected="true"]').waitFor({ timeout: 5000 });
        const facts = await page.evaluate(() => {
          const shown = el => el && !el.closest("[hidden]") && el.getClientRects().length > 0;
          const fact = id => { const value = document.getElementById(id), box = value?.closest(".ds-fact"); return shown(box) ? { top: Math.round(box.getBoundingClientRect().top), icon: Boolean(box.querySelector("svg.ds-icon use")), label: box.querySelector(".ds-fact__label")?.textContent.trim(), value: value.textContent.trim(), ink: getComputedStyle(value).color } : null; };
          const details = document.querySelector(".details");
          return { kit: details.classList.contains("ds-facts"), background: getComputedStyle(details).backgroundColor, location: fact("profileLocation"), work: fact("profileWork"), website: fact("profileWebsite"), overflow: document.documentElement.scrollWidth > innerWidth };
        });
        if (!facts.kit) failures.push(`${label}: About is not kit facts`);
        if (facts.background !== "rgb(255, 255, 255)") failures.push(`${label}: About is not on Day white (${facts.background})`);
        const expectedLabels = lang === "it" ? { location: "Luogo", work: "Lavoro", website: "Sito web" } : { location: "Location", work: "Work", website: "Website" };
        for (const key of ["location", "work", "website"]) {
          const item = facts[key];
          if (!item) { if (owner || key === "location" || key === "website") failures.push(`${label}: ${key} is missing`); continue; }
          if (!item.icon) failures.push(`${label}: ${key} has no icon`);
          if (item.label.toLocaleLowerCase() !== expectedLabels[key].toLocaleLowerCase()) failures.push(`${label}: ${key} label is "${item.label}"`);
          if (/^(Not added|Non aggiunto)$/.test(item.value) && !owner) failures.push(`${label}: a visitor sees "${item.value}"`);
          if (item.ink !== "rgb(11, 11, 12)" && !/^(Not added|Non aggiunto)$/.test(item.value)) failures.push(`${label}: ${key} value is not Day ink (${item.ink})`);
        }
        if (owner && facts.location && facts.work && facts.location.top !== facts.work.top) failures.push(`${label}: Location and Work are not on one line`);
        if (owner && facts.website?.value !== (lang === "it" ? "Non aggiunto" : "Not added")) failures.push(`${label}: the owner's empty Website reads "${facts.website?.value}"`);
        if (facts.overflow) failures.push(`${label}: sideways scroll on About`);
        if (process.env.CAPTURE && [360, 390].includes(width)) await page.screenshot({ path: path.join(process.env.CAPTURE, `profile-kit-${owner ? "owner" : "visitor"}-${scheme}-${lang}-${width}.png`), clip: { x: 0, y: 0, width, height: 844 } });
        // Friends from the keyboard: one row to the Friends screen, no second list.
        await page.locator('.profile-tabs [data-profile-tab="About"]').focus();
        await page.keyboard.press("ArrowRight");
        await page.locator(".profile-friends-link").waitFor({ timeout: 5000 });
        const link = await page.evaluate(() => { const row = document.querySelector(".profile-friends-link"); const b = row.getBoundingClientRect(); return { href: row.getAttribute("href"), text: row.textContent.trim(), height: b.height, grids: document.querySelectorAll(".profile-friend-grid,.profile-friend-card").length }; });
        if (link.href !== (owner ? "friends.html" : `friends.html?member=${them}`)) failures.push(`${label}: the Friends row goes to ${link.href}`);
        if (link.height < 44) failures.push(`${label}: the Friends row is ${link.height}px high`);
        if (link.grids) failures.push(`${label}: a second friends list is drawn on the profile`);
        const expectedRow = lang === "it" ? (owner ? "Vedi tutti i tuoi amici" : "Vedi i suoi amici") : (owner ? "See all your friends" : "See their friends");
        if (link.text !== expectedRow) failures.push(`${label}: the Friends row reads "${link.text}"`);
      } catch (error) { failures.push(`${label}: ${String(error.message || error).split("\n")[0]}`); }
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`Profile on the kit (UIKIT 4b): ${failures.length} problem(s)\n- ${failures.join("\n- ")}`); process.exit(1); }
  console.log("Profile on the kit (UIKIT 4b) passed at 320/360/390/430px, owner and visitor, Day and Night, English and Italian: 44px pills edge to edge that select on a centre tap, About facts with icons (Location and Work on one line), Day kept on a page that hasn't moved, and the Friends tab's one row to the Friends screen.");
})();
