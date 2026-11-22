"use strict";
// T2a (owner 2026-11-18, fix-it 18): tapping any profile picture opens that member's profile — post authors (Mix and
// profile walls), comments, online friends, notifications, search, SYNC chat list and thread header, Tribe members.
// Real browser at 320, 360, 390, 414, 430 and 1280px: every visible avatar is a real link to the right profile, with a
// 44px tap area where it is small; the SYNC chat-list photo opens the profile while the rest of the row opens the chat.
// Deliberate exceptions (asserted by name so nothing else slips through): Dailies tiles (T2b / 5a7), your own photo in
// a comment box, the SYNC contact strip (chat shortcuts) and the big photo of the profile you are already on.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/profile-picture-links.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/profile-picture-links");
const me = "11111111-1111-4111-8111-111111111111", friend = "22222222-2222-4222-8222-222222222222", commenter = "55555555-5555-4555-8555-555555555555";
const pic = `${baseUrl}/assets/danzstak-share-fb-v2.jpg`;
const EXCEPTIONS = /\b(story-create|story-open|profile-comment-viewer-avatar|composer-avatar|comment-composer-avatar|chat-contact-avatar(-wrap)?|conversation-list-avatar|conversation-avatar-wrap)\b/;

function fixture(url) {
  const p = url.pathname;
  if (p === "/auth/session") return { authenticated: true, user: { sub: me, email: "me@danzstak.invalid" } };
  if (p === "/profiles") {
    const asked = url.searchParams.get("memberId") || url.searchParams.get("member");
    return asked && asked !== me ? { profile: { memberId: friend, name: "Tour Friend", username: "tourfriend", handle: "tourfriend", cloudProfile: true, picture: pic, isOwner: false, friendStatus: "friends" } } : { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", cloudProfile: true, picture: pic, isOwner: true } };
  }
  if (p === "/secure-posts") return { posts: [
    { postId: "33333333-3333-4333-8333-333333333333", userId: friend, authorMemberId: friend, authorName: "Tour Friend", authorPicture: pic, content: "Load-in at 6", createdAt: "2026-11-18T20:00:00.000Z", audience: "public", isOwner: false, commentPolicy: "everyone" },
    { postId: "33333333-3333-4333-8333-333333333334", userId: me, authorMemberId: me, authorName: "Night Shift", authorPicture: pic, content: "Soundcheck done", createdAt: "2026-11-18T19:00:00.000Z", audience: "public", isOwner: true, commentPolicy: "everyone", mediaType: "image", mediaUrl: `${baseUrl}/assets/danzstak-share-fb-v2.jpg?posted` }] };
  if (p === "/engagement") return { reactionCounts: { Like: 1 }, comments: [{ commentId: "44444444-4444-4444-8444-444444444444", authorMemberId: commenter, authorName: "Comment Person", authorPicture: pic, content: "See you there", createdAt: "2026-11-18T20:05:00.000Z", reactionCounts: {} }] };
  if (p === "/stories") return { stories: [{ storyId: "s1", memberId: friend, displayName: "Tour Friend", picture: pic, mediaType: "image", mediaUrl: pic, createdAt: new Date().toISOString(), audience: "friends" }], reels: [] };
  if (p === "/friends") return { friends: [{ email: "friend@danzstak.invalid", memberId: friend, name: "Tour Friend", picture: pic, online: true }] };
  if (p === "/calls/directory" || p === "/people") return { users: [{ email: "friend@danzstak.invalid", memberId: friend, name: "Tour Friend", picture: pic, online: true, friendStatus: "friends", username: "tourfriend" }] };
  if (p === "/conversations") return { conversations: [{ contactEmail: "friend@danzstak.invalid", memberId: friend, name: "Tour Friend", picture: pic, preview: "Soundcheck at 6", updatedAt: new Date().toISOString(), canContact: true, hasConversation: true }] };
  if (p === "/messages") return { messages: [], canContact: true };
  if (p === "/settings/posts") return { hiddenPostIds: [] };
  return {};
}

// In the page: every visible avatar is a profile link (or one of the named exceptions); small ones have a 44px hit area.
function audit(exceptionSource) {
  const exceptions = new RegExp(exceptionSource);
  const found = [];
  for (const el of document.querySelectorAll('[class*="avatar"]')) {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    if (!r.width || !r.height || r.width > 140 || r.width < 14 || cs.visibility === "hidden" || cs.display === "none" || el.closest("[hidden]")) continue;
    const link = el.closest("a[href]"), href = link?.getAttribute("href") || "";
    // #profileInitial is the big photo at the top of the profile you are already on.
    const exception = el.id === "profileInitial" || exceptions.test(String(el.className)) || exceptions.test(String(el.parentElement?.className || ""));
    let hit44 = null, missed = "";
    if (link && r.width < 44) {
      el.scrollIntoView({ block: "center", inline: "nearest" }); // probe it where a thumb can reach it, not under the bottom bar
      // The tap target is the link: when the photo sits inside a bigger link, measure around the link.
      const own = el.getBoundingClientRect(), box = link.getBoundingClientRect(), c = box.width >= own.width && box.height >= own.height ? box : own;
      const cx = c.left + c.width / 2, cy = c.top + c.height / 2, reach = Math.max(0, (44 - c.width) / 2 - 0.5);
      const probes = c.width >= 44 && c.height >= 44 ? [] : [[cx - c.width / 2 - reach, cy], [cx + c.width / 2 + reach, cy], [cx, cy - c.height / 2 - reach], [cx, cy + c.height / 2 + reach]]
        .filter(([x, y]) => x >= 0 && y >= 0 && x < innerWidth && y < innerHeight);
      const outside = probes.map(([x, y]) => document.elementFromPoint(x, y)).filter(hit => !link.contains(hit));
      hit44 = outside.length === 0;
      missed = outside.map(hit => hit ? `${hit.tagName}.${String(hit.className).split(" ")[0]}` : "nothing").join(",");
    }
    found.push({ cls: String(el.className).split(" ")[0], href, linked: /profile\.html/.test(href), exception, hit44, missed, size: Math.round(r.width) });
  }
  return found;
}

async function open(browser, width, url) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: true, serviceWorkers: "block", deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
  await page.goto(baseUrl + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  return { context, page };
}
function judge(label, rows) {
  assert.ok(rows.length > 0, `${label}: avatars rendered`);
  const missing = rows.filter(row => !row.linked && !row.exception);
  assert.deepEqual(missing, [], `${label}: every profile picture opens a profile`);
  const small = rows.filter(row => row.linked && row.hit44 === false);
  assert.deepEqual(small, [], `${label}: small profile pictures still have a 44px tap area`);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 414, 430, 1280]) {
      const label = `${width}px`, shots = width === 360 || width === 390;
      // Mix: post authors, comments (and online friends on computers).
      let { context, page } = await open(browser, width, "/feed.html?view=feed");
      if (width === 1280) await page.locator(".feed-online-avatar-wrap").first().waitFor({ timeout: 10000 }); // the online list loads on its own timer
      const mix = await page.evaluate(audit, EXCEPTIONS.source);
      judge(`${label} Mix`, mix);
      assert.ok(mix.some(row => row.href === `profile.html?member=${friend}`), `${label} Mix: the friend's post photo opens their profile`);
      assert.ok(mix.some(row => row.href === `profile.html?member=${commenter}`), `${label} Mix: a comment photo opens the commenter's profile`);
      if (width === 1280) assert.ok(mix.some(row => row.cls === "feed-online-avatar-wrap" && row.linked), `${label} Mix: an online friend's photo opens their profile`);
      await context.close();

      // A profile wall: the post author's photo and name open their profile.
      ({ context, page } = await open(browser, width, `/profile.html?member=${friend}`));
      await page.locator(".profile-post-avatar-link").first().waitFor({ timeout: 8000 });
      judge(`${label} profile`, await page.evaluate(audit, EXCEPTIONS.source));
      const wall = await page.evaluate(() => ({ avatar: document.querySelector(".profile-post-avatar-link")?.getAttribute("href"), name: document.querySelector(".profile-post-author-link")?.getAttribute("href"), label: document.querySelector(".profile-post-author-link")?.getAttribute("aria-label") }));
      assert.deepEqual(wall, { avatar: `profile.html?member=${friend}`, name: `profile.html?member=${friend}`, label: "Open Tour Friend profile" }, `${label} profile: post author links`);
      if (shots) { await page.locator(".profile-post-card").first().scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `profile-wall-${width}.png`) }); }
      await context.close();

      // Owner 2026-11-19: on your OWN profile the big picture is not a link — tapping it changes it (this phone or your
      // DanzStak photos), and your other pictures on the page follow. On someone else's profile it does nothing.
      ({ context, page } = await open(browser, width, "/profile.html"));
      const newPic = `${baseUrl}/assets/favicon-192.png?new`;
      let uploaded = false;
      await page.route(`${baseUrl}/__upload`, route => { uploaded = route.request().method() === "PUT"; route.fulfill({ status: 200, body: "" }); });
      await page.route("https://api.danzstak.com/stories", route => route.request().method() === "POST" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ uploadUrl: `${baseUrl}/__upload`, mediaKey: "profile/new.jpg" }) }) : route.fallback());
      await page.route("https://api.danzstak.com/profiles", route => route.request().method() === "POST" ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", cloudProfile: true, picture: newPic, isOwner: true } }) }) : route.fallback());
      await page.locator("#profileInitial.profile-avatar-editable").waitFor({ timeout: 8000 });
      await page.locator("img.profile-create-avatar").waitFor({ timeout: 5000 });
      assert.equal(await page.getAttribute("img.profile-create-avatar", "src"), pic, `${label} own profile: the post box shows your profile picture, not your initial`);
      assert.equal(await page.getAttribute("#profileInitial", "role"), "button", `${label} own profile: the picture is a button`);
      assert.equal(await page.getAttribute("#profileInitial", "aria-label"), "Change profile picture");
      await page.locator("#profileInitial").click();
      await page.locator(".profile-photo-sheet[open]").waitFor({ timeout: 3000 });
      const sheet = await page.evaluate(() => { const d = document.querySelector(".profile-photo-sheet"), r = d.getBoundingClientRect(); return { title: d.querySelector("h2").textContent, choices: [...d.querySelectorAll(".profile-photo-choices button")].filter(b => !b.hidden).map(b => b.textContent), fits: r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, tall: [...d.querySelectorAll("button")].filter(b => !b.hidden && b.offsetParent).every(b => b.getBoundingClientRect().height >= 44) }; });
      assert.deepEqual(sheet.choices, ["Choose from this phone", "Choose from your DanzStak photos", "Move to fit", "Past profile pictures", "Remove profile picture"], `${label} own profile: the change-picture choices (F4c adds Past profile pictures, F12 Move to fit)`);
      assert.ok(sheet.title === "Change profile picture" && sheet.fits && sheet.tall, `${label} own profile: the sheet fits with 44px buttons`);
      if (shots) await page.screenshot({ path: path.join(output, `own-picture-sheet-${width}.png`) });
      // From this phone: the existing photo flow (rights check, then the phone's picker).
      await page.locator('.profile-photo-sheet [data-choice="phone"]').click();
      await page.waitForFunction(() => [...document.querySelectorAll("dialog[open]")].some(d => /created this image/.test(d.textContent)), null, { timeout: 3000 });
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
      // From your DanzStak photos: only your own posted photos; picking one uploads it and every picture of you follows.
      await page.locator("#profileInitial").click();
      await page.locator('.profile-photo-sheet [data-choice="danzstak"]').click();
      await page.locator(".profile-photo-tile").first().waitFor({ timeout: 5000 });
      assert.equal(await page.locator(".profile-photo-tile").count(), 1, `${label} own profile: only photos you posted are offered`);
      if (shots) await page.screenshot({ path: path.join(output, `own-picture-danzstak-photos-${width}.png`) });
      const oldAvatars = await page.evaluate(src => [...document.querySelectorAll("img")].filter(i => i.getAttribute("src") === src && !i.closest(".profile-photo-sheet")).length, pic);
      await page.locator(".profile-photo-tile").first().click();
      // F12: the photo opens in the round Move-to-fit sheet first; Save uploads the crop.
      await page.locator(".ds-fit-sheet[open] .ds-fit-box.is-round").waitFor({ timeout: 8000 });
      await page.locator(".ds-fit-sheet[open] .ds-fit-save").click();
      await page.waitForFunction(() => !document.querySelector(".profile-photo-sheet")?.open, null, { timeout: 8000 });
      assert.equal(uploaded, true, `${label} own profile: the DanzStak photo was uploaded as the new picture`);
      const after = await page.evaluate(([src, fresh]) => ({ header: getComputedStyle(document.getElementById("profileInitial")).backgroundImage.includes("favicon-192.png"), stale: [...document.querySelectorAll("img")].filter(i => i.getAttribute("src") === src && !i.closest(".profile-photo-sheet")).length, fresh: [...document.querySelectorAll("img")].filter(i => i.getAttribute("src") === fresh).length }), [pic, newPic]);
      assert.ok(after.header, `${label} own profile: the header shows the new picture`);
      assert.ok(oldAvatars === 0 || (after.stale === 0 && after.fresh >= oldAvatars), `${label} own profile: your other pictures on the page follow (${JSON.stringify({ oldAvatars, ...after })})`);
      await context.close();
      ({ context, page } = await open(browser, width, `/profile.html?member=${friend}`));
      await page.locator(".profile-post-avatar-link").first().waitFor({ timeout: 8000 });
      assert.equal(await page.evaluate(() => document.getElementById("profileInitial").classList.contains("profile-avatar-editable")), false, `${label}: someone else's picture is not editable`);
      await page.locator("#profileInitial").click({ force: true });
      await page.waitForTimeout(300);
      assert.equal(await page.isVisible(".profile-photo-sheet[open]"), false, `${label}: tapping someone else's picture does not open the change sheet`);
      await context.close();

      // SYNC: the chat-list photo opens the profile; the rest of the row still opens the chat; the header photo is a link.
      ({ context, page } = await open(browser, width, "/messages.html"));
      await page.locator(".conversation-row .conversation-user").first().waitFor({ timeout: 8000 });
      judge(`${label} SYNC list`, await page.evaluate(audit, EXCEPTIONS.source));
      await page.locator(".conversation-row .conversation-copy strong").first().click();
      await page.waitForFunction(() => document.body.classList.contains("is-conversation-open"), null, { timeout: 5000 });
      assert.match(page.url(), /messages\.html/, `${label} SYNC: tapping the name opens the chat`);
      assert.equal(await page.getAttribute("#conversationAvatar", "href"), `profile.html?member=${friend}`, `${label} SYNC: the thread header photo opens the profile`);
      if (shots) await page.screenshot({ path: path.join(output, `sync-thread-${width}.png`) });
      await page.goto(baseUrl + "/messages.html", { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-row .conversation-avatar-wrap").first().waitFor({ timeout: 8000 });
      if (shots) await page.screenshot({ path: path.join(output, `sync-list-${width}.png`) });
      await Promise.all([page.waitForURL(/profile\.html\?member=/, { timeout: 8000 }), page.locator(".conversation-row .conversation-avatar-wrap").first().click()]);
      assert.ok(new URL(page.url()).searchParams.get("member") === friend && new URL(page.url()).pathname.endsWith("/profile.html"), `${label} SYNC: tapping the chat-list photo opens the profile (${page.url()})`);
      assert.deepEqual(page.errors.filter(e => !/Failed to fetch|NetworkError/.test(e)), [], `${label}: no page errors`);
      await context.close();
    }
  } finally { await browser.close(); }
  console.log("Profile picture checks passed at 320, 360, 390, 414, 430 and 1280px: Mix post and comment photos, online friends, profile-wall authors (photo and name), SYNC chat-list photo and thread header all open the member's profile with 44px tap areas; the rest of a SYNC row still opens the chat; your own profile picture opens Change profile picture (this phone or your DanzStak photos) and your other pictures follow.");
})().catch(error => { console.error(error); process.exitCode = 1; });
