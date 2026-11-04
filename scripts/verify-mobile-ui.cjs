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
const menuWidths = new Set([320, 360, 390, 414]);
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
const fixtureStoryImage = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#1769e0"/><stop offset="1" stop-color="#ef6c20"/></linearGradient></defs><rect width="720" height="1280" fill="url(#g)"/><text x="360" y="620" text-anchor="middle" fill="white" font-family="Arial" font-size="72" font-weight="700">DANZSTAK</text><text x="360" y="710" text-anchor="middle" fill="white" font-family="Arial" font-size="46">FLASH</text></svg>');
const fixtureStory = {
  storyId: "55555555-5555-4555-8555-555555555555",
  content: "Tonight at the show",
  displayName: "DanzStak Test Artist",
  memberId: "11111111-1111-4111-8111-111111111111",
  mediaType: "image",
  mediaUrl: fixtureStoryImage,
  isOwner: true
};
const fixtureReel = {
  id: "66666666-6666-4666-8666-666666666666",
  url: "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com/visual-fixture.mp4",
  authorName: "DanzStak Test Artist",
  memberId: "11111111-1111-4111-8111-111111111111",
  content: "DanzStak Roll layout verification",
  sharedAt: "2026-11-04T12:30:00.000Z",
  isOwner: true
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
    if (pathname === "/stories") return json(route, { stories: [fixtureStory], reels: [fixtureReel] });
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

async function assertNoIosInputZoom(page, label) {
  const undersized = await page.locator("input, textarea, select").evaluateAll(controls => controls
    .filter(control => {
      const type = String(control.getAttribute("type") || "text").toLowerCase();
      const style = getComputedStyle(control);
      const box = control.getBoundingClientRect();
      return !["checkbox", "radio", "file", "range", "hidden", "submit", "button"].includes(type)
        && style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
    })
    .map(control => ({
      tag: control.tagName.toLowerCase(),
      id: control.id,
      name: control.getAttribute("name") || "",
      className: control.className,
      fontSize: parseFloat(getComputedStyle(control).fontSize)
    }))
    .filter(control => control.fontSize < 16));
  assert.deepEqual(undersized, [], `${label}: text controls below 16px can trigger disruptive iOS focus zoom: ${JSON.stringify(undersized)}`);
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
        await page.waitForSelector("#feed article.post .danzstak-audio-toggle");
        const audioGeometry = await page.locator("#feed article.post .danzstak-media-shell").evaluate(shell => {
          const button = shell.querySelector(".danzstak-audio-toggle");
          const shellBox = shell.getBoundingClientRect();
          const buttonBox = button.getBoundingClientRect();
          return { width: buttonBox.width, height: buttonBox.height, right: shellBox.right - buttonBox.right, bottom: shellBox.bottom - buttonBox.bottom, label: button.getAttribute("aria-label"), pressed: button.getAttribute("aria-pressed") };
        });
        assert.ok(audioGeometry.width >= 44 && audioGeometry.height >= 44, `${width}px: audio control must retain a 44px touch target: ${JSON.stringify(audioGeometry)}`);
        assert.ok(audioGeometry.right >= 8 && audioGeometry.right <= 14 && audioGeometry.bottom >= 8 && audioGeometry.bottom <= 14, `${width}px: audio control must remain in the video bottom-right corner: ${JSON.stringify(audioGeometry)}`);
        assert.equal(audioGeometry.label, "Unmute video", `${width}px: videos must begin with a visible muted-state control`);
        assert.equal(audioGeometry.pressed, "false", `${width}px: autoplay audio must not begin enabled`);
      }
      await assertNoOverflow(page, `Home ${width}px`, width <= 430);
      if (width <= 430) {
        await assertNoIosInputZoom(page, `Home ${width}px`);
        await assertExclusiveFeedScreen(page, "home");
        const shellMetrics = await page.evaluate(() => {
          const header = document.querySelector(".topbar").getBoundingClientRect();
          const nav = document.querySelector(".topbar .topnav").getBoundingClientRect();
          const post = document.querySelector("#feed article.post");
          const postStyle = getComputedStyle(post);
          const contentStyle = getComputedStyle(post.querySelector(".post-content"));
          const timeStyle = getComputedStyle(post.querySelector(".post-time"));
          return {
            headerHeight: header.height,
            navHeight: nav.height,
            postPadding: parseFloat(postStyle.paddingLeft),
            bodyFont: parseFloat(getComputedStyle(document.body).fontSize),
            postFont: parseFloat(contentStyle.fontSize),
            postLineHeight: parseFloat(contentStyle.lineHeight),
            timeFont: parseFloat(timeStyle.fontSize)
          };
        });
        assert.ok(shellMetrics.headerHeight <= 52, `${width}px: mobile header is oversized: ${JSON.stringify(shellMetrics)}`);
        assert.ok(shellMetrics.navHeight <= 52, `${width}px: mobile navigation is oversized: ${JSON.stringify(shellMetrics)}`);
        assert.ok(shellMetrics.postPadding <= 10, `${width}px: feed cards waste horizontal space: ${JSON.stringify(shellMetrics)}`);
        assert.ok(shellMetrics.bodyFont >= 15, `${width}px: body copy is too small to read comfortably: ${JSON.stringify(shellMetrics)}`);
        assert.ok(shellMetrics.postFont >= 15, `${width}px: post copy is too small to read comfortably: ${JSON.stringify(shellMetrics)}`);
        assert.ok(shellMetrics.postLineHeight / shellMetrics.postFont >= 1.35, `${width}px: post copy line spacing is too tight: ${JSON.stringify(shellMetrics)}`);
        assert.ok(shellMetrics.timeFont >= 11, `${width}px: post metadata is too small to read: ${JSON.stringify(shellMetrics)}`);
        const reactionMetrics = await page.locator("#feed article.post .post-actions button").evaluateAll(buttons => buttons.map(button => {
          const icon = button.querySelector(".reaction-icon,.action-icon,svg");
          const count = button.querySelector(".reaction-count,.action-count,[data-count]");
          const buttonBox = button.getBoundingClientRect();
          const iconBox = icon?.getBoundingClientRect();
          const countBox = count?.getBoundingClientRect();
          return { buttonTop: buttonBox.top, buttonWidth: buttonBox.width, buttonHeight: buttonBox.height, iconTop: iconBox?.top || 0, iconRight: iconBox?.right || 0, countTop: countBox?.top || 0, countLeft: countBox?.left || 0 };
        }));
        assert.ok(reactionMetrics.every(item => item.buttonHeight >= 44 && item.buttonWidth >= 44), `${width}px: reaction controls require comfortable touch targets: ${JSON.stringify(reactionMetrics)}`);
        for (const metric of reactionMetrics.filter(item => item.countLeft)) {
          const iconGap = metric.countLeft - metric.iconRight;
          assert.ok(iconGap >= 3 && iconGap <= 7, `${width}px: reaction icon/count gap must be 4–6px: ${JSON.stringify(metric)}`);
          assert.ok(Math.abs(metric.countTop - metric.iconTop) <= 5, `${width}px: reaction count baseline drift`);
        }
        assert.ok(reactionMetrics.filter(item => item.countLeft).length >= 4, `${width}px: Like, Dislike, Comment, and Share require measurable inline counts: ${JSON.stringify(reactionMetrics)}`);
      }
      await captureViewport(page, `home-${width}.png`);
      if (menuWidths.has(width)) {
        await page.locator(".mobile-menu-control").click();
        await page.waitForSelector("body.mobile-menu-open");
        await page.waitForFunction(() => Math.abs(document.querySelector("#mobileNavMenu")?.getBoundingClientRect().left || 0) <= 1);
        const menuGeometry = await page.locator("#mobileNavMenu").evaluate(drawer => {
          const menu = drawer.querySelector(".menu");
          const drawerBox = drawer.getBoundingClientRect();
          const headerBox = menu.querySelector(".menu-profile-header").getBoundingClientRect();
          const closeBox = menu.querySelector("[data-menu-close]").getBoundingClientRect();
          const profileName = menu.querySelector(".menu-profile-copy strong");
          const profileNameStyle = getComputedStyle(profileName);
          const rows = [...menu.querySelectorAll(":scope > a, :scope > .menu-action")].map(row => {
            const box = row.getBoundingClientRect();
            const icon = row.querySelector(".menu-icon")?.getBoundingClientRect();
            const label = row.querySelector(".menu-label")?.getBoundingClientRect();
            return { height: box.height, iconSize: Math.max(icon?.width || 0, icon?.height || 0), labelOffset: label && icon ? label.left - icon.right : 0 };
          });
          const headings = [...menu.querySelectorAll(".menu-section-heading")].map(heading => {
            const style = getComputedStyle(heading);
            return { marginTop: parseFloat(style.marginTop), marginBottom: parseFloat(style.marginBottom) };
          });
          const style = getComputedStyle(menu);
          return {
            rows,
            headings,
            profileHeight: menu.querySelector(".menu-profile-header").getBoundingClientRect().height,
            drawerLeft: drawerBox.left,
            drawerRight: drawerBox.right,
            headerLeft: headerBox.left,
            headerRight: headerBox.right,
            closeLeft: closeBox.left,
            closeRight: closeBox.right,
            closeWidth: closeBox.width,
            closeHeight: closeBox.height,
            profileNameWhiteSpace: profileNameStyle.whiteSpace,
            profileNameHeight: profileName.getBoundingClientRect().height,
            direction: style.flexDirection,
            justify: style.justifyContent,
            gap: parseFloat(style.gap) || 0,
            scrollable: drawer.scrollHeight > drawer.clientHeight,
            overflowY: getComputedStyle(drawer).overflowY
          };
        });
        assert.equal(menuGeometry.direction, "column", `${width}px: menu must flow vertically`);
        assert.equal(menuGeometry.justify, "flex-start", `${width}px: menu must not distribute rows across viewport height`);
        assert.ok(menuGeometry.rows.every(row => row.height >= 44 && row.height <= 52), `${width}px: menu rows must remain 44–52px: ${JSON.stringify(menuGeometry.rows)}`);
        assert.ok(menuGeometry.rows.every(row => row.iconSize >= 19.9 && row.iconSize <= 22.1), `${width}px: menu icons must remain 20–22px: ${JSON.stringify(menuGeometry.rows)}`);
        assert.ok(menuGeometry.rows.every(row => row.labelOffset >= 8 && row.labelOffset <= 12), `${width}px: icon/label spacing must remain compact: ${JSON.stringify(menuGeometry.rows)}`);
        assert.ok(menuGeometry.headings.every(heading => heading.marginTop <= 8 && heading.marginBottom <= 4), `${width}px: section heading margins are oversized: ${JSON.stringify(menuGeometry.headings)}`);
        assert.ok(menuGeometry.profileHeight <= 60, `${width}px: profile header is oversized (${menuGeometry.profileHeight}px)`);
        assert.ok(menuGeometry.headerLeft >= menuGeometry.drawerLeft && menuGeometry.headerRight <= menuGeometry.drawerRight + 1, `${width}px: menu header escapes its drawer: ${JSON.stringify(menuGeometry)}`);
        assert.ok(menuGeometry.closeLeft >= menuGeometry.headerLeft && menuGeometry.closeRight <= menuGeometry.headerRight + 1, `${width}px: menu Close control is clipped outside its header: ${JSON.stringify(menuGeometry)}`);
        assert.ok(menuGeometry.closeWidth >= 43.9 && menuGeometry.closeHeight >= 43.9, `${width}px: menu Close control requires a 44px touch target: ${JSON.stringify(menuGeometry)}`);
        assert.equal(menuGeometry.profileNameWhiteSpace, "normal", `${width}px: profile names must wrap instead of disappearing behind an ellipsis: ${JSON.stringify(menuGeometry)}`);
        assert.ok(menuGeometry.profileNameHeight <= 34, `${width}px: profile name wrapping makes the menu header too tall: ${JSON.stringify(menuGeometry)}`);
        assert.equal(menuGeometry.overflowY, "auto", `${width}px: drawer must own vertical scrolling`);
        assert.equal(menuGeometry.scrollable, true, `${width}px: full menu should scroll independently on a phone viewport`);
        assert.equal(await page.locator("body>.install-app-button:visible,body>.app-update-button:visible").count(), 0, `${width}px: install/update shortcuts must not overlap the open menu`);
        await captureViewport(page, `menu-${width}.png`);
        await page.locator("[data-menu-close]").click();
      }
      if (width === 390) {
        await page.waitForSelector('.story[data-story-id] .story-open');
        await page.locator('.story[data-story-id] .story-open').click();
        await page.waitForSelector('#storyViewer[open]');
        const storyGeometry = await page.locator('#storyViewer').evaluate(viewer => {
          const box = viewer.getBoundingClientRect();
          const media = viewer.querySelector('.story-viewer-media').getBoundingClientRect();
          const close = viewer.querySelector('.story-viewer-close').getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, mediaWidth: media.width, closeWidth: close.width, closeHeight: close.height, viewportWidth: innerWidth, viewportHeight: innerHeight };
        });
        assert.ok(storyGeometry.left >= 0 && storyGeometry.right <= storyGeometry.viewportWidth + 1 && storyGeometry.top >= 0 && storyGeometry.bottom <= storyGeometry.viewportHeight + 1, `Flash viewer must fit the phone viewport: ${JSON.stringify(storyGeometry)}`);
        assert.ok(storyGeometry.mediaWidth >= storyGeometry.viewportWidth * .8, `Flash media wastes phone width: ${JSON.stringify(storyGeometry)}`);
        assert.ok(storyGeometry.closeWidth >= 44 && storyGeometry.closeHeight >= 44, `Flash close action needs a comfortable touch target: ${JSON.stringify(storyGeometry)}`);
        await captureViewport(page, 'flash-viewer-390.png');
        await page.locator('.story-viewer-close').click();
        await page.waitForFunction(() => !document.getElementById('storyViewer')?.open);

        await page.waitForSelector('.reels-list .reel-card');
        await page.locator('.roll-open').click();
        await page.waitForSelector('.reels-rail.roll-fullscreen');
        const rollGeometry = await page.locator('.reels-rail.roll-fullscreen').evaluate(rail => {
          const box = rail.getBoundingClientRect();
          const card = rail.querySelector('.reel-card').getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, cardLeft: card.left, cardRight: card.right, viewportWidth: innerWidth, viewportHeight: innerHeight };
        });
        assert.ok(rollGeometry.left === 0 && rollGeometry.right === rollGeometry.viewportWidth && rollGeometry.top === 0 && rollGeometry.bottom === rollGeometry.viewportHeight, `The Roll must own the phone viewport: ${JSON.stringify(rollGeometry)}`);
        assert.ok(rollGeometry.cardLeft >= 0 && rollGeometry.cardRight <= rollGeometry.viewportWidth + 1, `The Roll card overflows the phone: ${JSON.stringify(rollGeometry)}`);
        await captureViewport(page, 'roll-fullscreen-390.png');
        await page.locator('.roll-close').click();
        await page.waitForSelector('.reels-rail:not(.roll-fullscreen)');

        await page.locator("#feed article.post video.ds-responsive-media").scrollIntoViewIfNeeded();
        await captureViewport(page, "video-390.png");
        await page.locator("#feed article.post .post-actions").scrollIntoViewIfNeeded();
        await captureViewport(page, "reactions-390.png");
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        await page.locator('.topnav [data-feature="Friends"]').click();
        await page.waitForTimeout(100);
        await assertExclusiveFeedScreen(page, "friends");
        await page.waitForSelector(".friend-discovery-row button[data-icon='chat']");
        const onlineMessageAction = await page.locator(".friend-discovery-row button[data-icon='chat']").evaluate(action => {
          const box = action.getBoundingClientRect();
          return { width: box.width, height: box.height, label: action.getAttribute("aria-label"), title: action.title };
        });
        assert.ok(onlineMessageAction.width >= 44 && onlineMessageAction.height >= 44, `Friends online-message action needs a 44px phone target: ${JSON.stringify(onlineMessageAction)}`);
        assert.equal(onlineMessageAction.label, "Message Mobile Friend", "Friends online-message icon needs the complete member name");
        assert.equal(onlineMessageAction.title, onlineMessageAction.label, "Friends online-message icon needs a matching tooltip");
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
        await assertNoIosInputZoom(page, "Chat list 390px");
        assert.equal(await page.locator("#messageDrawer").count(), 0, "mobile Chat must not use a feed popup");
        await captureViewport(page, "chat-list-390.png");

        await page.evaluate(() => openConversation({ contactEmail: "friend@danzstak.invalid", name: "Mobile Friend", memberId: "22222222-2222-4222-8222-222222222222", online: true, canContact: true }));
        await page.waitForSelector("body.is-conversation-open");
        await assertNoIosInputZoom(page, "Chat conversation 390px");
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
      await assertNoIosInputZoom(page, `Booking Agent ${width}px`);
      const bookingHeader = await page.locator("body.ds-tool-page>header").evaluate(header => ({ height: header.getBoundingClientRect().height, navVisible: getComputedStyle(header.querySelector("nav")).display !== "none" }));
      assert.ok(bookingHeader.height <= 60, `${width}px: professional-tool header is oversized: ${JSON.stringify(bookingHeader)}`);
      assert.equal(bookingHeader.navVisible, false, `${width}px: desktop tool links must not duplicate mobile navigation`);
      const bookingPrimary = await page.locator("#bookingBriefForm button.primary").evaluate(button => {
        const style = getComputedStyle(button);
        return { background: style.backgroundColor, color: style.color, height: button.getBoundingClientRect().height };
      });
      assert.equal(bookingPrimary.background, "rgb(23, 105, 224)", `${width}px: Booking Agent primary action is not DANZSTAK blue: ${JSON.stringify(bookingPrimary)}`);
      assert.equal(bookingPrimary.color, "rgb(255, 255, 255)", `${width}px: Booking Agent primary action lacks readable contrast: ${JSON.stringify(bookingPrimary)}`);
      assert.ok(bookingPrimary.height >= 42, `${width}px: Booking Agent primary action is too small: ${JSON.stringify(bookingPrimary)}`);
      assert.equal(await page.locator("#venueQuickMore").isVisible(), false, `${width}px: empty Find more clubs control must remain hidden before a search`);
      await captureViewport(page, `booking-${width}.png`);
      await page.evaluate(() => {
        document.querySelectorAll("details").forEach(details => { details.open = true; });
        const summary = document.querySelector(".summary");
        if (summary) window.scrollTo(0, Math.max(0, summary.getBoundingClientRect().top + scrollY - 70));
      });
      await page.waitForTimeout(100);
      const tourManagerVisible = await page.locator(".summary").evaluate(summary => {
        const box = summary.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, viewport: innerHeight };
      });
      assert.ok(tourManagerVisible.top >= 58 && tourManagerVisible.top < tourManagerVisible.viewport && tourManagerVisible.bottom > 0, `${width}px: Tour Manager heading is not fully visible below the tool header: ${JSON.stringify(tourManagerVisible)}`);
      await captureViewport(page, `tour-manager-${width}.png`);

      await page.goto(`${baseUrl}/epk.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#epkMain");
      await assertNoOverflow(page, `EPK ${width}px`, true);
      await assertNoIosInputZoom(page, `EPK ${width}px`);
      await captureViewport(page, `epk-${width}.png`);

      await page.goto(`${baseUrl}/record-stores.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#recordStoreMain");
      await assertNoOverflow(page, `Record Stores ${width}px`, true);
      await assertNoIosInputZoom(page, `Record Stores ${width}px`);
      assert.equal(await page.locator(".ds-mobile-nav").isVisible(), true, `${width}px: Record Stores must share mobile navigation`);
      const recordStoreSpacing = await page.evaluate(() => {
        const search = document.querySelector(".search-card").getBoundingClientRect();
        const placement = document.querySelector(".placement-card").getBoundingClientRect();
        const more = document.querySelector("#recordStoreMore");
        return { gap: placement.top - search.bottom, moreHidden: more.hidden, moreDisplay: getComputedStyle(more).display };
      });
      assert.equal(recordStoreSpacing.moreHidden, true, `${width}px: unused record-store pagination row should remain hidden before a search`);
      assert.equal(recordStoreSpacing.moreDisplay, "none", `${width}px: hidden record-store pagination row still consumes layout space`);
      assert.ok(recordStoreSpacing.gap <= 36, `${width}px: record-store cards have an excessive empty gap: ${JSON.stringify(recordStoreSpacing)}`);
      await captureViewport(page, `record-stores-${width}.png`);

      await page.goto(`${baseUrl}/profile.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#profileContent:not([hidden])");
      await assertNoOverflow(page, `Profile ${width}px`, true);
      await assertNoIosInputZoom(page, `Profile ${width}px`);
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
      await assertNoIosInputZoom(page, `Settings ${width}px`);
      const settingsGeometry = await page.locator(".settings-workspace .settings-row").evaluateAll(rows => rows.map(row => {
        const rowBox = row.getBoundingClientRect();
        const children = [...row.children].map(child => child.getBoundingClientRect()).filter(box => box.width && box.height);
        return { rowRight: rowBox.right, childRight: Math.max(0, ...children.map(box => box.right)), height: rowBox.height };
      }));
      assert.ok(settingsGeometry.every(item => item.childRight <= item.rowRight + 1), `${width}px: Settings control overflows its row: ${JSON.stringify(settingsGeometry)}`);
      const settingsActionGeometry = await page.locator(".settings-workspace .settings-action-row").evaluateAll(rows => rows.map(row => {
        const label = row.querySelector(":scope > strong")?.getBoundingClientRect();
        const control = row.lastElementChild?.getBoundingClientRect();
        return { labelTop: label?.top || 0, labelBottom: label?.bottom || 0, controlTop: control?.top || 0, controlBottom: control?.bottom || 0, controlHeight: control?.height || 0 };
      }));
      assert.ok(settingsActionGeometry.length >= 6, `${width}px: Settings action rows were not identified`);
      assert.ok(settingsActionGeometry.every(item => Math.min(item.labelBottom, item.controlBottom) - Math.max(item.labelTop, item.controlTop) > 0), `${width}px: Settings action fell onto a separate row: ${JSON.stringify(settingsActionGeometry)}`);
      assert.ok(settingsActionGeometry.every(item => item.controlHeight >= 43), `${width}px: Settings action is not comfortably tappable: ${JSON.stringify(settingsActionGeometry)}`);
      await captureViewport(page, `settings-${width}.png`);

      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".chat-sidebar");
      await assertNoOverflow(page, `Chat ${width}px`, true);
      await assertNoIosInputZoom(page, `Chat ${width}px`);
      assert.equal(await page.locator(".conversation-call-actions").first().isVisible().catch(() => false), false, `${width}px: conversation list must not waste width on per-row call controls`);
      assert.equal(await page.locator(".chat-header [data-logout]").isVisible(), false, `${width}px: mobile Chat must not duplicate account actions`);
      assert.equal(await page.locator("#chatSearch").getAttribute("placeholder"), "Search chats", `${width}px: Chat search wording is too long for a narrow phone`);
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
      assert.equal(await page.locator("#minimizeConversation").isVisible(), false, `${width}px: phone Chat must not show the redundant desktop minimize action`);
      if (width <= 360) {
        assert.equal(await page.locator("#headerVideo").isVisible(), false, `${width}px: video call must collapse before it truncates the contact name`);
        const nameFit = await page.locator("#conversationName").evaluate(name => ({ clientWidth: name.clientWidth, scrollWidth: name.scrollWidth }));
        assert.ok(nameFit.scrollWidth <= nameFit.clientWidth + 1, `${width}px: Chat contact name is truncated: ${JSON.stringify(nameFit)}`);
      }
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
      const anchoredHeader = await page.locator(".topbar").evaluate(header => {
        const box = header.getBoundingClientRect();
        return { top: box.top, height: box.height, position: getComputedStyle(header).position };
      });
      assert.equal(anchoredHeader.position, "sticky", `${width}px: desktop app header must remain sticky`);
      assert.ok(Math.abs(anchoredHeader.top) <= 1 && anchoredHeader.height >= 50, `${width}px: hash navigation clipped the desktop header: ${JSON.stringify(anchoredHeader)}`);
      await captureViewport(page, `settings-${width}.png`);

      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      const desktopIdentity = await page.locator("#mobileNavMenu").evaluate(drawer => {
        const name = drawer.querySelector("#menuProfileName");
        const close = drawer.querySelector("[data-menu-close]");
        return { text: name.textContent.trim(), clientHeight: name.clientHeight, scrollHeight: name.scrollHeight, closeVisible: Boolean(close.offsetWidth || close.offsetHeight) };
      });
      assert.equal(desktopIdentity.text, "DanzStak Test Artist", `${width}px: desktop profile shortcut lost the signed-in name`);
      assert.ok(desktopIdentity.scrollHeight <= desktopIdentity.clientHeight + 4, `${width}px: desktop profile shortcut clips the signed-in name: ${JSON.stringify(desktopIdentity)}`);
      assert.equal(desktopIdentity.closeVisible, false, `${width}px: desktop sidebar must not reserve a visible mobile Close control`);
      if (await page.locator("#feedOnlineUsers .feed-online-row:visible").count()) {
        const onlineIdentity = await page.locator("#feedOnlineUsers .feed-online-row").evaluate(row => {
          const name = row.querySelector("[aria-label$=', online']");
          const action = row.querySelector("button");
          const actionBox = action.getBoundingClientRect();
          return { name: name.textContent.trim(), nameClientWidth: name.clientWidth, nameScrollWidth: name.scrollWidth, actionWidth: actionBox.width, actionHeight: actionBox.height, icon: action.dataset.icon, label: action.getAttribute("aria-label"), title: action.title };
        });
        assert.equal(onlineIdentity.name, "Mobile Friend", `${width}px: online-user identity changed unexpectedly`);
        assert.ok(onlineIdentity.nameScrollWidth <= onlineIdentity.nameClientWidth + 1, `${width}px: right-rail online-user name is truncated: ${JSON.stringify(onlineIdentity)}`);
        assert.equal(onlineIdentity.icon, "chat", `${width}px: narrow online-user action should use the shared Chat icon`);
        assert.ok(onlineIdentity.actionWidth >= 38 && onlineIdentity.actionHeight >= 38, `${width}px: online-user Chat action is too small: ${JSON.stringify(onlineIdentity)}`);
        assert.equal(onlineIdentity.label, "Message Mobile Friend", `${width}px: icon-only online-user action lacks a complete accessible name`);
        assert.equal(onlineIdentity.title, onlineIdentity.label, `${width}px: online-user Chat action lacks a matching tooltip`);
      }
      await page.locator('.topnav [data-feature="Friends"]').click();
      await page.waitForSelector(".friends-workspace-list");
      await page.waitForSelector(".friend-discovery-row button[data-icon='chat']");
      await assertNoOverflow(page, `Desktop Friends ${width}px`);
      assert.equal(await page.locator("#featureView").isVisible(), true, `${width}px: desktop Friends workspace must be visible`);
      assert.equal(await page.locator("#newsFeedView").isVisible(), false, `${width}px: desktop Friends must not stack over the feed`);
      await captureViewport(page, `friends-desktop-${width}.png`);

      await page.locator('.topnav [data-feature="Notifications"]').click();
      await page.waitForSelector("#notificationDrawer:not([hidden])");
      await assertNoOverflow(page, `Desktop Notifications ${width}px`);
      const notificationPanel = await page.locator("#notificationDrawer").evaluate(drawer => {
        const box = drawer.getBoundingClientRect();
        return { width: box.width, height: box.height, right: innerWidth - box.right, top: box.top };
      });
      assert.ok(notificationPanel.width >= 300 && notificationPanel.width <= 430, `${width}px: desktop Notifications width is uncomfortable: ${JSON.stringify(notificationPanel)}`);
      assert.ok(notificationPanel.height >= 180 && notificationPanel.right >= 0 && notificationPanel.top >= 0, `${width}px: desktop Notifications is clipped: ${JSON.stringify(notificationPanel)}`);
      await captureViewport(page, `notifications-desktop-${width}.png`);

      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector(".chat-sidebar");
      await page.evaluate(() => openConversation({ contactEmail: "friend@danzstak.invalid", name: "Mobile Friend", memberId: "22222222-2222-4222-8222-222222222222", online: true, canContact: true }));
      await page.waitForSelector("#conversationHeader:not([hidden])");
      await assertNoOverflow(page, `Desktop Chat ${width}px`);
      const desktopChat = await page.evaluate(() => {
        const shell = document.querySelector(".chat-shell").getBoundingClientRect();
        const sidebar = document.querySelector(".chat-sidebar").getBoundingClientRect();
        const conversation = document.querySelector(".conversation").getBoundingClientRect();
        const actions = document.querySelector(".conversation-header-actions").getBoundingClientRect();
        const nameElement = document.querySelector("#conversationName");
        const name = nameElement.getBoundingClientRect();
        return {
          shellWidth: shell.width,
          sidebarWidth: sidebar.width,
          conversationWidth: conversation.width,
          panelsAligned: Math.abs(sidebar.right - conversation.left),
          nameRight: name.right,
          actionsLeft: actions.left,
          nameText: nameElement.textContent.trim(),
          nameClientWidth: nameElement.clientWidth,
          nameScrollWidth: nameElement.scrollWidth
        };
      });
      assert.ok(desktopChat.sidebarWidth >= 280 && desktopChat.conversationWidth >= 360, `${width}px: desktop Chat panes are not usable: ${JSON.stringify(desktopChat)}`);
      assert.ok(desktopChat.panelsAligned <= 1, `${width}px: desktop Chat panes have a gap or overlap: ${JSON.stringify(desktopChat)}`);
      assert.ok(desktopChat.nameRight <= desktopChat.actionsLeft + 1, `${width}px: desktop Chat contact name overlaps actions: ${JSON.stringify(desktopChat)}`);
      assert.equal(desktopChat.nameText, "Mobile Friend", `${width}px: desktop Chat contact name changed unexpectedly`);
      assert.ok(desktopChat.nameScrollWidth <= desktopChat.nameClientWidth + 1, `${width}px: desktop Chat contact name is visually truncated: ${JSON.stringify(desktopChat)}`);
      await captureViewport(page, `chat-desktop-${width}.png`);

      await page.goto(`${baseUrl}/booking.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#bookingMain");
      await assertNoOverflow(page, `Desktop Booking Agent ${width}px`);
      assert.equal(await page.locator("body.booking-page>header nav").isVisible(), true, `${width}px: desktop Booking Agent navigation must remain available`);
      assert.equal(await page.locator("body.booking-page>.ds-mobile-nav").isVisible(), false, `${width}px: mobile navigation must not duplicate desktop Booking Agent navigation`);
      assert.equal(await page.locator("#venueQuickMore").isVisible(), false, `${width}px: desktop Booking Agent must not show an empty pre-search control`);
      await captureViewport(page, `booking-desktop-${width}.png`);

      await page.goto(`${baseUrl}/epk.html`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("#epkMain");
      await assertNoOverflow(page, `Desktop EPK ${width}px`);
      assert.equal(await page.locator("body.ds-tool-page>header nav").isVisible(), true, `${width}px: desktop EPK navigation must remain available`);
      assert.equal(await page.locator("body.ds-tool-page>.ds-mobile-nav").isVisible(), false, `${width}px: mobile navigation must not duplicate desktop EPK navigation`);
      const epkColumns = await page.locator(".epk-layout").evaluate(layout => getComputedStyle(layout).gridTemplateColumns.split(" ").filter(Boolean).length);
      if (width >= 768) assert.equal(epkColumns, 2, `${width}px: tablet/desktop EPK must keep editor and preview side by side`);
      await captureViewport(page, `epk-desktop-${width}.png`);
      await context.close();
    }
    console.log(`Mobile visual checks passed at ${widths.join(", ")}px; screenshots: ${outputDir}`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
