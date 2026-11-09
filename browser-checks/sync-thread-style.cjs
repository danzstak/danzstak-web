"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8021";
const width = Number(process.env.DANZSTAK_VIEWPORT_WIDTH || 390);
const screenshot = String(process.env.DANZSTAK_SCREENSHOT || "");
const callsScreenshot = String(process.env.DANZSTAK_CALLS_SCREENSHOT || "");
const listScreenshot = String(process.env.DANZSTAK_LIST_SCREENSHOT || "");
const uuid = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: "msedge", headless: true });
  const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, hasTouch: width < 700, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [];
  let conversationLoads = 0;
  let pictureGeneration = 0;
  const pictureUrl = () => `${baseUrl}/assets/danzstak-d-icon.png?signature=${pictureGeneration}`;
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: uuid(20), email: "owner@example.test" } });
    if (endpoint === "/conversations") {
      conversationLoads += 1;
      pictureGeneration += 1;
      return json(route, { conversations: [{ contactEmail: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", picture: pictureUrl(), preview: "Perfect. See you Friday.", updatedAt: "2026-11-07T18:24:00.000Z", online: true, canContact: true, unread: 2 }] });
    }
    if (endpoint === "/friends") return json(route, { friends: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", picture: pictureUrl() }] });
    if (endpoint === "/calls/directory") return json(route, { users: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", picture: pictureUrl(), online: true }] });
    if (endpoint === "/messages" && route.request().method() === "GET") return json(route, { messages: [
      { messageId: uuid(101), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: "The club confirmed Friday night.", createdAt: "2026-11-07T18:20:00.000Z", read: true },
      { messageId: uuid(102), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: "Soundcheck is at 5 PM.", createdAt: "2026-11-07T18:21:00.000Z", read: true },
      { messageId: uuid(103), senderEmail: "owner@example.test", recipientEmail: "alice@example.test", content: "Great. I added it to the tour calendar.", createdAt: "2026-11-07T18:22:00.000Z", read: true },
      { messageId: uuid(104), senderEmail: "owner@example.test", recipientEmail: "alice@example.test", content: "I’ll send the stage plot tonight.", createdAt: "2026-11-07T18:23:00.000Z", read: true },
      { messageId: uuid(105), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: "Perfect. See you Friday.", createdAt: "2026-11-07T18:24:00.000Z", read: true }
    ], canContact: true });
    if (["/calls/presence", "/calls/devices"].includes(endpoint)) return json(route, endpoint.endsWith("devices") ? { devices: [] } : { ok: true });
    if (endpoint === "/calls/inbox") return json(route, { events: [] });
    return json(route, {});
  });

  try {
    await page.goto(`${baseUrl}/messages.html`, { waitUntil: "domcontentloaded" });
    const chatRow = page.locator('.conversation-row[data-sync-section="chats"]').first();
    await chatRow.waitFor();
    const listGeometry = await chatRow.evaluate(row => {
      const button = row.querySelector(".conversation-user");
      const avatar = row.querySelector(".conversation-list-avatar");
      const title = row.querySelector(".conversation-copy strong");
      const snippet = row.querySelector(".conversation-copy small");
      const time = row.querySelector("time");
      const badge = row.querySelector(".conversation-unread");
      const sidebar = row.closest(".chat-sidebar");
      const rect = node => node?.getBoundingClientRect();
      const style = node => node ? getComputedStyle(node) : null;
      return {
        row: rect(row),
        button: rect(button),
        avatar: rect(avatar),
        sidebar: rect(sidebar),
        titleSize: style(title)?.fontSize,
        titleWeight: style(title)?.fontWeight,
        snippetSize: style(snippet)?.fontSize,
        timeSize: style(time)?.fontSize,
        badgeSize: style(badge)?.fontSize,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    });
    assert.ok(listGeometry.row.height >= 72 && listGeometry.row.height <= 74, `${width}px conversation row is not 72px: ${listGeometry.row.height}`);
    assert.ok(listGeometry.button.height >= 72, `${width}px conversation action is shorter than the row`);
    assert.ok(Math.abs(listGeometry.avatar.width - 48) <= 1 && Math.abs(listGeometry.avatar.height - 48) <= 1, `${width}px avatar is not 48px`);
    assert.ok(Math.abs(listGeometry.avatar.left - (listGeometry.sidebar.left + 16)) <= 1, `${width}px avatar does not use the 16px screen inset`);
    assert.equal(listGeometry.titleSize, "16px");
    assert.equal(listGeometry.titleWeight, "700", "unread chat title should use the bounded bold weight");
    assert.equal(listGeometry.snippetSize, "14px");
    assert.equal(listGeometry.timeSize, "12px");
    assert.equal(listGeometry.badgeSize, "12px");
    assert.equal(listGeometry.overflow, false, `${width}px conversation list overflows horizontally`);
    const initialPicture = await chatRow.locator("img.conversation-list-avatar").getAttribute("src");
    await page.evaluate(() => {
      window.__danzstakConversationAvatar = document.querySelector("img.conversation-list-avatar");
      window.__danzstakContactAvatar = document.querySelector("img.chat-contact-avatar");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    for (let attempt = 0; attempt < 40 && conversationLoads < 2; attempt += 1) await page.waitForTimeout(50);
    assert.ok(conversationLoads >= 2, `${width}px conversation refresh did not run`);
    await page.waitForFunction(() => document.getElementById("conversationUsers")?.getAttribute("aria-busy") === "false");
    const avatarStability = await page.evaluate(() => ({
      conversationSame: window.__danzstakConversationAvatar === document.querySelector("img.conversation-list-avatar"),
      contactSame: window.__danzstakContactAvatar === document.querySelector("img.chat-contact-avatar"),
      src: document.querySelector("img.conversation-list-avatar")?.getAttribute("src") || ""
    }));
    assert.equal(avatarStability.conversationSame, true, `${width}px conversation avatar was rebuilt for a refreshed signed URL`);
    assert.equal(avatarStability.contactSame, true, `${width}px contact-strip avatar was rebuilt for a refreshed signed URL`);
    assert.equal(avatarStability.src, initialPicture, `${width}px stable profile photo was replaced by a new signed URL`);
    if (listScreenshot) { fs.mkdirSync(path.dirname(listScreenshot), { recursive: true }); await page.screenshot({ path: listScreenshot }); }
    const videoCall = page.getByRole("button", { name: "Start a video call" });
    await videoCall.waitFor();
    await videoCall.click();
    assert.equal(await page.locator('[data-chat-filter="calls"]').getAttribute("aria-selected"), "true", "the visible video-call action must open the real Calls directory");
    await page.locator('.conversation-row[data-sync-section="calls"] .conversation-call[data-call-kind="video"]').first().waitFor();
    if (callsScreenshot) { fs.mkdirSync(path.dirname(callsScreenshot), { recursive: true }); await page.screenshot({ path: callsScreenshot }); }
    await page.locator(".conversation-user").first().click();
    const messages = page.locator("#messageList .message");
    await messages.last().waitFor();
    assert.equal(await messages.count(), 5);
    const style = await page.locator("#messageList").evaluate(element => {
      const computed = getComputedStyle(element);
      return { backgroundColor: computed.backgroundColor, backgroundImage: computed.backgroundImage, overflowX: element.scrollWidth > element.clientWidth };
    });
    assert.equal(style.backgroundImage, "none", "conversation canvas must not use wallpaper noise");
    assert.equal(style.backgroundColor, "rgb(239, 234, 226)");
    assert.equal(style.overflowX, false, "conversation must not overflow horizontally");
    const bubbleStyle = async index => messages.nth(index).evaluate(element => {
      const computed = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        background: computed.backgroundColor,
        topLeft: computed.borderTopLeftRadius,
        topRight: computed.borderTopRightRadius,
        fontSize: computed.fontSize,
        lineHeight: computed.lineHeight,
        paddingTop: computed.paddingTop,
        paddingLeft: computed.paddingLeft,
        maxWidth: computed.maxWidth,
        top: rect.top,
        bottom: rect.bottom
      };
    });
    const firstIncoming = await bubbleStyle(0);
    const groupedIncoming = await bubbleStyle(1);
    const firstOutgoing = await bubbleStyle(2);
    const groupedOutgoing = await bubbleStyle(3);
    const finalIncoming = await bubbleStyle(4);
    assert.equal(firstIncoming.background, "rgb(255, 255, 255)");
    assert.equal(firstIncoming.topLeft, "0px");
    assert.equal(firstOutgoing.background, "rgb(217, 239, 255)");
    assert.equal(firstOutgoing.topRight, "0px");
    assert.equal(firstIncoming.fontSize, "15px");
    assert.equal(firstIncoming.lineHeight, "20px");
    assert.equal(firstIncoming.paddingTop, "8px");
    assert.equal(firstIncoming.paddingLeft, "12px");
    assert.equal(firstIncoming.maxWidth, "min(75%, 540px)");
    assert.ok(Math.abs(groupedIncoming.top - firstIncoming.bottom - 2) <= 1, `${width}px same-speaker incoming gap is not 2px`);
    assert.ok(Math.abs(firstOutgoing.top - groupedIncoming.bottom - 8) <= 1, `${width}px incoming-to-outgoing gap is not 8px`);
    assert.ok(Math.abs(groupedOutgoing.top - firstOutgoing.bottom - 2) <= 1, `${width}px same-speaker outgoing gap is not 2px`);
    assert.ok(Math.abs(finalIncoming.top - groupedOutgoing.bottom - 8) <= 1, `${width}px outgoing-to-incoming gap is not 8px`);
    const composerState = await page.locator("#messageForm").evaluate(element => {
      const rect = element.getBoundingClientRect();
      const input = element.querySelector("#messageInput");
      const shell = element.querySelector(".message-input-shell");
      const inputStyle = getComputedStyle(input);
      const actions = [...element.querySelectorAll(".message-attach,.message-camera,.message-send")].map(node => node.getBoundingClientRect());
      return { rect, paddingLeft:getComputedStyle(element).paddingLeft, shellRadius:getComputedStyle(shell).borderRadius, inputSize:inputStyle.fontSize, actions };
    });
    const composer = composerState.rect;
    assert.ok(composer.height >= 52, `${width}px composer is shorter than 52px`);
    assert.equal(composerState.paddingLeft, "12px");
    assert.equal(composerState.shellRadius, "24px");
    assert.equal(composerState.inputSize, "15px");
    assert.ok(composerState.actions.every(rect => rect.width >= 44 && rect.height >= 44), `${width}px composer contains a small action`);
    assert.ok(composer && composer.y + composer.height <= (width < 700 ? 844 : 900), "fixed conversation composer must remain visible");
    if (screenshot) { fs.mkdirSync(path.dirname(screenshot), { recursive: true }); await page.screenshot({ path: screenshot }); }
    assert.deepEqual(errors, [], `thread styling must not raise browser errors: ${errors.join(" | ")}`);
    console.log(`SYNC WhatsApp-familiar thread check passed at ${width}px: clean canvas, grouped bubbles, composer fit, and no overflow.`);
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
