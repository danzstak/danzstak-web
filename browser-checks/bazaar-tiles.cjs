"use strict";
// Audit 36 B10 (directive F6, plus F17's "fill = box" rule): Bazaar product photos fill their square tiles, and the
// Bazaar has one search. Before: wide photos sat in white letterbox bars, tall photos ran out of the square and were cut
// at the top, and the page had two searches (the bar's "Search people" and a "Search the Bazaar" form in the body).
// Checks at 320/360/390/430px, signed in:
// - every tile is square, its photo's box equals the tile's box (wide, tall and square photos), cropped centred;
//   a product with no photo shows readable "No image" text on the dark backdrop;
// - one search on the page: the bar's search box says "Search the Bazaar"; there is no people search and no second
//   search form; tapping the centre of the box puts the cursor in it, typing and Enter searches the Bazaar (q= sent)
//   and shows the results; no sideways scroll.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/bazaar-tiles");
const me = "11111111-1111-4111-8111-111111111111";
const svg = (w, h, colour) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${colour}"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 3}" fill="#fff"/></svg>`;
const product = (id, title, image) => ({ productId: id, title, priceCents: 2500, currency: "usd", imageUrl: image ? `${base}/__${image}.svg` : "", shopName: "Night Shift Merch", sellerMemberId: me, shippingCents: 0 });
const ALL = [product("p1", "Tour tee", "wide"), product("p2", "Live LP", "tall"), product("p3", "Patch", "square"), product("p4", "Sticker", "")];

async function open(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [], queries = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route(`${base}/__*.svg`, route => {
    const name = new URL(route.request().url()).pathname;
    route.fulfill({ status: 200, contentType: "image/svg+xml", body: name.includes("wide") ? svg(800, 400, "#1769e0") : name.includes("tall") ? svg(400, 800, "#c0392b") : svg(500, 500, "#16a085") });
  });
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url());
    let body = {};
    if (url.pathname === "/auth/session") body = { authenticated: true, user: { sub: me, email: "night@danzstak.invalid" } };
    else if (url.pathname === "/profiles" || url.pathname === "/profile") body = { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true } };
    else if (url.pathname === "/marketplace/bazaar") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      queries.push(q);
      const products = q ? ALL.filter(item => item.title.toLowerCase().includes(q)) : ALL;
      body = { products };
    }
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
  await page.goto(`${base}/bazaar.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelectorAll('.bazaar-card:not(.bazaar-example) .bazaar-image-frame').length >= 4, null, { timeout: 8000 });
  await page.waitForFunction(() => [...document.querySelectorAll(".bazaar-image-frame img")].every(img => img.complete), null, { timeout: 8000 });
  return { context, page, errors, queries };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      const label = `${width}px Bazaar`;
      const { context, page, errors, queries } = await open(browser, width);
      const tiles = await page.evaluate(() => [...document.querySelectorAll(".bazaar-card:not(.bazaar-example) .bazaar-image-frame")].map(frame => {
        const box = frame.getBoundingClientRect(), image = frame.querySelector("img"), fallback = frame.querySelector(".image-fallback");
        const round = rect => rect && [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)];
        const contrastOf = element => { const style = getComputedStyle(element); return [style.color, getComputedStyle(frame).backgroundColor]; };
        return {
          title: frame.closest(".bazaar-card").querySelector(".bazaar-title")?.textContent.trim() || "",
          frame: round(box), image: round(image?.getBoundingClientRect()), fit: image ? getComputedStyle(image).objectFit : "",
          position: image ? getComputedStyle(image).objectPosition : "", background: getComputedStyle(frame).backgroundColor,
          fallback: fallback ? { text: fallback.textContent.trim(), colours: contrastOf(fallback) } : null
        };
      }));
      assert.equal(tiles.length, 4, `${label}: four product tiles`);
      for (const tile of tiles) {
        assert.ok(Math.abs(tile.frame[2] - tile.frame[3]) <= 1, `${label} ${tile.title}: the tile is square ${JSON.stringify(tile.frame)}`);
        assert.equal(tile.background, "rgb(18, 20, 24)", `${label} ${tile.title}: a dark backdrop, not a white box`);
        if (tile.image) {
          assert.deepEqual(tile.image, tile.frame, `${label} ${tile.title}: the photo fills its tile exactly (fill = box)`);
          assert.deepEqual([tile.fit, tile.position], ["cover", "50% 50%"], `${label} ${tile.title}: cropped centred, never letterboxed`);
        }
      }
      const empty = tiles.find(tile => !tile.image);
      assert.equal(empty.fallback?.text, "No image", `${label}: a product without a photo says so`);
      assert.notEqual(empty.fallback.colours[0], empty.fallback.colours[1], `${label}: "No image" is readable on the backdrop`);
      if (width === 390) await page.screenshot({ path: path.join(output, "after-390.png") });

      // One search: the bar's box searches the Bazaar.
      const searches = await page.evaluate(() => {
        const shown = element => element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden";
        const fields = [...document.querySelectorAll('input[type="search"], .ds-top-search-button, form[role="search"]')].filter(shown);
        const box = document.querySelector("header .ds-top-search-field");
        return {
          fields: fields.map(field => field.tagName + "." + String(field.className).split(" ")[0]),
          inBar: Boolean(box && box.closest("header")), placeholder: box?.querySelector("input")?.placeholder || "",
          label: box?.querySelector("input")?.getAttribute("aria-label") || "", people: Boolean(document.querySelector(".ds-top-search-button")),
          height: box ? Math.round(box.getBoundingClientRect().height) : 0, overflow: document.documentElement.scrollWidth > innerWidth
        };
      });
      assert.equal(searches.inBar, true, `${label}: the search box is in the bar`);
      assert.equal(searches.people, false, `${label}: no second (people) search on the Bazaar`);
      assert.deepEqual(searches.fields, ["FORM.ds-top-search-field", "INPUT.ds-top-search-input"], `${label}: exactly one search on the page ${JSON.stringify(searches.fields)}`);
      assert.deepEqual([searches.placeholder, searches.label], ["Search the Bazaar", "Search the Bazaar"], `${label}: the box says what it searches`);
      assert.equal(searches.height, 44, `${label}: a 44px search box`);
      assert.equal(searches.overflow, false, `${label}: no sideways scroll`);
      const box = await page.locator("header .ds-top-search-field").boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await page.evaluate(() => document.activeElement?.matches(".ds-top-search-field input")), true, `${label}: tapping the centre of the box puts the cursor in it`);
      await page.keyboard.type("tee");
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelectorAll(".bazaar-card:not(.bazaar-example)").length === 1, null, { timeout: 5000 }).catch(() => {});
      assert.ok(queries.includes("tee"), `${label}: Enter searches the Bazaar ${JSON.stringify(queries)}`);
      const titles = await page.evaluate(() => [...document.querySelectorAll(".bazaar-card:not(.bazaar-example)")].map(card => card.querySelector(".bazaar-title")?.textContent.trim()));
      assert.deepEqual(titles, ["Tour tee"], `${label}: the grid shows the results`);
      assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    console.log("Bazaar tile checks passed at 320, 360, 390, 430px: wide, tall and square photos fill their square tiles (cover, centred, on a dark backdrop), \"No image\" is readable, and the bar's one search box searches the Bazaar.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
