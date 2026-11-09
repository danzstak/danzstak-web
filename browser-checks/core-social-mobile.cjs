"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8016").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430];
const pages = [
  ["home", "feed.html?view=feed", ".post-composer"],
  ["friends", "feed.html?view=friends", ".friend-workspace-row"],
  ["notifications", "feed.html?view=notifications", ".notification-row"],
  ["chat", "messages.html", ".conversation-row"],
  ["profile", "profile.html", ".profile"],
  ["settings", "feed.html?view=settings", ".settings-row"],
  ["menu", "feed.html?view=feed&menu=1", ".mobile-menu-open #mobileNavMenu"],
];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";

async function captureViewport(page, file, width, height) {
  let failure;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width, height }, animations: "disabled", caret: "hide" });
      return;
    } catch (error) {
      failure = error;
      await page.waitForTimeout(100);
    }
  }
  throw failure;
}

function fixture(pathname) {
  const profile = { memberId: "11111111-1111-4111-8111-111111111111", name: "DanzStak Test Artist", username: "testartist", handle: "testartist", bio: "Independent artist testing the DanzStak mobile experience.", picture: "", cover: "", website: "https://example.com" };
  const friend = { memberId: "22222222-2222-4222-8222-222222222222", email: "tour-friend@danzstak.invalid", name: "Tour Friend", picture: "" };
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "test-artist@danzstak.invalid" } };
  if (pathname === "/profiles" || pathname === "/profile") return { profile };
  if (pathname === "/secure-posts") return { posts: [] };
  if (pathname === "/friends") return { friends: [friend], incoming: [], outgoing: [] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [{ ...friend, online: true, canContact: true, friendStatus: "friends" }] };
  if (pathname === "/notifications") return { notifications: [{ type: "friend_request", email: friend.email, createdAt: "2026-11-04T20:15:00.000Z", unread: true }] };
  if (pathname === "/engagement-notifications") return { notifications: [{ type: "reaction", memberId: friend.memberId, name: friend.name, postId: "33333333-3333-4333-8333-333333333333", preview: "Love", createdAt: "2026-11-04T20:20:00.000Z", unread: true }] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  if (pathname === "/news") return { articles: [] };
  if (pathname === "/conversations") return { conversations: [{ ...friend, contactEmail: friend.email, preview: "The tour route looks good.", updatedAt: "2026-11-04T20:10:00.000Z", unread: 2, online: true, canContact: true }] };
  if (pathname === "/calls/devices") return { devices: [] };
  if (pathname === "/calls/inbox") return { events: [] };
  if (pathname === "/settings/presence") return { visible: true };
  if (pathname === "/settings/posts") return { hiddenPostIds: [] };
  if (pathname === "/profile-video") return { video: null };
  if (pathname === "/engagement") return { reactions: [], comments: [], savedPostIds: [], shares: [], views: {} };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const results = [];
  try {
    for (const width of widths) {
      for (const [name, target, populatedSelector] of pages) {
        const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/**", route => {
          const url = new URL(route.request().url());
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
        });
        await page.goto(`${baseUrl}/${target}`, { waitUntil: "domcontentloaded" });
        await page.locator(populatedSelector).first().waitFor({ state: "visible" });
        await page.waitForTimeout(100);
        if (name === "home") {
          const install = page.locator("body > .install-app-button");
          await install.waitFor({ state: "visible", timeout: 3000 });
          const headerControls = await page.evaluate(() => {
            const rect = selector => {
              const box = document.querySelector(selector)?.getBoundingClientRect();
              return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null;
            };
            const pivot = rect("#pivotButton");
            const installButton = rect("body > .install-app-button");
            const pivotTarget = pivot
              ? document.elementFromPoint((pivot.left + pivot.right) / 2, (pivot.top + pivot.bottom) / 2)
              : null;
            return {
              pivot,
              install: installButton,
              searchPlaceholder: document.querySelector(".topbar .search")?.placeholder || "",
              pivotTarget: Boolean(pivotTarget?.closest?.("#pivotButton")),
              pivotLabel: document.querySelector("#pivotButton")?.textContent?.trim() || "",
              pivotHtml: document.querySelector("#pivotButton")?.outerHTML || ""
            };
          });
          assert.equal(headerControls.pivotLabel, "Pivot", `${width}px Pivot label must remain intact: ${JSON.stringify(headerControls)}`);
          assert.ok(headerControls.pivot && headerControls.install, `${width}px Pivot and Install controls must both render`);
          assert.ok(headerControls.pivot.right + 4 <= headerControls.install.left, `${width}px Install overlaps Pivot: ${JSON.stringify(headerControls)}`);
          assert.equal(headerControls.pivotTarget, true, `${width}px Pivot center must remain clickable above other controls`);
          assert.ok(headerControls.pivot.width >= 60 && headerControls.pivot.height >= 38, `${width}px Pivot control is clipped: ${JSON.stringify(headerControls.pivot)}`);
          assert.ok(headerControls.install.width >= 36 && headerControls.install.height >= 36, `${width}px Install control is undersized: ${JSON.stringify(headerControls.install)}`);
          assert.equal(headerControls.searchPlaceholder, width <= 360 ? "Search" : "Search posts and users", `${width}px global search prompt must not be visibly clipped`);
        }
        if (name === "friends") {
          assert.equal(await page.locator(".friend-workspace-row").count(), 1, `${width}px accepted friend card is missing`);
          assert.match(await page.getByRole("tab", { name: /^Online/ }).textContent() || "", /1$/, `${width}px accepted online friend must appear in the Online tab`);
          assert.match(await page.locator(".friend-message-action").first().getAttribute("aria-label") || "", /^Message\b/, `${width}px accepted friend must open SYNC instead of offering a duplicate request`);
          const friendTabs = await page.locator(".friends-directory-tab").evaluateAll(elements => elements.filter(element => !element.hidden && getComputedStyle(element).display !== "none").map(element => { const box = element.getBoundingClientRect(); return { label: element.textContent.trim(), left: box.left, right: box.right, width: box.width, height: box.height }; }));
          assert.equal(friendTabs.length, 4, `${width}px Friends must expose all four list tabs: ${JSON.stringify(friendTabs)}`);
          assert.ok(friendTabs.every(tab => tab.left >= 0 && tab.right <= width && tab.height >= 44), `${width}px Friends tabs must remain fully visible and touchable: ${JSON.stringify(friendTabs)}`);
        }
        if (name === "notifications") {
          assert.equal(await page.locator(".notification-row").count(), 2, `${width}px populated notification sources did not remain visible together`);
          const notificationSurface = await page.locator(".notification-row").first().evaluate(element => {
            const style = getComputedStyle(element);
            return {
              background: style.backgroundColor,
              radius: style.borderRadius,
              leftBorder: style.borderLeftWidth,
              rightBorder: style.borderRightWidth,
              bottomBorder: style.borderBottomWidth
            };
          });
          assert.equal(notificationSurface.background, "rgba(0, 0, 0, 0)", `${width}px notifications must share the fluid page canvas`);
          assert.equal(notificationSurface.radius, "0px", `${width}px notifications must not restore separate rounded cards`);
          assert.equal(notificationSurface.leftBorder, "0px", `${width}px notifications must not restore a left card edge`);
          assert.equal(notificationSurface.rightBorder, "0px", `${width}px notifications must not restore a right card edge`);
          assert.equal(notificationSurface.bottomBorder, "1px", `${width}px notification rows need a single quiet separator`);
          const notificationTargets = await page.locator(".notification-row a, .notification-row button").evaluateAll(elements => elements.map(element => {
            const rect = element.getBoundingClientRect();
            return { label: element.getAttribute("aria-label") || element.textContent?.trim() || "", width: rect.width, height: rect.height };
          }));
          assert.ok(notificationTargets.every(target => target.width >= 44 && target.height >= 44), `${width}px notification actions must retain 44px touch targets: ${JSON.stringify(notificationTargets)}`);
        }
        if (name === "chat") {
          assert.equal((await page.locator(".conversation-unread").textContent())?.trim(), "2", `${width}px unread chat badge is missing`);
          assert.equal(await page.locator("body > .chat-header").evaluate(element => getComputedStyle(element).display), "none", `${width}px SYNC must use one phone header, not the desktop header plus the list header`);
          const contactName = await page.locator(".chat-contact-name").first().evaluate(element => ({ text: element.textContent?.trim(), clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
          assert.equal(contactName.text, "Tour Friend", `${width}px recent contact name changed unexpectedly`);
          assert.ok(contactName.scrollWidth <= contactName.clientWidth + 1, `${width}px recent contact name is visibly clipped: ${JSON.stringify(contactName)}`);
          const videoCall = await page.locator("#newVideoCall").boundingBox();
          assert.ok(videoCall && videoCall.width >= 44 && videoCall.height >= 44 && videoCall.x >= 0 && videoCall.x + videoCall.width <= width, `${width}px video-call action must remain visible and touchable`);
        }
        if (name === "profile") {
          await page.getByRole("link", { name: /(?:Open|Manage) my shop/ }).waitFor({ state: "visible" });
          const profileControls = await page.evaluate(() => {
            const visible = selector => [...document.querySelectorAll(selector)].filter(element => !element.hidden && getComputedStyle(element).display !== "none");
            const actions = visible(".profile-actions > button, .profile-actions > a").map(element => {
              const box = element.getBoundingClientRect();
              return { label: element.textContent.trim(), top: box.top, bottom: box.bottom, width: box.width, height: box.height };
            });
            const tabs = visible(".profile-tabs > button").map(element => {
              const box = element.getBoundingClientRect();
              return { label: element.textContent.trim(), left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
            });
            const headerRect = element => {
              if (!element || element.hidden) return null;
              const style = getComputedStyle(element);
              if (style.display === "none" || style.visibility === "hidden") return null;
              const box = element.getBoundingClientRect();
              return box.width > 0 && box.height > 0
                ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height }
                : null;
            };
            return { actions, tabs, header: { search: headerRect(document.querySelector("#profileHeaderSearch")), searchPlaceholder: document.querySelector("#profileHeaderSearch")?.placeholder || "", pivot: headerRect(document.querySelector("#profileHeaderPivot")), install: headerRect(document.querySelector("body > .install-app-button")) } };
          });
          assert.deepEqual(profileControls.actions.map(action => action.label), ["Edit Profile", "Open my shop", "Share Profile", "Invite People"], `${width}px owner profile must retain Edit, Shop, Share, and Invite actions`);
          assert.ok(Math.max(...profileControls.actions.map(action => action.top)) - Math.min(...profileControls.actions.map(action => action.top)) <= 1, `${width}px profile actions must use one row: ${JSON.stringify(profileControls.actions)}`);
          assert.ok(profileControls.actions.every(action => action.height >= 44 && action.width > 0), `${width}px profile actions must retain touch targets: ${JSON.stringify(profileControls.actions)}`);
          assert.ok(profileControls.tabs.length >= 5, `${width}px profile sections are missing: ${JSON.stringify(profileControls.tabs)}`);
          assert.ok(Math.max(...profileControls.tabs.map(tab => tab.top)) - Math.min(...profileControls.tabs.map(tab => tab.top)) <= 1, `${width}px profile tabs must stay on one row: ${JSON.stringify(profileControls.tabs)}`);
          assert.ok(profileControls.tabs.every(tab => tab.height >= 44), `${width}px profile tabs must retain touch targets: ${JSON.stringify(profileControls.tabs)}`);
          assert.ok(profileControls.tabs.every(tab => tab.left >= 0 && tab.right <= width), `${width}px profile tabs must all remain fully visible: ${JSON.stringify(profileControls.tabs)}`);
          assert.ok(profileControls.header.search && profileControls.header.search.height >= 38, `${width}px profile search is missing or clipped: ${JSON.stringify(profileControls.header)}`);
          assert.ok(profileControls.header.pivot && profileControls.header.pivot.height >= 38, `${width}px profile Pivot is missing or clipped: ${JSON.stringify(profileControls.header)}`);
          assert.ok(profileControls.header.search.right + 4 <= profileControls.header.pivot.left, `${width}px profile Search overlaps Pivot: ${JSON.stringify(profileControls.header)}`);
          assert.ok(!profileControls.header.install || profileControls.header.pivot.right + 4 <= profileControls.header.install.left, `${width}px profile Pivot overlaps Install: ${JSON.stringify(profileControls.header)}`);
          assert.equal(profileControls.header.searchPlaceholder, width <= 360 ? "Search" : "Search posts and users", `${width}px profile search prompt must not be visibly clipped`);
        }
        if (name === "settings") {
          const settingsGeometry = await page.evaluate(() => {
            const visible = element => !element.hidden && getComputedStyle(element).display !== "none";
            const rows = [...document.querySelectorAll(".settings-row")].filter(visible).map(element => {
              const box = element.getBoundingClientRect();
              const style = getComputedStyle(element);
              const icon = element.querySelector(".settings-icon .ds-action-icon")?.getBoundingClientRect();
              const controls = [...element.querySelectorAll("button,a,select,input")].filter(visible).map(control => {
                const rect = control.getBoundingClientRect();
                return { type: control.tagName, width: rect.width, height: rect.height };
              });
              return {
                label: element.querySelector("strong")?.textContent?.trim() || "",
                width: box.width,
                background: style.backgroundColor,
                radius: style.borderRadius,
                leftBorder: style.borderLeftWidth,
                rightBorder: style.borderRightWidth,
                bottomBorder: style.borderBottomWidth,
                icon: icon ? { width: icon.width, height: icon.height } : null,
                controls
              };
            });
            return { rows };
          });
          assert.ok(settingsGeometry.rows.length >= 16, `${width}px Settings rows are missing: ${JSON.stringify(settingsGeometry.rows)}`);
          assert.ok(settingsGeometry.rows.every(row => row.background === "rgba(0, 0, 0, 0)"), `${width}px Settings must share the fluid page canvas: ${JSON.stringify(settingsGeometry.rows)}`);
          assert.ok(settingsGeometry.rows.every(row => row.radius === "0px" && row.leftBorder === "0px" && row.rightBorder === "0px"), `${width}px Settings must not restore separate cards: ${JSON.stringify(settingsGeometry.rows)}`);
          assert.ok(settingsGeometry.rows.every(row => row.bottomBorder === "1px"), `${width}px Settings rows need one quiet separator: ${JSON.stringify(settingsGeometry.rows)}`);
          assert.ok(settingsGeometry.rows.every(row => row.icon && row.icon.width >= 20 && row.icon.width <= 24 && row.icon.height >= 20 && row.icon.height <= 24), `${width}px Settings icons must remain consistent: ${JSON.stringify(settingsGeometry.rows)}`);
          const interactive = settingsGeometry.rows.flatMap(row => row.controls).filter(control => control.type !== "INPUT" || control.width > 30 || control.height > 30);
          assert.ok(interactive.every(control => control.height >= 44), `${width}px Settings actions must retain 44px touch targets: ${JSON.stringify(interactive)}`);
        }
        if (name === "menu") {
          await page.waitForFunction(() => document.querySelector("#mobileNavMenu")?.getBoundingClientRect().left >= -0.5, null, { timeout: 1000 });
          const menuGeometry = await page.evaluate(() => {
            const drawer = document.querySelector("#mobileNavMenu");
            const menu = drawer.querySelector(".menu");
            const close = drawer.querySelector("[data-menu-close]");
            const rows = [...drawer.querySelectorAll(".menu > a, .menu > .menu-action")].filter(element => !element.hidden && getComputedStyle(element).display !== "none").map(element => {
              const box = element.getBoundingClientRect();
              const icon = element.querySelector(".menu-icon")?.getBoundingClientRect();
              return { label: element.textContent.trim(), top: box.top, height: box.height, iconWidth: icon?.width || 0, iconHeight: icon?.height || 0 };
            });
            const drawerBox = drawer.getBoundingClientRect();
            const menuStyle = getComputedStyle(menu);
            const closeBox = close.getBoundingClientRect();
            return {
              bodyOpen: document.body.classList.contains("mobile-menu-open"),
              drawer: { left: drawerBox.left, right: drawerBox.right, top: drawerBox.top, bottom: drawerBox.bottom, width: drawerBox.width, height: drawerBox.height, scrollHeight: drawer.scrollHeight, clientHeight: drawer.clientHeight },
              close: { width: closeBox.width, height: closeBox.height },
              rows,
              menuGap: menuStyle.gap,
              menuJustify: menuStyle.justifyContent,
              activeElementInside: drawer.contains(document.activeElement),
              activeElementClose: document.activeElement?.matches?.("[data-menu-close]") === true,
              activeElement: { tag: document.activeElement?.tagName || "", id: document.activeElement?.id || "", className: String(document.activeElement?.className || "") },
              backdropOwnsOutsideTap: (() => {
                const x = Math.min(innerWidth - 2, drawerBox.right + Math.max(2, (innerWidth - drawerBox.right) / 2));
                const y = innerHeight - 26;
                const target = document.elementFromPoint(x, y);
                return !target?.closest?.(".ds-mobile-nav");
              })(),
            };
          });
          assert.equal(menuGeometry.bodyOpen, true, `${width}px menu route must open the drawer`);
          assert.ok(menuGeometry.drawer.left >= -0.5 && menuGeometry.drawer.right <= width + 0.5, `${width}px menu drawer escapes the viewport: ${JSON.stringify(menuGeometry.drawer)}`);
          assert.ok(menuGeometry.drawer.width <= Math.min(340, width * 0.87) + 1, `${width}px menu drawer is too wide: ${JSON.stringify(menuGeometry.drawer)}`);
          assert.ok(Math.abs(menuGeometry.drawer.top) <= 1 && Math.abs(menuGeometry.drawer.height - 844) <= 1, `${width}px menu must own one viewport-height region: ${JSON.stringify(menuGeometry.drawer)}`);
          assert.ok(menuGeometry.drawer.scrollHeight > menuGeometry.drawer.clientHeight, `${width}px complete menu must scroll inside its drawer`);
          assert.ok(menuGeometry.rows.length >= 16, `${width}px menu destinations are missing`);
          assert.ok(menuGeometry.rows.every(row => row.height >= 44 && row.height <= 52), `${width}px menu rows must stay within the compact 44–52px range: ${JSON.stringify(menuGeometry.rows)}`);
          const iconSizeWithinTolerance = value => value >= 19.99 && value <= 22.01;
          assert.ok(menuGeometry.rows.every(row => iconSizeWithinTolerance(row.iconWidth) && iconSizeWithinTolerance(row.iconHeight)), `${width}px menu icons must remain consistently 20–22px: ${JSON.stringify(menuGeometry.rows)}`);
          assert.equal(menuGeometry.menuGap, "0px", `${width}px menu must not distribute blank gaps between rows`);
          assert.equal(menuGeometry.menuJustify, "flex-start", `${width}px menu rows must flow from the top`);
          assert.ok(menuGeometry.close.width >= 44 && menuGeometry.close.height >= 44, `${width}px menu close action must retain a 44px touch target`);
          assert.equal(menuGeometry.activeElementInside, true, `${width}px opening Menu must move focus into the drawer: ${JSON.stringify(menuGeometry.activeElement)}`);
          assert.equal(menuGeometry.activeElementClose, true, `${width}px opening Menu must focus its close action: ${JSON.stringify(menuGeometry.activeElement)}`);
          assert.equal(menuGeometry.backdropOwnsOutsideTap, true, `${width}px bottom navigation must remain behind the menu backdrop`);
        }
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bodyWidth: document.body.scrollWidth,
          mobileNavs: [...document.querySelectorAll(".ds-mobile-nav")].filter(element => getComputedStyle(element).display !== "none").length,
          visibleDialogs: [...document.querySelectorAll("dialog,[role=dialog]")].filter(element => !element.hidden && getComputedStyle(element).display !== "none").length,
          skipLink: (() => {
            const element = document.querySelector(".skip-link");
            if (!element) return null;
            const rect = element.getBoundingClientRect();
            return { focused: element.matches(":focus"), top: rect.top, bottom: rect.bottom, transform: getComputedStyle(element).transform, activeTag: document.activeElement?.tagName || "" };
          })(),
        }));
        assert.equal(errors.length, 0, `${name} ${width}px browser errors: ${errors.join(" | ")}`);
        assert.ok(geometry.scrollWidth <= width && geometry.bodyWidth <= width, `${name} overflows at ${width}px: ${JSON.stringify(geometry)}`);
        assert.ok(geometry.mobileNavs <= 1, `${name} renders duplicate mobile navigation at ${width}px`);
        assert.equal(geometry.visibleDialogs, 0, `${name} opens an unsolicited dialog at ${width}px`);
        assert.ok(!geometry.skipLink?.focused, `${name} moves initial focus to the keyboard-only skip link at ${width}px: ${JSON.stringify(geometry.skipLink)}`);
        assert.ok(!geometry.skipLink || geometry.skipLink.bottom <= 0, `${name} exposes the keyboard-only skip link without keyboard navigation at ${width}px: ${JSON.stringify(geometry.skipLink)}`);
        if (captureDir) {
          fs.mkdirSync(captureDir, { recursive: true });
          // Viewport captures preserve fixed-element composition accurately; Chromium's
          // stitched full-page mode can paint offscreen fixed skip links and navigation
          // at misleading document coordinates.
          await captureViewport(page, path.join(captureDir, `${name}-${width}.png`), width, 844);
        }
        await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(50);
        const footerClearance = await page.evaluate(() => {
          const footer = document.querySelector(".site-ownership"), nav = [...document.querySelectorAll(".ds-mobile-nav,.topnav")].find(element => getComputedStyle(element).position === "fixed" && getComputedStyle(element).display !== "none");
          if (!footer || !nav) return null;
          const footerRect = footer.getBoundingClientRect(), navRect = nav.getBoundingClientRect();
          return { footerBottom: footerRect.bottom, navTop: navRect.top };
        });
        if (footerClearance) assert.ok(footerClearance.footerBottom <= footerClearance.navTop + 1, `${name} footer is covered by mobile navigation at ${width}px: ${JSON.stringify(footerClearance)}`);
        results.push(`${name}-${width}`);
        await context.close();
      }
    }
    const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 }, serviceWorkers: "block" });
    const desktopPage = await desktop.newPage();
    await desktopPage.route("https://api.danzstak.com/**", route => {
      const url = new URL(route.request().url());
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname)) });
    });
    await desktopPage.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
    await desktopPage.locator(".post-composer").waitFor({ state: "visible" });
    await desktopPage.locator(".topbar .install-app-button").waitFor({ state: "visible", timeout: 3000 });
    const desktopHeader = await desktopPage.evaluate(() => {
      const rect = selector => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom } : null;
      };
      return {
        pivot: rect("#pivotButton"),
        install: rect(".topbar .install-app-button"),
        scrollWidth: document.documentElement.scrollWidth
      };
    });
    assert.ok(desktopHeader.pivot && desktopHeader.install, "desktop Pivot and Install controls must both render");
    assert.ok(desktopHeader.pivot.right <= desktopHeader.install.left || desktopHeader.install.right <= desktopHeader.pivot.left, `desktop Install overlaps Pivot: ${JSON.stringify(desktopHeader)}`);
    assert.ok(desktopHeader.scrollWidth <= 1366, `desktop header overflows: ${JSON.stringify(desktopHeader)}`);
    if (captureDir) await desktopPage.screenshot({ path: path.join(captureDir, "home-1366.png"), fullPage: true });
    results.push("home-1366");
    await desktopPage.goto(`${baseUrl}/profile.html`, { waitUntil: "domcontentloaded" });
    await desktopPage.locator(".profile").waitFor({ state: "visible" });
    const desktopProfileHeader = await desktopPage.evaluate(() => {
      const rect = selector => { const box = document.querySelector(selector)?.getBoundingClientRect(); return box ? { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height } : null; };
      return { search: rect("#profileHeaderSearch"), pivot: rect("#profileHeaderPivot"), actions: rect(".profile-app-header .header-actions"), scrollWidth: document.documentElement.scrollWidth };
    });
    assert.ok(desktopProfileHeader.search && desktopProfileHeader.search.width >= 180 && desktopProfileHeader.search.height >= 42, `desktop profile Search is missing or clipped: ${JSON.stringify(desktopProfileHeader)}`);
    assert.ok(desktopProfileHeader.pivot && desktopProfileHeader.pivot.height >= 42, `desktop profile Pivot is missing or clipped: ${JSON.stringify(desktopProfileHeader)}`);
    assert.ok(desktopProfileHeader.actions && desktopProfileHeader.actions.width > 0, `desktop profile account navigation is missing: ${JSON.stringify(desktopProfileHeader)}`);
    assert.ok(desktopProfileHeader.search.right < desktopProfileHeader.pivot.left && desktopProfileHeader.pivot.right < desktopProfileHeader.actions.left, `desktop profile header controls overlap: ${JSON.stringify(desktopProfileHeader)}`);
    assert.ok(desktopProfileHeader.scrollWidth <= 1366, `desktop profile header overflows: ${JSON.stringify(desktopProfileHeader)}`);
    if (captureDir) await desktopPage.screenshot({ path: path.join(captureDir, "profile-1366.png"), fullPage: true });
    await desktopPage.locator("#profileHeaderSearch").fill("Tour Friend");
    await Promise.all([
      desktopPage.waitForURL(url => url.pathname.endsWith("/feed.html") && url.searchParams.get("q") === "Tour Friend"),
      desktopPage.locator("#profileHeaderSearch").press("Enter"),
    ]);
    await desktopPage.locator(".search").waitFor({ state: "visible" });
    assert.equal(await desktopPage.locator(".search").inputValue(), "Tour Friend", "profile search query must arrive intact in Your Mix");
    assert.equal(await desktopPage.locator(".search").evaluate(element => element === document.activeElement), true, "cross-page profile search must focus the Feed search box");
    results.push("profile-1366-search");
    await desktop.close();
    console.log(`Core social mobile browser checks passed: ${results.length} page/viewport combinations.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
