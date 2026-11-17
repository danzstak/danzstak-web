"use strict";
// Fix-it 18, Profile page (owner 2026-11-17): a profile should feel "like looking in the mirror". The member's cover,
// face, photos and videos fill the screen; DanzStak chrome and big text buttons get out of the way.
// Audits the owner's own profile and a visitor's view at 360 and 390px (plus 320/430) and fails on big text buttons in
// the profile column (the "View in Your Mix" / "Feature on profile" / "Add to the Mix" kind), sideways overflow and
// page errors. API mocked. Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/profile-mirror.cjs
// AUDIT_ONLY=1 SHOTS=before just reports.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const prefix = process.env.SHOTS || "after";
const output = path.resolve("docs/screenshots/profile-mirror");
const widths = (process.env.WIDTHS || "320,360,390,430").split(",").map(Number);
const ownerId = "11111111-1111-4111-8111-111111111111", visitorId = "22222222-2222-4222-8222-222222222222";

const portrait = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360"><rect width="360" height="360" fill="#1d2633"/><circle cx="180" cy="150" r="80" fill="#f4c8a4"/><path d="M55 360c20-105 70-150 125-150s105 45 125 150" fill="#e5452e"/></svg>';
const landscape = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#0b0b0c"/><circle cx="800" cy="450" r="300" fill="#ff5a1f"/><text x="800" y="480" font-size="120" text-anchor="middle" fill="#fff" font-family="sans-serif">LIVE</text></svg>';
const tall = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1600"><rect width="900" height="1600" fill="#0f2e26"/><rect x="100" y="200" width="700" height="1200" fill="#ffc93c"/></svg>';

function profileFor(owner) {
  return {
    memberId: ownerId, name: "Night Shift", handle: "nightshift", username: "nightshift",
    bio: "Electronic punk from Oakland.", location: "Oakland, California", work: "Artist · Live act",
    picture: `${baseUrl}/__mirror/portrait.svg`, cover: `${baseUrl}/__mirror/landscape.svg`,
    isOwner: owner, cloudProfile: true, friendStatus: owner ? undefined : "none"
  };
}
const posts = owner => [
  { postId: "33333333-3333-4333-8333-333333333331", userId: ownerId, authorName: "Night Shift", authorPicture: `${baseUrl}/__mirror/portrait.svg`, content: "Warehouse set last night. Thank you Oakland.", createdAt: "2026-11-16T21:30:00.000Z", audience: "public", isOwner: owner, mediaType: "image", mediaUrl: `${baseUrl}/__mirror/landscape.svg`, viewCount: 42 },
  { postId: "33333333-3333-4333-8333-333333333332", userId: ownerId, authorName: "Night Shift", authorPicture: `${baseUrl}/__mirror/portrait.svg`, content: "Flyer for Friday.", createdAt: "2026-11-15T17:30:00.000Z", audience: "public", isOwner: owner, mediaType: "image", mediaUrl: `${baseUrl}/__mirror/tall.svg`, viewCount: 18 },
  { postId: "33333333-3333-4333-8333-333333333333", userId: ownerId, authorName: "Night Shift", authorPicture: `${baseUrl}/__mirror/portrait.svg`, content: "New track is up, link in bio.", createdAt: "2026-11-14T12:00:00.000Z", audience: "public", isOwner: owner, viewCount: 7 },
  // A friend's post on the owner's wall: the owner may remove it from their profile (slim icon, not a text button).
  { postId: "33333333-3333-4333-8333-333333333334", userId: visitorId, authorName: "Tour Friend", content: "Great show!", profileOwnerMemberId: ownerId, createdAt: "2026-11-13T12:00:00.000Z", audience: "public", isOwner: false, canRemoveFromProfile: owner, viewCount: 2 }
];

// Dailies: three by the profile's member (oldest first in the strip) and one by someone else that must not appear.
const dailies = () => [
  { storyId: "d1", memberId: ownerId, displayName: "Night Shift", mediaType: "image", mediaUrl: `${baseUrl}/__mirror/tall.svg`, createdAt: "2026-11-17T09:00:00.000Z" },
  { storyId: "d2", memberId: ownerId, displayName: "Night Shift", mediaType: "image", mediaUrl: `${baseUrl}/__mirror/portrait.svg`, createdAt: "2026-11-17T10:00:00.000Z" },
  { storyId: "d3", memberId: ownerId, displayName: "Night Shift", mediaType: "image", mediaUrl: `${baseUrl}/__mirror/landscape.svg`, createdAt: "2026-11-17T11:00:00.000Z" },
  { storyId: "x1", memberId: visitorId, displayName: "Someone Else", mediaType: "image", mediaUrl: `${baseUrl}/__mirror/landscape.svg`, createdAt: "2026-11-17T12:00:00.000Z" }
];
// One continuous wall on a phone: cover, tabs, composer, Dailies and posts all reach both screen edges, and the
// composer, Dailies strip and first post touch with no gap.
const wall = page => page.evaluate(() => {
  const box = selector => { const node = document.querySelector(selector); if (!node || node.closest("[hidden]")) return null; const r = node.getBoundingClientRect(); return r.height ? { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY } : null; };
  return { width: innerWidth, cover: box(".cover"), tabs: box(".profile-tabs"), composer: box(".profile-wall-composer"), strip: box(".profile-dailies:not([hidden])"), post: box(".profile-post-card"),
    tiles: [...document.querySelectorAll(".profile-daily")].map(node => node.getAttribute("aria-label")), tileCount: document.querySelectorAll(".profile-daily").length };
});

// Big text buttons in the profile column: visible buttons/links styled as buttons whose label is a phrase.
const audit = page => page.evaluate(() => {
  const problems = [];
  const scope = document.querySelector("main") || document.body;
  for (const node of scope.querySelectorAll("button, a.button, a[role='button'], .profile-post-card a.secondary, .profile-post-card a.primary")) {
    const r = node.getBoundingClientRect(), cs = getComputedStyle(node);
    if (!r.width || !r.height || cs.visibility === "hidden" || node.closest("[hidden], dialog:not([open]), .profile-editor, .ds-mobile-nav, .topbar, header.site-header, [role='tablist'], [role='menu']")) continue;
    const text = [...node.childNodes].map(child => child.nodeType === 3 ? child.textContent : child.matches?.("svg, .sr-only, [aria-hidden='true']") ? "" : child.textContent).join("").replace(/\s+/g, " ").trim();
    if (/^(View in (Your Mix|The Roll)|View on Reels|Feature on profile|Remove from Featured|Add to (the )?Mix)$/i.test(text)) problems.push(`big text button "${text}"`);
    else if (text.split(" ").length >= 3 && r.width > 120 && node.closest(".profile-post-card, .profile-media, .profile-dailies, .profile-roll")) problems.push(`phrase button in content "${text}" (${Math.round(r.width)}px)`);
  }
  if (document.documentElement.scrollWidth > innerWidth) problems.push(`sideways overflow ${document.documentElement.scrollWidth}px`);
  return problems;
});

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const owner of [true, false]) for (const width of widths) {
      const who = owner ? "owner" : "visitor", label = `${who} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${baseUrl}/__mirror/*`, route => {
        const name = new URL(route.request().url()).pathname.split("/").pop();
        route.fulfill({ status: 200, contentType: "image/svg+xml", body: name === "portrait.svg" ? portrait : name === "tall.svg" ? tall : landscape });
      });
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: owner ? ownerId : visitorId, email: owner ? "artist@danzstak.invalid" : "fan@danzstak.invalid" } }
          : p === "/profiles" ? { profile: profileFor(owner) }
          : p === "/secure-posts" ? { posts: posts(owner) }
          : p === "/profile-friends" ? { friends: [] }
          : p === "/profile-video" ? { video: null }
          : p === "/settings/presence" ? { visible: true }
          : p === "/stories" && route.request().method() === "GET" ? { stories: width === 430 ? [] : dailies() }
          : {};
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      await page.goto(`${baseUrl}/profile.html${owner ? "" : "?member=" + ownerId}#posts`, { waitUntil: "domcontentloaded" });
      await page.locator(".profile-post-card").first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(700);
      (await audit(page)).forEach(problem => failures.push(`${label}: ${problem}`));
      const remove = await page.evaluate(() => { const b = document.querySelector(".profile-wall-remove"); if (!b) return null; const r = b.getBoundingClientRect(); return { svg: !!b.querySelector("svg"), text: [...b.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()), label: b.getAttribute("aria-label"), w: r.width, h: r.height }; });
      if (owner && !remove) failures.push(`${label}: the owner cannot remove a friend's wall post`);
      if (!owner && remove) failures.push(`${label}: a visitor sees the wall-remove control`);
      if (remove && (!remove.svg || remove.text || !remove.label || remove.w > 48 || Math.min(remove.w, remove.h) < 43.5)) failures.push(`${label}: wall remove is not a slim 44px icon button with a name ${JSON.stringify(remove)}`);
      await page.waitForFunction(() => document.querySelector(".profile-dailies:not([hidden])") || !document.querySelector(".profile-dailies"), null, { timeout: 5000 }).catch(() => {});
      const w = await wall(page);
      const edge = (name, r) => { if (!r) failures.push(`${label}: ${name} missing`); else if (Math.abs(r.left) > 0.5 || Math.abs(r.right - w.width) > 0.5) failures.push(`${label}: ${name} does not reach both edges (${Math.round(r.left)}–${Math.round(r.right)} of ${w.width})`); };
      if (width <= 560) { edge("cover", w.cover); edge("tab row", w.tabs); edge("first post", w.post); if (owner) edge("composer", w.composer); }
      if (width === 430) { if (w.strip) failures.push(`${label}: an empty Dailies strip is shown`); }
      else {
        edge("Dailies strip", w.strip);
        if (w.tileCount !== 3) failures.push(`${label}: Dailies strip shows ${w.tileCount} tiles, expected the member's 3 (no one else's)`);
        if (w.strip && w.post && Math.abs(w.post.top - w.strip.bottom) > 1.5) failures.push(`${label}: gap between Dailies and posts (${Math.round(w.post.top - w.strip.bottom)}px)`);
        if (owner && w.strip && w.composer && Math.abs(w.strip.top - w.composer.bottom) > 1.5) failures.push(`${label}: gap between composer and Dailies (${Math.round(w.strip.top - w.composer.bottom)}px)`);
      }
      if ([360, 390].includes(width)) {
        await page.screenshot({ path: path.join(output, `${prefix}-${who}-top-${width}.png`) });
        if (w.strip) {
          await page.evaluate(() => { const r = document.querySelector(".profile-dailies").getBoundingClientRect(); scrollBy(0, r.top - 180); });
          await page.waitForTimeout(250);
          await page.screenshot({ path: path.join(output, `${prefix}-${who}-dailies-${width}.png`) });
          const before = await page.evaluate(() => scrollY);
          // Tap a Daily: full screen; next; Back returns to the same place on the profile.
          await page.locator(".profile-daily").nth(1).click();
          await page.waitForTimeout(300);
          const open = await page.evaluate(() => { const v = document.querySelector(".profile-daily-viewer"); const m = v?.querySelector(".profile-daily-full"); const r = v?.getBoundingClientRect(); return { open: v?.open === true, w: r?.width, h: r?.height, src: m?.getAttribute("src") || "", next: !v?.querySelector(".profile-daily-next").hidden, prev: !v?.querySelector(".profile-daily-prev").hidden, labels: [...v.querySelectorAll("button:not([hidden])")].every(b => b.getAttribute("aria-label")) }; });
          if (!open.open || Math.abs(open.w - width) > 1 || Math.abs(open.h - 844) > 1) failures.push(`${label}: Daily viewer is not full screen ${JSON.stringify(open)}`);
          if (!/portrait\.svg/.test(open.src) || !open.next || !open.prev || !open.labels) failures.push(`${label}: viewer opened the wrong Daily or lacks named prev/next ${JSON.stringify(open)}`);
          await page.screenshot({ path: path.join(output, `${prefix}-${who}-viewer-${width}.png`) });
          await page.locator(".profile-daily-next").click();
          await page.waitForTimeout(200);
          if (!/landscape\.svg/.test(await page.locator(".profile-daily-full").getAttribute("src"))) failures.push(`${label}: next did not advance`);
          await page.goBack();
          await page.waitForTimeout(400);
          const after = await page.evaluate(() => ({ open: document.querySelector(".profile-daily-viewer")?.open === true, y: scrollY, url: location.href }));
          if (after.open) failures.push(`${label}: Back did not close the Daily viewer`);
          if (!/profile\.html/.test(after.url) || Math.abs(after.y - before) > 2) failures.push(`${label}: Back did not return to the same place (${before} → ${after.y}, ${after.url})`);
        }
        await page.locator(".profile-post-card").first().scrollIntoViewIfNeeded().catch(() => {});
        await page.evaluate(() => scrollBy(0, -60));
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(output, `${prefix}-${who}-posts-${width}.png`) });
        // Where the old text buttons sat: under the first post's reactions, and the friend's wall post below it.
        await page.evaluate(() => { const row = document.querySelector(".profile-post-card .profile-post-actions"); if (row) { const r = row.getBoundingClientRect(); scrollBy(0, r.top - innerHeight * 0.35); } });
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(output, `${prefix}-${who}-actions-${width}.png`) });
      }
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) {
    console[process.env.AUDIT_ONLY ? "log" : "error"](`Profile mirror: ${unique.length} problem(s)\n- ${unique.join("\n- ")}`);
    if (!process.env.AUDIT_ONLY) process.exitCode = 1;
    return;
  }
  console.log(`Profile mirror checks passed at ${widths.join(", ")}px (owner and visitor): no big text buttons, one edge-to-edge wall, Dailies strip directly above the posts with a full-screen viewer and Back.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
