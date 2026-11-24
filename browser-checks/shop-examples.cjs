"use strict";
// Task 22: example shops at phone, tablet and desktop widths, and Moving Day with a Discogs collection export.
//   python3 -m http.server 8132   (repo root), then: node browser-checks/shop-examples.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = (process.env.DANZSTAK_WIDTHS || "320,360,375,390,414,430,768,1024,1366").split(",").map(Number);
const output = path.resolve("docs/screenshots/shop-examples");
fs.mkdirSync(output, { recursive: true });

(async () => {
  // Edge in CI like the other checks; DANZSTAK_BROWSER_CHANNEL=bundled runs Playwright's own Chromium.
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", reducedMotion: "reduce", deviceScaleFactor: 1 });
      const page = await context.newPage(), errors = [], apiCalls = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => { apiCalls.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 401, contentType: "application/json", body: "{}" }); });
      await page.goto(`${origin}/shop-example.html`, { waitUntil: "networkidle" });
      for (const [shop, label] of [["fan", "Fan shop"], ["band", "Band shop"], ["record", "Record shop"]]) {
        await page.getByRole("tab", { name: label }).click();
        assert.equal(await page.getByRole("tab", { name: label }).getAttribute("aria-selected"), "true");
        const cards = page.locator(".example-card");
        const count = await cards.count();
        assert.ok(count >= 5, `${width}px ${shop}: ${count} example cards`);
        assert.equal(await page.locator(".example-card .example-tag").count(), count, "every card is tagged Example");
        assert.equal(await page.getByRole("button", { name: "Example — not for sale" }).count(), count, "every card has the not-for-sale button");
        for (const button of await page.getByRole("button", { name: "Example — not for sale" }).all()) assert.equal(await button.isDisabled(), true);
        assert.equal(await page.locator(".example-card a").count(), 0, "example cards link nowhere");
        if (shop === "record") {
          await page.getByRole("heading", { name: "Bring your Discogs inventory over" }).waitFor();
          assert.equal(await page.locator(".example-steps li").count(), 8);
          assert.equal(await page.getByRole("link", { name: "Start Moving Day" }).getAttribute("href"), "moving-day.html?source=discogs");
        }
        if (shop === "band") assert.match(await page.locator(".example-extras").innerText(), /Every order comes with free stickers/);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 0, `${width}px ${shop}: no horizontal overflow (${overflow})`);
        for (const target of await page.locator(".example-switch button, .example-buy, .example-primary, .example-guide summary").all()) {
          if (!await target.isVisible()) continue;
          const box = await target.boundingBox();
          assert.ok(box.height >= 44, `${width}px ${shop}: touch target "${(await target.innerText()).slice(0, 30)}" is ${box.height}px`);
        }
        await page.screenshot({ path: path.join(output, `${shop}-${width}.png`) });
      }
      // Keyboard: arrows move between the three shops.
      await page.getByRole("tab", { name: "Record shop" }).focus();
      await page.keyboard.press("ArrowRight");
      assert.equal(await page.getByRole("tab", { name: "Fan shop" }).getAttribute("aria-selected"), "true");
      // Guide notes stay out of the way until tapped.
      const note = page.locator(".example-guide").first();
      assert.equal(await note.evaluate(element => element.open), false);
      await note.locator("summary").click();
      assert.equal(await note.evaluate(element => element.open), true);
      assert.deepEqual(apiCalls.filter(call => /marketplace/.test(call)), [], "the examples never call the marketplace");
      assert.deepEqual(errors, [], `${width}px: no page errors`);
      await context.close();
      console.log(`ok ${width}px`);
    }

    // Moving Day: a Discogs collection export has no prices; nothing moves until the member sets them.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block", deviceScaleFactor: 1 });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    let imported = null;
    await page.route("https://api.danzstak.com/**", route => {
      if (new URL(route.request().url()).pathname === "/marketplace/products/import") {
        imported = route.request().postDataJSON();
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ moved: imported.items.length, skipped: 0, errors: 0, results: imported.items.map((_, index) => ({ index, result: "moved" })) }) });
      }
      return route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    });
    await page.goto(`${origin}/moving-day.html?source=discogs`, { waitUntil: "networkidle" });
    assert.match(await page.locator("#movingGuide").innerText(), /choose Collection from the menu and Request Data Export/);
    const csv = path.join(os.tmpdir(), "danzstak-collection-check.csv");
    fs.writeFileSync(csv, 'Catalog#,Artist,Title,Label,Format,Rating,Released,release_id,CollectionFolder,Date Added,Collection Media Condition,Collection Sleeve Condition,Collection Notes\nNTR-014,Static Ward,Ward Lights,Night Tram Records,"LP, Album",4,2025,12345,Uncategorized,2025-03-01 10:00:00,Very Good Plus (VG+),Very Good (VG),Signed\nGW-031,Bone Choir,Ossuary Hymns,Grave Weather,LP,,2024,777,Uncategorized,2025-03-02 10:00:00,Near Mint (NM or M-),Very Good Plus (VG+),\n');
    await page.locator("#movingFile").setInputFiles(csv);
    await page.locator("#movingStatus", { hasText: "Discogs collection export" }).waitFor();
    assert.equal(await page.locator("#priceAllRow").isVisible(), true, "the price-for-all field shows for a collection");
    assert.equal(await page.locator("#moveButton").isDisabled(), true, "nothing without a price moves");
    await page.locator("#priceAll").fill("15");
    await page.locator("#moveButton", { hasText: "Move 2 items" }).waitFor();
    await page.getByLabel("Price in USD for Bone Choir – Ossuary Hymns").fill("22.50");
    await page.locator("#stepPick").screenshot({ path: path.join(output, "moving-day-collection-390.png") });
    await page.locator("#moveButton").click();
    await page.locator("#movingStatus", { hasText: "Moved 2" }).waitFor();
    assert.deepEqual(imported.items.map(item => [item.title, item.priceCents]), [["Static Ward – Ward Lights", 1500], ["Bone Choir – Ossuary Hymns", 2250]], "row price wins, the rest take the price for all");
    assert.deepEqual(errors, []);
    await context.close();
    console.log("ok Moving Day collection export");

    // Every word translated (directive quality bar): in Italian, French and Spanish nothing on the example page reads as
    // English except names and record titles, the prices and seller lines included, and the tab title follows.
    const english = /\b(the|and|your|with|from|for|shop|sale|price|shipping|seller|buyer|fees|Example|Media|Sleeve|Sizes|Why|works|ships)\b/;
    for (const lang of ["it", "fr", "es"]) {
      const languageContext = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
      await languageContext.addInitScript(code => { try { localStorage.setItem("danzstak_language", code); } catch { /* optional */ } }, lang);
      const languagePage = await languageContext.newPage();
      await languagePage.route("https://api.danzstak.com/**", route => route.fulfill({ status: 401, contentType: "application/json", body: "{}" }));
      for (const shop of ["fan", "band", "record"]) {
        await languagePage.goto(`${origin}/shop-example.html?shop=${shop}`, { waitUntil: "domcontentloaded" });
        await languagePage.waitForFunction(() => document.documentElement.lang && document.documentElement.lang !== "en");
        await languagePage.waitForTimeout(600);
        const seen = await languagePage.evaluate(() => {
          const lines = [], walker = document.createTreeWalker(document.getElementById("exampleMain"), NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.nodeValue.trim();
            if (text && !node.parentElement.closest("svg, .example-title")) lines.push(text); // item titles are the seller's own words
          }
          return { lines, title: document.title };
        });
        const left = seen.lines.filter(line => english.test(line));
        assert.deepEqual(left, [], `${lang} ${shop}: every line translated`);
        assert.doesNotMatch(seen.title, /shop example/, `${lang} ${shop}: the tab title is translated`);
      }
      await languageContext.close();
      console.log(`ok ${lang}: every line translated`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
