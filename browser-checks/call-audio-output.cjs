"use strict";

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8017";
const widths = [320, 360, 375, 390, 414, 430, 768, 1024];
const memberId = "00000000-0000-4000-8000-000000000001";
const json = (route, body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 768 }, hasTouch: width < 700, isMobile: width < 700, serviceWorkers: "block" });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const endpoint = new URL(route.request().url()).pathname;
        if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: memberId, email: "owner@example.test" } });
        if (endpoint === "/calls/presence") return json(route, { ok: true });
        if (endpoint === "/conversations") return json(route, { conversations: [{ contactEmail: "alice@example.test", memberId, name: "Alice", preview: "Ready", updatedAt: "2026-11-05T00:00:00.000Z", canContact: true }] });
        if (endpoint === "/friends") return json(route, { friends: [{ email: "alice@example.test", memberId, name: "Alice", picture: "" }] });
        if (endpoint === "/calls/directory") return json(route, { users: [{ email: "alice@example.test", memberId, name: "Alice", online: true, friendStatus: "friends" }] });
        if (endpoint === "/messages") return json(route, { messages: [], canContact: true });
        if (endpoint === "/calls/devices") return json(route, { devices: [] });
        if (endpoint === "/calls/inbox") return json(route, { events: [] });
        return json(route, {});
      });
      await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
      await page.locator(".conversation-user").first().click();
      await page.locator("body.is-conversation-open").waitFor();
      const geometry = await page.evaluate(() => {
        const phone = document.getElementById("headerPhone").getBoundingClientRect();
        const video = document.getElementById("headerVideo").getBoundingClientRect();
        const header = document.getElementById("conversationHeader").getBoundingClientRect();
        return { phone, video, header, documentWidth: document.documentElement.scrollWidth, viewport: innerWidth };
      });
      assert.ok(geometry.phone.width > 0 && geometry.video.width > 0, `${width}px phone and video actions must both remain visible`);
      assert.ok(geometry.header.right <= width + 0.5 && geometry.documentWidth <= width, `${width}px call header must not overflow`);
      if (width <= 760) {
        assert.ok(geometry.phone.width >= 44 && geometry.phone.height >= 44, `${width}px phone control must retain a touch target`);
        assert.ok(geometry.video.width >= 44 && geometry.video.height >= 44, `${width}px video control must retain a touch target`);
      }
      const state = await page.evaluate(async () => {
        startRingback();
        const ringbackVisible = !document.getElementById("toggleRingback").hidden;
        stopRingback();
        const remote = document.getElementById("remoteAudio");
        remote.srcObject = new MediaStream();
        remote.play = async () => { throw new DOMException("blocked", "NotAllowedError"); };
        await playRemoteMedia();
        const recoveryVisible = !document.getElementById("resumeRemoteAudio").hidden;
        const recoveryStatus = document.getElementById("callStatus").textContent;
        remote.play = async () => {};
        document.getElementById("resumeRemoteAudio").click();
        await new Promise(resolve => setTimeout(resolve, 0));
        return { ringbackVisible, recoveryVisible, recoveryStatus, recovered: document.getElementById("resumeRemoteAudio").hidden };
      });
      assert.equal(state.ringbackVisible, true, `${width}px waiting call must expose ringback mute`);
      assert.equal(state.recoveryVisible, true, `${width}px blocked output must expose Hear call`);
      assert.match(state.recoveryStatus, /Hear call/);
      assert.equal(state.recovered, true, `${width}px user recovery must resume and clear the prompt`);
      assert.deepEqual(errors, [], `${width}px browser errors: ${errors.join(" | ")}`);
      await context.close();
    }
    console.log(`Call audio-output browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
