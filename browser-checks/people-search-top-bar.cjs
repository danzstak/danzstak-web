"use strict";
// People search in the top bar and the naming step (owner 2026-11-17), in Edge at phone widths.
// The API is mocked. Run with a local server:
// DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/people-search-top-bar.cjs
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/people-search");
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const users = [
  { memberId: "11111111-1111-4111-8111-111111111111", name: "Eroticon", handle: "eroticon", friendStatus: "none", online: false, picture: "" },
  { memberId: "22222222-2222-4222-8222-222222222222", name: "Erotic Noise Collective of the Bay", handle: "eroticnoisecollective", friendStatus: "friends", online: true, picture: "" }
];
const words = {
  en: { bazaarPlaceholder: "Search the Bazaar or people", syncPlaceholder: "Search chats and people", add: "Add friend", requested: "Requested", friends: "Friends", placeholder: "Search name or @username", welcome: "What should people call you?" },
  it: { bazaarPlaceholder: "Cerca nel Bazaar o persone", syncPlaceholder: "Cerca chat e persone", add: "Aggiungi agli amici", requested: "Richiesta inviata", friends: "Amici", placeholder: "Cerca nome o @username", welcome: "Come vuoi che ti chiamino?" },
  fr: { bazaarPlaceholder: "Chercher dans le Bazaar ou des personnes", syncPlaceholder: "Rechercher chats et personnes", add: "Ajouter", requested: "Demande envoyée", friends: "Amis", placeholder: "Nom ou @nom d’utilisateur", welcome: "Comment veux-tu qu’on t’appelle ?" },
  es: { bazaarPlaceholder: "Buscar en el Bazaar o personas", syncPlaceholder: "Buscar chats y personas", add: "Añadir amigo", requested: "Solicitud enviada", friends: "Amigos", placeholder: "Busca nombre o @usuario", welcome: "¿Cómo quieres que te llamen?" }
};
const runs = [...[320, 360, 375, 390, 414, 430].map(width => ["en", width]), ["it", 375], ["fr", 375], ["es", 375]];

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}
async function context(browser, lang, width, profile) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", locale: lang });
  await ctx.addInitScript(code => { try { localStorage.setItem("danzstak_language", code); } catch {} }, lang);
  const page = await ctx.newPage(), state = { queries: [], requests: [], errors: [] };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("https://api.danzstak.com/**", async route => {
    const request = route.request(), url = new URL(request.url()), p = url.pathname;
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { email: "me@danzstak.test", sub: "33333333-3333-4333-8333-333333333333" } }));
    if (p === "/profiles" && request.method() === "GET") return route.fulfill(json({ profile }));
    if (p === "/people") { state.queries.push(url.searchParams.get("query")); return route.fulfill(json({ users })); }
    if (p === "/friends/request") { state.requests.push(request.postDataJSON()); return route.fulfill(json({ requested: true })); }
    if (p === "/calls/devices") return route.fulfill(json({ accountTag: "c".repeat(32), currentDeviceRegistered: false, devices: [] }));
    if (p === "/conversations") return route.fulfill(json({ conversations: [] }));
    if (p === "/phone-verification") return route.fulfill(json({ configured: true, state: "none", verified: false, providerAvailable: true }));
    return route.fulfill(json(p === "/messages" ? { messages: [], canContact: true } : p === "/friends" ? { friends: [] } : p === "/posts" ? { posts: [] } : {}));
  });
  return { ctx, page, state };
}
async function checkRows(page, width, label, root) {
  const geometry = await page.evaluate(root => ({
    overflow: document.documentElement.scrollWidth > innerWidth,
    small: [...document.querySelectorAll(`${root} button, ${root} a.person-row-message, .ds-top-search-button`)].filter(node => node.getBoundingClientRect().height > 0 && node.getBoundingClientRect().height < 44).map(node => node.className),
    rows: [...document.querySelectorAll(`${root} .person-row`)].map(row => { const r = row.getBoundingClientRect(); return { left: r.left, right: r.right }; })
  }), root);
  assert.equal(geometry.overflow, false, `${label}: sideways scroll`);
  assert.deepEqual(geometry.small, [], `${label}: targets under 44px`);
  for (const row of geometry.rows) assert.ok(row.left >= 0 && row.right <= width + 0.5, `${label}: row inside the screen ${JSON.stringify(row)}`);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const [lang, width] of runs) {
      const copy = words[lang];
      for (const page of ["bazaar.html", "messages.html"]) {
        const label = `${lang} ${width}px ${page}`;
        const { ctx, page: tab, state } = await context(browser, lang, width, { isOwner: true, name: "Night Shift", handle: "nightshift" });
        await tab.goto(`${baseUrl}/${page}`, { waitUntil: "domcontentloaded" });
        const sync = page === "messages.html", root = sync ? ".sync-people-results" : "dialog.ds-top-search";
        const sheet = tab.locator(root);
        if (sync) {
          // SYNC: the chat search box also finds people (WhatsApp-style); no extra icon in its full top bar.
          const box = tab.locator("#chatSearch");
          await box.waitFor({ state: "visible", timeout: 15000 });
          await tab.waitForFunction(() => document.querySelector(".sync-people-results"));
          assert.equal(await tab.locator(".ds-top-search-button").count(), 0, `${label}: no extra icon in the SYNC top bar`);
          assert.equal(await box.getAttribute("placeholder"), copy.syncPlaceholder, `${label}: placeholder`);
          await tab.waitForTimeout(400);
          assert.equal(await tab.locator(".ds-onboard").count(), 0, `${label}: a named account is not asked to name itself`);
          await box.fill("@ero");
        } else {
          const button = tab.locator(".ds-top-search-button");
          await button.waitFor({ state: "visible", timeout: 15000 });
          await tab.waitForTimeout(400);
          assert.equal(await tab.locator(".ds-onboard").count(), 0, `${label}: a named account is not asked to name itself`);
          await button.click();
          await sheet.waitFor({ state: "visible" });
          // The Bazaar's one search (fix-it 18) finds products and people in the same sheet.
          assert.equal(await sheet.locator("input").getAttribute("placeholder"), page === "bazaar.html" ? copy.bazaarPlaceholder : copy.placeholder, `${label}: placeholder`);
          await sheet.locator("input").fill("@ero");
        }
        await sheet.locator(".person-row").first().waitFor();
        assert.equal(state.queries.at(-1), "@ero", `${label}: @username query sent as typed`);
        const first = sheet.locator(".person-row").first();
        assert.equal((await first.locator(".user-search-identity a").textContent()).trim(), "Eroticon");
        assert.equal((await first.locator(".user-search-identity small").textContent()).trim(), "@eroticon");
        assert.equal((await first.locator(".user-search-action").textContent()).trim(), copy.add);
        assert.equal(await first.locator("a.person-row-message").getAttribute("href"), "messages.html?member=11111111-1111-4111-8111-111111111111");
        assert.equal((await sheet.locator(".person-row").nth(1).locator(".user-search-action").textContent()).trim(), copy.friends);
        assert.ok(!(await sheet.textContent()).includes("@danzstak.test"), `${label}: no email shown`);
        await tab.waitForTimeout(200);
        await checkRows(tab, width, label, root);
        await shot(tab, `${lang}-1-results-${sync ? "sync" : "bazaar"}-${width}`);
        await first.locator(".user-search-action").click();
        await tab.waitForFunction(([selector, text]) => document.querySelector(`${selector} .person-row .user-search-action`)?.textContent.trim() === text, [root, copy.requested]);
        assert.deepEqual(state.requests.at(-1), { memberId: "11111111-1111-4111-8111-111111111111" }, `${label}: friend request by opaque id`);
        if (page === "bazaar.html" && lang === "en") await shot(tab, `${lang}-2-requested-${width}`);
        if (!sync) {
          // Device Back closes search and stays on the page.
          await tab.goBack();
          await sheet.waitFor({ state: "hidden" });
          assert.ok(tab.url().endsWith(`/${page}`), `${label}: Back returns to the page`);
        }
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
      // Mix keeps its header search box with the same rows.
      if (lang === "en" && [320, 430].includes(width)) {
        const { ctx, page: tab, state } = await context(browser, lang, width, { isOwner: true, name: "Night Shift", handle: "nightshift" });
        await tab.goto(`${baseUrl}/feed.html`, { waitUntil: "domcontentloaded" });
        const box = tab.locator("input.search");
        await box.waitFor({ state: "attached", timeout: 15000 });
        await box.evaluate((input, value) => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); }, "@ero");
        await tab.locator(".user-search-results .person-row").first().waitFor({ timeout: 10000 });
        assert.equal(state.queries.at(-1), "@ero");
        assert.equal(await tab.locator(".user-search-results .person-row a.person-row-message").count(), 2, "Mix rows have Message too");
        assert.equal(await tab.locator(".ds-top-search-button").count(), 0, "Mix keeps its own header search box");
        await ctx.close();
      }
      // A placeholder account names itself first; nothing fake is prefilled.
      {
        const label = `${lang} ${width}px naming step`;
        const { ctx, page: tab, state } = await context(browser, lang, width, { isOwner: true, name: "DanzStak member", handle: "danzstak-member" });
        await tab.goto(`${baseUrl}/bazaar.html`, { waitUntil: "domcontentloaded" });
        const step = tab.locator("dialog.ds-onboard");
        await step.waitFor({ state: "visible", timeout: 15000 });
        assert.equal((await step.locator("h2").textContent()).trim(), copy.welcome, `${label}: title`);
        assert.equal(await step.locator("input[name=name]").inputValue(), "", `${label}: no fake name`);
        assert.equal(await step.locator("input[name=handle]").inputValue(), "", `${label}: no fake username`);
        const overflow = await tab.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow, false, `${label}: sideways scroll`);
        await shot(tab, `${lang}-3-naming-${width}`);
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
    }
    console.log(`People search browser checks passed (${runs.map(([lang, width]) => `${lang} ${width}px`).join(", ")}): top-bar search on Bazaar, People in SYNC chat search, @username, person rows with Add friend / Requested / Friends and Message, Back closes, Mix header box, naming step.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
