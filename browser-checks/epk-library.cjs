"use strict";
// Spec 47, Train B part 1 (owner 2026-11-24: "users may have a bunch of epk", "and also several per artist", "a limit of
// 5 epk per artist"). Real browser, the EPK builder at 320/360/390/430px (touch, centre taps), plus Italian:
//   - the switch above the title says "<artist> · <label> ▾" for the EPK being built, and opens My EPKs;
//   - My EPKs groups the account's EPKs by artist, with "N of 5" and each name's verification state;
//   - every row, Rename and Delete fit the screen and are 44px targets; nothing scrolls sideways;
//   - + New EPK as a copy sends { action:"create", from } and opens the new EPK (epk.html?epk=<id>);
//   - the builder then loads, saves and lists versions for that EPK only (?epk= on GET, epkId on POST);
//   - a 6th EPK for one artist is refused on the screen before anything is sent;
//   - Rename sends the new label and the switch follows;
//   - an EPK deleted on another device sends the builder back to the first one.
// Run: node scripts/static-server.cjs 8132 . then DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/epk-library.cjs
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const me = "11111111-1111-4111-8111-111111111111";
const dj = "0a1b2c3d4e", fest = "1a2b3c4d5e", label = "2a3b4c5d6e";

function store() {
  return {
    epks: {
      main: { kit: { artistName: "Eroticon", shortBio: "Club set.", genres: ["Techno"] }, label: "", published: true, publishedAt: "2026-11-20T18:30:00.000Z", updatedAt: "2026-11-24T10:00:00.000Z" },
      [dj]: { kit: { artistName: "Eroticon", shortBio: "DJ set.", genres: ["Electro"] }, label: "DJ set", published: false, publishedAt: "", updatedAt: "2026-11-23T10:00:00.000Z" },
      [label]: { kit: { artistName: "Sleeping Dragon Records", shortBio: "The label.", genres: ["Electro"] }, label: "Label", published: true, publishedAt: "2026-11-21T09:00:00.000Z", updatedAt: "2026-11-22T10:00:00.000Z" }
    },
    calls: []
  };
}

async function open(browser, width, url, state, { locale = "en-US" } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, locale, serviceWorkers: "block", deviceScaleFactor: 1 });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), u = new URL(request.url()), p = u.pathname, method = request.method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
    if (p === "/auth/session") return json({ authenticated: true, user: { sub: me } });
    if (p === "/profiles") return json({ profile: { memberId: me, name: "Eroticon", username: "eroticon", handle: "eroticon", isOwner: true, cloudProfile: true } });
    if (p === "/epk") {
      const epkId = method === "POST" ? (request.postDataJSON().epkId || "main") : (u.searchParams.get("epk") || "main");
      state.calls.push({ method, epkId, query: Object.fromEntries(u.searchParams), body: method === "POST" ? request.postDataJSON() : null });
      const epk = state.epks[epkId];
      if (method === "GET" && u.searchParams.get("list") === "1") {
        const epks = Object.entries(state.epks).map(([id, item]) => ({ epkId: id, label: item.label, artistName: item.kit.artistName, published: item.published, publishedAt: item.publishedAt, updatedAt: item.updatedAt, shareUrl: "" }));
        return json({ epks, names: [{ artistName: "Eroticon", count: epks.filter(item => item.artistName === "Eroticon").length, status: "verified" }, { artistName: "Sleeping Dragon Records", count: 1, status: "not_verified" }], maxPerArtist: 5, maxPerAccount: 50 });
      }
      if (method === "GET" && u.searchParams.get("versions") === "1") return json({ versions: [], epkId });
      if (method === "GET") return epk ? json({ kit: epk.kit, epkId, label: epk.label, publicId: epkId, published: epk.published, publishedAt: epk.publishedAt, draftChanged: false, privateShared: false, updatedAt: epk.updatedAt, shareCardOff: true }) : json({ error: "That EPK was deleted. Open another one from My EPKs." }, 404);
      if (method === "DELETE") { delete state.epks[epkId]; return json({ deleted: true, epkId }); }
      const body = request.postDataJSON();
      if (body.action === "create") {
        const newId = "3a4b5c6d7e", source = body.from ? state.epks[body.from || "main"] : null;
        state.epks[newId] = { kit: source ? { ...source.kit } : { artistName: body.artistName }, label: body.label, published: false, publishedAt: "", updatedAt: "2026-11-25T10:00:00.000Z" };
        return json({ epkId: newId, label: body.label, published: false });
      }
      if (body.action === "rename") { epk.label = body.label; return json({ epkId, label: body.label }); }
      if (!epk) return json({ error: "That EPK was deleted. Open another one from My EPKs." }, 404);
      epk.kit = body.kit;
      return json({ epkId, label: epk.label, publicId: epkId, published: epk.published, publishedAt: epk.publishedAt, draftChanged: false, updatedAt: "2026-11-25T10:05:00.000Z", cleanupPending: 0 });
    }
    return json({});
  });
  await page.goto(`${base}/${url}`, { waitUntil: "domcontentloaded" });
  return { context, page, errors };
}

async function centreTap(page, selector, tag, { min = 44 } = {}) {
  const spot = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    if (!node) return null;
    node.scrollIntoView({ block: "center" });
    const r = node.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, top = document.elementFromPoint(x, y);
    return { x, y, w: r.width, h: r.height, right: r.right, hit: Boolean(top && (top === node || node.contains(top))) };
  }, selector);
  assert.ok(spot, `${tag}: ${selector} exists`);
  assert.ok(spot.hit, `${tag}: ${selector} is covered at its centre (${JSON.stringify(spot)})`);
  assert.ok(spot.h >= min && spot.w >= min, `${tag}: ${selector} is a 44px target (${JSON.stringify(spot)})`);
  await page.touchscreen.tap(spot.x, spot.y);
}

async function fits(page, tag) {
  const result = await page.evaluate(() => {
    const width = document.documentElement.clientWidth, out = [];
    for (const node of document.querySelectorAll("#epkLibraryDialog .epk-lib-row, #epkLibraryDialog .epk-lib-row button, #epkLibraryDialog .epk-lib-open, #epkSwitch")) {
      const r = node.getBoundingClientRect();
      if (r.width && (r.right > width + 0.5 || r.left < -0.5)) out.push(`${node.className} ${Math.round(r.left)}..${Math.round(r.right)}`);
    }
    for (const node of document.querySelectorAll("#epkLibraryDialog .epk-lib-row button")) { const r = node.getBoundingClientRect(); if (r.width < 44 || r.height < 44) out.push(`small ${node.getAttribute("aria-label")}`); }
    return { out, overflow: document.documentElement.scrollWidth - width };
  });
  assert.deepEqual(result.out, [], `${tag}: My EPKs fits the screen`);
  assert.ok(result.overflow <= 0, `${tag}: the page scrolls sideways by ${result.overflow}px`);
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      const tag = `${width}px`, state = store();
      const { context, page, errors } = await open(browser, width, `epk.html?epk=${dj}`, state);
      await page.waitForFunction(() => document.querySelector("#epkSwitch .epk-switch__text")?.textContent.includes("DJ set"));
      assert.equal((await page.textContent("#epkSwitch .epk-switch__text")).trim(), "Eroticon · DJ set", `${tag}: the switch names the EPK`);
      assert.equal(await page.inputValue("#artistName"), "Eroticon");
      assert.ok(state.calls.some(call => call.method === "GET" && call.epkId === dj && !call.query.list), `${tag}: the builder loads that EPK`);

      // My EPKs.
      await centreTap(page, "#epkSwitch", tag);
      await page.waitForSelector("#epkLibraryDialog[open] .epk-lib-row");
      const groups = await page.$$eval("#epkLibraryDialog .epk-lib-group", nodes => nodes.map(node => ({ name: node.querySelector("h3").textContent, count: node.querySelector(".epk-lib-count").textContent, badge: node.querySelector(".epk-lib-badge")?.textContent || "", rows: node.querySelectorAll(".epk-lib-row").length })));
      assert.deepEqual(groups, [{ name: "Eroticon", count: "2 of 5", badge: "Verified ✓", rows: 2 }, { name: "Sleeping Dragon Records", count: "1 of 5", badge: "Verify this name", rows: 1 }], `${tag}: grouped by artist`);
      assert.equal(await page.$eval("#epkLibraryDialog .epk-lib-row.is-current .epk-lib-label", node => node.textContent), "DJ set");
      await fits(page, tag);
      if (captureDir) await page.screenshot({ path: path.join(captureDir, `epk-library-${width}.png`) });

      // Rename the DJ set.
      await centreTap(page, "#epkLibraryDialog .epk-lib-row.is-current button[aria-label='Rename']", tag);
      await page.fill("#epkLibraryDialog .epk-lib-rename input", "Festival DJ set");
      await centreTap(page, "#epkLibraryDialog .epk-lib-rename button[type=submit]", tag);
      await page.waitForFunction(() => document.querySelector("#epkSwitch .epk-switch__text")?.textContent.includes("Festival DJ set"));
      assert.deepEqual(state.calls.at(-1).body, { action: "rename", epkId: dj, label: "Festival DJ set" });

      // A 6th Eroticon EPK is refused before anything is sent.
      for (const id of ["4a", "5a", "6a"]) state.epks[`${id}4b5c6d7e`] = { kit: { artistName: "Eroticon" }, label: `Set ${id}`, published: false, publishedAt: "", updatedAt: "2026-11-20T00:00:00.000Z" };
      await page.evaluate(() => document.getElementById("epkLibraryClose").click());
      await centreTap(page, "#epkSwitch", tag);
      await page.waitForFunction(() => document.querySelector("#epkLibraryDialog .epk-lib-count")?.textContent === "5 of 5");
      await centreTap(page, "#epkLibraryNewOpen", tag);
      await page.check("#epkLibraryDialog input[value=copy]");
      assert.equal(await page.isHidden("#epkLibraryArtistRow"), true, `${tag}: a copy keeps this EPK's artist`);
      await page.fill("#epkLibraryLabel", "Italia");
      const before = state.calls.length;
      await centreTap(page, "#epkLibraryCreate", tag);
      await page.waitForFunction(() => /already has 5 EPKs/.test(document.getElementById("epkLibraryNewStatus").textContent));
      assert.equal(state.calls.filter(call => call.body?.action === "create").length, 0, `${tag}: nothing is sent`);
      assert.equal(state.calls.length, before);

      // Room again: + New EPK as a copy opens it.
      for (const id of ["4a", "5a", "6a"]) delete state.epks[`${id}4b5c6d7e`];
      await page.evaluate(() => document.getElementById("epkLibraryClose").click());
      await centreTap(page, "#epkSwitch", tag);
      await page.waitForFunction(() => document.querySelector("#epkLibraryDialog .epk-lib-count")?.textContent === "2 of 5");
      await centreTap(page, "#epkLibraryNewOpen", tag);
      await page.check("#epkLibraryDialog input[value=copy]");
      await page.fill("#epkLibraryLabel", "Italia");
      await Promise.all([page.waitForURL(/epk\.html\?epk=3a4b5c6d7e$/), centreTap(page, "#epkLibraryCreate", tag)]);
      assert.deepEqual(state.calls.find(call => call.body?.action === "create").body, { action: "create", from: dj, label: "Italia" });
      await page.waitForFunction(() => document.querySelector("#epkSwitch .epk-switch__text")?.textContent.includes("Italia"));
      // Save and versions go to that EPK.
      await centreTap(page, "#saveDraft", tag);
      await page.waitForFunction(() => /Private draft saved/.test(document.getElementById("epkStatus").textContent));
      const saved = state.calls.filter(call => call.method === "POST" && call.body?.action === "draft").at(-1);
      assert.equal(saved.body.epkId, "3a4b5c6d7e", `${tag}: Save sends the open EPK`);
      assert.equal(saved.body.kit.shortBio, "DJ set.", `${tag}: the copy carries the DJ set`);
      // Plain epk.html reopens the EPK last worked on.
      await page.goto(`${base}/epk.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.querySelector("#epkSwitch .epk-switch__text")?.textContent.includes("Italia"));
      assert.match(page.url(), /epk\.html\?epk=3a4b5c6d7e$/, `${tag}: the address names the EPK`);

      // Deleted on another device: back to the first EPK.
      delete state.epks["3a4b5c6d7e"];
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForURL(/epk\.html\?epk=main$/);
      await page.waitForFunction(() => document.querySelector("#epkSwitch .epk-switch__text")?.textContent.trim() === "Eroticon");
      assert.deepEqual(errors, [], `${tag}: no page errors`);
      await context.close();
    }

    // Italian.
    const state = store();
    const { context, page, errors } = await open(browser, 390, `epk.html?epk=${dj}`, state, { locale: "it-IT" });
    await page.evaluate(() => { try { localStorage.setItem("danzstak_language", "it"); } catch {} });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => document.documentElement.lang.startsWith("it"));
    await page.waitForFunction(() => document.querySelector("#epkSwitch .epk-switch__text")?.textContent.includes("DJ set"));
    await centreTap(page, "#epkSwitch", "it");
    await page.waitForSelector("#epkLibraryDialog[open] .epk-lib-row");
    await page.waitForFunction(() => document.getElementById("epkLibraryTitle").textContent === "I miei EPK");
    const words = await page.evaluate(() => ({ count: document.querySelector(".epk-lib-count").textContent, badge: [...document.querySelectorAll(".epk-lib-badge")].map(node => node.textContent), state: document.querySelector(".epk-lib-row:not(.is-current) .epk-lib-state")?.textContent || "", newEpk: document.getElementById("epkLibraryNewOpen").textContent.trim(), name: document.querySelector(".epk-lib-group h3").textContent }));
    assert.equal(words.count, "2 di 5");
    assert.deepEqual(words.badge, ["Verificato ✓", "Verifica questo nome"]);
    assert.match(words.state, /^Pubblicato /);
    assert.equal(words.newEpk, "+ Nuovo EPK");
    assert.equal(words.name, "Eroticon", "artist names are never translated");
    await fits(page, "it");
    if (captureDir) await page.screenshot({ path: path.join(captureDir, "epk-library-it-390.png") });
    assert.deepEqual(errors, []);
    await context.close();
    console.log("EPK library browser checks passed (320-430px, Italian).");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
