"use strict";
// Queue 5a1 done-when: tap a Mix photo, swipe twice, press Back and land on the same scroll Y.
// Screenshots: DANZSTAK_CAPTURE_DIR=docs/screenshots/media-viewer node browser-checks/media-viewer.cjs
// Also: media only (no post text), swipes stay within the same member's photos, videos open
// muted and playing with the lower-right sound toggle, and Esc closes on computers.
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const asset = name => path.resolve(__dirname, "..", "assets", name);
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";

function pagePosts() {
  const rows = [];
  const colors = ["#ff5a1f", "#1f8bff", "#2ecc71", "#c0392b", "#8e44ad", "#f1c40f", "#16a085"];
  for (let i = 0; i < 7; i++) {
    const author = i % 3 === 2 ? B : A;
    rows.push(`<article class="post" data-author-member-id="${author}"><div class="post-header"><a class="post-author">${author === A ? "Ana" : "Bo"}</a></div><p class="post-content">Post text ${i}</p><img class="post-media" alt="photo ${i}" data-color="${colors[i]}"><div class="post-actions">like</div></article>`);
  }
  rows.push(`<article class="post" data-author-member-id="${A}"><p class="post-content">Video post</p><video class="post-media" id="vid" playsinline controls></video><div class="post-actions">like</div></article>`);
  return rows.join("");
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [320, 360, 390, 414, 430]) {
      const page = await browser.newPage({ viewport: { width, height: 760 }, hasTouch: true });
      await page.setContent(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
        body{margin:0;font:14px sans-serif} #feed{display:grid;gap:12px} .post{background:#fff;padding:0 0 8px}
        .post-media{display:block;width:100%;height:300px;object-fit:cover;background:#222}
      </style></head><body><main id="feed">${pagePosts()}</main><script>
        window.danzstakIcons = { upgrade() {}, create() { return document.createElement('span'); } };
        for (const img of document.querySelectorAll('img.post-media')) {
          const c = document.createElement('canvas'); c.width = 400; c.height = 300;
          const g = c.getContext('2d'); g.fillStyle = img.dataset.color; g.fillRect(0, 0, 400, 300);
          g.fillStyle = '#fff'; g.font = '48px sans-serif'; g.fillText(img.alt, 40, 160);
          img.src = c.toDataURL();
        }
        const v = document.getElementById('vid'), c = document.createElement('canvas'); c.width = 32; c.height = 18;
        c.getContext('2d').fillRect(0, 0, 32, 18);
        v.src = c.toDataURL(); // a src so the viewer accepts it; playback is stubbed below
        HTMLMediaElement.prototype.play = function () { Object.defineProperty(this, 'paused', { value: false, configurable: true }); return Promise.resolve(); };
        HTMLMediaElement.prototype.pause = function () { Object.defineProperty(this, 'paused', { value: true, configurable: true }); };
      </script></body></html>`);
      await page.addScriptTag({ path: asset("media-visibility.js") });
      await page.addStyleTag({ path: asset("media-viewer.css") });
      await page.addScriptTag({ path: asset("media-viewer.js") });
      await page.evaluate(() => history.replaceState({ feed: true }, ""));

      // Scroll to the 4th photo (Ana's third photo: index 0,1,3,4,6 are Ana's).
      await page.evaluate(() => document.querySelectorAll("img.post-media")[3].scrollIntoView({ block: "center" }));
      const scrollY = await page.evaluate(() => window.scrollY);
      assert.ok(scrollY > 300, "the check starts part-way down Mix");
      await page.locator("img.post-media").nth(3).click();
      await page.waitForSelector(".ds-media-viewer");
      const opened = await page.evaluate(() => ({
        count: document.querySelector(".ds-media-viewer-count").textContent,
        slides: [...document.querySelectorAll(".ds-media-viewer-slide img")].map(i => i.alt),
        text: document.querySelector(".ds-media-viewer").textContent.trim(),
        state: history.state?.danzstakMediaViewer === true
      }));
      assert.deepEqual(opened.slides, ["photo 0", "photo 1", "photo 3", "photo 4", "photo 6"], "only Ana's photos, in feed order");
      assert.equal(opened.count, "3 / 5", "opens on the tapped photo");
      assert.ok(!/Post text|like/.test(opened.text), "media only: no post text or reaction rows");
      assert.ok(opened.state, "opening adds one history entry");
      const rect = await page.evaluate(() => { const r = document.querySelector(".ds-media-viewer").getBoundingClientRect(); return [r.width, r.height]; });
      assert.deepEqual(rect, [width, 760], "the viewer fills the screen");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      assert.equal(overflow, false, "no horizontal page overflow");

      // Owner 2026-11-19: vertical swipes, like Reels. Up = next, down = previous; sideways does nothing.
      const swipe = async (dy, dx = 0) => {
        const x = width / 2, y0 = 380 + (dy < 0 ? 120 : -120);
        await page.mouse.move(x, y0); await page.mouse.down();
        for (let i = 1; i <= 8; i++) await page.mouse.move(x + dx * i / 8, y0 + dy * i / 8);
        await page.mouse.up();
        await page.waitForTimeout(320);
      };
      await swipe(-240);
      await swipe(-240);
      assert.equal(await page.evaluate(() => document.querySelector(".ds-media-viewer-count").textContent), "5 / 5", "two swipes up move two photos on");
      if (captureDir) await page.screenshot({ path: path.join(captureDir, `media-viewer-${width}.png`) });
      await swipe(240);
      assert.equal(await page.evaluate(() => globalThis.danzstakMediaViewer.index()), 3, "swipe down goes back one");
      await swipe(0, -220);
      assert.equal(await page.evaluate(() => globalThis.danzstakMediaViewer.index()), 3, "a sideways swipe does not move (vertical only)");
      const slideTop = await page.evaluate(() => { const s = document.querySelectorAll(".ds-media-viewer-slide")[globalThis.danzstakMediaViewer.index()].getBoundingClientRect(); return [Math.round(s.top), Math.round(s.left)]; });
      assert.deepEqual(slideTop, [0, 0], "the current photo fills the screen after a vertical move");

      await page.goBack();
      await page.waitForFunction(() => !document.querySelector(".ds-media-viewer"));
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => window.scrollY), scrollY, "Back returns to the same scroll spot");
      assert.equal(await page.evaluate(() => history.state?.feed === true && !history.state.danzstakMediaViewer), true, "Back unwinds the viewer entry only");
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains("ds-media-viewer-open")), false, "page scroll unlocked");

      // Keyboard on computers: Enter opens a focused photo, arrows move, Esc closes.
      await page.locator("img.post-media").nth(0).focus();
      await page.keyboard.press("Enter");
      await page.waitForSelector(".ds-media-viewer");
      await page.keyboard.press("ArrowDown");
      assert.equal(await page.evaluate(() => globalThis.danzstakMediaViewer.index()), 1, "arrow keys move");
      await page.keyboard.press("ArrowUp");
      assert.equal(await page.evaluate(() => globalThis.danzstakMediaViewer.index()), 0);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector(".ds-media-viewer"));

      // Swipe down on the first photo closes.
      await page.locator("img.post-media").nth(0).click();
      await page.waitForSelector(".ds-media-viewer");
      await page.mouse.move(width / 2, 200); await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(width / 2, 200 + 25 * i);
      await page.mouse.up();
      await page.waitForFunction(() => !document.querySelector(".ds-media-viewer"));

      // A video opens full screen, muted, playing, with the lower-right sound toggle.
      await page.evaluate(() => document.getElementById("vid").scrollIntoView({ block: "center" }));
      await page.locator("#vid").click({ position: { x: 40, y: 40 } });
      await page.waitForSelector(".ds-media-viewer video");
      await page.waitForTimeout(150);
      const video = await page.evaluate(() => {
        const v = document.querySelector(".ds-media-viewer video");
        const t = document.querySelector(".ds-media-viewer .danzstak-audio-toggle");
        const r = t?.getBoundingClientRect();
        return { muted: v.muted, paused: v.paused, toggle: Boolean(t), right: r ? innerWidth - r.right : -1, bottom: r ? innerHeight - r.bottom : -1, inlinePaused: document.getElementById("vid").paused };
      });
      assert.equal(video.muted, true, "video starts muted");
      assert.equal(video.paused, false, "video plays");
      assert.ok(video.toggle && video.right < 40 && video.bottom < 60, "sound toggle sits lower-right");
      assert.equal(video.inlinePaused, true, "only one player: the inline one is paused");
      await page.locator(".ds-media-viewer-close").click();
      await page.waitForFunction(() => !document.querySelector(".ds-media-viewer"));
      await page.close();
    }
    console.log("Media viewer browser check passed at 320, 360, 390, 414 and 430px: same member's photos, vertical swipes (up ×2, down, sideways ignored), Back to the same scroll Y, keys, swipe-down on the first closes, muted video with sound toggle.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
