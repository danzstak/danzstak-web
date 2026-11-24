"use strict";
// Spec 46, Train A (owner 2026-11-24: "need a way to see my previous published epk"). Real browser, the EPK builder with a
// published EPK and a newer draft, at 320/360/390/430px (touch, centre taps) and once in Italian:
//   - the line under Publish says venues see the version published on a date and the changes are a draft;
//   - "Published versions" opens the list (newest first, "Latest" on the first), every row fits the screen, 44px targets;
//   - "Bring back" asks first, then fills the builder with that version and says so; the list closes;
//   - Save private draft sends action "draft" (it never takes the EPK offline);
//   - Unpublish asks first: "Keep it online" sends nothing, "Unpublish" sends action "unpublish";
//   - View (epk.html?version=…) shows that version to its owner with "Back to my EPK" and "Bring back";
//   - epk.html?restore=… brings a version back after the builder loads, then the address is plain epk.html again.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/epk-versions.cjs
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const me = "11111111-1111-4111-8111-111111111111";
const latest = "2026-11-20T18:30:00.000Z", older = "2026-10-02T09:15:00.000Z";
const draft = { artistName: "Eroticon", shortBio: "The draft I'm still working on.", genres: ["Techno"] };
const versions = {
  [latest]: { artistName: "Eroticon", shortBio: "Techno and electro since 1988.", genres: ["Techno"] },
  [older]: { artistName: "Eroticon", shortBio: "Vinyl on Sleeping Dragon Records since 1996.", genres: ["Electro"] }
};

async function open(browser, width, url, { locale = "en-US" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, locale, serviceWorkers: "block", deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [], posts = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    if (p === "/auth/session") return json({ authenticated: true, user: { sub: me } });
    if (p === "/profiles") return json({ profile: { memberId: me, name: "Eroticon", username: "eroticon", handle: "eroticon", isOwner: true, cloudProfile: true } });
    if (p === "/epk" && request.method() === "GET") {
      if (url.searchParams.get("versions") === "1") return json({ versions: [latest, older].map(id => ({ id, publishedAt: id, artistName: "Eroticon" })) });
      const id = url.searchParams.get("version");
      if (id !== null) return versions[id] ? json({ kit: versions[id], publishedAt: id }) : json({ error: "That version is no longer kept." }, 404);
      return json({ kit: draft, publicId: "eroticon", published: true, publishedAt: latest, draftChanged: true, privateShared: false, updatedAt: "2026-11-24T10:00:00.000Z", shareUrl: "https://danzstak.com/e/eroticon", shareCardOff: true });
    }
    if (p === "/epk" && request.method() === "POST") {
      const body = request.postDataJSON(); posts.push(body);
      if (body.action === "unpublish") return json({ publicId: "eroticon", published: false, publishedAt: "", draftChanged: false, updatedAt: "2026-11-24T10:05:00.000Z", cleanupPending: 0, shareUrl: "https://danzstak.com/e/eroticon" });
      return json({ publicId: "eroticon", published: true, publishedAt: latest, draftChanged: true, updatedAt: "2026-11-24T10:05:00.000Z", cleanupPending: 0, shareUrl: "https://danzstak.com/e/eroticon" });
    }
    return json({});
  });
  await page.goto(`${base}/${url}`, { waitUntil: "domcontentloaded" });
  return { context, page, errors, posts };
}

async function centreTap(page, selector, tag) {
  const spot = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (!node) return null;
    node.scrollIntoView({ block: "center" });
    const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, w: r.width, h: r.height, hit: Boolean(top && (top === node || node.contains(top))) };
  }, selector);
  assert.ok(spot, `${tag}: ${selector} exists`);
  assert.ok(spot.hit, `${tag}: ${selector} is covered at its centre (${JSON.stringify(spot)})`);
  assert.ok(spot.h >= 44 && spot.w >= 44, `${tag}: ${selector} is a 44px target (${JSON.stringify(spot)})`);
  await page.touchscreen.tap(spot.x, spot.y);
}

async function noSideScroll(page, tag) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `${tag}: the page scrolls sideways by ${overflow}px`);
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      const tag = `${width}px`;
      const { context, page, errors, posts } = await open(browser, width, "epk.html");
      await page.locator("#epkPublishState").waitFor({ state: "visible", timeout: 15000 });
      assert.match(await page.locator("#epkPublishState").textContent(), /^Venues see the version you published on .*20.*2026.*\. Your changes are a draft\.$/, `${tag}: the line says what venues see`);
      assert.equal(await page.inputValue("#shortBio"), draft.shortBio, `${tag}: the builder opens the draft`);

      // The list.
      await centreTap(page, "#epkVersionsOpen", tag);
      await page.locator("#epkVersionsList .epk-version").nth(1).waitFor({ timeout: 10000 });
      const rows = await page.$$eval("#epkVersionsList .epk-version", list => list.map(row => {
        const r = row.getBoundingClientRect();
        return { text: row.textContent, left: r.left, right: r.right, buttons: [...row.querySelectorAll("a,button")].map(node => { const b = node.getBoundingClientRect(); return { w: b.width, h: b.height, right: b.right }; }) };
      }));
      assert.equal(rows.length, 2, `${tag}: both versions are listed`);
      assert.match(rows[0].text, /Latest/, `${tag}: the newest is marked Latest`);
      assert.doesNotMatch(rows[1].text, /Latest/);
      assert.match(rows[0].text, /2026/);
      for (const row of rows) {
        assert.ok(row.left >= 0 && row.right <= width, `${tag}: a version row runs off the screen (${row.left}..${row.right})`);
        for (const button of row.buttons) assert.ok(button.h >= 44 && button.w >= 44 && button.right <= width, `${tag}: View/Bring back are 44px and on screen (${JSON.stringify(button)})`);
      }
      assert.equal(await page.getAttribute("#epkVersionsList .epk-version:nth-child(2) .epk-version__view", "href"), `epk.html?version=${encodeURIComponent(older)}`);
      if (captureDir && width === 390) await page.screenshot({ path: path.join(captureDir, `epk-versions-list-${width}.png`) });

      // The ✕ in the header closes the list (an icon with its name kept).
      assert.equal(await page.getAttribute("#epkVersionsClose", "aria-label"), "Close");
      await centreTap(page, "#epkVersionsClose", tag);
      await page.waitForFunction(() => !document.getElementById("epkVersionsDialog").open, null, { timeout: 5000 });
      await centreTap(page, "#epkVersionsOpen", tag);
      await page.locator("#epkVersionsList .epk-version").nth(1).waitFor({ timeout: 10000 });

      // Bring back asks first, then fills the builder.
      await centreTap(page, "#epkVersionsList .epk-version:nth-child(2) .epk-version__back", tag);
      await page.locator(".danzstak-confirm-dialog").waitFor({ timeout: 5000 });
      assert.match(await page.locator(".danzstak-confirm-dialog h2").textContent(), /Bring back this version\?/);
      await centreTap(page, ".danzstak-confirm-dialog button[value=confirm]", tag);
      await page.waitForFunction(text => document.getElementById("shortBio").value === text, versions[older].shortBio, { timeout: 5000 });
      assert.match(await page.locator("#epkStatus").textContent(), /^Brought back the version you published on .*2026.*\. Save the draft, or publish it to make it live again\.$/);
      assert.equal(await page.evaluate(() => document.getElementById("epkVersionsDialog").open), false, `${tag}: the list closes`);

      // Save draft: action "draft".
      await centreTap(page, "#saveDraft", tag);
      await page.waitForFunction(() => /Venues still see your published EPK/.test(document.getElementById("epkStatus").textContent), null, { timeout: 5000 });
      assert.equal(posts.at(-1).action, "draft", `${tag}: Save private draft sends a draft`);
      assert.equal(posts.at(-1).kit.shortBio, versions[older].shortBio, `${tag}: the brought-back version is what's saved`);

      // Unpublish asks first.
      const before = posts.length;
      await centreTap(page, "#unpublishEpk", tag);
      await page.locator(".danzstak-confirm-dialog").waitFor({ timeout: 5000 });
      assert.match(await page.locator(".danzstak-confirm-dialog h2").textContent(), /Take this EPK offline\?/);
      assert.match(await page.locator(".danzstak-confirm-dialog button[value=cancel]").textContent(), /Keep it online/);
      await centreTap(page, ".danzstak-confirm-dialog button[value=cancel]", tag);
      await page.locator(".danzstak-confirm-dialog").waitFor({ state: "detached", timeout: 5000 });
      await page.waitForTimeout(300);
      assert.equal(posts.length, before, `${tag}: Keep it online sends nothing`);
      await centreTap(page, "#unpublishEpk", tag);
      await centreTap(page, ".danzstak-confirm-dialog button[value=confirm]", tag);
      await page.waitForFunction(() => /EPK unpublished/.test(document.getElementById("epkStatus").textContent), null, { timeout: 5000 });
      assert.equal(posts.at(-1).action, "unpublish");
      assert.equal(await page.locator("#epkPublishState").isHidden(), true, `${tag}: no "published" line once offline`);
      await noSideScroll(page, tag);
      assert.deepEqual(errors, [], `${tag}: page errors`);
      await context.close();

      // View a version: only its owner, with the way back.
      const view = await open(browser, width, `epk.html?version=${encodeURIComponent(older)}`);
      await view.page.locator(".epk-public-notice").waitFor({ timeout: 15000 });
      assert.match(await view.page.locator(".epk-public-notice").textContent(), /The version you published on .*2026.*\. Only you can see this page\./, `${tag}: the version page says whose it is`);
      assert.match(await view.page.locator("#epkPreview").textContent(), /Vinyl on Sleeping Dragon Records since 1996\./, `${tag}: that version is shown`);
      assert.equal(await view.page.getAttribute(".epk-public-notice a[href^='epk.html?restore=']", "href"), `epk.html?restore=${encodeURIComponent(older)}`);
      assert.equal(await view.page.locator(".epk-public-notice a[href='epk.html']").count(), 1, `${tag}: Back to my EPK`);
      await noSideScroll(view.page, `${tag} version page`);
      if (captureDir && width === 390) await view.page.screenshot({ path: path.join(captureDir, `epk-versions-view-${width}.png`) });
      assert.deepEqual(view.errors, [], `${tag}: version page errors`);
      await view.context.close();

      // ?restore=… from that page.
      const restore = await open(browser, width, `epk.html?restore=${encodeURIComponent(older)}`);
      await restore.page.locator(".danzstak-confirm-dialog").waitFor({ timeout: 15000 });
      await centreTap(restore.page, ".danzstak-confirm-dialog button[value=confirm]", tag);
      await restore.page.waitForFunction(text => document.getElementById("shortBio").value === text, versions[older].shortBio, { timeout: 5000 });
      assert.equal(new URL(restore.page.url()).search, "", `${tag}: the address is plain epk.html again`);
      assert.deepEqual(restore.errors, [], `${tag}: restore errors`);
      await restore.context.close();
      console.log(`ok ${tag}`);
    }

    // Every word in the visitor's language.
    const italian = await open(browser, 390, "epk.html", { locale: "it-IT" });
    await italian.page.locator("#epkPublishState").waitFor({ state: "visible", timeout: 15000 });
    await italian.page.waitForFunction(() => /I locali vedono/.test(document.getElementById("epkPublishState").textContent), null, { timeout: 5000 });
    assert.match(await italian.page.locator("#epkPublishState").textContent(), /^I locali vedono la versione che hai pubblicato il .*2026.*\. Le tue modifiche sono una bozza\.$/);
    assert.match(await italian.page.locator("#epkVersionsOpen").textContent(), /^Versioni pubblicate$/);
    const cardRow = await italian.page.locator("#epkCardRow").textContent();
    assert.ok(!/Links to this EPK|Show my EPK card/.test(cardRow), `it: the link-preview lines are still English (${cardRow})`);
    await centreTap(italian.page, "#epkVersionsOpen", "it 390px");
    await italian.page.locator("#epkVersionsList .epk-version").nth(1).waitFor({ timeout: 10000 });
    const words = await italian.page.locator("#epkVersionsDialog").textContent();
    for (const english of ["Published versions", "Latest", "View", "Bring back", "What venues saw"]) assert.ok(!words.includes(english), `it: "${english}" is still English`);
    assert.match(words, /Ultima/); assert.match(words, /Ripristina/); 
    if (captureDir) await italian.page.screenshot({ path: path.join(captureDir, "epk-versions-list-it-390.png") });
    await centreTap(italian.page, "#epkVersionsList .epk-version:nth-child(2) .epk-version__back", "it 390px");
    await italian.page.locator(".danzstak-confirm-dialog").waitFor({ timeout: 5000 });
    await italian.page.waitForFunction(() => /Ripristinare questa versione\?/.test(document.querySelector(".danzstak-confirm-dialog h2").textContent), null, { timeout: 5000 });
    await centreTap(italian.page, ".danzstak-confirm-dialog button[value=confirm]", "it 390px");
    await italian.page.waitForFunction(() => /^Ripristinata la versione pubblicata il .*2026/.test(document.getElementById("epkStatus").textContent), null, { timeout: 5000 });
    assert.deepEqual(italian.errors, [], "it: page errors");
    await italian.context.close();
    console.log("ok it-IT 390px");
    console.log("EPK versions browser check passed.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
