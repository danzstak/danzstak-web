"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright-core");

const baseUrl = process.env.DANZSTAK_VISUAL_BASE_URL || "http://127.0.0.1:8013";
const outputDir = path.resolve(process.env.DANZSTAK_VISUAL_OUTPUT || "docs/screenshots/mobile-ui");
const edgePath = process.env.DANZSTAK_EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1366];
const benchmarkWidths = [320, 360, 390, 414];
const desktopProfileWidths = [768, 1024, 1366];
fs.mkdirSync(outputDir, { recursive: true });

const fixturePost = {
  postId: "33333333-3333-4333-8333-333333333333",
  content: "Mobile-first DanzStak navigation and reaction alignment verification.",
  authorName: "DanzStak Test Artist",
  authorPicture: "",
  userId: "11111111-1111-4111-8111-111111111111",
  createdAt: "2026-11-04T12:00:00.000Z",
  audience: "public",
  commentPolicy: "everyone",
  isOwner: true,
  reactions: { Like: 1, Dislike: 1 },
  commentCount: 2,
  shareCount: 3
};

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function installApiFixtures(page) {
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    if (pathname === "/auth/session") return json(route, { authenticated: true, email: "mobile-test@danzstak.invalid", name: "DanzStak Test Artist", memberId: "11111111-1111-4111-8111-111111111111" });
    if (pathname === "/posts" || pathname === "/secure-posts") return json(route, { posts: [fixturePost] });
    if (pathname === "/engagement") return json(route, { myReaction: "", reactionCounts: { Like: 1, Dislike: 1 }, comments: [
      { commentId: "44444444-4444-4444-8444-444444444441", content: "Compact comments work.", authorName: "Mobile Friend", createdAt: "2026-11-04T12:12:00.000Z", reactionCounts: {} },
      { commentId: "44444444-4444-4444-8444-444444444442", content: "Reply actions stay aligned.", authorName: "DanzStak Test Artist", createdAt: "2026-11-04T12:13:00.000Z", reactionCounts: {} }
    ] });
    if (pathname === "/friends") return json(route, { friends: [{ email: "friend@danzstak.invalid", name: "Mobile Friend", memberId: "22222222-2222-4222-8222-222222222222", online: true, friendStatus: "friends" }] });
    if (pathname === "/calls/directory") return json(route, { users: [{ email: "friend@danzstak.invalid", name: "Mobile Friend", memberId: "22222222-2222-4222-8222-222222222222", online: true, friendStatus: "friends", canContact: true }] });
    if (pathname === "/notifications") return json(route, { notifications: [{ id: "notice-1", type: "friend_request", message: "Mobile Friend sent a request.", createdAt: "2026-11-04T12:10:00.000Z", read: false, actorName: "Mobile Friend" }] });
    if (pathname === "/engagement-notifications") return json(route, { notifications: [] });
    if (pathname === "/messages/conversations") return json(route, { conversations: [{ contactEmail: "friend@danzstak.invalid", name: "Mobile Friend", memberId: "22222222-2222-4222-8222-222222222222", preview: "See you at the show.", unread: 2, online: true, canContact: true, updatedAt: "2026-11-04T12:20:00.000Z" }] });
    if (pathname === "/messages") return json(route, { messages: [{ messageId: "message-1", senderEmail: "friend@danzstak.invalid", content: "See you at the show.", createdAt: "2026-11-04T12:20:00.000Z" }] });
    if (pathname === "/settings/posts") return json(route, { pinned: [], saved: [], muted: [] });
    if (pathname === "/settings/presence") return json(route, { onlineVisible: true, allowTags: true, callAlerts: true, messageAlerts: true, reduceMotion: false, dataSaver: false, language: "en" });
    if (pathname === "/profile" || pathname === "/profiles") return json(route, { profile: { name: "DanzStak Test Artist", username: "testartist", memberId: "11111111-1111-4111-8111-111111111111", isOwner: true, location: "Berlin, Germany", bio: "Independent artist testing DanzStak on mobile." } });
    if (pathname === "/stories") return json(route, { stories: [] });
    return json(route, {});
  });
}

async function assertNoOverflow(page, label, enforceMobileHeader = false) {
  const metrics = await page.evaluate(() => ({
    bodyWidth: document.body.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    headerHeight: document.querySelector(".topbar, .chat-header")?.getBoundingClientRect().height || 0
  }));
  assert.ok(metrics.bodyWidth <= metrics.viewportWidth + 1, `${label}: horizontal overflow ${metrics.bodyWidth} > ${metrics.viewportWidth}`);
  if (enforceMobileHeader) assert.ok(metrics.headerHeight <= 64, `${label}: mobile header is too tall (${metrics.headerHeight}px)`);
}

async function assertExclusiveFeedScreen(page, expected) {
  const state = await page.evaluate(() => ({
    primary: document.body.dataset.mobileScreen || "",
    menu: document.body.classList.contains("mobile-menu-open"),
    messageDrawer: Boolean(document.querySelector("#messageDrawer:not([hidden])")),
    notificationDrawer: Boolean(document.querySelector("#notificationDrawer:not([hidden])")),
    feedVisible: !document.getElementById("newsFeedView")?.hidden,
    featureVisible: !document.getElementById("featureView")?.hidden
  }));
  assert.equal(state.primary, expected);
  assert.equal(state.messageDrawer, false, `${expected}: Chat drawer must not overlap`);
  assert.equal(state.notificationDrawer, false, `${expected}: Notifications drawer must not overlap`);
  if (["friends", "notifications"].includes(expected)) {
    assert.equal(state.feedVisible, false, `${expected}: underlying feed must be hidden`);
    assert.equal(state.featureVisible, true, `${expected}: dedicated workspace must be visible`);
  }
  return state;
}

async function captureViewport(page, fileName) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.screenshot({ path: path.join(outputDir, fileName), fullPage: false, animations: "disabled", timeout: 120000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(250);
    }
  }
  throw lastError;
}

(async () => {
  assert.ok(fs.existsSync(edgePath), `Microsoft Edge not found at ${edgePath}`);
  const browser = await chromium.launch({ executablePath: edgePath, headless: true, args: ["--disable-gpu"] });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width <= 430 ? 860 : 900 }, deviceScaleFactor: 1, serviceWorkers: "block" });
      const page = await context.newPage();
      await installApiFixtures(page);
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.addStyleTag({ content: ".push-alert-prompt{display:none!important}" });
      await page.waitForSelector("#feed article.post");
      if (width <= 430) {
        await page.locator("#feed article.post").evaluate(post => {
          if (post.querySelector("video.post-media")) return;
          const video = document.createElement("video");
          video.className = "post-media";
          video.controls = true;
          video.playsInline = true;
          video.poster = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g"><stop stop-color="#1769e0"/><stop offset="1" stop-color="#ef6c20"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><text x="800" y="470" text-anchor="middle" fill="white" font-family="Arial" font-size="90" font-weight="700">DANZSTAK VIDEO</text></svg>');
          post.querySelector(".post-actions")?.before(video);
        });
        await page.waitForSelector("#feed article.post video.ds-responsive-media");
        const mediaGeometry = await page.locator("#feed article.post").evaluate(post => {
          const media = post.querySelector("video.ds-responsive-media");
          const postBox = post.getBoundingClientRect();
          const mediaBox = media.getBoundingClientRect();
          return { left: Math.abs(mediaBox.left - postBox.left), right: Math.abs(mediaBox.right - postBox.right), width: mediaBox.width, postWidth: postBox.width };
        });
        assert.ok(mediaGeometry.left <= 1.5 && mediaGeometry.right <= 1.5, `${width}px: video edges must align with the post grid: ${JSON.stringify(mediaGeometry)}`);
        assert.ok(Math.abs(mediaGeometry.width - mediaGeometry.postWidth) <= 3, `${width}px: video must fill the post width`);
      }
      await assertNoOverflow(page, `Home ${width}px`, width <= 430);
      if (width <= 430) {
        await assertExclusiveFeedScreen(page, "home");
        const shellMetrics = await page.evaluate(() => {
          const header = document.querySelector(".topbar").getBoundingClientRect();
          const nav = document.querySelector(".topbar .topnav").getBoundingClientRect();
          const post = document.querySelector("#feed article.post");
          const postStyle = getComputedStyle(post);
          return { headerHeight: header.height, navHeight: nav.height, postPadding: parseFloat(postStyle.paddingLeft) };
        });
        assert.ok(shellMetrics.headerHeight <= 52, `${width}px: mobile header is oversized: ${JSON.stringify(shellMetrics)}`);
        assert.ok(shellMetrics.navHeight <= 52, `${width}px: mobile navigation is oversized: ${JSON.stringify(shellMetrics)}`);
        assert.ok(shellMetrics.postPadding <= 10, `${width}px: feed cards waste horizontal space: ${JSON.stringify(shellMetrics)}`);
        const reactionMetrics = await page.locator("#feed article.post .post-actions button").evaluateAll(buttons => buttons.map(button => {
          const icon = button.querySelector(".reaction-icon,.action-icon,svg");
          const count = button.querySelector(".reaction-count,.action-count,[data-count]");
          const buttonBox = button.getBoundingClientRect();
          const iconBox = icon?.getBoundingClientRect();
          const countBox = count?.getBoundingClientRect();
          return { buttonTop: buttonBox.top, iconTop: iconBox?.top || 0, iconRight: iconBox?.right || 0, countTop: countBox?.top || 0, countLeft: countBox?.left || 0 };
        }));
        for (const metric of reactionMetrics.filter(item => item.countLeft)) {
          const iconGap = metric.countLeft - metric.iconRight;
          assert.ok(iconGap >= 3 && iconGap <= 7, `${width}px: reaction icon/count gap must be 4–6px: ${JSON.stringify(metric)}`);
          assert.ok(Math.abs(metric.countTop - metric.iconTop) <= 5, `${width}px: reaction count baseline drift`);
        }
        assert.ok(reactionMetrics.filter(item => item.countLeft).length >= 4, `${width}px: Like, Dislike, Comment, and Share require measurable inline counts: ${JSON.stringify(reactionMetrics)}`);
      }
      await captureViewport(page, `home-${width}.png`);
      if (width === 390) {
        await page.locator("#feed article.post video.ds-responsive-media").scrollIntoViewIfNeeded();
        await captureViewport(page, "video-390.png");
        await page.locator("#feed article.post .post-actions").scrollIntoViewIfNeeded();
        await captureViewport(page, "reactions-390.png");
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        await page.locator('.topnav [data-feature="Friends"]').click();
        await page.waitForTimeout(100);
        await assertExclusiveFeedScreen(page, "friends");
        await captureViewport(page, "friends-390.png");

        await page.locator('.topnav [data-feature="Notifications"]').click();
        await page.waitForTimeout(100);
        await assertExclusiveFeedScreen(page, "notifications");
        await captureViewport(page, "notifications-390.png");

        await page.locator(".mobile-menu-control").click();
        await page.waitForTimeout(50);
        const menuState = await assertExclusiveFeedScreen(page, "menu");
        assert.equal(menuState.menu, true, "Menu must be the only active drawer");
        await captureViewport(page, "menu-390.png");

        await page.locator("[data-menu-close]").click();
        await page.locator("#messagesNav").click();
        await page.waitForURL(/messages\.html/);
        await page.waitForSelector(".chat-sidebar");
        await assertNoOverflow(page, "Chat list 390px", true);
        assert.equal(await page.locator("#messageDrawer").count(), 0, "mobile Chat must not use a feed popup");
        await captureViewport(page, "chat-list-390.png");

        await page.evaluate(() => openConversation({ contactEmail: "friend@danzstak.invalid", name: "Mobile Friend", memberId: "22222222-2222-4222-8222-222222222222", online: true, canContact: true }));
        await page.waitForSelector("body.is-conversation-open");
        assert.equal(await page.locator(".chat-sidebar").isVisible(), false, "conversation must hide Chat list");
        await captureViewport(page, "chat-conversation-390.png");
        await page.goBack();
        assert.equal(await page.locator("body.is-conversation-open").count(), 0, "Back must return to Chat list");
        await page.goBack();
        await page.waitForURL(/feed\.html/);
      }
      await context.close();
    }
    for (const width of benchmarkWidths) {
      const context = await browser.newContext({ viewport: { width, height: 860 }, deviceScaleFactor: 1, serviceWorkers: "block" });
      const page = await context.newPage();
      await installApiFixtures(page);
      await page.goto(`${baseUrl}/booking.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#bookingMain");
      await assertNoOverflow(page, `Booking Agent ${width}px`, true);
      const bookingHeader = await page.locator("body.ds-tool-page>header").evaluate(header => ({ height: header.getBoundingClientRect().height, navVisible: getComputedStyle(header.querySelector("nav")).display !== "none" }));
      assert.ok(bookingHeader.height <= 60, `${width}px: professional-tool header is oversized: ${JSON.stringify(bookingHeader)}`);
      assert.equal(bookingHeader.navVisible, false, `${width}px: desktop tool links must not duplicate mobile navigation`);
      await captureViewport(page, `booking-${width}.png`);
      await page.evaluate(() => { document.querySelectorAll("details").forEach(details => { details.open = true; }); document.querySelector(".summary")?.scrollIntoView(); });
      await page.waitForTimeout(100);
      await captureViewport(page, `tour-manager-${width}.png`);

      await page.goto(`${baseUrl}/epk.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#epkMain");
      await assertNoOverflow(page, `EPK ${width}px`, true);
      await captureViewport(page, `epk-${width}.png`);

      await page.goto(`${baseUrl}/record-stores.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#recordStoreMain");
      await assertNoOverflow(page, `Record Stores ${width}px`, true);
      assert.equal(await page.locator(".ds-mobile-nav").isVisible(), true, `${width}px: Record Stores must share mobile navigation`);
      await captureViewport(page, `record-stores-${width}.png`);

      await page.goto(`${baseUrl}/profile.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#profileContent:not([hidden])");
      await assertNoOverflow(page, `Profile ${width}px`, true);
      const profileHeader = await page.locator("body.profile-page>header").evaluate(header => {
        const headerBox = header.getBoundingClientRect();
        const actions = [...header.querySelectorAll(".header-actions .button")].map(item => {
          const box = item.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        });
        return { height: headerBox.height, left: headerBox.left, right: headerBox.right, actions };
      });
      assert.ok(profileHeader.height <= 64, `${width}px: Profile header is oversized: ${JSON.stringify(profileHeader)}`);
      assert.equal(await page.locator("body.profile-page>header .header-actions").isVisible(), false, `${width}px: Profile must not retain desktop text navigation on mobile`);
      assert.equal(await page.locator("body.profile-page>.ds-mobile-nav").isVisible(), true, `${width}px: Profile must share primary mobile navigation`);
      for (let index = 1; index < profileHeader.actions.length; index += 1) {
        assert.ok(profileHeader.actions[index - 1].right <= profileHeader.actions[index].left + 1, `${width}px: Profile header actions overlap: ${JSON.stringify(profileHeader)}`);
      }
      await captureViewport(page, `profile-${width}.png`);

      await page.goto(`${baseUrl}/feed.html?view=feed#settings`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".settings-workspace .settings-row");
      await assertNoOverflow(page, `Settings ${width}px`, true);
      const settingsGeometry = await page.locator(".settings-workspace .settings-row").evaluateAll(rows => rows.map(row => {
        const rowBox = row.getBoundingClientRect();
        const children = [...row.children].map(child => child.getBoundingClientRect()).filter(box => box.width && box.height);
        return { rowRight: rowBox.right, childRight: Math.max(0, ...children.map(box => box.right)), height: rowBox.height };
      }));
      assert.ok(settingsGeometry.every(item => item.childRight <= item.rowRight + 1), `${width}px: Settings control overflows its row: ${JSON.stringify(settingsGeometry)}`);
      await captureViewport(page, `settings-${width}.png`);

      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".chat-sidebar");
      await assertNoOverflow(page, `Chat ${width}px`, true);
      assert.equal(await page.locator(".conversation-call-actions").first().isVisible().catch(() => false), false, `${width}px: conversation list must not waste width on per-row call controls`);
      assert.equal(await page.locator(".chat-header [data-logout]").isVisible(), false, `${width}px: mobile Chat must not duplicate account actions`);
      await captureViewport(page, `chat-list-${width}.png`);
      await page.evaluate(() => openConversation({ contactEmail: "friend@danzstak.invalid", name: "Mobile Friend", memberId: "22222222-2222-4222-8222-222222222222", online: true, canContact: true }));
      await page.waitForSelector("body.is-conversation-open");
      const chatGeometry = await page.evaluate(() => {
        const header = document.querySelector(".conversation-header").getBoundingClientRect();
        const actions = document.querySelector(".conversation-header-actions").getBoundingClientRect();
        const name = document.querySelector("#conversationName").getBoundingClientRect();
        const form = document.querySelector(".message-form").getBoundingClientRect();
        return { headerRight: header.right, actionsRight: actions.right, nameRight: name.right, actionsLeft: actions.left, formBottom: form.bottom, viewportHeight: innerHeight };
      });
      assert.ok(chatGeometry.actionsRight <= chatGeometry.headerRight + 1, `${width}px: Chat header controls overflow`);
      assert.ok(chatGeometry.nameRight <= chatGeometry.actionsLeft + 1, `${width}px: Chat name overlaps header controls`);
      assert.ok(chatGeometry.formBottom <= chatGeometry.viewportHeight + 1, `${width}px: Chat composer falls below viewport`);
      await captureViewport(page, `chat-conversation-${width}.png`);
      await context.close();
    }
    for (const width of desktopProfileWidths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1, serviceWorkers: "block" });
      const page = await context.newPage();
      await installApiFixtures(page);
      await page.goto(`${baseUrl}/profile.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#profileContent:not([hidden])");
      await assertNoOverflow(page, `Desktop Profile ${width}px`);
      assert.equal(await page.locator("body.profile-page>header .header-actions").isVisible(), true, `${width}px: desktop Profile account navigation must remain available`);
      assert.equal(await page.locator("body.profile-page>.ds-mobile-nav").isVisible(), false, `${width}px: mobile navigation must not duplicate desktop Profile navigation`);
      await captureViewport(page, `profile-${width}.png`);

      await page.goto(`${baseUrl}/feed.html?view=feed#settings`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".settings-workspace .settings-row");
      await assertNoOverflow(page, `Desktop Settings ${width}px`);
      await captureViewport(page, `settings-${width}.png`);
      await context.close();
    }
    console.log(`Mobile visual checks passed at ${widths.join(", ")}px; screenshots: ${outputDir}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
