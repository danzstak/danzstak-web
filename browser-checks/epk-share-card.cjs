"use strict";
// Owner 2026-11-23: a private EPK link posted in Mix showed only "EPK Builder | DanzStak" — "Should have a preview" — then
// the builder's ALL ACCESS laminate: "Like this". Real browser, the EPK builder with a published EPK, at 320/390px and
// 1280px:
//   - the public link is danzstak.com/e/<id> (where link previews read the card), and a new private review link is
//     danzstak.com/e/<id>#token=…;
//   - the card shows under the links: a 1200x630 JPEG under 300 KB, uploaded once and turned on (POST /epk/share-card with
//     the artist's own upload), dark ground with the light laminate in the middle square and "EPK" on the left;
//   - an up-to-date card isn't uploaded again on the next visit;
//   - "Show my EPK card in link previews" off (centre tap) turns it off and hides the card; the choice is kept;
//   - until the server offers danzstak.com/e/ (its answers carry shareUrl), the long epk.html links stay and no card is made.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/epk-share-card.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const me = "11111111-1111-4111-8111-111111111111", prefix = "0123456789abcdef01234567";
const photo = fs.readFileSync(path.join(__dirname, "..", "assets", "danzstak-logo.png"));
const kit = { artistName: "Eroticon", genres: ["Techno", "Electro"], hometown: "San Francisco", heroImage: "https://dk7kawr758jtd.cloudfront.net/epk/0123456789abcdef01234567/hero.png", shortBio: "Techno and electro." };

function jpegSize(bytes) {
  assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8, "a JPEG");
  for (let at = 2; at < bytes.length;) {
    if (bytes[at] !== 0xff) { at += 1; continue; }
    const marker = bytes[at + 1], length = bytes.readUInt16BE(at + 2);
    if (marker >= 0xc0 && marker <= 0xc2) return { height: bytes.readUInt16BE(at + 5), width: bytes.readUInt16BE(at + 7) };
    at += 2 + length;
  }
  throw new Error("no JPEG frame header");
}

async function run(browser, width, state) {
  const desktop = width >= 1000, tag = `${width}px`;
  const context = await browser.newContext({ viewport: { width, height: desktop ? 900 : 844 }, isMobile: !desktop, hasTouch: !desktop, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [], uploads = [], posts = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://dk7kawr758jtd.cloudfront.net/**", route => route.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: photo }));
  await page.route("https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com/**", route => { uploads.push(route.request().postDataBuffer()); return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "" }); });
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    if (p === "/auth/session") return json({ authenticated: true, user: { sub: me } });
    if (p === "/profiles") return json({ profile: { memberId: me, name: "Eroticon", username: "eroticon", handle: "eroticon", isOwner: true, cloudProfile: true } });
    if (p === "/epk" && request.method() === "GET") return json(state.legacy ? { kit, publicId: "eroticon", published: true, privateShared: false, updatedAt: "2026-11-23T00:00:00Z" } : { kit, publicId: "eroticon", published: true, privateShared: false, updatedAt: "2026-11-23T00:00:00Z", shareUrl: "https://danzstak.com/e/eroticon", shareCard: state.on, shareCardOff: state.off, shareCardSig: state.sig });
    if (p === "/stories" && request.method() === "POST") return json({ uploadUrl: "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com/users/put", mediaKey: `users/${prefix}/22222222-3333-4444-8555-666666666666.jpg`, mediaType: "image" });
    if (p === "/epk/share-card") {
      const body = request.postDataJSON(); posts.push(body);
      if (body.off) { Object.assign(state, { on: false, off: true, sig: "" }); return json({ shareCard: false, shareCardOff: true, shareCardSig: "", shareUrl: "https://danzstak.com/e/eroticon" }); }
      Object.assign(state, { on: true, off: false, sig: body.sig }); return json({ shareCard: true, shareCardSig: body.sig, shareUrl: "https://danzstak.com/e/eroticon" });
    }
    if (p === "/epk/share") return json(state.legacy ? { privateShared: true, publicId: "eroticon", token: "c".repeat(64) } : { privateShared: true, publicId: "eroticon", token: "c".repeat(64), shareUrl: "https://danzstak.com/e/eroticon" });
    return json({});
  });
  await page.goto(`${base}/epk.html`, { waitUntil: "domcontentloaded" });
  await page.locator("#publicLinkRow").waitFor({ state: "visible", timeout: 15000 });
  return { context, page, errors, uploads, posts, tag };
}

async function centreTap(page, selector, touch) {
  const spot = await page.evaluate(sel => { const node = document.querySelector(sel); node.scrollIntoView({ block: "center" }); const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2; return { x, y, h: r.height, hit: node.contains(document.elementFromPoint(x, y)) || document.elementFromPoint(x, y)?.closest("label")?.contains(node) }; }, selector);
  assert.ok(spot.hit && spot.h >= 44, `${selector} is covered or under 44px (${JSON.stringify(spot)})`);
  if (touch) await page.touchscreen.tap(spot.x, spot.y); else await page.mouse.click(spot.x, spot.y);
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const state = { on: false, off: false, sig: "" };
      // First visit: the card is drawn, uploaded once and turned on.
      let run1 = await run(browser, width, state);
      const { page, tag } = run1;
      assert.equal(await page.locator("#publicLink").textContent(), "https://danzstak.com/e/eroticon", `${tag}: the public link is the short one previews read`);
      await page.waitForFunction(() => { const image = document.getElementById("epkCardImage"); return image && !image.hidden && image.naturalWidth > 0; }, null, { timeout: 15000 });
      assert.equal(run1.uploads.length, 1, `${tag}: the card is uploaded once`);
      const bytes = run1.uploads[0];
      assert.ok(bytes.length > 1000 && bytes.length <= 300 * 1024, `${tag}: the card is under 300 KB (${bytes.length})`);
      assert.deepEqual(jpegSize(bytes), { width: 1200, height: 630 }, `${tag}: a 1200x630 JPEG`);
      assert.equal(run1.posts.length, 1);
      assert.match(run1.posts[0].mediaKey, new RegExp(`^users/${prefix}/[a-f0-9-]{36}\\.jpg$`), `${tag}: turned on with the artist's own upload`);
      assert.match(run1.posts[0].sig, /^[a-f0-9]{32}$/);
      // What the card looks like: dark ground, the light laminate in the middle square, "EPK" in white on the left.
      const look = await page.evaluate(async () => {
        const image = document.getElementById("epkCardImage"), canvas = document.createElement("canvas"); canvas.width = 1200; canvas.height = 630;
        const context = canvas.getContext("2d"); context.drawImage(image, 0, 0);
        const at = (x, y) => { const [r, g, b] = context.getImageData(x, y, 1, 1).data; return (r + g + b) / 3; };
        let white = 0; for (let x = 52; x < 280; x += 2) for (let y = 230; y < 330; y += 2) if (at(x, y) > 200) white += 1;
        return { ground: at(120, 560), laminate: at(470, 315), laminateRight: at(735, 330), epkText: white };
      });
      assert.ok(look.ground < 40, `${tag}: dark ground (${look.ground})`);
      assert.ok(look.laminate > 200 && look.laminateRight > 200, `${tag}: the light laminate sits in the middle square (${JSON.stringify(look)})`);
      assert.ok(look.epkText > 200, `${tag}: "EPK" is written on the left (${look.epkText})`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `${tag}: the page scrolls sideways`);
      if (captureDir) { fs.mkdirSync(captureDir, { recursive: true }); fs.writeFileSync(path.join(captureDir, `epk-card-${width}.jpg`), bytes); await page.locator("#epkCardRow").screenshot({ path: path.join(captureDir, `epk-card-row-${width}.png`) }); }

      // A new private review link is the short link with its token.
      await page.evaluate(() => { document.querySelector(".epk-private-share").open = true; });
      await page.locator("#createPrivateLink").click();
      await page.locator("#privateLinkRow").waitFor({ state: "visible" });
      assert.equal(await page.locator("#privateLink").textContent(), `https://danzstak.com/e/eroticon#token=${"c".repeat(64)}`, `${tag}: the private link`);
      await run1.context.close();
      assert.deepEqual(run1.errors, [], `${tag}: page errors`);

      // Next visit, nothing changed: no new upload.
      run1 = await run(browser, width, state);
      await run1.page.waitForFunction(() => !document.getElementById("epkCardImage").hidden, null, { timeout: 15000 });
      assert.equal(run1.uploads.length, 0, `${tag}: an up-to-date card isn't uploaded again`);

      // Off: the card goes, and the choice is kept.
      await centreTap(run1.page, "#epkCardOn", width < 1000);
      await run1.page.waitForFunction(() => document.getElementById("epkCardImage").hidden && /plain DanzStak card/.test(document.getElementById("epkCardStatus").textContent), null, { timeout: 10000 });
      assert.deepEqual(run1.posts.at(-1), { off: true }, `${tag}: turned off on the server`);
      await run1.context.close();
      run1 = await run(browser, width, state);
      await run1.page.waitForFunction(() => /plain DanzStak card/.test(document.getElementById("epkCardStatus").textContent), null, { timeout: 10000 });
      assert.equal(await run1.page.locator("#epkCardOn").isChecked(), false, `${tag}: off stays off`);
      assert.equal(run1.uploads.length + run1.posts.length, 0, `${tag}: nothing is drawn or sent while it's off`);
      await run1.context.close();
      assert.deepEqual(run1.errors, [], `${tag}: page errors`);
    }
    // Before the server offers danzstak.com/e/ (an older Auth API, or before the Amplify rewrite): the long links, no card.
    const legacy = await run(browser, 390, { legacy: true });
    await legacy.page.waitForTimeout(1500);
    assert.match(await legacy.page.locator("#publicLink").textContent(), /\/epk\.html\?id=eroticon$/, "legacy server: the long link");
    assert.equal(await legacy.page.locator("#epkCardRow").isHidden(), true, "legacy server: no card row");
    assert.equal(legacy.uploads.length + legacy.posts.length, 0, "legacy server: no card is drawn or sent");
    await legacy.context.close();
  } finally { await browser.close(); }
  console.log("EPK share card checks passed: links are danzstak.com/e/<id> (and #token= for private review), the laminate card is a 1200x630 JPEG under 300 KB uploaded once with the artist's own upload and shown under the links, it isn't uploaded again when up to date, and off turns it off and stays off (320/390/1280px); before the server offers the short link, the long links stay and no card is made.");
})().catch(error => { console.error(error); process.exit(1); });
