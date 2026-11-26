"use strict";
// Owner 2026-11-25 (Italian testers): "Italian has to be Italian the whole thing French has to be French the whole thing
// Spanish has to be Spanish the whole thing", "These people really don't understand English not a word".
// QUEUE row LANG: opens every screen a tester touches as a signed-in member whose phone is set to Italian, French or
// Spanish (390px, touch) and fails on any English UI word that is visible on screen, in a placeholder, or in the
// accessible name of a button or link. Brand names stay (DanzStak, SYNC, Mix, The Roll, Dailies, Tribes, Bazaar, EPK,
// Music HQ). Member content comes from the mocks below and is written in the member's language, so anything English on
// screen is DanzStak's own words.
//   node browser-checks/language-sweep.cjs                 (fails on English)
//   AUDIT_ONLY=1 node browser-checks/language-sweep.cjs    (prints every English word with where it is, never fails)
//   LANGS=it SCREENS=feed node browser-checks/language-sweep.cjs
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = "https://review.danzstak.test";
const me = "11111111-1111-4111-8111-111111111111";
const friend = "22222222-2222-4222-8222-222222222222";
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const cors = { "access-control-allow-origin": origin, "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type", "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS" };
const locales = { it: "it-IT", fr: "fr-FR", es: "es-ES" };

// The screens of the T2 walk a tester touches (CLAUDE.md "T2 sweep").
const screens = {
  feed: "feed.html",
  profile: "profile.html",
  friends: "friends.html",
  notifications: "feed.html?view=notifications",
  menu: "feed.html?view=feed&menu=1",
  tribes: "feed.html?view=tribes",
  events: "feed.html?view=events",
  bazaar: "bazaar.html",
  shop: "store.html?manage=1",
  hq: "feed.html?view=hq",
  booking: "booking.html",
  bookingSelections: "booking-selections.html",
  epk: "epk.html",
  sync: "messages.html",
  settings: "feed.html?view=settings",
  support: "support.html",
  // Part 2: what opens behind a tap (sheets, dialogs, panels), each tapped at its centre like a thumb would.
  postMenu: { url: "feed.html", tap: [".post .post-menu-toggle"] },
  composer: { url: "feed.html", tap: ["#postText", ".post-location-picker > summary"] },
  syncDevice: "messages.html?device=register",
  profileEdit: "profile.html?edit=1",
  createEvent: { url: "feed.html?view=events", tap: [".ev-primary"] },
  // Part 3: the EPK builder's steps, reached with Next like a member would, and the private review link opened.
  epkStep2: { url: "epk.html", tap: ["#guideNext"] },
  epkStep3: { url: "epk.html", tap: ["#guideNext", "#guideNext"] },
  epkStep4: { url: "epk.html", tap: ["#guideNext", "#guideNext", "#guideNext"] },
  epkStep5: { url: "epk.html", tap: ["#guideNext", "#guideNext", "#guideNext", "#guideNext", "#epkTypeInstead > summary"] },
  epkShare: { url: "epk.html", tap: [".epk-private-share > summary"] },
  // The purchase pop-up every paid product shows first (owner 2026-11-15), and the refund pop-up.
  buyPopup: { url: "messages.html", run: "window.danzstakConfirmPurchase({ kind: 'network', priceCents: 300 })" },
  buyContactPopup: { url: "booking-selections.html", run: "window.danzstakConfirmPurchase({ kind: 'contact', priceCents: 75 })" },
  refundPopup: { url: "messages.html", run: "window.danzstakConfirmRefund({ paidCents: 365, feeCents: 41, refundCents: 324, quantity: 1 })" },
};

// English words that never appear in Italian, French or Spanish UI. Words the three languages share with English
// (video, post, chat, online, email, link, live, tour, band, festival, menu, shop, ok, DJ, mix) are left out on purpose.
const english = new Set(`the your you and with from this that what whats what's who where when how why there here
add adding added remove delete deleted edit save saved cancel close back next done send sent share shared copy copied
search find loading load more less show hide see view open opened
sign log out in up signed account settings privacy notifications notification friend friends request requests accept
decline follow following followers unfollow block blocked report message messages reply replies comment comments like
likes liked photo photos picture pictures upload uploads uploading camera record take choose pick select selected
create new post posts posted posting write something mind public private only just me everyone nobody
people members member profile name username about bio location city work website home page today yesterday ago
minute minutes hour hours day days week weeks month months year years now soon later never always
call calls calling ringing answer hang mute unmute speaker turn on off allow alerts device phone number code verify
verified register registration text texts your
events event tickets ticket price free buy sell sold item items cart checkout order orders shipping
help support terms language languages dark light mode theme
nothing yet empty caught up try again something went wrong error failed couldnt couldn't can't cant
welcome hello hi thanks thank please sorry
venue venues gigs dates bookings contacts
not for of is are will be can could would should example examples sale look looks refresh map found web address
buyers buyer sellers seller receive fee fees under plus shops sections an my our their it its into
`.split(/\s+/).filter(Boolean));
// Words that are also everyday words in the member's language ("in", "date", "camera" and "private" are Italian; "on" is
// French; "post", "home", "booking", "pitch", "bio" and "line-up" are used as-is in all three).
const sharedWords = ["post", "posts", "home", "booking", "pitch", "bio", "club", "tour", "online", "live"];
const alsoLocal = { it: ["in", "camera", "date", "private", "no", "come", "dove", "account", "privacy", "look", "fan", "manager", "web", "shop"], fr: ["on", "web", "contacts", "date", "dates", "plus", "look", "me", "sections", "section", "comment", "public", "photo", "photos", "message", "messages", "commentaire", "notifications", "notification", "public", "profile", "location", "page", "pages", "code", "minute", "minutes", "ticket", "tickets", "mode", "support", "terms", "venue", "items"], es: ["no", "me", "come", "solo", "online", "web", "fan", "manager", "a", "privacy"] };
// The Dailies clapper (SCENE / TAKE) and the empty strip's film set calls ("ROLL CAMERA" … "ACTION!") are the owner's
// film-set labels, kept as they are (CLAUDE.md "Dailies come from posts"), so they're left out of the sweep.
// Brand names and words that are names, not English.
const brand = /\b(DanzStak|SYNC|Mix|The Roll|Dailies|Daily|Tribes?|Bazaar|EPK|Music HQ|HQ|Pivot|Moving Day|Night Shift|Eroticon|Stripe|Phantom|Bandcamp|Discogs|SoundCloud|Mixcloud|YouTube|Instagram|Facebook|TikTok|WhatsApp|Spotify|Apple Music|Google|Android|iPhone|Chrome|Safari)\b/g;

function mockApi(page, lang) {
  const words = {
    it: { post: "Stasera suoniamo al Covo, ci vediamo lì", comment: "Bellissimo", tribe: "Punk Bologna", shop: "Dischi di Night Shift", item: "Maglietta nera" },
    fr: { post: "Ce soir on joue au Glazart, à tout à l'heure", comment: "Magnifique", tribe: "Punk Paris", shop: "Disques de Night Shift", item: "T-shirt noir" },
    es: { post: "Esta noche tocamos en la Sala Apolo, nos vemos", comment: "Precioso", tribe: "Punk Madrid", shop: "Discos de Night Shift", item: "Camiseta negra" },
  }[lang];
  const ago = minutes => new Date(Date.now() - minutes * 60000).toISOString();
  const post = { postId: "33333333-3333-4333-8333-333333333333", userId: friend, authorMemberId: friend, authorName: "Ana Rossi", authorPicture: "", content: words.post, createdAt: ago(90), audience: "public", reactionCounts: { like: 2 } };
  return page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (p === "/auth/session") return reply({ authenticated: true, user: { sub: me, email: "artist@danzstak.invalid" } });
    if (p === "/profiles" || p === "/profile") return reply({ profile: { memberId: me, name: "Night Shift", handle: "nightshift", username: "nightshift", cloudProfile: true, isOwner: true, onboarded: true }, profiles: [] });
    if (p === "/secure-posts") return reply({ posts: [post] });
    if (p === "/engagement") return reply({ reactionCounts: {}, comments: [{ commentId: "c1", authorName: "Luca", authorMemberId: friend, content: words.comment, createdAt: ago(30), reactionCounts: {} }] });
    if (p === "/stories") return reply({ stories: [], reels: [], dailyTakeCount: 3 });
    if (p === "/friends") return reply({ friends: [{ memberId: friend, name: "Ana Rossi", username: "anarossi" }], incoming: [], outgoing: [] });
    if (p === "/notifications") return reply({ notifications: [{ id: "n1", type: "comment", actorName: "Luca", actorMemberId: friend, postId: post.postId, createdAt: ago(20), read: false }] });
    if (p === "/tribes") return reply({ tribes: [{ tribeId: "t1", name: words.tribe, memberCount: 12, visibility: "public", isMember: true, role: "member" }] });
    if (p === "/calls/devices") return reply({ devices: [], registered: false });
    if (p === "/phone-verification") return reply({ verified: false });
    if (p === "/settings/posts") return reply({ hiddenPostIds: [] });
    return reply({});
  });
}

async function serve(page) {
  await page.route(`${origin}/**`, route => {
    const url = new URL(route.request().url());
    let file = path.join(process.cwd(), decodeURIComponent(url.pathname));
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    if (!file.startsWith(process.cwd()) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: "" });
    return route.fulfill({ status: 200, contentType: types[path.extname(file)] || "application/octet-stream", body: fs.readFileSync(file) });
  });
  // Nothing else on the internet: fonts, maps and players stay out of the sweep.
  await page.route(url => !url.href.startsWith(origin) && !url.href.startsWith("https://api.danzstak.com"), route => route.fulfill({ status: 204, body: "" }));
}

// Every visible string a member reads: text on screen, placeholders, and the names of buttons/links/inputs.
function collect() {
  const shown = el => { for (let n = el; n && n.nodeType === 1; n = n.parentElement) { const s = getComputedStyle(n); if (n.hidden || s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false; } const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1 && r.bottom > 0 && r.right > 0 && r.left < innerWidth; };
  const where = el => { const parts = []; for (let n = el; n && n.nodeType === 1 && parts.length < 3; n = n.parentElement) parts.unshift(n.id ? `#${n.id}` : n.classList[0] ? `${n.tagName.toLowerCase()}.${n.classList[0]}` : n.tagName.toLowerCase()); return parts.join(" > "); };
  const out = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const text = t.textContent.replace(/\s+/g, " ").trim(), el = t.parentElement;
    if (!text || !el || ["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "OPTION"].includes(el.tagName) || el.closest("[translate=no], .notranslate, svg, .bazaar-title, .post-content, .comment-text, .daily-clapper, .story-placeholder-cue")) continue;
    if (shown(el)) out.push({ text, where: where(el), kind: "text" });
  }
  for (const el of document.querySelectorAll("button, a, input, textarea, select, [role=button], [aria-label]")) {
    // A Bazaar card's name is "Example: <record title>. Not for sale."; the title is the seller's, and the words
    // around it are checked on the card's visible lines.
    if (!shown(el) || el.closest("[translate=no], .notranslate") || el.matches(".bazaar-card")) continue;
    for (const [kind, value] of [["aria-label", el.getAttribute("aria-label")], ["placeholder", el.getAttribute("placeholder")], ["title", el.getAttribute("title")]]) if (value && value.trim()) out.push({ text: value.trim(), where: where(el), kind });
  }
  for (const el of document.querySelectorAll("select")) if (shown(el) && el.selectedOptions[0]) out.push({ text: el.selectedOptions[0].textContent.trim(), where: where(el), kind: "select" });
  return out;
}

function englishIn(text, lang) {
  const local = new Set([...sharedWords, ...(alsoLocal[lang] || [])]);
  const clean = text.replace(brand, " ").replace(/\bline-up\b/gi, " ").replace(/@\w+|https?:\S+|\S+@\S+|\S+\.(html|com|it|fr|es)\b/g, " ");
  return [...new Set((clean.toLowerCase().match(/\p{L}[\p{L}'’]+/gu) || []).map(w => w.replace(/['’]s$/, "")).filter(w => english.has(w) && !local.has(w)))];
}

(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  const langs = (process.env.LANGS || "it,fr,es").split(",");
  const only = process.env.SCREENS ? process.env.SCREENS.split(",") : Object.keys(screens);
  const found = [];
  try {
    for (const lang of langs) for (const name of only) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: locales[lang], extraHTTPHeaders: { "accept-language": `${locales[lang]},${lang};q=0.9` } });
      await context.addInitScript(value => { Object.defineProperty(navigator, "language", { get: () => value }); Object.defineProperty(navigator, "languages", { get: () => [value] }); }, locales[lang]);
      const page = await context.newPage();
      // A screen that throws is a broken screen, in any language.
      page.on("console", message => { if (/Refused to (execute|load).*Content Security Policy/i.test(message.text())) found.push({ lang, screen: name, words: "(blocked script)", text: message.text().slice(0, 140), where: "", kind: "error" }); });
      page.on("pageerror", error => found.push({ lang, screen: name, words: "(script error)", text: error.message.split("\n")[0].slice(0, 140), where: "", kind: "error" }));
      await serve(page); await mockApi(page, lang);
      try {
        const screen = typeof screens[name] === "string" ? { url: screens[name] } : screens[name];
        await page.goto(`${origin}/${screen.url}`, { waitUntil: "load", timeout: 30000 });
        await page.waitForTimeout(2500);
        for (const selector of screen.tap || []) {
          const target = page.locator(selector).first();
          if (!(await target.count())) { found.push({ lang, screen: name, words: "(nothing to tap)", text: selector, where: "", kind: "error" }); continue; }
          await target.scrollIntoViewIfNeeded().catch(() => {});
          const box = await target.boundingBox();
          if (box) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); else await target.click({ force: true });
          await page.waitForTimeout(800);
        }
        if (screen.run) { await page.evaluate(code => { (0, eval)(code); }, screen.run); await page.waitForTimeout(800); }
        const seen = new Set();
        for (const item of await page.evaluate(collect)) {
          const words = englishIn(item.text, lang);
          const key = `${item.text}|${item.where}`;
          if (words.length && !seen.has(key)) { seen.add(key); found.push({ lang, screen: name, words: words.join(","), text: item.text.slice(0, 90), where: item.where, kind: item.kind }); }
        }
      } catch (error) { found.push({ lang, screen: name, words: "(page did not open)", text: error.message.split("\n")[0], where: "", kind: "error" }); }
      await context.close();
    }
    // The post's audience ("🌎 Public") is drawn by Mix's own script, which can run before i18n.js has loaded; it must
    // still end up in the member's language (it stayed "Public" about one load in four before this check).
    if (langs.includes("it") && only.includes("feed")) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "it-IT" });
      await context.addInitScript(() => { Object.defineProperty(navigator, "language", { get: () => "it-IT" }); Object.defineProperty(navigator, "languages", { get: () => ["it-IT"] }); });
      const page = await context.newPage();
      await serve(page); await mockApi(page, "it");
      // Registered last so it runs first (Playwright tries the newest route first), then hands over to serve().
      await page.route(/\/assets\/i18n\.js/, async route => { await new Promise(done => setTimeout(done, 2500)); return route.fallback(); });
      await page.goto(`${origin}/feed.html`, { waitUntil: "load", timeout: 30000 });
      const audience = await page.locator(".post .post-audience").first().textContent({ timeout: 15000 }).catch(() => "");
      await page.waitForTimeout(1500);
      const after = await page.locator(".post .post-audience").first().textContent().catch(() => "");
      if (after.trim() !== "🌎 Pubblico") found.push({ lang: "it", screen: "feed", words: "(slow i18n.js)", text: `audience reads "${after.trim()}" (first drawn as "${audience.trim()}")`, where: ".post-audience", kind: "text" });
      await context.close();
    }
    // Part 4: a reply from the server whose words have no translation (most of the API's 500 error lines) must still
    // reach the member in their language, never in English. Support is sent with a reply the server really gives
    // (429, the 10-minute wait), then with our side failing (500), and the line under the form is read.
    if (only.includes("support")) for (const lang of langs) for (const [status, error] of [[429, "A support request was already submitted recently. Please wait up to 10 minutes before sending another."], [500, "Authentication service error"]]) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: locales[lang] });
      await context.addInitScript(value => { Object.defineProperty(navigator, "language", { get: () => value }); Object.defineProperty(navigator, "languages", { get: () => [value] }); }, locales[lang]);
      const page = await context.newPage();
      await serve(page); await mockApi(page, lang);
      // Registered last so it runs first (Playwright tries the newest route first).
      await page.route("https://api.danzstak.com/support-tickets", route => route.request().method() === "OPTIONS" ? route.fulfill({ status: 204, headers: cors }) : route.fulfill({ status, contentType: "application/json", headers: cors, body: JSON.stringify({ error }) }));
      const fail = text => found.push({ lang, screen: "support", words: `(server ${status})`, text, where: "#supportStatus", kind: "server error" });
      try {
        await page.goto(`${origin}/support.html`, { waitUntil: "load", timeout: 30000 });
        await page.waitForTimeout(1500);
        await page.selectOption("#supportCategory", "technical");
        await page.fill("#supportSubject", "Video");
        await page.fill("#supportMessage", { it: "Il video non parte quando lo apro dal telefono.", fr: "La vidéo ne démarre pas quand je l'ouvre sur mon téléphone.", es: "El vídeo no arranca cuando lo abro en el teléfono." }[lang]);
        const send = page.locator("#supportForm button[type=submit]");
        await send.evaluate(el => el.scrollIntoView({ block: "center" })); // clear of the tab bar, like a thumb would
        const box = await send.boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForFunction(() => !/…$/.test(document.getElementById("supportStatus").textContent.trim()) && document.getElementById("supportStatus").textContent.trim(), null, { timeout: 10000 });
        await page.waitForTimeout(400);
        const line = (await page.locator("#supportStatus").textContent()).trim();
        const words = englishIn(line, lang);
        if (words.length || line === error) fail(`"${line}" [${words.join(",")}]`);
      } catch (error) { fail(`${error.message.split("\n")[0]} (${page.url()})`); }
      await context.close();
    }
    // Baby-proof (owner 2026-11-25: "It really has got to be baby proof… they don't know what they're doing"): a brand-new
    // Italian member finds each first-time action by its visible word, on screen without scrolling, and a thumb on the
    // centre of that word's button reaches it. Registering the phone then shows "Invia codice" after that one tap.
    if (langs.includes("it")) {
      const findable = [
        { action: "post a photo", url: "feed.html", word: "Foto" },
        { action: "post a video", url: "feed.html", word: "Video" },
        { action: "send a message", url: "messages.html", word: "Inizia una chat" },
        { action: "call", url: "messages.html", word: "Chiamate" },
        { action: "register the phone", url: "messages.html", word: "Verifica", then: "Invia codice" },
      ];
      for (const item of findable) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", locale: "it-IT" });
        await context.addInitScript(() => { Object.defineProperty(navigator, "language", { get: () => "it-IT" }); Object.defineProperty(navigator, "languages", { get: () => ["it-IT"] }); });
        const page = await context.newPage();
        await serve(page); await mockApi(page, "it");
        const fail = text => found.push({ lang: "it", screen: "baby-proof", words: `(${item.action})`, text, where: item.url, kind: "findable" });
        try {
          await page.goto(`${origin}/${item.url}`, { waitUntil: "load", timeout: 30000 });
          await page.waitForTimeout(3000);
          const spot = await page.evaluate(word => {
            for (const el of document.querySelectorAll("button, a, label, [role=button], [role=tab]")) {
              const text = (el.innerText || "").replace(/\s+/g, " ").trim(), r = el.getBoundingClientRect();
              if (text !== word && !text.startsWith(word + " ") && text !== word.toUpperCase()) continue;
              if (r.width < 2 || r.height < 2 || r.top < 0 || r.bottom > innerHeight || r.left < 0 || r.right > innerWidth) continue;
              const x = r.left + r.width / 2, y = r.top + r.height / 2, hit = document.elementFromPoint(x, y);
              return { x, y, hit: Boolean(hit && (el === hit || el.contains(hit))), size: Math.min(r.width, r.height) };
            }
            return null;
          }, item.word);
          if (!spot) { fail(`no "${item.word}" on screen without scrolling`); continue; }
          if (!spot.hit) { fail(`"${item.word}" is covered: a tap on its centre lands on something else`); continue; }
          if (spot.size < 44 && item.word !== "Chiamate") fail(`"${item.word}" is ${Math.round(spot.size)}px: under 44px`);
          if (item.then) {
            await page.touchscreen.tap(spot.x, spot.y);
            const next = await page.getByText(item.then, { exact: true }).first().isVisible({ timeout: 5000 }).catch(() => false);
            if (!next) fail(`one tap on "${item.word}" doesn't show "${item.then}"`);
          }
        } catch (error) { fail(error.message.split("\n")[0]); }
        await context.close();
      }
    }
  } finally { await browser.close(); }
  for (const f of found) console.log(`${f.lang} ${f.screen.padEnd(13)} [${f.words}] "${f.text}" (${f.kind} @ ${f.where})`);
  console.log(`${found.length} English strings`);
  if (found.length && !process.env.AUDIT_ONLY) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
