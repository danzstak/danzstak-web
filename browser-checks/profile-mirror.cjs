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
  { postId: "33333333-3333-4333-8333-333333333335", userId: ownerId, authorName: "Night Shift", content: "Soundcheck clip.", createdAt: "2026-11-12T12:00:00.000Z", audience: "public", isOwner: owner, mediaType: "video", mediaUrl: `${baseUrl}/__mirror/portrait.webm`, viewCount: 3 },
  { postId: "33333333-3333-4333-8333-333333333336", userId: ownerId, authorName: "Night Shift", content: "Crowd from the booth.", createdAt: "2026-11-11T12:00:00.000Z", audience: "public", isOwner: owner, mediaType: "video", mediaUrl: `${baseUrl}/__mirror/landscape.webm`, viewCount: 3 },
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

// Small portrait and landscape test videos, recorded in the browser at run time (no binaries in the repo).
async function makeVideos(browser) {
  const page = await browser.newPage(), out = {};
  for (const [name, w, h] of [["portrait", 360, 640], ["landscape", 640, 360]]) {
    out[name] = Buffer.from(await page.evaluate(async ([w, h]) => {
      const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
      const rec = new MediaRecorder(c.captureStream(15), { mimeType: "video/webm" }), chunks = [];
      rec.ondataavailable = e => chunks.push(e.data); rec.start();
      for (let i = 0; i < 20; i++) { g.fillStyle = `hsl(${i * 18},80%,50%)`; g.fillRect(0, 0, w, h); await new Promise(r => setTimeout(r, 70)); }
      rec.stop(); await new Promise(r => { rec.onstop = r; });
      const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer()); let s = ""; bytes.forEach(x => { s += String.fromCharCode(x); }); return btoa(s);
    }, [w, h]), "base64");
  }
  await page.close();
  return out;
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const videos = await makeVideos(browser);
  const failures = [];
  try {
    for (const owner of [true, false]) for (const width of widths) {
      const who = owner ? "owner" : "visitor", label = `${who} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${baseUrl}/__mirror/*`, route => {
        const name = new URL(route.request().url()).pathname.split("/").pop();
        if (name.endsWith(".webm")) return route.fulfill({ status: 200, contentType: "video/webm", body: videos[name.replace(".webm", "")] });
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
      // Familiar navigation: action row, top bar, tab row.
      const nav = await page.evaluate(() => {
        const visible = node => { if (!node) return false; const r = node.getBoundingClientRect(), cs = getComputedStyle(node); return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden"; };
        const row = [...document.querySelectorAll(".profile-actions:not(.profile-locked-friend) > *")].filter(visible);
        const label = node => (node.getAttribute("aria-label") || node.querySelector("[aria-label]")?.getAttribute("aria-label") || node.textContent).trim();
        const header = document.querySelector("header.profile-app-header");
        const tabs = [...document.querySelectorAll(".profile-tabs > button")].filter(visible);
        const tops = new Set(row.map(node => Math.round(node.getBoundingClientRect().top)));
        return {
          row: row.map(label), rowLines: tops.size, rowTargets: row.every(node => { const r = (node.matches(".profile-more-wrap") ? node.firstElementChild : node).getBoundingClientRect(); return r.width >= 43.5 && r.height >= 43.5; }),
          header: header ? [...header.children].filter(visible).map(node => node.className || node.tagName) : [], headerName: header?.querySelector(".profile-header-name")?.textContent.trim() || "",
          headerHeight: header?.getBoundingClientRect().height || 0,
          // Contrast of the top bar's name and icons against the bar (WCAG ratio).
          headerContrast: (() => {
            const parse = value => (value.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
            const lum = ([r, g, b]) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
            let bgNode = header, bg = "rgba(0, 0, 0, 0)";
            while (bgNode && /rgba\(0, 0, 0, 0\)|transparent/.test(bg = getComputedStyle(bgNode).backgroundColor)) bgNode = bgNode.parentElement;
            return [".profile-header-name", ".profile-back", ".profile-search-toggle"].map(selector => { const node = header?.querySelector(selector); if (!node) return 0; const a = lum(parse(getComputedStyle(node).color)), b = lum(parse(bg)); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); });
          })(),
          note: /Only this member can post|Only accepted friends can post/.test(document.body.innerText),
          tabs: tabs.map(button => { const r = button.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(button); const lines = new Set([...range.getClientRects()].filter(x => x.width > 1).map(x => Math.round(x.top))).size; return { text: button.textContent.trim(), lines, h: r.height, active: button.classList.contains("active") || button.getAttribute("aria-selected") === "true" }; }),
          tabTops: new Set(tabs.map(button => Math.round(button.getBoundingClientRect().top))).size
        };
      });
      if (owner) {
        if (nav.row.some(text => /friend|^Message/i.test(text))) failures.push(`${label}: owner sees Add friend / Message (${nav.row.join(" | ")})`);
      } else {
        if (nav.row.length !== 3 || !/friend/i.test(nav.row[0]) || !/^Message/.test(nav.row[1]) || !/^More$/.test(nav.row[2])) failures.push(`${label}: visitor row is not Add friend / Message / More (${nav.row.join(" | ")})`);
        if (nav.row.some(text => /Edit Profile|Open my shop|Invite People/.test(text))) failures.push(`${label}: visitor sees owner-only controls (${nav.row.join(" | ")})`);
      }
      if (nav.rowLines !== 1 || !nav.rowTargets) failures.push(`${label}: action row wraps or has small targets (${nav.rowLines} lines)`);
      if (nav.note) failures.push(`${label}: instructional "only … can post" copy is shown`);
      if (width <= 700) {
        const header = nav.header.join(" ");
        if (!/profile-back/.test(header) || !/profile-header-name/.test(header) || !/profile-search-toggle/.test(header)) failures.push(`${label}: top bar is not back / name / search (${header})`);
        if (/brand|pivot-header-button|profile-header-search/.test(header)) failures.push(`${label}: top bar still shows ${header}`);
        if (nav.headerName !== "Night Shift") failures.push(`${label}: top bar name "${nav.headerName}"`);
        if (nav.headerHeight > 60) failures.push(`${label}: top bar is not slim (${nav.headerHeight}px)`);
        if (nav.headerContrast.some(ratio => ratio < 4.5)) failures.push(`${label}: top bar name/icons are hard to see (contrast ${nav.headerContrast.map(r => r.toFixed(1)).join(", ")})`);
      }
      if (nav.tabTops !== 1 || nav.tabs.some(tab => tab.lines !== 1 || tab.h < 43.5) || nav.tabs.filter(tab => tab.active).length !== 1) failures.push(`${label}: tab row is not one tidy single-line row ${JSON.stringify(nav.tabs)}`);
      // Photos and videos like a familiar feed: full width, source aspect (portrait capped at 4:5), never stretched.
      // Videos load their size only when near the screen (data-friendly); bring each one near first.
      for (const handle of await page.locator(".profile-post-card video.profile-post-media").elementHandles()) { await handle.scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
      await page.waitForFunction(() => [...document.querySelectorAll(".profile-post-card video.profile-post-media")].every(v => v.readyState >= 1), null, { timeout: 8000 }).catch(() => {});
      const media = await page.evaluate(() => [...document.querySelectorAll(".profile-post-card .profile-post-media")].map(node => {
        const r = node.getBoundingClientRect(), cs = getComputedStyle(node), natural = node.tagName === "IMG" ? node.naturalWidth / node.naturalHeight : node.videoWidth / node.videoHeight;
        return { tag: node.tagName, src: (node.currentSrc || node.src).split("/").pop(), left: r.left, right: r.right, ratio: r.width / r.height, natural, fit: cs.objectFit, controls: node.controls === true };
      }));
      for (const item of media) {
        if (!item.natural || !Number.isFinite(item.natural)) { failures.push(`${label}: ${item.src} has no size yet`); continue; }
        if (Math.abs(item.left) > 0.5 || Math.abs(item.right - width) > 0.5) failures.push(`${label}: ${item.src} is not edge to edge (${Math.round(item.left)}-${Math.round(item.right)})`);
        const want = Math.max(0.8, item.natural);
        if (Math.abs(item.ratio - want) > 0.03) failures.push(`${label}: ${item.src} shown at ${item.ratio.toFixed(2)}, expected ${want.toFixed(2)} (source ${item.natural.toFixed(2)}: whole if 4:5 or wider, else cropped to 4:5)`);
        if (item.fit !== "cover" && Math.abs(item.ratio - item.natural) > 0.03) failures.push(`${label}: ${item.src} would stretch (object-fit ${item.fit})`);
        if (item.tag === "VIDEO" && item.controls) failures.push(`${label}: ${item.src} shows browser controls instead of the feed player`);
      }
      if (media.filter(item => item.tag === "VIDEO").length !== 2) failures.push(`${label}: expected 2 profile videos, saw ${media.filter(item => item.tag === "VIDEO").length}`);
      // Autoplay muted at 50% visible; one at a time; 44px mute toggle bottom-right.
      // Scroll twice: late-loading images above can shift the video after the first scroll.
      for (let i = 0; i < 2; i++) { await page.evaluate(() => { const v = document.querySelector(".profile-post-card video.profile-post-media"); if (v) { const r = v.getBoundingClientRect(); scrollBy(0, r.top - 80); } }); await page.waitForTimeout(300); }
      await page.waitForFunction(() => { const v = document.querySelector(".profile-post-card video.profile-post-media"); return [...document.querySelectorAll(".profile-post-card video.profile-post-media")].some(x => !x.paused); }, null, { timeout: 4000 }).catch(() => {});
      const play = await page.evaluate(() => {
        const vids = [...document.querySelectorAll(".profile-post-card video.profile-post-media")];
        const v = vids[0]; if (!v) return { playing: [], muted: true, toggle: null };
        const r = v.getBoundingClientRect(), shell = v.closest(".danzstak-media-shell"), toggle = shell?.querySelector(".danzstak-audio-toggle"), t = toggle?.getBoundingClientRect();
        const diag = vids.map(x => { const b = x.getBoundingClientRect(); const vis = Math.max(0, Math.min(b.bottom, innerHeight) - Math.max(b.top, 0)) / b.height; return { paused: x.paused, ended: x.ended, dur: String(x.duration), t: +x.currentTime.toFixed(2), loop: x.loop, ready: x.readyState, net: x.networkState, preload: x.preload, vis: +vis.toFixed(2), err: x.error?.code || 0, hidden: document.hidden, focus: document.hasFocus() }; });
        return { diag, playing: vids.map(x => !x.paused), muted: v.muted, toggle: t ? { dr: r.right - t.right, db: r.bottom - t.bottom, w: t.width, label: toggle.getAttribute("aria-label") } : null };
      });
      if (!play.playing.some(Boolean)) failures.push(`${label}: no visible profile video autoplays ${JSON.stringify(play.diag)}`); // when two fit on screen, either may be the one
      if (!play.muted) failures.push(`${label}: profile video autoplays with sound`);
      if (play.playing.filter(Boolean).length > 1) failures.push(`${label}: more than one profile video plays at once`);
      if (!play.toggle || play.toggle.dr < 0 || play.toggle.dr > 24 || play.toggle.db < 0 || play.toggle.db > 24 || play.toggle.w < 43.5 || !play.toggle.label) failures.push(`${label}: no 44px mute toggle bottom-right ${JSON.stringify(play.toggle)}`);
      if ([360, 390].includes(width)) await page.screenshot({ path: path.join(output, `${prefix}-${who}-video-${width}.png`) });
      // Tap a tall photo: the whole picture, full screen; Back closes it.
      const tallImage = page.locator(".profile-post-card img.profile-post-media[src*='tall.svg']").first();
      if (await tallImage.count()) {
        await tallImage.scrollIntoViewIfNeeded();
        await tallImage.click();
        await page.waitForTimeout(300);
        const whole = await page.evaluate(() => { const v = document.querySelector(".ds-media-viewer .ds-media-viewer-slide[aria-hidden=\"false\"] img"); if (!v) return null; const cs = getComputedStyle(v); return { fit: cs.objectFit, src: v.getAttribute("src") }; });
        if (!whole || whole.fit !== "contain" || !/tall\.svg/.test(whole.src || "")) failures.push(`${label}: tapping a photo does not open it whole and full screen ${JSON.stringify(whole)}`);
        else if ([360, 390].includes(width)) await page.screenshot({ path: path.join(output, `${prefix}-${who}-photo-${width}.png`) });
        if (whole) { await page.goBack(); await page.waitForTimeout(300); }
        if (await page.evaluate(() => Boolean(document.querySelector("dialog[open], .ds-media-viewer")))) failures.push(`${label}: Back does not close the photo`);
      }
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(200);
      if ([360, 390].includes(width)) {
        await page.screenshot({ path: path.join(output, `${prefix}-${who}-top-${width}.png`) });
        if (!owner) {
          await page.locator(".profile-more").click();
          await page.waitForTimeout(150);
          const menuOpen = await page.evaluate(() => { const m = document.querySelector(".profile-more-menu"); return m && !m.hidden ? m.textContent.trim() : ""; });
          if (menuOpen !== "Share profile") failures.push(`${label}: More menu does not offer Share profile ("${menuOpen}")`);
          await page.screenshot({ path: path.join(output, `${prefix}-${who}-more-${width}.png`) });
          await page.keyboard.press("Escape");
        }
        await page.locator(".profile-search-toggle").click();
        await page.waitForTimeout(150);
        const searching = await page.evaluate(() => { const i = document.getElementById("profileHeaderSearch"); const r = i.getBoundingClientRect(); return { focused: document.activeElement === i, w: r.width }; });
        if (!searching.focused || searching.w < 150) failures.push(`${label}: search toggle does not open a usable search field ${JSON.stringify(searching)}`);
        await page.screenshot({ path: path.join(output, `${prefix}-${who}-search-${width}.png`) });
        await page.locator("#profileHeaderSearch").press("Escape");
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
  console.log(`Profile mirror checks passed at ${widths.join(", ")}px (owner and visitor): no big text buttons, back / name / search top bar, Add friend / Message / More row, tidy tabs, one edge-to-edge wall, Dailies strip directly above the posts with a full-screen viewer and Back.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
