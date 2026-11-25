"use strict";
// UI kit screen 3 (docs/tasks/39-modern-look.md, CLAUDE.md F21): My shop in a real browser, 320-430px and 1280px,
// Day and Night, English and Italian, every tap at the centre of the control (elementFromPoint must hit it).
// - The shop front uploads from the phone, opens Move to fit, saves with its position, then asks
//   "Use this as your shop front on your profile?": Replace puts its own copy in the profile's photo band at the same
//   position; Keep shop only leaves the profile alone.
// - Who can see it? is a sheet, never a raw <select>; no native-looking control anywhere on the screen.
// - Products are rows; a tap opens the product screen (full screen on phones); Back closes it; Save product posts it.
// - Get paid is one row that opens a sheet (no paragraph box).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/shop-manager.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/shop-manager");
const me = "11111111-1111-4111-8111-111111111111";
const MEDIA = "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com";
const flyer = `${baseUrl}/assets/danzstak-share-fb-v2.jpg`;
const jpeg = fs.readFileSync(path.resolve("assets/danzstak-share-fb-v2.jpg"));
const runs = [
  { width: 320, scheme: "light", lang: "en" }, { width: 360, scheme: "light", lang: "en" }, { width: 390, scheme: "light", lang: "en" },
  { width: 430, scheme: "light", lang: "en" }, { width: 390, scheme: "dark", lang: "en" }, { width: 360, scheme: "light", lang: "it" },
  { width: 1280, scheme: "light", lang: "en" }
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  try {
    for (const run of runs) {
      const { width, scheme, lang } = run, label = `${width}px ${scheme} ${lang}`;
      const context = await browser.newContext({ viewport: { width, height: width >= 760 ? 900 : 844 }, colorScheme: scheme, locale: lang === "it" ? "it-IT" : "en-US", serviceWorkers: "block", ...(width < 760 ? { isMobile: true, hasTouch: true } : {}) });
      await context.addInitScript(language => { try { localStorage.setItem("danzstak_language", language); localStorage.setItem("danzstak_fee_change_2026_11_16", "seen"); } catch {} }, lang);
      const page = await context.newPage(), errors = [], calls = [];
      page.on("pageerror", error => errors.push(error.message));
      let n = 0;
      const shop = { memberId: me, name: "Night Shift Records", description: "Used punk and metal vinyl.", status: "draft", coverUrl: "", coverPosition: null, album: [], revision: 1,
        products: [{ id: "p1", revision: 2, title: "Signal Lost LP, orange vinyl", description: "Orange vinyl.", imageUrl: flyer, imageKey: "users/aaaaaaaaaaaaaaaaaaaaaaaa/p1.jpg", priceCents: 2500, shippingCents: 600, inventory: 3, status: "published" }] };
      await page.route(`${MEDIA}/**`, route => route.fulfill({ status: 200, body: "" }));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
        const body = request.postData() ? JSON.parse(request.postData()) : null;
        calls.push({ method, p, body });
        const reply = (data, status = 200) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": baseUrl, "access-control-allow-credentials": "true" }, body: JSON.stringify(data) });
        if (p === "/auth/session") return reply({ authenticated: true, user: { sub: me, email: "seller@danzstak.invalid" } });
        if (p === "/stories" && method === "POST") { n += 1; return reply({ uploadUrl: `${MEDIA}/up-${n}`, mediaKey: `users/${"a".repeat(24)}/0000000${n}-0000-4000-8000-000000000000.jpg` }); }
        if (p === "/marketplace/shop" && method === "PUT") {
          Object.assign(shop, { name: body.name, description: body.description, status: body.status });
          if (body.coverKey !== undefined) { shop.coverUrl = body.coverKey ? flyer : ""; shop.coverPosition = body.coverKey ? { x: 50, y: 50, zoom: 1 } : null; }
          if (body.coverX !== undefined && shop.coverUrl) shop.coverPosition = { x: body.coverX, y: body.coverY, zoom: body.coverZoom };
          return reply({ shop: { ...shop, products: [] } });
        }
        if (p === "/marketplace/shop") return reply({ shop });
        if (p === "/marketplace/payouts") return reply({ payouts: { status: "none", testing: true } });
        if (p === "/marketplace/products/p1" && method === "PATCH") return reply({ product: { ...shop.products[0], ...body } });
        if (p === "/profiles" && method === "POST") return reply({ profile: { showcase: flyer } });
        if (p === "/shop/ai") return reply({ available: true, owned: false, totalCents: 630, listingsLeft: 0 });
        return reply({});
      });
      const shot = async name => {
        if (![320, 390, 1280].includes(width) && !(scheme === "dark" || lang === "it")) return;
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(output, `${name}-${width}-${scheme}-${lang}.png`), animations: "disabled", caret: "hide" });
      };
      const tap = async locator => {
        await locator.evaluate(node => node.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(60);
        const box = await locator.boundingBox();
        assert.ok(box, `${label}: tap target on screen`);
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        const hit = await locator.evaluate((node, [px, py]) => { const top = document.elementFromPoint(px, py); return !!top && (node === top || node.contains(top)); }, [x, y]);
        assert.ok(hit, `${label}: something covers the centre of ${await locator.evaluate(el => el.getAttribute("aria-label") || el.textContent.trim().slice(0, 40) || el.id)}`);
        assert.ok(box.height >= 43.5 && box.width >= 43.5, `${label}: ${await locator.evaluate(el => el.id || el.textContent.trim().slice(0, 30))} is at least 44px (${box.width}x${box.height})`);
        if (width < 760) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
      };
      const sheetReady = () => page.waitForFunction(() => { const panel = document.querySelector(".ds-sheet.is-open .ds-sheet__panel"); return !!panel && getComputedStyle(panel).transform === "none" && getComputedStyle(panel).opacity === "1"; });
      const layout = async where => {
        const state = await page.evaluate(() => {
          const visible = el => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
          const screen = document.getElementById("shopManager");
          return {
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            selects: [...document.querySelectorAll("#shopManager select, #productScreen select")].filter(visible).length,
            native: [...document.querySelectorAll("#shopManager input:not([type=hidden]):not([type=file]), #shopManager textarea, #productScreen input:not([type=hidden]):not([type=file]), #productScreen textarea")].filter(visible).filter(el => !el.classList.contains("ds-field__input")).map(el => el.id),
            small: [...document.querySelectorAll("#shopManager button, #shopManager a, #productScreen button")].filter(visible).filter(el => { const r = el.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map(el => el.id || el.textContent.trim().slice(0, 30)),
            raw: /Cannot read propert|undefined|is not a function|\[object/.test(document.body.innerText),
            canvas: getComputedStyle(screen).backgroundColor
          };
        });
        assert.equal(state.overflow, false, `${label} ${where}: page scrolls sideways`);
        assert.equal(state.selects, 0, `${label} ${where}: raw <select> on the kit screen`);
        assert.deepEqual(state.native, [], `${label} ${where}: fields outside the kit field`);
        assert.deepEqual(state.small, [], `${label} ${where}: controls under 44px`);
        assert.equal(state.raw, false, `${label} ${where}: raw error text`);
        return state;
      };

      await page.goto(`${baseUrl}/store.html?manage=1`, { waitUntil: "domcontentloaded" });
      await page.locator("#productList .ds-row").first().waitFor();
      await page.waitForFunction(() => document.querySelector(".payouts-row-kit"));
      const day = await layout("dashboard");
      if (scheme === "dark") assert.notEqual(day.canvas, "rgb(255, 255, 255)", `${label}: Night follows the phone`);
      assert.equal(await page.locator(".store-hero").isVisible(), false, `${label}: the public hero stays out of My shop`);
      assert.equal(await page.locator(".payouts-card").count(), 0, `${label}: no paragraph Get paid box`);
      if (lang === "it") {
        assert.equal((await page.locator("#manageTitle").innerText()).trim(), "Il mio negozio");
        assert.equal((await page.locator("#shopStatusValue").innerText()).trim(), "Bozza privata");
        assert.match(await page.locator("#shopManager").innerText(), /Aggiungi la vetrina/);
      }
      await shot("1-dashboard");

      // Who can see it? → sheet → Published.
      await tap(page.locator("#shopStatusPick"));
      await sheetReady();
      await layout("visibility sheet");
      await shot("2-visibility-sheet");
      await tap(page.locator('.ds-sheet.is-open .ds-choice[data-value="published"]'));
      await page.waitForFunction(() => !document.querySelector(".ds-sheet"));
      assert.equal(await page.locator("#shopStatus").inputValue(), "published");
      await tap(page.locator("#shopForm button[type=submit]"));
      await page.waitForFunction(() => /published|pubblicato/i.test(document.getElementById("storeStatus").textContent));
      assert.equal(calls.filter(c => c.p === "/marketplace/shop" && c.method === "PUT").at(-1).body.status, "published", `${label}: Save shop sends the picked visibility`);

      // Shop front: upload → Move to fit → saved with its position → offer to the profile.
      const chooser = page.waitForEvent("filechooser");
      await tap(page.locator("#chooseShopCover"));
      await (await chooser).setFiles({ name: "front.jpg", mimeType: "image/jpeg", buffer: jpeg });
      const fitSheet = page.locator("dialog.ds-fit-sheet, dialog:has(.ds-fit-box)");
      await fitSheet.waitFor({ state: "visible" });
      await shot("3-move-to-fit");
      await page.locator(".ds-fit-range").evaluate(range => { range.value = "1.5"; range.dispatchEvent(new Event("input", { bubbles: true })); });
      await tap(page.locator(".ds-fit-save"));
      await sheetReady();
      const coverSave = calls.filter(c => c.p === "/marketplace/shop" && c.method === "PUT").at(-1).body;
      assert.match(coverSave.coverKey, /^users\//, `${label}: the shop front is the seller's own upload`);
      assert.equal(coverSave.coverZoom, 1.5, `${label}: Move to fit's zoom is saved with the shop front`);
      assert.equal(await page.locator("#shopCoverPreview").isVisible(), true, `${label}: the shop front shows`);
      const fill = await page.evaluate(() => { const img = document.getElementById("shopCoverPreview"), box = document.querySelector(".shop-front").getBoundingClientRect(); return { img: [img.offsetWidth, img.offsetHeight], box: [box.width, box.height].map(Math.round), ratio: box.width / box.height, fit: getComputedStyle(img).objectFit, zoom: img.style.transform }; });
      assert.deepEqual(fill.img, fill.box, `${label}: the picture fills its box (fill = box)`);
      assert.equal(fill.fit, "cover"); assert.equal(fill.zoom, "scale(1.5)", `${label}: drawn at the zoom the seller picked`);
      assert.ok(Math.abs(fill.ratio - 16 / 7) < 0.02, `${label}: the shop front box is 16:7 like the profile band (${fill.ratio})`);
      assert.match(await page.locator(".ds-sheet.is-open").innerText(), lang === "it" ? /Usarla come vetrina sul tuo profilo/ : /Use this as your shop front on your profile\?/);
      const offer = await page.evaluate(() => {
        const panel = document.querySelector(".ds-sheet.is-open .ds-sheet__panel").getBoundingClientRect(), frame = document.querySelector(".ds-sheet.is-open .ds-sheet__preview");
        const r = frame.getBoundingClientRect(), note = document.querySelector(".ds-sheet.is-open .ds-note"), n = note.getBoundingClientRect();
        const top = document.elementFromPoint(n.x + n.width / 2, n.y + n.height / 2);
        return { inside: r.left >= panel.left && r.right <= panel.right + 0.5, clipped: getComputedStyle(frame).overflow === "hidden", ratio: r.width / r.height, noteSeen: !!top && note.contains(top) };
      });
      assert.ok(offer.inside && offer.clipped && Math.abs(offer.ratio - 16 / 7) < 0.02, `${label}: the profile preview is a clipped 16:7 frame inside the sheet ${JSON.stringify(offer)}`);
      assert.ok(offer.noteSeen, `${label}: "It will replace the photo on your profile" is not covered by the zoomed picture`);
      await layout("profile offer");
      await shot("4-use-on-profile");
      const before = calls.filter(c => c.p === "/profiles").length;
      if (width % 2 === 0) {
        await tap(page.locator("#shopFrontReplace"));
        await page.waitForFunction(() => !document.querySelector(".ds-sheet"));
        const profile = calls.filter(c => c.p === "/profiles" && c.method === "POST").at(-1)?.body;
        assert.ok(profile, `${label}: Replace saves the profile`);
        assert.match(profile.showcaseKey, /^users\//, `${label}: Replace sends its own upload`);
        assert.notEqual(profile.showcaseKey, coverSave.coverKey, `${label}: the profile gets its own copy (either can be deleted alone)`);
        assert.equal(profile.showcaseZoom, 1.5, `${label}: the profile band uses the same position`);
      } else {
        await tap(page.locator("#shopFrontKeep"));
        await page.waitForFunction(() => !document.querySelector(".ds-sheet"));
        assert.equal(calls.filter(c => c.p === "/profiles").length, before, `${label}: Keep shop only leaves the profile alone`);
      }

      // A product row opens the product screen; the phone's Back closes it; Save posts the edit.
      await tap(page.locator("#productList .ds-row__target").first());
      await page.locator("#productScreen:not([hidden])").waitFor();
      assert.equal(await page.locator("#productTitle").inputValue(), "Signal Lost LP, orange vinyl");
      const screen = await page.evaluate(() => { const r = document.querySelector("#productScreen .ds-form-screen__panel").getBoundingClientRect(); return { w: r.width, h: r.height }; });
      if (width < 760) assert.ok(screen.w >= width - 1 && screen.h >= 843, `${label}: the product screen is full screen on a phone`);
      await layout("product screen");
      assert.equal(await page.locator("#feePreview").innerText(), "Buyer pays $33.50 · You get $31.00", `${label}: fee line on the product screen`);
      await shot("5-product-screen");
      await page.goBack();
      await page.waitForFunction(() => document.getElementById("productScreen").hidden);
      assert.match(page.url(), /store\.html\?manage=1/, `${label}: Back closed the screen and stayed on My shop`);
      await tap(page.locator("#productList .ds-row__target").first());
      await page.locator("#productScreen:not([hidden])").waitFor();
      await page.locator("#productInventory").fill("2");
      await tap(page.locator("#productStatusPick"));
      await sheetReady();
      await tap(page.locator('.ds-sheet.is-open .ds-choice[data-value="sold_out"]'));
      await page.waitForFunction(() => !document.querySelector(".ds-sheet"));
      await tap(page.locator("#saveProduct"));
      await page.waitForFunction(() => document.getElementById("productScreen").hidden);
      const patch = calls.filter(c => c.p === "/marketplace/products/p1" && c.method === "PATCH").at(-1)?.body;
      assert.ok(patch && patch.inventory === 2, JSON.stringify(patch)); assert.ok(patch && patch.inventory === 2 && patch.status === "sold_out" && patch.priceCents === 2500, `${label}: Save product sends the edit`);

      // Add a product with no name: the error sits under the field, not in a pop-up.
      await tap(page.locator("#addProduct"));
      await page.locator("#productScreen:not([hidden])").waitFor();
      await tap(page.locator("#saveProduct"));
      assert.notEqual((await page.locator("#productTitleError").innerText()).trim(), "", `${label}: the missing name is said under the field`);
      assert.equal(await page.locator("#productTitle").getAttribute("aria-invalid"), "true");
      await tap(page.locator("#closeProductScreen"));
      await page.waitForFunction(() => document.getElementById("productScreen").hidden);

      // Get paid: one row, the details in a sheet.
      await tap(page.locator(".payouts-row-kit"));
      await sheetReady();
      assert.match(await page.locator(".ds-sheet.is-open").innerText(), lang === "it" ? /Stripe/ : /DanzStak never sees them/);
      await layout("get paid sheet");
      if (width < 760) await tap(page.locator('.ds-sheet.is-open .ds-choice[data-country="IT"]'));
      const go = page.locator(".ds-sheet.is-open .ds-actions .ds-btn--go");
      assert.ok(await go.evaluate(button => { const r = button.getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; }), `${label}: "Get paid with Stripe" stays on screen under the country list`);
      await shot("6-get-paid");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector(".ds-sheet"));

      // Remove from shop asks in a kit sheet (never the browser's confirm box), then closes the screen.
      page.on("dialog", dialog => { errors.push(`browser dialog: ${dialog.message()}`); dialog.dismiss(); });
      await tap(page.locator("#productList .ds-row__target").first());
      await page.locator("#productScreen:not([hidden])").waitFor();
      await tap(page.locator("#removeProduct"));
      await sheetReady();
      await tap(page.locator("#confirmRemoveProduct"));
      await page.waitForFunction(() => document.getElementById("productScreen").hidden && !document.querySelector(".ds-sheet"));
      assert.ok(calls.some(c => c.p === "/marketplace/products/p1" && c.method === "DELETE"), `${label}: Remove from shop deletes the listing`);
      assert.match(page.url(), /store\.html\?manage=1/, `${label}: still on My shop after removing`);
      assert.deepEqual(errors, [], `${label}: page errors`);
      await context.close();
    }
    console.log(`My shop (UI kit) checks passed at ${runs.map(r => `${r.width}/${r.scheme}/${r.lang}`).join(", ")}: shop front with Move to fit and the profile offer, visibility sheet, product rows and screen with Back, field errors, Get paid row.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
