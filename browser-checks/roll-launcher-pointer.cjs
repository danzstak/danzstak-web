"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_VISUAL_BASE_URL || "http://127.0.0.1:8013";
const viewports = [
  { width: 320, height: 568 },
  { width: 360, height: 780 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 414, height: 896 },
  { width: 430, height: 932 },
  { width: 1366, height: 900 }
];
const output = path.resolve(process.env.DANZSTAK_VISUAL_OUTPUT || "docs/screenshots/roll-launcher-pointer");
fs.mkdirSync(output, { recursive: true });

function fixture(url) {
  if (url.pathname === "/auth/session") return { authenticated: true, email: "roll-test@danzstak.invalid", name: "Roll Test Artist", memberId: "11111111-1111-4111-8111-111111111111" };
  if (url.pathname === "/posts" || url.pathname === "/secure-posts") return { posts: [] };
  if (url.pathname === "/stories") return {
    dailyTakeCount: 1,
    stories: [{ storyId: "safe-zone-story", memberId: "11111111-1111-4111-8111-111111111111", displayName: "Roll Test Artist", mediaType: "image", mediaUrl: `${baseUrl}/__safe-zone-story.svg`, caption: "Phone safe-zone verification", createdAt: "2026-11-08T00:00:00.000Z", isOwner: false }],
    reels: [
      { id: "roll-pointer-fixture", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", authorName: "Roll Test Artist", memberId: "11111111-1111-4111-8111-111111111111", content: "Landscape Roll fit verification", sharedAt: "2026-11-08T00:00:00.000Z", isOwner: true },
      { id: "roll-portrait-fixture", url: "https://www.youtube.com/shorts/abcdefghijk", authorName: "Roll Test Artist", memberId: "11111111-1111-4111-8111-111111111111", content: "Portrait Roll fit verification", sharedAt: "2026-11-08T00:00:00.000Z", isOwner: true }
    ]
  };
  if (url.pathname === "/friends") return { friends: [] };
  if (url.pathname === "/calls/directory" || url.pathname === "/people") return { users: [] };
  if (url.pathname === "/notifications" || url.pathname === "/engagement-notifications") return { notifications: [] };
  if (url.pathname === "/messages/conversations") return { conversations: [] };
  if (url.pathname === "/settings/presence") return { dataSaver: false };
  if (url.pathname === "/profiles" || url.pathname === "/profile") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Roll Test Artist", isOwner: true } };
  return {};
}

async function pointerOwner(page, selector) {
  return page.locator(selector).first().evaluate(control => {
    const box = control.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return {
      box: { left: box.left, top: box.top, right: box.right, bottom: box.bottom },
      ownsCenter: Boolean(hit && (hit === control || control.contains(hit))),
      hit: hit?.className || hit?.tagName || "",
      hitTag: hit?.tagName || "",
      hitHtml: hit?.outerHTML?.slice(0, 240) || "",
      hitParent: hit?.parentElement?.className || hit?.parentElement?.tagName || ""
    };
  });
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const { width, height } of viewports) {
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
      const page = await context.newPage();
      await page.route("https://www.youtube-nocookie.com/embed/**", route => {
        const portrait = new URL(route.request().url()).pathname.includes("abcdefghijk");
        return route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `<!doctype html><html><body style="margin:0;display:grid;place-items:center;width:100vw;height:100vh;overflow:hidden;background:linear-gradient(135deg,#24103f,#ef6c20);color:#fff;font:700 8vw Arial"><span>${portrait ? "PORTRAIT VIDEO" : "LANDSCAPE VIDEO"}</span></body></html>`
        });
      });
      await page.route(`${baseUrl}/__safe-zone-story.svg`, route => route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1600"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#101722"/><stop offset="1" stop-color="#1769e0"/></linearGradient></defs><rect width="900" height="1600" fill="url(#g)"/><circle cx="450" cy="650" r="230" fill="#ef6c20"/><text x="450" y="680" fill="white" font-family="Arial" font-size="72" font-weight="700" text-anchor="middle">DAILIES</text></svg>'
      }));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(new URL(route.request().url()))) }));
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator('.story[data-story-id="safe-zone-story"] .story-open').waitFor();
      await page.locator(".reel-fullscreen-trigger").first().waitFor();
      await page.locator(".reel-media-stage iframe.reel-player").nth(1).waitFor();
      await page.locator('.reel-media-stage[data-video-layout="landscape"]').evaluate(stage => stage.scrollIntoView({ block:"center", inline:"center" }));

      const linkedPreview = await page.evaluate(() => {
        const bounds = element => {
          const rect = element.getBoundingClientRect();
          return { left:rect.left, top:rect.top, right:rect.right, bottom:rect.bottom, width:rect.width, height:rect.height };
        };
        const stage = document.querySelector(".reels-rail:not(.roll-fullscreen) .reel-media-stage");
        const player = stage?.querySelector("iframe.reel-player");
        const card = stage?.closest(".reel-card");
        const style = getComputedStyle(stage);
        return {
          stage:bounds(stage),
          player:bounds(player),
          card:bounds(card),
          backgroundColor:style.backgroundColor,
          backgroundImage:style.backgroundImage
        };
      });
      assert.ok(Math.abs(linkedPreview.stage.height - linkedPreview.stage.width * 9 / 16) <= 2, `${width}px linked Roll preview does not match its 16:9 provider: ${JSON.stringify(linkedPreview)}`);
      assert.ok(Math.abs(linkedPreview.player.width - linkedPreview.stage.width) <= 2, `${width}px linked Roll player does not fill the stage width: ${JSON.stringify(linkedPreview)}`);
      assert.ok(Math.abs(linkedPreview.player.height - linkedPreview.stage.height) <= 2, `${width}px linked Roll player does not fill the ratio-matched stage: ${JSON.stringify(linkedPreview)}`);
      assert.ok(linkedPreview.stage.top >= -1 && linkedPreview.stage.bottom <= height + 1, `${width}px linked Roll video cannot be seen in one device viewport: ${JSON.stringify(linkedPreview)}`);
      assert.equal(linkedPreview.backgroundColor, "rgb(5, 7, 12)", `${width}px linked Roll stage is not using the dark media canvas`);
      assert.match(linkedPreview.backgroundImage, /danzstak-score-pattern\.svg/, `${width}px linked Roll stage is missing the subtle music texture`);

      await page.locator('.reel-media-stage[data-video-layout="portrait"]').evaluate(stage => stage.scrollIntoView({ block:"center", inline:"center" }));
      const portraitPreview = await page.locator('.reel-media-stage[data-video-layout="portrait"]').evaluate(stage => {
        const bounds = element => {
          const rect = element.getBoundingClientRect();
          return { left:rect.left, top:rect.top, right:rect.right, bottom:rect.bottom, width:rect.width, height:rect.height };
        };
        const player = stage.querySelector("iframe.reel-player");
        const shell = player.parentElement;
        const style = element => {
          const computed = getComputedStyle(element);
          return { width:computed.width, height:computed.height, aspectRatio:computed.aspectRatio, display:computed.display, flex:computed.flex };
        };
        return { stage:bounds(stage), player:bounds(player), shell:bounds(shell), playerStyle:style(player), shellStyle:style(shell) };
      });
      assert.ok(portraitPreview.stage.height <= Math.min(720, Math.max(280, height - 168)) + 2, `${width}px portrait Roll stage exceeds the usable device viewport: ${JSON.stringify(portraitPreview)}`);
      assert.ok(portraitPreview.player.height <= portraitPreview.stage.height + 2 && portraitPreview.player.width <= portraitPreview.stage.width + 2, `${width}px portrait Roll player exceeds the fitted stage: ${JSON.stringify(portraitPreview)}`);
      assert.ok(Math.abs(portraitPreview.player.width - portraitPreview.player.height * 9 / 16) <= 2, `${width}px portrait Roll player was cropped or stretched: ${JSON.stringify(portraitPreview)}`);
      assert.ok(Math.abs((portraitPreview.player.top + portraitPreview.player.bottom) / 2 - (portraitPreview.stage.top + portraitPreview.stage.bottom) / 2) <= 2, `${width}px portrait Roll player is not vertically centered: ${JSON.stringify(portraitPreview)}`);
      assert.ok(Math.abs((portraitPreview.player.left + portraitPreview.player.right) / 2 - (portraitPreview.stage.left + portraitPreview.stage.right) / 2) <= 2, `${width}px portrait Roll player is not horizontally centered: ${JSON.stringify(portraitPreview)}`);
      assert.ok(portraitPreview.stage.top >= -1 && portraitPreview.stage.bottom <= height + 1, `${width}px portrait Roll video cannot be seen in one device viewport: ${JSON.stringify(portraitPreview)}`);
      await page.waitForTimeout(50);
      await page.locator('.reel-media-stage[data-video-layout="portrait"]').screenshot({ path:path.join(output, `roll-portrait-${width}.png`) });
      await page.locator('.reel-media-stage[data-video-layout="landscape"]').evaluate(stage => stage.scrollIntoView({ block:"center", inline:"center" }));

      if (width <= 700) {
        await page.locator('.story[data-story-id="safe-zone-story"] .story-open').click();
        await page.locator(".story-viewer[open]").waitFor();
        await page.locator(".story-viewer-media img").waitFor();
        const storyGeometry = await page.evaluate(() => {
          const bounds = selector => {
            const rect = document.querySelector(selector).getBoundingClientRect();
            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
          };
          return {
            viewer: bounds(".story-viewer"),
            media: bounds(".story-viewer-media"),
            caption: bounds(".story-viewer-caption"),
            close: bounds(".story-viewer-close")
          };
        });
        assert.ok(Math.abs(storyGeometry.viewer.left) <= 1 && Math.abs(storyGeometry.viewer.top) <= 1 && Math.abs(storyGeometry.viewer.right - width) <= 1 && Math.abs(storyGeometry.viewer.bottom - height) <= 1, `${width}x${height} Daily viewer is not full viewport: ${JSON.stringify(storyGeometry)}`);
        assert.ok(Math.abs(storyGeometry.media.top - height * .13) <= 2 && Math.abs(storyGeometry.media.bottom - height * .87) <= 2, `${width}x${height} Daily media is outside its 74% safe window: ${JSON.stringify(storyGeometry)}`);
        assert.ok(Math.abs(storyGeometry.caption.top - height * .87) <= 2 && Math.abs(storyGeometry.caption.bottom - height) <= 2, `${width}x${height} Daily caption is outside the lower 13% safe zone: ${JSON.stringify(storyGeometry)}`);
        assert.ok(storyGeometry.close.width >= 44 && storyGeometry.close.height >= 44 && storyGeometry.close.bottom <= height * .13 + 2, `${width}x${height} Daily close control is not a 44px target in the top safe zone: ${JSON.stringify(storyGeometry)}`);
        await page.screenshot({ path: path.join(output, `dailies-safe-zone-${width}x${height}.png`) });
        await page.locator(".story-viewer-close").click();
        await page.waitForFunction(() => !document.querySelector(".story-viewer")?.open);
      }

      const launcher = page.locator(".roll-open");
      await launcher.scrollIntoViewIfNeeded();
      await page.waitForTimeout(50);
      const headerHit = await pointerOwner(page, ".roll-open");
      const previewBox = await page.locator(".reel-fullscreen-trigger").first().evaluate(control => {
        const box = control.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom };
      });
      assert.equal(headerHit.ownsCenter, true, `${width}px Roll header launcher is covered by ${headerHit.hit}: ${JSON.stringify({ headerHit, previewBox })}`);
      assert.ok(previewBox.top >= headerHit.box.bottom, `${width}px per-video fullscreen control overlaps the Roll header launcher: ${JSON.stringify({ headerHit, previewBox })}`);
      await page.screenshot({ path: path.join(output, `roll-launcher-${width}.png`) });

      const pageBeforeFullscreen = await page.evaluate(() => ({ href: location.href, scrollY }));
      await launcher.click();
      await page.locator(".reels-rail.roll-fullscreen").waitFor();
      await page.evaluate(() => history.back());
      await page.locator(".reels-rail:not(.roll-fullscreen)").waitFor();
      const pageAfterDeviceBack = await page.evaluate(() => ({ href: location.href, scrollY }));
      assert.equal(pageAfterDeviceBack.href, pageBeforeFullscreen.href, `${width}px device Back left the page instead of closing The Roll`);
      assert.ok(Math.abs(pageAfterDeviceBack.scrollY - pageBeforeFullscreen.scrollY) <= 2, `${width}px device Back did not restore the prior page position: ${JSON.stringify({ pageBeforeFullscreen, pageAfterDeviceBack })}`);
      await page.evaluate(() => history.forward());
      await page.locator(".reels-rail.roll-fullscreen").waitFor();
      await page.locator(".roll-close").click();
      await page.locator(".reels-rail:not(.roll-fullscreen)").waitFor();

      const preview = page.locator(".reel-fullscreen-trigger").first();
      await preview.scrollIntoViewIfNeeded();
      await page.waitForTimeout(50);
      const previewHit = await pointerOwner(page, ".reel-fullscreen-trigger");
      assert.equal(previewHit.ownsCenter, true, `${width}px per-video Roll launcher is covered by ${previewHit.hit}: ${JSON.stringify(previewHit)}`);
      await preview.click();
      await page.locator(".reels-rail.roll-fullscreen").waitFor();
      const fullscreenCloseHit = await pointerOwner(page, ".roll-fullscreen .roll-close");
      assert.equal(fullscreenCloseHit.ownsCenter, true, `${width}x${height} Roll close control is covered by ${fullscreenCloseHit.hit}: ${JSON.stringify(fullscreenCloseHit)}`);
      if (width <= 700) {
        const rollGeometry = await page.evaluate(() => {
          const bounds = selector => {
            const rect = document.querySelector(selector).getBoundingClientRect();
            return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
          };
          return {
            viewer: bounds(".reels-rail.roll-fullscreen"),
            list: bounds(".roll-fullscreen .reels-list"),
            card: bounds(".roll-fullscreen .reel-card"),
            cardStyle: (() => { const style = getComputedStyle(document.querySelector(".roll-fullscreen .reel-card")); return { margin: style.margin, border: style.border, padding: style.padding, width: style.width, boxSizing: style.boxSizing }; })(),
            heading: bounds(".roll-fullscreen .reels-heading"),
            details: bounds(".roll-fullscreen .reel-details"),
            close: bounds(".roll-fullscreen .roll-close"),
            closeIcon: (() => { const button = document.querySelector(".roll-fullscreen .roll-close"); return { requested: button?.dataset.icon || "", children: button?.childElementCount || 0, icons: [...(button?.querySelectorAll("svg") || [])].map(icon => icon.getAttribute("data-ds-icon")) }; })()
          };
        });
        assert.ok(Math.abs(rollGeometry.viewer.left) <= 1 && Math.abs(rollGeometry.viewer.top) <= 1 && Math.abs(rollGeometry.viewer.right - width) <= 1 && Math.abs(rollGeometry.viewer.bottom - height) <= 1, `${width}x${height} Roll viewer is not full viewport: ${JSON.stringify(rollGeometry)}`);
        assert.ok(Math.abs(rollGeometry.card.width - width) <= 1 && Math.abs(rollGeometry.card.height - height) <= 1, `${width}x${height} Roll card is not 100vw by 100vh: ${JSON.stringify(rollGeometry)}`);
        assert.ok(rollGeometry.heading.height >= height * .08 - 2, `${width}x${height} Roll top safe zone is too short: ${JSON.stringify(rollGeometry)}`);
        assert.ok(Math.abs(rollGeometry.details.right - width * .89) <= 2, `${width}x${height} Roll caption enters the 11vw control tray: ${JSON.stringify(rollGeometry)}`);
        assert.ok(Math.abs(rollGeometry.details.top - height * .78) <= 2 && Math.abs(rollGeometry.details.bottom - height) <= 2, `${width}x${height} Roll caption is outside the lower 22% safe zone: ${JSON.stringify(rollGeometry)}`);
        assert.ok(rollGeometry.close.width >= 44 && rollGeometry.close.height >= 44, `${width}x${height} Roll close target is below 44px: ${JSON.stringify(rollGeometry)}`);
        assert.deepEqual(rollGeometry.closeIcon, { requested: "close", children: 1, icons: ["close"] }, `${width}x${height} Roll close button contains the wrong or duplicated icon`);
        assert.equal(await page.locator(".roll-fullscreen .ds-media-control--fullscreen").evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display === "none")), true, `${width}x${height} provider fullscreen controls overlap The Roll close button`);
      }
      await page.screenshot({ path: path.join(output, `roll-fullscreen-${width}.png`) });
      await page.locator(".roll-close").click();
      await context.close();
    }
    console.log(`Roll launcher and mobile safe-zone checks passed at ${viewports.map(({ width, height }) => `${width}x${height}`).join(", ")}.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
