"use strict";
// SYNC sends photos and videos (owner 2026-11-19 "Photo or attach does not work"; 2026-11-23 "sync need to be able to send
// images and video through sync the buttons dont work"). The paperclip is a label around its file input, and the shared
// icon script replaced the label's contents with the icon, so the input was gone and a tap opened nothing (the camera
// had the same bug). The camera now offers a choice (owner 2026-11-23: "with the camera i should be able to choose a
// video or the camera"): Take a photo, Record a video, Choose from your phone.
// This check taps the CENTRE of each button at 320/360/390/430px on messages.html and the SYNC app: the paperclip sends a
// photo; the camera's three choices each open the right picker (camera photo, camera video, the phone's gallery), and
// a recorded video is sent. It follows each upload: a ticket from /stories, the PUT to the media bucket, the message with
// the attachment, and the attachment shown in the thread. A received photo and video show in the thread too.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8017";
const widths = (process.env.DANZSTAK_VIEWPORT_WIDTHS || "320,360,390,430").split(",").map(Number);
const screenshotDir = process.env.DANZSTAK_SCREENSHOT_DIR || "";
const bucket = "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com";
const uuid = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const json = (route, body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const photo = fs.readFileSync(path.join(__dirname, "..", "assets", "danzstak-d-icon.png"));
let clip = null; // a real one-second WebM, recorded once in the browser (the repository keeps no video files)
async function recordClip(browser) {
  const page = await browser.newPage();
  await page.goto(`${baseUrl}/assets/danzstak-d-icon.png`);
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas"); canvas.width = 160; canvas.height = 284;
    const context = canvas.getContext("2d"), stream = canvas.captureStream(15);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8" }), chunks = [];
    recorder.ondataavailable = event => chunks.push(event.data);
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.start();
    for (let frame = 0; frame < 15; frame++) { context.fillStyle = `hsl(${frame * 20},80%,50%)`; context.fillRect(0, 0, 160, 284); await new Promise(resolve => setTimeout(resolve, 66)); }
    recorder.stop(); await stopped;
    return [...new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer())];
  });
  await page.close();
  return Buffer.from(bytes);
}

async function centreTap(page, locator) {
  const box = await locator.boundingBox();
  assert.ok(box, "button is on screen");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await page.evaluate(([px, py]) => { const node = document.elementFromPoint(px, py); return node ? node.closest("label, button")?.className || node.tagName : null; }, [x, y]);
  await page.touchscreen.tap(x, y);
  return hit;
}

async function run(browser, pagePath, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const page = await context.newPage();
  const errors = [], uploads = [], sent = [];
  page.on("pageerror", error => errors.push(error.message));
  const thread = [
    { messageId: uuid(101), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: "Send me the flyer", createdAt: "2026-11-07T18:20:00.000Z", read: true },
    { messageId: uuid(102), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: "", mediaKey: `messages/alice/${uuid(7)}.png`, mediaType: "image", mediaUrl: `${baseUrl}/assets/danzstak-d-icon.png`, createdAt: "2026-11-07T18:21:00.000Z", read: true },
    { messageId: uuid(103), senderEmail: "alice@example.test", recipientEmail: "owner@example.test", content: "", mediaKey: `messages/alice/${uuid(8)}.mp4`, mediaType: "video", mediaUrl: `${baseUrl}/__sync-clip.webm`, createdAt: "2026-11-07T18:22:00.000Z", read: true }
  ];
  await page.route(`${baseUrl}/__sync-clip.webm`, route => route.fulfill({ status: 200, contentType: "video/webm", body: clip }));
  await page.route(`${bucket}/**`, route => {
    uploads.push({ method: route.request().method(), type: route.request().headers()["content-type"] });
    return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "" });
  });
  let ticket = 0;
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname, method = request.method();
    if (endpoint === "/auth/session") return json(route, { authenticated: true, user: { sub: uuid(20), email: "owner@example.test" } });
    if (endpoint === "/conversations") return json(route, { conversations: [{ contactEmail: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", preview: "Send me the flyer", updatedAt: "2026-11-07T18:24:00.000Z", online: true, canContact: true, unread: 0 }] });
    if (endpoint === "/friends") return json(route, { friends: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera" }] });
    if (endpoint === "/calls/directory") return json(route, { users: [{ email: "alice@example.test", memberId: uuid(1), name: "Alice Rivera", online: true }] });
    if (endpoint === "/stories" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      if (body.action === "discard") return json(route, { discarded: true });
      assert.equal(body.purpose, "message", "a SYNC attachment asks for a message upload ticket");
      ticket += 1;
      const extension = body.contentType === "video/webm" ? "webm" : "png";
      const mediaKey = `messages/owner/${uuid(500 + ticket)}.${extension}`;
      return json(route, { uploadUrl: `${bucket}/${mediaKey}?X-Amz-Signature=test`, mediaKey, mediaType: extension === "webm" ? "video" : "image" });
    }
    if (endpoint === "/messages" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      sent.push(body);
      const message = { messageId: body.clientMessageId, senderEmail: "owner@example.test", recipientEmail: body.recipientEmail, content: body.content, mediaKey: body.mediaKey, mediaType: body.mediaType, mediaUrl: body.mediaType === "video" ? `${baseUrl}/__sync-clip.webm` : `${baseUrl}/assets/danzstak-d-icon.png`, createdAt: new Date().toISOString(), read: false };
      thread.push(message);
      return json(route, { message });
    }
    if (endpoint === "/messages" && method === "GET") return json(route, { messages: thread, canContact: true });
    if (endpoint === "/calls/devices") return json(route, { devices: [] });
    if (endpoint === "/calls/inbox") return json(route, { events: [] });
    return json(route, {});
  });

  await page.goto(`${baseUrl}/${pagePath}`, { waitUntil: "domcontentloaded" });
  const row = page.locator('.conversation-row[data-sync-section="chats"] .conversation-user').first();
  await row.waitFor({ timeout: 20000 });
  await centreTap(page, row);
  await page.locator("#messageMedia:not([disabled])").waitFor({ state: "attached", timeout: 15000 });

  const where = `${pagePath} at ${width}px`;
  const inside = await page.locator(".message-attach").evaluate(label => label.querySelector("#messageMedia") !== null && label.querySelector(".ds-action-icon") !== null);
  assert.ok(inside, `${where}: the paperclip keeps its file input next to its icon`);

  // Received photo and video show in the thread.
  await page.locator("img.message-attachment").first().waitFor({ timeout: 10000 });
  assert.ok(await page.locator("img.message-attachment").first().evaluate(img => img.complete && img.naturalWidth > 0), `${where}: a received photo shows`);
  await page.waitForFunction(() => [...document.querySelectorAll("video.message-attachment")].some(video => video.readyState >= 1), null, { timeout: 10000 });

  // Paperclip: a photo.
  const paperclip = page.locator(".message-attach");
  const [photoChooser, photoHit] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), centreTap(page, paperclip)]);
  assert.match(String(photoHit), /message-attach/, `${where}: the centre of the paperclip is the paperclip`);
  await photoChooser.setFiles({ name: "flyer.png", mimeType: "image/png", buffer: photo });
  await page.locator("#messageMediaPreview:not([hidden]) img").waitFor({ timeout: 5000 });
  const sendButton = page.locator("#messageForm button[type=submit]");
  await centreTap(page, sendButton);
  await page.waitForFunction(count => document.querySelectorAll(".message.mine img.message-attachment").length >= count, 1, { timeout: 10000 });
  assert.deepEqual(uploads.at(-1), { method: "PUT", type: "image/png" }, `${where}: the photo goes up to the media bucket`);
  assert.equal(sent.at(-1).mediaType, "image", `${where}: the message carries the photo`);
  assert.match(sent.at(-1).mediaKey, /^messages\/owner\/[a-f0-9-]{36}\.png$/, `${where}: with its upload key`);
  assert.equal(await page.locator("#messageMediaPreview").evaluate(node => node.hidden), true, `${where}: the preview clears after sending`);

  // Camera: three choices, each opening the right picker.
  const camera = page.locator(".message-camera");
  const menu = page.locator("#messageCaptureMenu");
  async function choose(kind) {
    const hit = await centreTap(page, camera);
    assert.match(String(hit), /message-camera/, `${where}: the centre of the camera is the camera`);
    await menu.waitFor({ state: "visible", timeout: 3000 });
    const layout = await menu.evaluate(node => {
      const box = node.getBoundingClientRect(), shell = document.querySelector(".message-input-shell").getBoundingClientRect();
      return { left: box.left, right: box.right, bottom: box.bottom, shellTop: shell.top, width: innerWidth, items: [...node.querySelectorAll("[data-capture]")].map(item => ({ kind: item.dataset.capture, text: item.textContent.trim(), height: item.getBoundingClientRect().height, icon: !!item.querySelector(".ds-action-icon") })) };
    });
    assert.deepEqual(layout.items.map(item => item.kind), ["photo", "video", "library"], `${where}: the camera offers a photo, a video or the phone's own photos and videos`);
    assert.deepEqual(layout.items.map(item => item.text), ["Take a photo", "Record a video", "Choose from your phone"], `${where}: the choices are labelled`);
    assert.ok(layout.items.every(item => item.height >= 44 && item.icon), `${where}: each choice is a 44px row with its icon`);
    assert.ok(layout.left >= 0 && layout.right <= layout.width && layout.bottom <= layout.shellTop, `${where}: the menu sits on screen, above the message box`);
    if (screenshotDir && kind === "photo") { fs.mkdirSync(screenshotDir, { recursive: true }); await page.screenshot({ path: path.join(screenshotDir, `sync-camera-menu-${pagePath.replace(/\W+/g, "-")}-${width}.png`) }); }
    const item = menu.locator(`[data-capture="${kind}"]`);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser", { timeout: 5000 }), centreTap(page, item)]);
    await menu.waitFor({ state: "hidden", timeout: 3000 });
    const input = await chooser.element().evaluate(node => ({ id: node.id, accept: node.accept, capture: node.getAttribute("capture") }));
    return { chooser, input };
  }
  const photoChoice = await choose("photo");
  assert.deepEqual(photoChoice.input, { id: "messageCamera", accept: "image/jpeg,image/png,image/webp", capture: "environment" }, `${where}: Take a photo opens the camera for photos`);
  const libraryChoice = await choose("library");
  assert.equal(libraryChoice.input.id, "messageMedia", `${where}: Choose from your phone opens the phone's photos and videos`);
  assert.match(libraryChoice.input.accept, /image\/jpeg/, `${where}: photos`); assert.match(libraryChoice.input.accept, /video\/mp4/, `${where}: and videos`);
  assert.equal(libraryChoice.input.capture, null, `${where}: from the gallery, not the camera`);
  const videoChoice = await choose("video");
  assert.deepEqual(videoChoice.input, { id: "messageCameraVideo", accept: "video/mp4,video/webm,video/quicktime", capture: "environment" }, `${where}: Record a video opens the camera for video`);
  await videoChoice.chooser.setFiles({ name: "clip.webm", mimeType: "video/webm", buffer: clip });
  await page.locator("#messageMediaPreview:not([hidden]) video").waitFor({ timeout: 5000 });
  await centreTap(page, sendButton);
  await page.waitForFunction(() => document.querySelectorAll(".message.mine video.message-attachment").length >= 1, null, { timeout: 10000 });
  assert.deepEqual(uploads.at(-1), { method: "PUT", type: "video/webm" }, `${where}: the video goes up to the media bucket`);
  assert.equal(sent.at(-1).mediaType, "video", `${where}: the message carries the video`);

  // A tap anywhere else closes the menu without opening anything.
  await centreTap(page, camera);
  await menu.waitFor({ state: "visible", timeout: 3000 });
  await page.touchscreen.tap(Math.round(width / 2), 120);
  await menu.waitFor({ state: "hidden", timeout: 3000 });
  assert.equal(await camera.getAttribute("aria-expanded"), "false", `${where}: the camera button says the menu is closed`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  assert.equal(overflow, false, `${where}: no sideways scroll`);
  assert.deepEqual(errors, [], `${where}: no page errors`);
  if (screenshotDir) { fs.mkdirSync(screenshotDir, { recursive: true }); await page.screenshot({ path: path.join(screenshotDir, `sync-attach-${pagePath.replace(/\W+/g, "-")}-${width}.png`) }); }
  await context.close();
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: "msedge", headless: true });
  try {
    clip = await recordClip(browser);
    for (const width of widths) await run(browser, "messages.html", width);
    for (const width of [360, 390]) await run(browser, "sync/index.html", width);
  } finally {
    await browser.close();
  }
  console.log(`SYNC attach checks passed at ${widths.join("/")}px (messages.html) and 360/390px (SYNC app): the paperclip sends a photo; the camera offers Take a photo, Record a video and Choose from your phone, and a recorded video is sent; centre taps, uploads and attachments in the thread.`);
})().catch(error => { console.error(error); process.exit(1); });
