"use strict";
// Directive F12 (owner 2026-11-19): "on all pictures I should be able to move them around to fit them in the box" and
// "In tribes and other profile pictures need to be able to position the Fotos". Real browser, touch, 320/360/390/430px:
// - Profile, the photo under the name: ⋯ → Move to fit opens the sheet at the photo's own 16:7 box; a finger drag moves
//   the picture with the finger, a two-finger pinch zooms, Save sends where it sits; the photo is then drawn there inside
//   its frame (nothing spills out of the band).
// - Profile picture: Choose from this phone → the round sheet → Save uploads a 1080×1080 JPEG cropped where it was
//   placed (pixels checked: dragged to the top of a red-over-green photo, the crop is red where centred would be green).
// - The cover (Edit profile → Cover photo → Move to fit): drag and zoom, Save, drawn there.
// - Tribe (Elder): Move to fit on the cover shows the square Tribe picture too; Save sends the position; the cover and
//   the Tribes-list picture are drawn from it. A member who isn't an Elder sees no cover tools (F13).
// - Before the call-signaling deploy (the server refuses a position-only save): "Saved on this phone…" shows and the
//   photo keeps its place after a reload.
// - Every control is centre-tapped, the sheet has no sideways overflow, Save is reachable; in Italian the sheet reads Italian.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/image-position.cjs
const zlib = require("node:zlib");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111", tribeId = "33333333-3333-4333-8333-333333333333";
const cdn = "https://dk7kawr758jtd.cloudfront.net", bucket = "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com";

function png(width, height, pixel) {
  const row = width * 3 + 1, raw = Buffer.alloc(row * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) raw.set(pixel(x, y), y * row + 1 + x * 3);
  const chunk = (type, data) => { const head = Buffer.alloc(4), body = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); head.writeUInt32BE(data.length); crc.writeUInt32BE(zlib.crc32(body)); return Buffer.concat([head, body, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
// A wide photo (wider than 16:7, so it can move sideways) and a tall red-over-green one for the profile picture.
const wide = png(2400, 700, x => (x < 1200 ? [255, 90, 31] : [20, 40, 120])); // 3.4:1, wider than every box it is placed in at 320-430px
const tall = png(600, 900, (x, y) => (y < 450 ? [220, 20, 20] : [20, 160, 60]));
const media = { "/users/me/wide.png": wide, "/users/me/tall.png": tall };
const cors = { "access-control-allow-origin": base, "access-control-allow-credentials": "true" };

function jpegSize(buffer) {
  for (let i = 2; i < buffer.length - 9;) {
    if (buffer[i] !== 0xff) return null;
    const marker = buffer[i + 1], length = buffer.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc2) return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  return null;
}
const centre = box => ({ x: box.x + box.width / 2, y: box.y + box.height / 2 });

async function setup(browser, width, { profile = {}, groups = [], positionsStored = true, language = "" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  if (language) await context.addInitScript(lang => { try { localStorage.setItem("danzstak_language", lang); } catch {} }, language);
  const page = await context.newPage(), errors = [], sent = { profiles: [], covers: [], uploads: [] };
  page.on("pageerror", error => errors.push(error.message));
  let current = { memberId: me, name: "Night Shift", handle: "nightshift", isOwner: true, cloudProfile: true, picture: `${cdn}/users/me/tall.png`, ...profile };
  await page.route(`${cdn}/**`, route => {
    const body = media[new URL(route.request().url()).pathname];
    return body ? route.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": base }, body }) : route.fulfill({ status: 404, body: "" });
  });
  await page.route(`${bucket}/**`, async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 200, headers: { ...cors, "access-control-allow-methods": "PUT", "access-control-allow-headers": "content-type" } });
    sent.uploads.push({ type: request.headers()["content-type"], body: request.postDataBuffer() });
    return route.fulfill({ status: 200, headers: cors, body: "" });
  });
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET,POST,PUT,DELETE", "access-control-allow-headers": "content-type" } });
    if (path === "/auth/session") return reply({ authenticated: true, user: { sub: me, email: "me@danzstak.test" } });
    if (path === "/profiles" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}"); sent.profiles.push(body);
      const positionOnly = Object.keys(body).every(key => /^(showcase|cover)(X|Y|Zoom)$/.test(key));
      if (!positionsStored && positionOnly && Object.keys(body).every(key => key.startsWith("showcase"))) return reply({ error: "No profile changes supplied" }, 400);
      const next = { ...current };
      for (const [key, value] of Object.entries(body)) if (positionsStored || !/Zoom$|^showcase[XY]$/.test(key)) next[key] = value;
      if (body.avatarKey) next.picture = `${cdn}/users/me/tall.png?v=${sent.profiles.length}`;
      current = next;
      return reply({ profile: current });
    }
    if (path === "/profiles") return reply({ profile: current });
    if (path === "/stories" && method === "POST") return reply({ uploadUrl: `${bucket}/upload/${sent.uploads.length + 1}`, mediaKey: `users/me/${String(sent.uploads.length + 1).padStart(8, "0")}-1111-4111-8111-111111111111.jpg` });
    if (path === "/groups" && method === "GET") return reply({ groups });
    if (path === "/groups/membership") return reply({ groupIds: groups.map(group => group.id) });
    if (path.endsWith("/cover") && method === "POST") { const body = JSON.parse(request.postData() || "{}"); sent.covers.push(body); return reply({ coverUrl: groups[0].coverUrl, coverPosition: body.position }); }
    if (path === "/secure-posts") return reply({ posts: [] });
    if (path === "/stories") return reply({ stories: [], reels: [] });
    return reply({});
  });
  const cdp = await context.newCDPSession(page);
  const touch = (type, points) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((point, id) => ({ x: Math.round(point.x), y: Math.round(point.y), id })) });
  const drag = async (from, to, steps = 10) => {
    await touch("touchStart", [from]);
    for (let i = 1; i <= steps; i++) await touch("touchMove", [{ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }]);
    await touch("touchEnd", []);
  };
  const pinch = async (at, from, to, steps = 10) => {
    await touch("touchStart", [{ x: at.x - from / 2, y: at.y }, { x: at.x + from / 2, y: at.y }]);
    for (let i = 1; i <= steps; i++) { const gap = from + (to - from) * i / steps; await touch("touchMove", [{ x: at.x - gap / 2, y: at.y }, { x: at.x + gap / 2, y: at.y }]); }
    await touch("touchEnd", []);
  };
  const tap = async locator => { await locator.scrollIntoViewIfNeeded({ timeout: 8000 }); const box = await locator.boundingBox({ timeout: 8000 }); if (!box) throw new Error("not on screen"); const c = centre(box); const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 80) || "", c); await page.touchscreen.tap(c.x, c.y); return { box, hit }; };
  return { context, page, errors, sent, drag, pinch, tap };
}
// The sheet: open, the box at the given aspect, every control 44px and reachable, no sideways overflow.
async function sheetState(page) {
  return page.evaluate(() => {
    const sheet = document.querySelector(".ds-fit-sheet"), box = sheet?.querySelector(".ds-fit-box")?.getBoundingClientRect(), save = sheet?.querySelector(".ds-fit-save");
    const controls = [...(sheet?.querySelectorAll(".ds-fit-cancel,.ds-fit-save,.ds-fit-step") || [])].map(button => { const r = button.getBoundingClientRect(); return { w: r.width, h: r.height, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === button }; });
    return { open: Boolean(sheet?.open), aspect: box ? box.width / box.height : 0, round: sheet?.querySelector(".ds-fit-box")?.classList.contains("is-round"), inside: box ? box.left >= -0.5 && box.right <= innerWidth + 0.5 && box.top >= 0 : false,
      controls, title: sheet?.querySelector("h2")?.textContent, save: save?.textContent, hint: sheet?.querySelector(".ds-fit-hint")?.textContent, zoom: Number(sheet?.querySelector(".ds-fit-range")?.value || 0),
      extras: [...(sheet?.querySelectorAll(".ds-fit-extra") || [])].map(figure => { const r = figure.querySelector(".ds-fit-extra-frame").getBoundingClientRect(); return { aspect: r.width / r.height, label: figure.textContent.trim() }; }),
      overflow: document.documentElement.scrollWidth > innerWidth + 0.5 };
  });
}
function checkSheet(state, label, aspect, failures, { round = false } = {}) {
  if (!state.open) { failures.push(`${label}: the Move-to-fit sheet did not open`); return; }
  if (Math.abs(state.aspect - aspect) > 0.04) failures.push(`${label}: the preview is not the picture's own box (${state.aspect.toFixed(2)} vs ${aspect.toFixed(2)})`);
  if (Boolean(state.round) !== round) failures.push(`${label}: the preview ${round ? "is not" : "is"} round`);
  if (!state.inside) failures.push(`${label}: the preview runs off the screen`);
  if (state.controls.length !== 4 || state.controls.some(control => control.w < 44 || control.h < 44 || !control.hit)) failures.push(`${label}: Cancel / Save / zoom are not 44px reachable targets ${JSON.stringify(state.controls)}`);
  if (state.overflow) failures.push(`${label}: sideways overflow under the sheet`);
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) {
      // 1. The photo under the name: drag + pinch, Save, drawn where it was placed and clipped by its frame.
      let label = `${width}px photo under the name`;
      let run = await setup(browser, width, { profile: { showcase: `${cdn}/users/me/wide.png`, showcaseX: 50, showcaseY: 50, showcaseZoom: 1, cover: `${cdn}/users/me/wide.png`, coverX: 50, coverY: 50, coverZoom: 1 } });
      try {
        await run.page.goto(`${base}/profile.html`, { waitUntil: "domcontentloaded" });
        await run.page.locator(".profile-showcase-frame").waitFor({ timeout: 15000 });
        const frame = await run.page.locator(".profile-showcase-frame").boundingBox();
        await run.tap(run.page.locator(".profile-showcase-more")); await run.page.waitForTimeout(350); // the sheet slides up
        const move = await run.tap(run.page.locator(".ds-sheet.is-open .profile-showcase-move"));
        if (!/profile-showcase-move|ds-choice__text">Move to fit/.test(move.hit)) failures.push(`${label}: the centre of "Move to fit" is covered (${move.hit})`);
        await run.page.waitForFunction(() => document.querySelector(".ds-fit-sheet")?.open, null, { timeout: 8000 });
        await run.page.waitForTimeout(300);
        checkSheet(await sheetState(run.page), label, frame.width / frame.height, failures);
        const box = await run.page.locator(".ds-fit-box").boundingBox(), middle = centre(box);
        await run.drag(middle, { x: middle.x - box.width * 0.2, y: middle.y });
        const afterDrag = await run.page.evaluate(() => getComputedStyle(document.querySelector(".ds-fit-image")).objectPosition);
        const x = parseFloat(afterDrag);
        if (!(x > 55)) failures.push(`${label}: dragging left did not move the picture left (object-position ${afterDrag})`);
        await run.pinch(middle, 60, 140);
        const zoom = (await sheetState(run.page)).zoom;
        if (!(zoom > 1.5)) failures.push(`${label}: a two-finger pinch did not zoom (${zoom})`);
        if (width === 390) await run.page.screenshot({ path: "docs/screenshots/image-position/showcase-sheet-390.png" });
        await run.tap(run.page.locator(".ds-fit-save"));
        await run.page.waitForFunction(() => !document.querySelector(".ds-fit-sheet")?.open, null, { timeout: 8000 });
        await run.page.waitForTimeout(400);
        const saved = run.sent.profiles.at(-1) || {};
        if (Object.keys(saved).sort().join(",") !== "showcaseX,showcaseY,showcaseZoom") failures.push(`${label}: Save did not send only the position ${JSON.stringify(saved)}`);
        if (Math.abs(saved.showcaseX - x) > 0.6 || Math.abs(saved.showcaseZoom - zoom) > 0.02) failures.push(`${label}: Save sent another position than the preview ${JSON.stringify({ saved, x, zoom })}`);
        const drawn = await run.page.evaluate(() => {
          const image = document.querySelector(".profile-showcase-photo"), frame = document.querySelector(".profile-showcase-frame").getBoundingClientRect(), style = getComputedStyle(image);
          return { position: style.objectPosition, transform: image.style.transform, frame: { w: frame.width, h: frame.height }, hit: document.elementFromPoint(frame.left + frame.width / 2, frame.top + frame.height / 2) === image,
            clipped: getComputedStyle(image.parentElement).overflow === "hidden", below: document.elementFromPoint(frame.left + 4, frame.bottom + 6)?.closest(".profile-showcase-frame") === null };
        });
        if (Math.abs(parseFloat(drawn.position) - saved.showcaseX) > 0.6 || drawn.transform !== `scale(${saved.showcaseZoom})`) failures.push(`${label}: the photo is not drawn where it was placed ${JSON.stringify(drawn)}`);
        if (Math.abs(drawn.frame.w / drawn.frame.h - 16 / 7) > 0.05 || !drawn.hit || !drawn.clipped || !drawn.below) failures.push(`${label}: the zoomed photo spills out of its 16:7 frame ${JSON.stringify(drawn)}`);
        if (width === 390) await run.page.screenshot({ path: "docs/screenshots/image-position/showcase-placed-390.png", clip: { x: 0, y: 0, width, height: 640 } });

        // 2. The profile picture: from this phone, dragged to the top, saved as a 1080px square crop.
        label = `${width}px profile picture`;
        await run.page.evaluate(() => scrollTo(0, 0));
        await run.tap(run.page.locator("#profileInitial"));
        await run.tap(run.page.locator('.profile-photo-sheet [data-choice="phone"]'));
        const chooser = run.page.waitForEvent("filechooser", { timeout: 8000 });
        await run.tap(run.page.locator(".danzstak-confirm-actions button").last());
        await (await chooser).setFiles({ name: "me.png", mimeType: "image/png", buffer: tall });
        await run.page.waitForFunction(() => document.querySelector(".ds-fit-sheet")?.open, null, { timeout: 8000 });
        await run.page.waitForTimeout(300);
        checkSheet(await sheetState(run.page), label, 1, failures, { round: true });
        const round = await run.page.locator(".ds-fit-box").boundingBox(), roundMiddle = centre(round);
        await run.drag(roundMiddle, { x: roundMiddle.x, y: roundMiddle.y + round.height * 0.6 });
        await run.tap(run.page.locator(".ds-fit-save"));
        for (let i = 0; i < 40 && !run.sent.profiles.some(body => body.avatarKey); i++) await run.page.waitForTimeout(150);
        const upload = run.sent.uploads.at(-1), size = upload ? jpegSize(upload.body) : null;
        if (!upload || upload.type !== "image/jpeg" || !size || size.width !== 1080 || size.height !== 1080) failures.push(`${label}: the upload is not a 1080×1080 JPEG ${JSON.stringify({ type: upload?.type, size })}`);
        else {
          const colour = await run.page.evaluate(async b64 => {
            // Through an <img> (the page's connect-src doesn't allow data: for fetch; img-src does).
            const image = new Image(); image.src = "data:image/jpeg;base64," + b64; await image.decode();
            const canvas = new OffscreenCanvas(image.naturalWidth, image.naturalHeight), context = canvas.getContext("2d");
            context.drawImage(image, 0, 0); return [...context.getImageData(540, 756, 1, 1).data].slice(0, 3);
          }, upload.body.toString("base64"));
          if (!(colour[0] > 150 && colour[1] < 90)) failures.push(`${label}: the crop is not where it was placed (pixel at 70% height ${colour}, expected red after dragging to the top)`);
        }
        if (!run.sent.profiles.some(body => body.avatarKey && !("avatarRecrop" in body))) failures.push(`${label}: the new picture was not saved`);

        // 3. The cover: Edit profile → Photos and video → Cover photo → Move to fit, at the cover's own box.
        label = `${width}px cover`;
        await run.page.evaluate(() => scrollTo(0, 0));
        const coverBox = await run.page.locator(".cover").boundingBox();
        await run.tap(run.page.locator('.profile-actions button[data-icon="edit"]'));
        await run.tap(run.page.locator(".profile-edit-section > summary").first());
        await run.tap(run.page.locator(".profile-media-menu > summary", { hasText: "Cover photo" }));
        await run.tap(run.page.locator('.profile-media-menu button[data-media-field="cover"]', { hasText: "Move to fit" }));
        await run.page.waitForFunction(() => document.querySelector(".ds-fit-sheet")?.open, null, { timeout: 8000 });
        await run.page.waitForTimeout(300);
        checkSheet(await sheetState(run.page), label, coverBox.width / coverBox.height, failures);
        const coverPreview = await run.page.locator(".ds-fit-box").boundingBox(), coverMiddle = centre(coverPreview);
        await run.drag(coverMiddle, { x: coverMiddle.x + coverPreview.width * 0.2, y: coverMiddle.y });
        await run.tap(run.page.locator(".ds-fit-step").last());
        await run.tap(run.page.locator(".ds-fit-save"));
        await run.page.waitForFunction(() => !document.querySelector(".ds-fit-sheet")?.open, null, { timeout: 8000 });
        await run.page.waitForTimeout(400);
        const coverSaved = run.sent.profiles.at(-1) || {};
        if (Object.keys(coverSaved).sort().join(",") !== "coverX,coverY,coverZoom" || !(coverSaved.coverX < 45) || !(coverSaved.coverZoom > 1.1)) failures.push(`${label}: Save did not send the moved and zoomed cover ${JSON.stringify(coverSaved)}`);
        const coverDrawn = await run.page.evaluate(() => { const style = getComputedStyle(document.querySelector(".cover")); return { position: style.backgroundPosition, size: style.backgroundSize }; });
        if (Math.abs(parseFloat(coverDrawn.position) - coverSaved.coverX) > 0.6 || !/px/.test(coverDrawn.size)) failures.push(`${label}: the cover is not drawn where it was placed ${JSON.stringify(coverDrawn)}`);
        if (run.errors.length) failures.push(`${width}px profile: page errors ${run.errors.join(" | ")}`);
      } catch (error) { failures.push(`${label}: ${error.message.split("\n")[0]}`); }
      await run.context.close();

      // 4. Tribe cover (Elder): Move to fit shows the square Tribe picture too; cover and list picture follow it.
      label = `${width}px Tribe cover`;
      const tribe = { id: tribeId, name: "Bay Area Hardcore", category: "Local Scenes", description: "Shows and rides.", memberCount: 12, isElder: true, isOwner: true, coverUrl: `${cdn}/users/me/wide.png`, coverPosition: { x: 50, y: 50, zoom: 1 } };
      run = await setup(browser, width, { groups: [tribe] });
      try {
        await run.page.goto(`${base}/feed.html?view=groups&tribe=${tribeId}#groups`, { waitUntil: "domcontentloaded" });
        await run.page.locator(".tribe-cover-move").waitFor({ timeout: 15000 });
        const hero = await run.page.locator(".tribe-hero-cover").boundingBox();
        await run.tap(run.page.locator(".tribe-cover-move"));
        await run.page.waitForFunction(() => document.querySelector(".ds-fit-sheet")?.open, null, { timeout: 8000 });
        await run.page.waitForTimeout(300);
        const state = await sheetState(run.page);
        checkSheet(state, label, hero.width / hero.height, failures);
        if (state.extras.length !== 1 || Math.abs(state.extras[0].aspect - 1) > 0.05 || !/Tribe picture/.test(state.extras[0].label)) failures.push(`${label}: the square Tribe picture preview is missing ${JSON.stringify(state.extras)}`);
        const box = await run.page.locator(".ds-fit-box").boundingBox(), middle = centre(box);
        await run.drag(middle, { x: middle.x + box.width * 0.25, y: middle.y });
        if (width === 390) await run.page.screenshot({ path: "docs/screenshots/image-position/tribe-sheet-390.png" });
        await run.tap(run.page.locator(".ds-fit-save"));
        await run.page.waitForFunction(() => !document.querySelector(".ds-fit-sheet")?.open, null, { timeout: 8000 });
        await run.page.waitForTimeout(400);
        const sent = run.sent.covers.at(-1)?.position;
        if (!sent || !(sent.x < 45) || "mediaKey" in run.sent.covers.at(-1)) failures.push(`${label}: Save did not send the moved position alone ${JSON.stringify(run.sent.covers)}`);
        const drawn = await run.page.evaluate(() => getComputedStyle(document.querySelector(".tribe-hero-cover")).backgroundPosition);
        if (!sent || Math.abs(parseFloat(drawn) - sent.x) > 0.6) failures.push(`${label}: the cover is not drawn where it was placed (${drawn} vs ${sent?.x})`);
        await run.tap(run.page.locator(".ds-app-bar-screen-back")); // F13: the bar's ← goes back to the list
        await run.page.locator(".group-card-cover.has-photo").first().waitFor({ timeout: 8000 });
        const tile = await run.page.evaluate(() => getComputedStyle(document.querySelector(".group-card-cover.has-photo")).backgroundPosition);
        if (!sent || Math.abs(parseFloat(tile) - sent.x) > 0.6) failures.push(`${label}: the Tribes-list picture is not drawn from the same point (${tile})`);
        if (run.errors.length) failures.push(`${label}: page errors ${run.errors.join(" | ")}`);
      } catch (error) { failures.push(`${label}: ${error.message.split("\n")[0]}`); }
      await run.context.close();
    }

    // 5. A member who isn't an Elder sees no cover tools (F13).
    let run = await setup(browser, 390, { groups: [{ id: tribeId, name: "Bay Area Hardcore", category: "Local Scenes", description: "", memberCount: 12, isElder: false, isOwner: false, joined: true, coverUrl: `${cdn}/users/me/wide.png` }] });
    try {
      await run.page.goto(`${base}/feed.html?view=groups&tribe=${tribeId}#groups`, { waitUntil: "domcontentloaded" });
      await run.page.locator(".tribe-hero-cover").waitFor({ timeout: 15000 });
      await run.page.waitForTimeout(500);
      if (await run.page.locator(".tribe-cover-tools, .tribe-cover-move, .tribe-cover-edit").count()) failures.push("390px member: cover tools show to someone who isn't an Elder");
    } catch (error) { failures.push(`390px member: ${error.message.split("\n")[0]}`); }
    await run.context.close();

    // 6. Before the call-signaling deploy: the photo keeps its place on this phone, and the member is told.
    run = await setup(browser, 360, { profile: { showcase: `${cdn}/users/me/wide.png` }, positionsStored: false });
    try {
      await run.page.goto(`${base}/profile.html`, { waitUntil: "domcontentloaded" });
      await run.page.locator(".profile-showcase-frame").waitFor({ timeout: 15000 });
      await run.tap(run.page.locator(".profile-showcase-more")); await run.page.waitForTimeout(350); // the sheet slides up
      await run.tap(run.page.locator(".ds-sheet.is-open .profile-showcase-move"));
      await run.page.waitForFunction(() => document.querySelector(".ds-fit-sheet")?.open, null, { timeout: 8000 });
      const box = await run.page.locator(".ds-fit-box").boundingBox(), middle = centre(box);
      await run.drag(middle, { x: middle.x - box.width * 0.3, y: middle.y });
      await run.tap(run.page.locator(".ds-fit-save"));
      await run.page.waitForTimeout(800);
      const note = await run.page.evaluate(() => document.body.innerText.includes("Saved on this phone. Everyone else sees it after DanzStak's next update."));
      if (!note) failures.push("360px before the deploy: the member isn't told the position is kept on this phone only");
      const before = await run.page.evaluate(() => getComputedStyle(document.querySelector(".profile-showcase-photo")).objectPosition);
      await run.page.reload({ waitUntil: "domcontentloaded" });
      await run.page.locator(".profile-showcase-frame").waitFor({ timeout: 15000 });
      await run.page.waitForTimeout(400);
      const after = await run.page.evaluate(() => getComputedStyle(document.querySelector(".profile-showcase-photo")).objectPosition);
      if (!(parseFloat(before) > 55) || before !== after) failures.push(`360px before the deploy: the photo lost its place after a reload (${before} → ${after})`);
      if (run.errors.length) failures.push(`360px before the deploy: page errors ${run.errors.join(" | ")}`);
    } catch (error) { failures.push(`360px before the deploy: ${error.message.split("\n")[0]}`); }
    await run.context.close();

    // 7. In Italian the sheet reads Italian.
    run = await setup(browser, 390, { profile: { showcase: `${cdn}/users/me/wide.png`, showcaseX: 50, showcaseY: 50, showcaseZoom: 1 }, language: "it" });
    try {
      await run.page.goto(`${base}/profile.html`, { waitUntil: "domcontentloaded" });
      await run.page.locator(".profile-showcase-frame").waitFor({ timeout: 15000 });
      await run.tap(run.page.locator(".profile-showcase-more")); await run.page.waitForTimeout(350); // the sheet slides up
      await run.tap(run.page.locator(".ds-sheet.is-open .profile-showcase-move"));
      await run.page.waitForFunction(() => document.querySelector(".ds-fit-sheet")?.open, null, { timeout: 8000 });
      await run.page.waitForTimeout(300);
      const state = await sheetState(run.page);
      if (state.title !== "Sposta la tua foto" || state.save !== "Salva" || !/Trascina/.test(state.hint || "")) failures.push(`390px Italian: the sheet isn't in Italian ${JSON.stringify({ title: state.title, save: state.save, hint: state.hint })}`);
    } catch (error) { failures.push(`390px Italian: ${error.message.split("\n")[0]}`); }
    await run.context.close();
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Move-to-fit checks passed at 320/360/390/430px: the photo under the name (drag, pinch, Save, drawn and clipped), the profile picture (round sheet, 1080px crop where placed), the cover (drag + zoom), the Tribe cover with its square picture (Elders only), the before-deploy fallback, and Italian.");
})();
