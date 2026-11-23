"use strict";
// F15k (owner 2026-11-19, a familiar messenger's voice call: "SYNC phone should open like this … It needs to open calls
// like this"). Real browser, touch, at 320/360/390/430px, on a real answered call (a second RTCPeerConnection plays the
// other person) and on an incoming call:
// - voice: the name, "Encrypted" (never "End-to-end"), a round photo centred above the panel; six equal round buttons
//   in two rows (Speaker · Video · Mute / More · Share · End), every one 44px or more, labels on one line, nothing
//   overlapping; a tap at the centre of Mute mutes (pressed, "Unmute"); More opens its sheet; minimise shows the chat with
//   a bubble, and the bubble brings the call back;
// - video: the same panel over the video, your camera window clear of it;
// - incoming: the same top and photo, Decline and Accept in the panel.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8017 node browser-checks/sync-call-screen-ui.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/sync-call-screen");
const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
async function setup(browser, width, picture = "") {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", permissions: ["camera", "microphone"] });
  const page = await context.newPage(); page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  await page.route("https://api.danzstak.com/**", route => { const p = new URL(route.request().url()).pathname;
    if (p === "/auth/session") return json(route, { authenticated: true, user: { sub: "00000000-0000-4000-8000-000000000001", email: "me@x.test" } });
    if (p === "/conversations") return json(route, { conversations: [{ contactEmail: "dee@x.test", memberId: "00000000-0000-4000-8000-000000000002", name: "Dee", preview: "Ready", updatedAt: "2026-11-19T12:00:00.000Z", canContact: true, ...(picture ? { picture } : {}) }] });
    if (p === "/calls/ice") return json(route, { iceServers: [], expiresAt: Date.now() + 300000 });
    return json(route, { events: [] }); });
  await page.goto(`${base}/messages.html`, { waitUntil: "domcontentloaded" });
  await page.locator(".conversation-user").first().click();
  await page.locator("body.is-conversation-open").waitFor();
  return { context, page };
}
async function call(page, kind) {
  await page.evaluate(async kind => {
    const wait = async (ok, ms) => { const t0 = performance.now(); while (!ok()) { if (performance.now() - t0 > ms) throw new Error("no connect"); await new Promise(r => setTimeout(r, 50)); } };
    // Calls send no candidates after the offer/answer, so each side's description goes across only once its candidates
    // are gathered (as in call-video-two-party.cjs); a fixed 300 ms wasn't enough on CI's Windows runner ("no connect").
    const gathered = pc => pc.iceGatheringState === "complete" ? Promise.resolve() : new Promise(resolve => {
      const done = () => { if (pc.iceGatheringState === "complete") { clearTimeout(cap); pc.removeEventListener("icegatheringstatechange", done); resolve(); } };
      const cap = setTimeout(() => { pc.removeEventListener("icegatheringstatechange", done); resolve(); }, 5000);
      pc.addEventListener("icegatheringstatechange", done);
    });
    document.getElementById("contactEmail").value = "dee@x.test"; window.danzstakActiveContactName = "Dee";
    const caller = new RTCPeerConnection({ iceServers: [] }), media = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" });
    media.getTracks().forEach(t => caller.addTrack(t, media)); caller.createDataChannel("danzstak-call", { ordered: true });
    await caller.setLocalDescription(await caller.createOffer()); await gathered(caller);
    await makePeer(kind, { receiving: true }); contactName = "Dee"; // eslint-disable-line no-undef
    await peer.setRemoteDescription(caller.localDescription); await peer.setLocalDescription(await peer.createAnswer()); await gathered(peer); // eslint-disable-line no-undef
    await caller.setRemoteDescription(peer.localDescription); // eslint-disable-line no-undef
    await wait(() => channel?.readyState === "open", 10000); // eslint-disable-line no-undef
  }, kind);
  await page.waitForTimeout(1500);
}

const rect = el => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
const overlap = (a, b) => a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge", headless: true, args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) {
      for (const kind of ["phone", "video"]) {
        const label = `${kind} ${width}px`;
        const { context, page } = await setup(browser, width);
        await call(page, kind);
        const layout = await page.evaluate(() => {
          const r = el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
          const keys = [...document.querySelectorAll(".ds-call-keys .ds-call-key")].map(key => ({ label: key.querySelector(".ds-call-label").textContent, button: r(key.querySelector("button")), text: r(key.querySelector(".ds-call-label")), oneLine: key.querySelector(".ds-call-label").scrollWidth <= key.querySelector(".ds-call-label").clientWidth + 1 && key.querySelector(".ds-call-label").getBoundingClientRect().height < 26 }));
          const photo = document.querySelector("#callStage .ds-call-photo"), shown = photo && getComputedStyle(document.getElementById("callStage")).display !== "none";
          const pip = document.querySelector(".video-grid .local-video");
          return { keys, panel: r(document.querySelector(".ds-call-panel")), top: r(document.querySelector(".ds-call-top")), name: document.querySelector(".ds-call-top .ds-call-name").textContent, lock: document.querySelector(".ds-call-top .ds-call-lock").textContent,
            photo: shown ? { ...r(photo), radius: getComputedStyle(photo).borderRadius } : null, pip: pip && !pip.closest("[hidden]") ? r(pip) : null, text: document.body.innerText, vw: innerWidth, scroll: document.documentElement.scrollWidth };
        });
        const sizes = new Set(layout.keys.map(k => `${Math.round(k.button.w)}x${Math.round(k.button.h)}`));
        if (layout.keys.map(k => k.label).join(",") !== "Speaker,Video,Mute,More,Share,End") failures.push(`${label}: buttons ${layout.keys.map(k => k.label).join(",")}`);
        if (sizes.size !== 1 || layout.keys.some(k => k.button.w < 44 || k.button.h < 44)) failures.push(`${label}: buttons not equal or under 44px (${[...sizes]})`);
        if (new Set(layout.keys.map(k => Math.round(k.button.t))).size !== 2) failures.push(`${label}: not two rows`);
        if (layout.keys.some(k => !k.oneLine)) failures.push(`${label}: a label wraps or is cut`);
        if (layout.keys.some(k => k.button.l < 0 || k.button.r > layout.vw) || layout.scroll > layout.vw) failures.push(`${label}: something is off screen`);
        if (layout.name !== "Dee") failures.push(`${label}: name "${layout.name}"`);
        if (layout.lock !== "Encrypted" || /end-to-end/i.test(layout.text)) failures.push(`${label}: the lock line must say Encrypted and never end-to-end`);
        if (kind === "phone") {
          if (!layout.photo) failures.push(`${label}: no photo`);
          else {
            if (Math.abs(layout.photo.w - layout.photo.h) > 1 || !/50%|9999|px/.test(layout.photo.radius)) failures.push(`${label}: photo not round`);
            if (Math.abs((layout.photo.l + layout.photo.r) / 2 - layout.vw / 2) > 2) failures.push(`${label}: photo not centred`);
            if (overlap(layout.photo, layout.panel) || overlap(layout.photo, layout.top)) failures.push(`${label}: photo overlaps the top or the panel`);
          }
        } else if (layout.pip && overlap(layout.pip, layout.panel)) failures.push(`${label}: your camera window covers the panel`);
        if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `${kind}-${width}.png`) });
        if (kind === "phone") {
          const mute = await page.evaluate(() => { const b = document.getElementById("toggleMic").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
          await page.touchscreen.tap(mute.x, mute.y); await page.waitForTimeout(200);
          const muted = await page.evaluate(() => [document.getElementById("toggleMic").getAttribute("aria-pressed"), document.getElementById("toggleMic").closest(".ds-call-key").querySelector(".ds-call-label").textContent, stream.getAudioTracks()[0].enabled]); // eslint-disable-line no-undef
          if (JSON.stringify(muted) !== JSON.stringify(["true", "Unmute", false])) failures.push(`${label}: a centre tap on Mute did not mute (${muted})`);
          await page.locator("#callMore").click();
          if (!(await page.locator("#callSheet .ds-call-sheet-row", { hasText: "Text note" }).count())) failures.push(`${label}: More has no Text note`);
          await page.locator("#callSheet .ds-call-sheet-close").click();
          await page.locator("#callMinimise").click(); await page.waitForTimeout(300);
          const mini = await page.evaluate(() => ({ mode: document.body.dataset.callMode || "", bubble: !document.getElementById("callBubble").hidden, chat: getComputedStyle(document.querySelector(".message-form")).display !== "none" }));
          if (mini.mode || !mini.bubble || !mini.chat) failures.push(`${label}: minimise should show the chat and the bubble (${JSON.stringify(mini)})`);
          if (width === 390) await page.screenshot({ path: path.join(output, `minimised-${width}.png`) });
          await page.locator("#callBubble").click(); await page.waitForTimeout(200);
          if (await page.evaluate(() => document.body.dataset.callMode) !== "phone") failures.push(`${label}: the bubble did not bring the call back`);
        }
        if (page.errors.length) failures.push(`${label}: page errors ${page.errors.join(" | ")}`);
        await context.close();
      }
      // Calling, before the other person answers (owner 2026-11-23, "Images are funky": the letter instead of their photo,
      // "Calling Adam3…" twice, your camera window over their photo, an orange ring around End after a tap).
      for (const kind of ["phone", "video"]) {
        const label = `calling ${kind} ${width}px`;
        const { context, page } = await setup(browser, width, "/assets/danzstak-share-card.jpg");
        await page.waitForFunction(() => /url\(/.test(document.getElementById("conversationAvatar").style.backgroundImage), null, { timeout: 10000 });
        await page.evaluate(async kind => { contactName = "Dee"; await makePeer(kind); setStatus(tf("Calling {name}…", { name: "Dee" })); }, kind); // eslint-disable-line no-undef
        await page.waitForTimeout(600);
        const end = await page.evaluate(() => { const b = document.getElementById("hangUp").getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
        await page.touchscreen.tap(width / 2, 420); // a tap on the photo first (no action there), then focus lands on End the way chat.js does it
        await page.evaluate(() => document.getElementById("hangUp").focus());
        const seen = await page.evaluate(() => {
          const r = el => { const b = el.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
          const photo = document.querySelector("#callStage .ds-call-photo"), pip = document.querySelector(".video-grid .local-video");
          const status = document.getElementById("callStatus"), end = document.getElementById("hangUp"), es = getComputedStyle(end);
          const words = [...document.querySelectorAll(".conversation *")].filter(n => n.childElementCount === 0 && n.offsetParent !== null && getComputedStyle(n).visibility !== "hidden" && /Calling/.test(n.textContent)).map(n => n.textContent.trim());
          return { img: Boolean(photo?.querySelector("img")?.src), photo: r(photo), pip: pip && getComputedStyle(pip).display !== "none" && !pip.closest("[hidden]") ? { ...r(pip), full: Math.round(pip.getBoundingClientRect().width) === innerWidth } : null,
            words, statusShown: getComputedStyle(status).visibility !== "hidden", ring: es.outlineStyle !== "none" && parseFloat(es.outlineWidth) > 0 };
        });
        if (!seen.img) failures.push(`${label}: the photo shows the letter, not the contact's picture`);
        if (seen.words.length !== 1) failures.push(`${label}: "Calling" shows ${seen.words.length} times (${seen.words.join(" | ")})`);
        if (seen.ring) failures.push(`${label}: a ring shows around End after a tap`);
        if (kind === "video" && seen.pip && !seen.pip.full && overlap(seen.pip, seen.photo)) failures.push(`${label}: your camera window covers their photo`);
        // An error still shows on the status line.
        await page.evaluate(() => setStatus("Call connection interrupted. Reconnecting…")); // eslint-disable-line no-undef
        await page.waitForTimeout(100);
        if (await page.evaluate(() => getComputedStyle(document.getElementById("callStatus")).visibility === "hidden")) failures.push(`${label}: an error on the status line was hidden`);
        if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `calling-${kind}-${width}.png`) });
        if (page.errors.length) failures.push(`${label}: page errors ${page.errors.join(" | ")}`);
        await context.close();
      }
      // Incoming
      const label = `incoming ${width}px`;
      const { context, page } = await setup(browser, width);
      await page.evaluate(() => { pending = { eventId: "e1", senderEmail: "dee@x.test", senderName: "Dee", callId: "11111111-1111-4111-8111-111111111111", mode: "phone", signalType: "offer", payload: {} }; contactName = "Dee"; els.incomingLabel.textContent = "Incoming call: Dee"; ring(); }); // eslint-disable-line no-undef
      await page.waitForTimeout(400);
      const incoming = await page.evaluate(() => { const s = document.getElementById("incomingCall"), r = s.getBoundingClientRect(), keys = [...s.querySelectorAll(".call-actions .ds-call-key")].map(k => ({ label: k.querySelector(".ds-call-label").textContent, w: k.querySelector("button").getBoundingClientRect().width }));
        return { full: r.top === 0 && r.left === 0 && Math.round(r.width) === innerWidth && Math.round(r.height) === innerHeight, top: document.elementFromPoint(innerWidth / 2, 4)?.closest("#incomingCall") !== null, name: s.querySelector(".ds-call-name").textContent, keys }; });
      if (!incoming.full || !incoming.top) failures.push(`${label}: the incoming screen must cover the whole screen (${JSON.stringify(incoming)})`);
      if (incoming.name !== "Dee" || incoming.keys.map(k => k.label).join(",") !== "Decline,Accept" || incoming.keys.some(k => k.w < 44)) failures.push(`${label}: ${JSON.stringify(incoming)}`);
      if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `incoming-${width}.png`) });
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log("SYNC call screen checks passed at 320, 360, 390, 430px: voice and video calls with the name, Encrypted (never end-to-end), a round centred photo, six equal round buttons in two rows with one-line labels (44px+); Mute works on a centre tap; More opens; minimise shows the chat with a bubble that brings the call back; the incoming call covers the screen with Decline and Accept.");
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
