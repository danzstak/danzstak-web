"use strict";
// Task 15-B: hometown skin on the EPK builder and the public EPK, in Edge at 320/375/430/768/1366px.
// Run with a local server: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/epk-hometown.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/epk-hometown");
const widths = [320, 375, 430, 768, 1366];
const combos = [
  { town: "Tacoma, WA", look: "techno", id: "tacoma", name: "Tacoma", coords: "47.25° N · 122.44° W" },
  { town: "Bologna, Italia", look: "punk", id: "bologna", name: "Bologna", coords: "44.49° N · 11.34° E" },
  { town: "Berlin", look: "metal", id: "berlin", name: "Berlin", coords: "52.52° N · 13.40° E" },
  { town: "Aberdeen, WA", look: "house", id: "town-aberdeen", name: "Aberdeen", coords: "" }
];
const kit = (c, extra = {}) => ({ artistName: "Ghost Rider", hometown: c.town, genres: [c.look], look: c.look, shortPitch: "Loud, fast and from home.", shortBio: "A four-piece that plays every room like it's the last show.", releases: ["Rain City — LP — 2026"], musicLinks: [{ label: "Bandcamp", url: "https://example.bandcamp.com/album/x" }], notableShows: ["The Valley — 2026"], bookingName: "Tour Contact", bookingEmail: "booking@example.com", website: "https://example.com", media: [], ...extra });

// Labels that must stay on one line at 320px (15-D): the hometown skin's own choices, the checklist and the public
// EPK's action buttons. Other titles may wrap to a second line but are never cut off with "…" (nothing clips).
const ONE_LINE = ".epk-hometown legend,.epk-choice,.epk-guide li,.epk-public-actions button";
async function wrappedLabels(page) {
  return page.evaluate(selector => {
    const visible = n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && !n.closest("[hidden],dialog:not([open])"); };
    const lines = n => { const walker = document.createTreeWalker(n, NodeFilter.SHOW_TEXT), tops = []; for (let t = walker.nextNode(); t; t = walker.nextNode()) { if (!t.textContent.trim() || t.parentElement.closest("[hidden]")) continue; const range = document.createRange(); range.selectNodeContents(t); for (const r of range.getClientRects()) if (r.width > 1) tops.push(r.top); } tops.sort((a, b) => a - b); return tops.reduce((count, top, i) => count + (i && top - tops[i - 1] > 6 ? 1 : 0), tops.length ? 1 : 0); }; // text only, not the radio or icon
    return [...document.querySelectorAll(selector)].filter(visible).filter(n => n.textContent.trim()).map(n => ({ text: n.textContent.trim().replace(/\s+/g, " ").slice(0, 60), lines: lines(n), clipped: n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflow === "hidden" })).filter(r => r.lines > 1 || r.clipped);
  }, ONE_LINE);
}
async function painted(page, root) {
  return page.evaluate(sel => {
    const lum = c => { const v = c.match(/[\d.]+/g).slice(0, 3).map(n => { n /= 255; return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const el = document.querySelector(sel), s = getComputedStyle(el), ground = s.getPropertyValue("--epk-ground").trim();
    const h2 = el.querySelector(".epk-body h2"), line = el.querySelector(".epk-hometown-line strong");
    const toRgb = hex => { const v = hex.replace("#", ""); return `rgb(${parseInt(v.slice(0, 2), 16)}, ${parseInt(v.slice(2, 4), 16)}, ${parseInt(v.slice(4, 6), 16)})`; };
    // Measure against what is actually painted behind the text: the nearest ancestor with a background colour.
    const behind = node => { for (let n = node; n && n !== el.parentElement; n = n.parentElement) { const bg = getComputedStyle(n).backgroundColor; if (!/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(bg)) return bg; } return toRgb(ground); };
    const lineText = el.querySelector(".epk-hometown-line span");
    return { ground, motif: s.backgroundImage.startsWith('url("data:image/svg+xml'), ink: ratio(s.color, toRgb(ground)), accent: h2 ? ratio(getComputedStyle(h2).color, behind(h2)) : 99, cityAccent: line ? ratio(getComputedStyle(line).color, behind(line)) : 99, lineInk: lineText ? ratio(getComputedStyle(lineText).color, behind(lineText)) : 99 };
  }, root);
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    // Public EPK: four city x genre combinations at every width.
    for (const c of combos) for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("https://api.danzstak.com/**", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(new URL(r.request().url()).pathname.startsWith("/epk/public") ? { kit: kit(c) } : {}) }));
      await page.goto(`${baseUrl}/epk.html?id=visual-${c.id}`, { waitUntil: "networkidle" });
      await page.locator(`#epkPreview[data-hometown="${c.id}"]`).waitFor();
      assert.equal(await page.locator("#epkPreview").getAttribute("data-look"), c.look);
      assert.equal(await page.locator("body").getAttribute("data-epk-hometown"), c.id, "the skin wraps the whole page");
      const p = await painted(page, "#epkPreview");
      assert.ok(p.motif, `${c.id} ${width}px preview carries the motif`);
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#epkPreview .epk-hero")).backgroundSize), "auto", "the motif tiles at its own size in the hero");
      assert.ok(p.ink >= 4.5 && p.accent >= 4.5 && p.cityAccent >= 4.5 && p.lineInk >= 4.5, `${c.id}/${c.look} ${width}px contrast: ${JSON.stringify(p)}`);
      assert.equal(await page.locator(".epk-hometown-line strong").textContent(), c.name);
      if (c.coords) assert.equal(await page.locator(".epk-hometown-coords").textContent(), c.coords, "city-centre coordinates, 2 decimals");
      else assert.equal(await page.locator(".epk-hometown-coords").count(), 0, "no coordinates for a fallback town");
      const frame = await page.evaluate(() => { const s = getComputedStyle(document.getElementById("epkPreview")); return { border: s.borderTopWidth, radius: s.borderTopLeftRadius, overflow: document.documentElement.scrollWidth > innerWidth, body: getComputedStyle(document.body).backgroundImage.startsWith('url("data:image/svg+xml') }; });
      assert.deepEqual([frame.border, frame.radius, frame.overflow, frame.body], ["0px", "0px", false, true], `${c.id} ${width}px: edge to edge, no card frame: ${JSON.stringify(frame)}`);
      if (width === 320) assert.deepEqual(await wrappedLabels(page), [], `${c.id} public EPK has labels on two lines at 320px`);
      // Print / PDF keeps the palette but drops textures.
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.evaluate(() => [getComputedStyle(document.getElementById("epkPreview")).backgroundImage, getComputedStyle(document.body).backgroundImage].every(v => v === "none")), true, `${c.id} print is texture-free`);
      await page.emulateMedia({ media: "screen" });
      if ([320, 375, 430, 768, 1366].includes(width)) await page.screenshot({ path: path.join(output, `public-${c.id}-${c.look}-${width}.png`), animations: "disabled" });
      assert.deepEqual(errors, [], `${c.id} ${width}px page errors`);
      await context.close();
    }

    // Builder: choice, live preview, laminate, save payload, one-line labels at 320px.
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [], saved = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.route("https://api.danzstak.com/**", r => {
        const url = new URL(r.request().url()), method = r.request().method();
        if (url.pathname === "/epk" && method !== "GET") saved.push(JSON.parse(r.request().postData() || "{}"));
        r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.pathname === "/epk" ? { kit: kit(combos[0]), published: false, privateShared: false } : url.pathname === "/auth/session" ? { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111" } } : {}) });
      });
      await page.goto(`${baseUrl}/epk.html`, { waitUntil: "networkidle" });
      await page.locator("#epkPreview[data-hometown=tacoma]").waitFor({ state: "attached" });
      assert.equal(await page.locator('input[name="hometownMode"][value="auto"]').isChecked(), true, "old kits act as auto");
      assert.equal(await page.locator("#hometownAutoCity").textContent(), "(Tacoma)");
      assert.equal(await page.locator("#hometownCityPick").isVisible(), false, "the city search only shows for Another city");
      assert.match(await page.locator("#hometownVibe").textContent(), /Tacoma · Puget Sound grey, mill steam/);
      await page.waitForFunction(() => document.querySelector(".epk-laminate__city")?.textContent.includes("47.25° N"));
      if (width === 320) assert.deepEqual(await wrappedLabels(page), [], "builder has labels on two lines at 320px");
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".intro h1,h2,h3,legend,summary,button,.epk-rider-slot__title")].filter(n => { const r = n.getBoundingClientRect(), st = getComputedStyle(n); return r.width > 0 && !n.closest("[hidden],dialog:not([open]),.epk-sr-only") && !n.classList.contains("epk-sr-only") && st.overflow === "hidden" && n.scrollWidth > n.clientWidth + 1; }).map(n => n.textContent.trim().slice(0, 40))), [], `builder cuts off a title at ${width}px`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && ![...document.querySelectorAll("#epkForm *")].some(n => { const r = n.getBoundingClientRect(); return r.width && r.right > innerWidth + 1; })), true, `builder overflows sideways at ${width}px`);
      if ([320, 375, 430, 768, 1366].includes(width)) {
        await page.locator("#builderIntro").screenshot({ path: path.join(output, `builder-intro-${width}.png`), animations: "disabled" });
        await page.locator("#hometownSkin").scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(output, `builder-skin-${width}.png`), animations: "disabled" });
      }
      // Live preview follows the hometown field.
      await page.locator("#hometown").fill("Bologna");
      await page.locator("#epkPreview[data-hometown=bologna]").waitFor({ state: "attached" });
      // Another city.
      await page.locator('input[name="hometownMode"][value="city"]').check();
      await page.locator("#hometownCity").fill("Berlin");
      await page.locator("#epkPreview[data-hometown=berlin]").waitFor({ state: "attached" });
      // Off.
      await page.locator('input[name="hometownMode"][value="off"]').check();
      await page.waitForFunction(() => !document.getElementById("epkPreview").dataset.hometown);
      assert.equal(await page.locator("body").getAttribute("data-epk-hometown"), null, "off removes the page skin");
      await page.locator('input[name="hometownMode"][value="city"]').check();
      await page.locator("#hometownCity").fill("Berlin");
      await page.locator("#epkPreview[data-hometown=berlin]").waitFor({ state: "attached" });
      await page.locator("#saveDraft").click();
      await page.waitForFunction(() => true);
      await page.waitForTimeout(300);
      assert.ok(saved.length >= 1, `${width}px the draft was saved`);
      assert.deepEqual(saved.at(-1).kit.hometownSkin, { mode: "city", city: "berlin" }, "the setting is saved with the kit");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px builder overflows`);
      assert.deepEqual(errors, [], `${width}px builder errors`);
      await context.close();
    }
    console.log(`EPK hometown browser checks passed at ${widths.join(", ")}px: Tacoma x Techno, Bologna x Punk, Berlin x Metal and a fallback town x House, edge to edge, contrast as painted, print without textures, one-line labels at 320px, builder choice saved with the kit.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
