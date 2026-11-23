"use strict";
// Task 30 (owner 2026-11-18): a 5th call button, Text; the note shows until the other person closes it.
// L3 (owner 2026-11-19): "the text box works in the callers side over video but not on the receivers side … make the
// video a little smaller and put the text box on the bottom". The receiver part below answers a real call (a second
// RTCPeerConnection plays the caller, with its own data channel) on voice and video at 360/390px: the note must be on
// screen, hit by a tap at its centre, above the call buttons, below the video (which ends above it), and confirmed back
// to the caller; the sender shows "Sent ✓" only after that confirmation, and "Not delivered" without it.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8017 node browser-checks/call-note.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  try {
    for (const width of [320, 360, 390, 430]) {
      const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("https://api.danzstak.com/**", route => { const p = new URL(route.request().url()).pathname; return route.fulfill(json(p === "/auth/session" ? { authenticated: true, user: { sub: "me", email: "me@danzstak.invalid" } } : {})); });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator("#callNoteButton").waitFor({ state: "attached", timeout: 10000 });
      // A connected video call with an open data channel (stubbed).
      await page.evaluate(() => { document.body.dataset.callMode = "video"; document.getElementById("videoGrid").hidden = false; document.getElementById("mediaControls").hidden = false; });
      await page.evaluate("channel = { readyState: 'open', send(data) { window.__sent = data; } }");
      // F15k: the note is reached from More (the six-button call panel), as a member does it.
      const panel = await page.evaluate(() => [...document.querySelectorAll(".ds-call-keys .ds-call-key > button")].map(b => { const r = b.getBoundingClientRect(); return { id: b.id, l: r.left, r: r.right, w: r.width, h: r.height }; }));
      assert.ok(panel.length === 6 && panel.every(b => b.l >= 0 && b.r <= width && b.w >= 44 && b.h >= 44), `${width}px: the call panel's six buttons fit, 44px+ (${JSON.stringify(panel)})`);
      const openNote = async () => { await page.locator("#callMore").click(); await page.locator("#callSheet .ds-call-sheet-row", { hasText: "Text note" }).click(); };
      await openNote();
      await page.locator(".call-note-sheet textarea").fill("Soundcheck at 5 <img src=x onerror=alert(1)>");
      await page.locator(".call-note-send").click();
      const sent = JSON.parse(await page.evaluate(() => window.__sent));
      assert.equal(sent.type, "call-note"); assert.match(sent.text, /^Soundcheck at 5/);
      const status = () => page.evaluate(() => document.querySelector(".call-note-status")?.textContent || "");
      assert.equal(await status(), "Sending…", `${width}px: not "Sent" before the other phone confirms`);
      await page.evaluate(id => window.danzstakCallNote.receive(JSON.stringify({ type: "call-note-ack", id }), "Mary Smith"), sent.id);
      assert.equal(await status(), "Sent ✓", `${width}px: Sent ✓ once confirmed`);
      await page.locator(".call-note-sheet").waitFor({ state: "detached", timeout: 3000 });
      if (width === 360) { // no confirmation → says so, and keeps the text to try again
        await page.waitForTimeout(2100);
        await openNote();
        await page.locator(".call-note-sheet textarea").fill("Bring the merch");
        await page.locator(".call-note-send").click();
        await page.waitForFunction(() => document.querySelector(".call-note-status")?.textContent === "Not delivered, try again", null, { timeout: 6000 });
        assert.equal(await page.locator(".call-note-sheet textarea").inputValue(), "Bring the merch", "the undelivered text stays in the box");
        await page.locator(".call-note-close").click();
      }
      // The other side receives it over its video.
      const handled = await page.evaluate(raw => window.danzstakCallNote.receive(raw, "Mary Smith"), JSON.stringify({ type: "call-note", id: "x", text: "Running 10 min late <b>sorry</b>", sentAt: Date.now() }));
      assert.equal(handled, true);
      const overlay = await page.evaluate(() => { const o = document.querySelector(".call-note-overlay"), c = document.getElementById("mediaControls").getBoundingClientRect(), r = o.getBoundingClientRect(); return { text: o.querySelector(".call-note-text").textContent, html: o.querySelector(".call-note-text").innerHTML, from: o.querySelector(".call-note-from").textContent, bottom: r.bottom, controlsTop: c.top, left: r.left, right: r.right }; });
      assert.equal(overlay.text, "Running 10 min late <b>sorry</b>", `${width}px: text only`);
      assert.doesNotMatch(overlay.html, /<b>/, `${width}px: no HTML rendered`);
      assert.equal(overlay.from, "Mary");
      assert.ok(overlay.bottom <= overlay.controlsTop && overlay.left >= 0 && overlay.right <= width, `${width}px: note sits above the controls, on screen (${JSON.stringify(overlay)})`);
      assert.equal(await page.evaluate(() => window.danzstakCallNote.receive("plain text", "x")), false, "plain chat messages still go to the chat");
      if (width === 390) { await page.waitForTimeout(900); await page.screenshot({ path: "docs/screenshots/call-note-390.png" }); }
      await page.locator(".call-note-dismiss").click();
      assert.equal(await page.locator(".call-note-overlay").count(), 0, `${width}px: ✕ closes the note`);
      assert.deepEqual(errors, [], `${width}px page errors`);
      await context.close();
    }

    // L3: the receiver, on a real call.
    for (const kind of ["audio", "video"]) for (const width of [360, 390]) {
      const label = `${kind} ${width}px receiver`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true, serviceWorkers: "block", permissions: ["camera", "microphone"] });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "me@danzstak.invalid" } }));
        if (p === "/conversations") return route.fulfill(json({ conversations: [{ contactEmail: "mary@danzstak.invalid", memberId: "00000000-0000-4000-8000-000000000002", name: "Mary Smith", preview: "Ready", updatedAt: "2026-11-19T12:00:00.000Z", canContact: true }] }));
        if (p === "/calls/ice") return route.fulfill(json({ iceServers: [], expiresAt: Date.now() + 300000 }));
        if (p === "/calls/inbox") return route.fulfill(json({ events: [] }));
        return route.fulfill(json({}));
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().click();
      await page.locator("body.is-conversation-open").waitFor();
      const acks = await page.evaluate(async kind => {
        const wait = async (ok, ms, what) => { const t0 = performance.now(); while (!ok()) { if (performance.now() - t0 > ms) throw new Error(what); await new Promise(r => setTimeout(r, 50)); } };
        document.getElementById("contactEmail").value = "mary@danzstak.invalid"; window.danzstakActiveContactName = "Mary Smith";
        const caller = new RTCPeerConnection({ iceServers: [] }), media = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
        media.getTracks().forEach(track => caller.addTrack(track, media));
        const line = caller.createDataChannel("danzstak-call", { ordered: true }); // the caller makes the channel, as chat.js does
        await caller.setLocalDescription(await caller.createOffer()); await new Promise(r => setTimeout(r, 500));
        await makePeer(kind, { receiving: true }); // eslint-disable-line no-undef
        contactName = "Mary Smith"; // eslint-disable-line no-undef -- chat.js sets it from the incoming offer (offer.senderName)
        const answering = peer; // eslint-disable-line no-undef
        await answering.setRemoteDescription(caller.localDescription);
        await answering.setLocalDescription(await answering.createAnswer()); await new Promise(r => setTimeout(r, 500));
        await caller.setRemoteDescription(answering.localDescription);
        await wait(() => line.readyState === "open" && channel?.readyState === "open", 12000, "the call did not connect"); // eslint-disable-line no-undef
        window.__acks = []; line.addEventListener("message", e => window.__acks.push(e.data));
        line.send(JSON.stringify({ type: "call-note", id: "n1", text: "Soundcheck at 5", sentAt: Date.now() }));
        await wait(() => window.__acks.length > 0 && document.querySelector(".call-note-overlay"), 5000, "the receiver did not show and confirm the note");
        await new Promise(r => setTimeout(r, 400)); // the video's resize
        return window.__acks;
      }, kind);
      assert.deepEqual(acks.map(raw => JSON.parse(raw)), [{ type: "call-note-ack", id: "n1" }], `${label}: the receiver confirms delivery to the caller`);
      const card = await page.evaluate(() => {
        const note = document.querySelector(".call-note-overlay"), r = note.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        const controls = document.getElementById("mediaControls").getBoundingClientRect(), grid = document.getElementById("videoGrid"), g = grid.getBoundingClientRect();
        return { text: note.querySelector(".call-note-text").textContent, from: note.querySelector(".call-note-from").textContent, hit: Boolean(document.elementFromPoint(x, y)?.closest(".call-note-overlay")), inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.height > 0,
          aboveControls: r.bottom <= controls.top + 1, videoShown: !grid.hidden && g.height > 0, videoAbove: grid.hidden || g.bottom <= r.top + 1, chatShowsIt: [...document.querySelectorAll(".message, .message-bubble")].some(m => m.textContent.includes("call-note")) };
      });
      assert.equal(card.text, "Soundcheck at 5", `${label}: the note text`);
      assert.equal(card.from, "Mary", `${label}: from the caller`);
      assert.ok(card.hit && card.inView, `${label}: the note is on screen and a tap at its centre reaches it (${JSON.stringify(card)})`);
      assert.ok(card.aboveControls, `${label}: the note sits above the call buttons`);
      assert.equal(card.videoShown, kind === "video", `${label}: video only on a video call`);
      assert.ok(card.videoAbove, `${label}: the video ends above the note (it shrinks, nothing covers it)`);
      assert.equal(card.chatShowsIt, false, `${label}: no note or receipt text in the chat`);
      if (width === 390) await page.screenshot({ path: `docs/screenshots/call-note-receiver-${kind}-390.png` });
      const close = await page.evaluate(() => { const r = document.querySelector(".call-note-dismiss").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
      await page.touchscreen.tap(close.x, close.y);
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => ({ gone: !document.querySelector(".call-note-overlay"), band: getComputedStyle(document.documentElement).getPropertyValue("--call-note-band").trim() }));
      assert.deepEqual(after, { gone: true, band: "" }, `${label}: ✕ closes the note and the video grows back`);
      assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    console.log("Call note checks passed: Text note opens from More in the call panel at 320/360/390/430px; the sender shows Sent ✓ only after the other phone confirms (Not delivered otherwise); the receiver sees the note on voice and video calls at 360/390px, on screen above the call buttons, with the video shrunk to end above it, and confirms delivery.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
