"use strict";
// SYNC video call screen (fix-it "Call screen"), real Edge, phones at 360/390 and a 1280 computer. The call UI is put in
// video mode with canvas streams (no network media); signalling and devices are not involved.
// - received video fills the screen edge to edge (cover); double-tap → whole picture (contain) and back;
// - subtitles on → the video ends above a bottom band, controls move up, the band is visible; off → no band;
// - own camera: touch long-press + drag snaps to the nearest corner, is remembered across reloads; a plain swipe doesn't
//   move it; mouse drag works on computers; a quick tap swaps big/small; it never overlaps the call buttons.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8158 node browser-checks/sync-call-screen.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8158").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-call-screen");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
async function shot(page, name) { try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); } catch (error) { console.error("screenshot", name, String(error.message).slice(0, 120)); } }
const startVideoCall = () => {
  const paint = (color, label, w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); const draw = () => { g.fillStyle = color; g.fillRect(0, 0, w, h); g.fillStyle = "#fff"; g.beginPath(); g.arc(w / 2, h * 0.38, Math.min(w, h) * 0.18, 0, 7); g.fill(); g.font = `${Math.round(h / 12)}px sans-serif`; g.fillText(label, 20, h - 30); }; draw(); setInterval(draw, 200); return c.captureStream(10); };
  document.body.dataset.callMode = "video"; document.body.dataset.syncScreen = "video-call"; document.body.classList.add("is-conversation-open");
  document.getElementById("videoGrid").hidden = false; document.getElementById("mediaControls").hidden = false;
  document.getElementById("remoteVideo").srcObject = paint("#1f6a7a", "SFScoop", 720, 1280);
  document.getElementById("localVideo").srcObject = paint("#7a1f6a", "You", 480, 640);
};
const rect = (page, sel) => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
const overlap = (a, b) => !(a.r <= b.x || b.r <= a.x || a.b <= b.y || b.b <= a.y);

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const [width, height, phone] of [[360, 780, true], [390, 844, true], [1280, 800, false]]) {
      const label = `${width}px`;
      const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block", hasTouch: phone, isMobile: phone, deviceScaleFactor: 2 });
      await context.route("https://api.danzstak.com/**", route => route.fulfill(json(new URL(route.request().url()).pathname === "/auth/session" ? { authenticated: true, user: { sub: "x", email: "me@danzstak.test" } } : {})));
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakCallScreen);
      await page.evaluate(() => localStorage.removeItem("danzstak_call_pip_corner"));
      await page.evaluate(startVideoCall);
      await page.waitForTimeout(500);
      // Full screen, cover.
      const big = await rect(page, "#remoteVideo"), vp = page.viewportSize();
      if (big.x > 0.5 || big.y > 0.5 || Math.abs(big.w - vp.width) > 1 || Math.abs(big.b - vp.height) > 1) failures.push(`${label}: received video is not edge to edge (${JSON.stringify(big)})`);
      if (await page.evaluate(() => getComputedStyle(document.getElementById("remoteVideo")).objectFit) !== "cover") failures.push(`${label}: received video not cover`);
      if (await page.evaluate(() => !document.getElementById("callSubtitles").hidden || getComputedStyle(document.getElementById("callSubtitles")).display !== "none")) failures.push(`${label}: subtitle band shows while subtitles are off`);
      await shot(page, `1-full-screen-${width}`);
      // Never over the buttons, every corner.
      const controls = await rect(page, "#mediaControls");
      for (const c of ["tl", "tr", "bl", "br"]) {
        await page.evaluate(c => window.danzstakCallScreen.setCorner(c), c); await page.waitForTimeout(250);
        const small = await rect(page, ".local-video");
        if (overlap(small, controls)) failures.push(`${label}: own camera over the call buttons in ${c}`);
        if (small.x < 0 || small.r > vp.width || small.y < 0 || small.b > vp.height) failures.push(`${label}: own camera off screen in ${c}`);
      }
      await page.evaluate(() => window.danzstakCallScreen.setCorner("tr"));
      await page.waitForTimeout(250);
      // Drag to bottom-left.
      const s = await rect(page, ".local-video"), from = { x: s.x + s.w / 2, y: s.y + s.h / 2 }, to = { x: 40, y: vp.height - 220 };
      if (phone) {
        await page.locator(".local-video").evaluate(async (el, { from, to }) => {
          const ev = (type, p) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: "touch", pointerId: 3, clientX: p.x, clientY: p.y, isPrimary: true }));
          ev("pointerdown", from); await new Promise(r => setTimeout(r, 380));
          for (let i = 1; i <= 8; i++) ev("pointermove", { x: from.x + (to.x - from.x) * i / 8, y: from.y + (to.y - from.y) * i / 8 });
          ev("pointerup", to);
        }, { from, to });
      } else {
        await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up();
      }
      await page.waitForTimeout(300);
      if (await page.evaluate(() => window.danzstakCallScreen.corner()) !== "bl") failures.push(`${label}: drag did not snap to bottom-left (${await page.evaluate(() => window.danzstakCallScreen.corner())})`);
      const snapped = await rect(page, ".local-video");
      if (overlap(snapped, await rect(page, "#mediaControls"))) failures.push(`${label}: snapped window covers the buttons`);
      await shot(page, `2-moved-bottom-left-${width}`);
      if (phone) {
        // A quick swipe (no hold) must not move it.
        const q = await rect(page, ".local-video");
        await page.locator(".local-video").evaluate((el, q) => { const ev = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "touch", pointerId: 4, clientX: x, clientY: y })); ev("pointerdown", q.x + 20, q.y + 20); for (let i = 1; i <= 6; i++) ev("pointermove", q.x + 20 + i * 30, q.y + 20 - i * 40); ev("pointerup", q.x + 200, q.y - 220); }, q);
        await page.waitForTimeout(250);
        if (await page.evaluate(() => window.danzstakCallScreen.corner()) !== "bl") failures.push(`${label}: a quick swipe moved the window`);
      }
      // Quick tap → swap; tap again → back.
      const tapAt = await rect(page, ".local-video");
      await page.locator(".local-video").evaluate((el, r) => { const ev = type => el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "mouse", pointerId: 5, button: 0, clientX: r.x + 10, clientY: r.y + 10 })); ev("pointerdown"); ev("pointerup"); }, tapAt);
      const swapped = await page.evaluate(() => { const l = document.getElementById("localVideo").getBoundingClientRect(); return { swapped: document.getElementById("videoGrid").dataset.swapped, w: l.width }; });
      if (swapped.swapped !== "1" || Math.abs(swapped.w - vp.width) > 1) failures.push(`${label}: tap did not swap to your camera big ${JSON.stringify(swapped)}`);
      await shot(page, `3-swapped-${width}`);
      await page.evaluate(() => window.danzstakCallScreen.swap());
      // Double-tap the big video → contain, again → cover.
      const center = { x: vp.width / 2, y: vp.height / 3 };
      const dbl = () => page.evaluate(c => { const g = document.getElementById("videoGrid"); for (let i = 0; i < 2; i++) g.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerType: "touch", clientX: c.x, clientY: c.y })); }, center);
      await dbl();
      if (await page.evaluate(() => getComputedStyle(document.getElementById("remoteVideo")).objectFit) !== "contain") failures.push(`${label}: double-tap did not fit the whole picture`);
      await shot(page, `4-fit-${width}`);
      await page.waitForTimeout(400); await dbl();
      if (await page.evaluate(() => getComputedStyle(document.getElementById("remoteVideo")).objectFit) !== "cover") failures.push(`${label}: double-tap again did not fill the screen`);
      // Subtitles on → band at the bottom, video and buttons above it.
      await page.evaluate(() => { window.danzstakCallScreen.setSubtitles(true); window.danzstakCallScreen.showSubtitle("Ciao! Il soundcheck è alle cinque."); });
      await page.waitForTimeout(250);
      const band = await rect(page, "#callSubtitles"), video = await rect(page, "#remoteVideo"), ctrl = await rect(page, "#mediaControls");
      if (band.h < 80 || Math.abs(band.b - vp.height) > 1) failures.push(`${label}: subtitle band missing (${JSON.stringify(band)})`);
      if (video.b > band.y + 1) failures.push(`${label}: video runs under the subtitles`);
      if (ctrl.b > band.y + 1) failures.push(`${label}: buttons sit on the subtitles`);
      if (overlap(await rect(page, ".local-video"), ctrl)) failures.push(`${label}: own camera over the buttons with subtitles on`);
      await shot(page, `5-subtitles-${width}`);
      await page.evaluate(() => window.danzstakCallScreen.setSubtitles(false));
      // Remembered corner.
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakCallScreen);
      if (await page.evaluate(() => window.danzstakCallScreen.corner()) !== "bl") failures.push(`${label}: corner not remembered`);
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(`SYNC call screen: ${failures.length} problem(s)\n- ${[...new Set(failures)].join("\n- ")}`); process.exitCode = 1; return; }
  console.log("SYNC call screen checks passed (360, 390, 1280): full-screen cover, double-tap fit, subtitle band only when on, long-press/mouse drag snaps to a corner and is remembered, swipe doesn't move it, tap swaps, never over the buttons.");
})().catch(error => { console.error(error); process.exitCode = 1; });
