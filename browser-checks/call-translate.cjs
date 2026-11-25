"use strict";
// Task 21 (owner 2026-11-25: "my cousin who speaks French to be able to talk in french and shows up on my side in
// English"; "I understand many languages but not perfect conversational language"). The SYNC call screen at
// 320/360/390/430px, touch, centre taps, plus Italian and a Hebrew speaker:
//   - More → Live translation → Start asks the other phone first; nothing is streamed before it allows;
//   - once allowed, this phone streams only its own microphone (AudioEvent frames to Transcribe's signed wss address)
//     and sends its own words over the call's channel;
//   - the cousin's French arrives, is translated, and shows big in English with the French small under it, in a band
//     above the call buttons that the video ends above;
//   - ✕ on the band stops it on both phones (stop message sent, stream closed, band gone);
//   - the other side: the ask shows Allow / Not now; Allow starts its own stream, Not now says so to the caller;
//   - translation unavailable or out of minutes: one plain line, the call carries on.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/call-translate.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const LANGS = [{ code: "en", label: "English" }, { code: "it", label: "Italiano" }, { code: "fr", label: "Français" }, { code: "he", label: "עברית", rtl: true }];

async function open(browser, width, { locale = "en-US", available = true, minutesOut = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block", locale });
  const page = await context.newPage(), errors = [], calls = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.__ws = [];
    class FakeSocket {
      constructor(url) { this.url = url; this.readyState = 0; this.frames = 0; this.audio = 0; this.listeners = {}; window.__ws.push(this); setTimeout(() => { this.readyState = 1; this.emit("open", {}); }, 20); }
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
      emit(type, event) { for (const fn of this.listeners[type] || []) fn(event); }
      send(data) { this.frames += 1; const bytes = data instanceof Uint8Array ? data : new Uint8Array(data); if (new TextDecoder().decode(bytes).includes("AudioEvent")) this.audio += 1; }
      close() { this.readyState = 3; this.closed = true; }
    }
    FakeSocket.OPEN = 1; FakeSocket.CLOSED = 3;
    window.WebSocket = FakeSocket;
  });
  const cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true" };
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname, body = request.method() === "POST" ? request.postDataJSON() : null;
    const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(data) });
    if (p.startsWith("/call-translate")) calls.push({ p, body });
    if (p === "/auth/session") return reply({ authenticated: true, user: { sub: "me", email: "me@danzstak.invalid" } });
    if (!available && p.startsWith("/call-translate")) return reply({ error: "Live translation isn't available right now.", code: "unavailable" }, 503);
    if (p === "/call-translate") return reply({ available: true, languages: LANGS, minutesLeft: 60 });
    if (p === "/call-translate/stream") return minutesOut ? reply({ error: "Today's free translation minutes are used up. They come back tomorrow.", code: "minutes" }, 429) : reply({ url: "wss://transcribestreaming.us-west-1.amazonaws.com:8443/stream-transcription-websocket?language-code=en-US&X-Amz-Signature=x", language: body.language });
    if (p === "/call-translate/text") return reply({ texts: body.texts.map(text => text === "On se voit vendredi au club" ? "See you Friday at the club" : `[${body.to}] ${text}`) });
    if (p === "/call-translate/minute") return reply({ minutesLeft: 59 });
    return reply({});
  });
  await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.danzstakCallTranslate && document.getElementById("callMore"), null, { timeout: 10000 });
  // A connected video call: the real microphone (fake device) and a stubbed open data channel.
  await page.evaluate(() => { document.body.dataset.callMode = "video"; document.getElementById("videoGrid").hidden = false; document.getElementById("mediaControls").hidden = false; });
  await page.evaluate("(async () => { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); channel = { readyState: 'open', send(data) { (window.__sent ||= []).push(JSON.parse(data)); } }; })()");
  // The other person's camera (the browser's fake one) fills the screen, as on a connected video call.
  await page.evaluate(async () => { const cam = await navigator.mediaDevices.getUserMedia({ video: { width: 720, height: 1280 } }); const remote = document.getElementById("remoteVideo"); remote.srcObject = cam; remote.muted = true; await remote.play().catch(() => {}); document.body.dataset.callConnected = "1"; });
  return { context, page, errors, calls };
}

async function centreTap(page, selector, tag) {
  const spot = await page.evaluate(sel => {
    const node = document.querySelector(sel); if (!node) return null;
    const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, w: r.width, h: r.height, hit: Boolean(top && (top === node || node.contains(top))) };
  }, selector);
  assert.ok(spot, `${tag}: ${selector} exists`);
  assert.ok(spot.hit, `${tag}: ${selector} is covered at its centre (${JSON.stringify(spot)})`);
  assert.ok(spot.w >= 44 && spot.h >= 44, `${tag}: ${selector} is a 44px target (${JSON.stringify(spot)})`);
  await page.touchscreen.tap(spot.x, spot.y);
}
const sent = page => page.evaluate(() => window.__sent || []);
async function openFromMore(page, tag, label = "Live translation") {
  await centreTap(page, "#callMore", tag);
  await page.waitForSelector("#callSheet .ds-call-sheet-row");
  const index = await page.$$eval("#callSheet .ds-call-sheet-row", (rows, want) => rows.findIndex(row => row.textContent.trim() === want), label);
  assert.equal(index, 0, `${tag}: ${label} is the first thing in More`);
  await centreTap(page, "#callSheet .ds-call-sheet-row", tag);
}

(async () => {
  const browser = await chromium.launch({ ...(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? {} : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge" }), headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  try {
    for (const width of [320, 360, 390, 430]) {
      const tag = `${width}px`, { context, page, errors, calls } = await open(browser, width);
      const gridBefore = await page.evaluate(() => { const r = document.getElementById("videoGrid").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height }; });
      // Shawn turns it on.
      await openFromMore(page, tag);
      await page.waitForSelector(".call-translate-sheet #callTranslateLanguage");
      assert.equal(await page.inputValue("#callTranslateLanguage"), "en");
      await centreTap(page, ".call-translate-go", tag);
      await page.waitForFunction(() => (window.__sent || []).some(m => m.type === "call-translate-ask"));
      assert.deepEqual((await sent(page)).find(m => m.type === "call-translate-ask"), { type: "call-translate-ask", lang: "en" });
      assert.equal(await page.evaluate(() => window.__ws.length), 0, `${tag}: nothing is streamed before the other person allows`);
      assert.ok(!calls.some(c => c.p === "/call-translate/stream"), `${tag}: no stream address before they allow`);
      assert.match(await page.textContent(".call-captions-label"), /Waiting for .* to allow live translation/);
      // Marcel allows (French).
      await page.evaluate(() => window.danzstakCallTranslate.receive(JSON.stringify({ type: "call-translate-ok", lang: "fr" }), "Marcel Dupont"));
      await page.waitForFunction(() => window.__ws[0]?.audio > 2, null, { timeout: 10000 });
      assert.deepEqual(calls.find(c => c.p === "/call-translate/stream").body, { language: "en" }, `${tag}: only my own language, my own mic`);
      assert.match(await page.evaluate(() => window.__ws[0].url), /^wss:\/\/transcribestreaming\.us-west-1\.amazonaws\.com:8443\//);
      // My own words go to Marcel over the call's channel.
      await page.evaluate(() => {
        const { encodeEvent } = window.danzstakCallTranslate._eventStream;
        const frame = encodeEvent({ ":event-type": "TranscriptEvent", ":message-type": "event", ":content-type": "application/json" }, new TextEncoder().encode(JSON.stringify({ Transcript: { Results: [{ ResultId: "me-1", IsPartial: false, Alternatives: [{ Transcript: "See you Friday" }] }] } })));
        window.__ws[0].emit("message", { data: frame.buffer });
      });
      assert.deepEqual((await sent(page)).filter(m => m.type === "call-translate-text").at(-1), { type: "call-translate-text", id: "me-1", text: "See you Friday", final: true, lang: "en" });
      // Marcel's French shows up in English.
      await page.evaluate(() => window.danzstakCallTranslate.receive(JSON.stringify({ type: "call-translate-text", id: "c-1", text: "On se voit vendredi au club", final: true, lang: "fr" }), "Marcel Dupont"));
      await page.waitForFunction(() => document.querySelector(".call-caption-text")?.textContent === "See you Friday at the club");
      await page.waitForTimeout(350); // the video's bottom edge slides up in 0.2 s
      const box = await page.evaluate(() => {
        const band = document.querySelector(".call-captions").getBoundingClientRect(), controls = document.getElementById("mediaControls").getBoundingClientRect(), grid = document.getElementById("videoGrid").getBoundingClientRect();
        return { original: document.querySelector(".call-caption-original").textContent, label: document.querySelector(".call-captions-label").textContent, top: band.top, bottom: band.bottom, left: band.left, right: band.right, controlsTop: controls.top, gridBottom: grid.bottom, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      });
      assert.equal(box.original, "On se voit vendredi au club", `${tag}: the French stays, small, under the English`);
      assert.match(box.label, /FR → EN/);
      if (process.env.SHOT) await page.screenshot({ path: `/tmp/claude-0/shots/ct-${width}.png` });
      assert.ok(box.bottom <= box.controlsTop + 1 && box.left >= 0 && box.right <= width, `${tag}: captions above the call buttons, on screen (${JSON.stringify(box)})`);
      assert.ok(Math.abs(box.gridBottom - gridBefore.bottom) < 1, `${tag}: the video keeps its full size under the captions (${JSON.stringify({ box, gridBefore })})`);
      assert.ok(box.top >= gridBefore.top && box.bottom <= gridBefore.bottom + 1, `${tag}: the captions sit over the picture, as subtitles`);
      const shade = await page.evaluate(() => { const cs = getComputedStyle(document.querySelector(".call-captions")); return { image: cs.backgroundImage, filter: cs.backdropFilter }; });
      assert.match(shade.image, /gradient/, `${tag}: a soft shade, not a box`);
      const status = await page.evaluate(() => { const node = document.querySelector(".conversation-status"); if (!node || !node.textContent.trim() || getComputedStyle(node).visibility === "hidden") return null; const r = node.getBoundingClientRect(), c = document.querySelector(".call-captions").getBoundingClientRect(); return { bottom: r.bottom, captionsTop: c.top }; });
      if (status) assert.ok(status.bottom <= status.captionsTop + 1, `${tag}: the status line sits above the captions, never behind them (${JSON.stringify(status)})`);
      assert.ok(!/blur/.test(shade.filter), `${tag}: the video isn't blurred behind the captions`);
      assert.ok(box.overflow <= 0, `${tag}: nothing wider than the screen`);
      assert.deepEqual(calls.filter(c => c.p === "/call-translate/text").at(-1).body, { texts: ["On se voit vendredi au club"], from: "fr", to: "en" });
      if (width === 390) await page.screenshot({ path: "docs/screenshots/call-translate-390.png" });
      // The call buttons step aside: the captions drop to the bottom edge, the video stays full.
      await page.evaluate(() => { document.body.dataset.callChrome = "hidden"; });
      await page.waitForTimeout(300);
      const low = await page.evaluate(() => document.querySelector(".call-captions").getBoundingClientRect().bottom);
      assert.ok(low >= 800 - 16 && low <= 800, `${tag}: captions at the bottom edge while the buttons are hidden (${low})`);
      if (width === 390) await page.screenshot({ path: "docs/screenshots/call-translate-390-buttons-hidden.png" });
      await page.evaluate(() => { delete document.body.dataset.callChrome; });
      await page.waitForTimeout(300); // the captions slide back up in 0.2 s
      // Stop: both phones.
      await centreTap(page, ".call-captions-stop", tag);
      assert.equal((await sent(page)).at(-1).type, "call-translate-stop");
      assert.equal(await page.evaluate(() => window.__ws[0].closed), true, `${tag}: the stream closes`);
      assert.equal(await page.locator(".call-captions").count(), 0);
      assert.equal(await page.evaluate(() => window.danzstakCallTranslate.isOn()), false);
      // Text that arrives after stopping never shows.
      await page.evaluate(() => window.danzstakCallTranslate.receive(JSON.stringify({ type: "call-translate-text", id: "c-2", text: "encore", final: true, lang: "fr" }), "Marcel"));
      assert.equal(await page.locator(".call-captions").count(), 0);

      // The other side: Marcel's phone is asked.
      await page.evaluate(() => { window.__sent = []; window.danzstakCallTranslate.receive(JSON.stringify({ type: "call-translate-ask", lang: "fr" }), "Marcel Dupont"); });
      await page.waitForSelector(".call-translate-sheet.is-prompt");
      assert.match(await page.textContent(".call-translate-sheet.is-prompt strong"), /Marcel turned on live translation/);
      if (width === 360) {
        await centreTap(page, ".call-translate-sheet.is-prompt .call-translate-quiet", tag);
        assert.deepEqual((await sent(page)).at(-1), { type: "call-translate-no" });
        await page.evaluate(() => window.danzstakCallTranslate.receive(JSON.stringify({ type: "call-translate-ask", lang: "fr" }), "Marcel Dupont"));
        await page.waitForSelector(".call-translate-sheet.is-prompt");
      }
      const before = await page.evaluate(() => window.__ws.length);
      await centreTap(page, ".call-translate-sheet.is-prompt .call-translate-go", tag);
      await page.waitForFunction(n => window.__ws.length > n && window.__ws.at(-1).audio > 0, before, { timeout: 10000 });
      assert.deepEqual((await sent(page)).find(m => m.type === "call-translate-ok"), { type: "call-translate-ok", lang: "en" });
      // The call ends: everything stops.
      await page.evaluate(() => { document.getElementById("mediaControls").hidden = true; });
      await page.waitForFunction(() => !window.danzstakCallTranslate.isOn() && window.__ws.at(-1).closed);
      assert.deepEqual(errors, [], `${tag}: no page errors`);
      await context.close();
    }

    // Unavailable (AWS off) and out of minutes: one plain line, nothing streamed.
    {
      const { context, page, errors } = await open(browser, 390, { available: false });
      await openFromMore(page, "unavailable");
      await page.waitForFunction(() => /isn't available right now/.test(document.querySelector(".call-translate-status")?.textContent || ""));
      assert.equal(await page.evaluate(() => window.__ws.length), 0);
      assert.deepEqual(errors, []);
      await context.close();
    }
    {
      const { context, page, errors } = await open(browser, 390, { minutesOut: true });
      await page.evaluate(() => window.danzstakCallTranslate.receive(JSON.stringify({ type: "call-translate-ask", lang: "fr" }), "Marcel"));
      await page.waitForSelector(".call-translate-sheet.is-prompt .call-translate-go");
      await centreTap(page, ".call-translate-sheet.is-prompt .call-translate-go", "minutes");
      await page.waitForFunction(() => /free translation minutes are used up/.test(document.querySelector(".call-captions-label")?.textContent || ""));
      assert.equal(await page.evaluate(() => window.__ws.length), 0);
      assert.equal((await sent(page)).at(-1).type, "call-translate-stop");
      assert.deepEqual(errors, []);
      await context.close();
    }
    // Italian screen, Hebrew speaker: words in Italian, Hebrew written right to left.
    {
      const { context, page, errors } = await open(browser, 390, { locale: "it-IT" });
      await page.evaluate(() => { try { localStorage.setItem("danzstak_language", "it"); } catch {} });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.documentElement.lang.startsWith("it") && window.danzstakCallTranslate && document.getElementById("callMore"));
      await page.evaluate(() => { document.body.dataset.callMode = "video"; document.getElementById("videoGrid").hidden = false; document.getElementById("mediaControls").hidden = false; });
      await page.evaluate("(async () => { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); channel = { readyState: 'open', send(data) { (window.__sent ||= []).push(JSON.parse(data)); } }; })()");
      await openFromMore(page, "it", "Traduzione dal vivo");
      await page.waitForSelector("#callTranslateLanguage");
      assert.equal(await page.inputValue("#callTranslateLanguage"), "it", "the app's language is the default");
      await centreTap(page, ".call-translate-go", "it");
      await page.waitForFunction(() => /In attesa che/.test(document.querySelector(".call-captions-label")?.textContent || ""));
      await page.evaluate(() => window.danzstakCallTranslate.receive(JSON.stringify({ type: "call-translate-ok", lang: "he" }), "Dana"));
      await page.waitForFunction(() => window.__ws[0]?.audio > 0, null, { timeout: 10000 });
      await page.evaluate(() => window.danzstakCallTranslate.receive(JSON.stringify({ type: "call-translate-text", id: "h-1", text: "נתראה ביום שישי", final: true, lang: "he" }), "Dana"));
      await page.waitForFunction(() => document.querySelector(".call-caption-text")?.textContent === "[it] נתראה ביום שישי");
      assert.equal(await page.getAttribute(".call-caption-original", "dir"), "rtl", "Hebrew is written right to left");
      assert.equal(await page.getAttribute(".call-caption-text", "dir"), "ltr");
      assert.match(await page.textContent(".call-captions-label"), /Traduzione dal vivo · HE → IT/);
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log("Call translation browser checks passed (320-430px, Italian, Hebrew).");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
