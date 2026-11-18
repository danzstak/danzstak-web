"use strict";
// "Draft it with AI" in My Shop (task 19, queue 5b2) in a real browser (Edge), API mocked: the two rows ($6.30 only
// until bought, then "N left" on listings), the purchase sheet to Stripe test checkout (kind=shop), the shop setup
// draft, a listing drafted from a photo picked on the phone (shrunk to JPEG in the browser), and the forms filled
// without saving. 320–430 px plus 1366; screenshots at 360 and 390.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8188 node browser-checks/shop-ai.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8188").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/shop-ai");
const widths = (process.env.WIDTHS || "320,360,390,430,1366").split(",").map(Number);
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const DISCLAIMER = "AI drafts can be wrong or out of date. DanzStak doesn't verify them. You must review every word, and you're responsible for what you publish or send. No guarantee of bookings or press. We never train AI on your content.";
// A real 48x48 orange PNG the browser can decode and re-encode.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAAZ0lEQVR4nM3OQQEAIBCAMKSIvezfQ/9XQJZg655NicRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjMRIjL8D0wMjQwHYkNd9GgAAAABJRU5ErkJggg==", "base64");

async function shot(page, name) {
  for (let attempt = 1; ; attempt++) {
    try { await page.screenshot({ path: path.join(output, `${name}.png`), animations: "disabled", caret: "hide" }); return; }
    catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(300); }
  }
}
async function open(browser, width, { available = true, owned = false, listingsLeft = 0 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 820 }, serviceWorkers: "block", hasTouch: width < 760, isMobile: width < 760, deviceScaleFactor: 2 });
  const page = await ctx.newPage(), state = { errors: [], bodies: {}, saves: 0, listingsLeft };
  page.on("pageerror", error => state.errors.push(error.message));
  await page.route("https://checkout.stripe.com/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Stripe Checkout (test)</p>" }));
  await page.route("https://api.danzstak.com/**", route => {
    const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
    if (request.postData()) { try { state.bodies[p] = JSON.parse(request.postData()); } catch {} }
    if (p === "/auth/session") return route.fulfill(json({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "me@danzstak.test" } }));
    if (p === "/profiles") return route.fulfill(json({ profile: { isOwner: true, name: "Hazard Records", handle: "hazardrecords" } }));
    if (p === "/marketplace/shop" && method !== "GET") { state.saves += 1; return route.fulfill(json({ shop: {} })); }
    if (p === "/marketplace/shop") return route.fulfill(json({ shop: { memberId: "11111111-1111-4111-8111-111111111111", name: "Hazard Records", description: "", status: "draft", products: [] } }));
    if (p.startsWith("/marketplace/products")) { state.saves += 1; return route.fulfill(json({})); }
    if (p === "/shop/ai") return route.fulfill(json({ available, comingSoon: available ? "" : "AI coming soon", owned, listingsLeft: state.listingsLeft, listingsPerPurchase: 10, priceCents: 500, feeCents: 130, totalCents: 630, disclaimer: DISCLAIMER, callsLeftToday: 20 }));
    if (p === "/shop/ai/setup") return route.fulfill(json({ draft: { name: "Hazard Records", about: "Used punk and metal vinyl from Oakland, checked and graded by hand. Ships in a stiff mailer within 3 days; returns if it arrives damaged." } }));
    if (p === "/shop/ai/listing") { state.listingsLeft -= 1; return route.fulfill(json({ draft: { title: "Signal Lost LP, orange vinyl", description: "Orange vinyl LP in its original sleeve. Light shelf wear on the corners.", condition: "Very good" }, listingsLeft: state.listingsLeft })); }
    if (p === "/tour-manager/ai-epk/checkout") return route.fulfill(json({ checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_shop", totalCents: 630, testMode: true }));
    return route.fulfill(json({}));
  });
  await page.goto(`${baseUrl}/store.html?manage=1`, { waitUntil: "domcontentloaded" });
  await page.locator("#shopAiSetup").waitFor({ timeout: 15000 });
  await page.waitForFunction(() => document.querySelector("#shopAiSetup .profile-ai-label")?.textContent.trim() && !document.getElementById("productManager")?.hidden, null, { timeout: 15000 });
  return { ctx, page, state };
}
const geometry = page => page.evaluate(() => ({
  overflow: document.documentElement.scrollWidth > innerWidth,
  small: [...document.querySelectorAll("dialog.shop-ai-sheet button, #shopAiSetup, #shopAiListing")].filter(node => { const r = node.getBoundingClientRect(); return r.height > 0 && r.height < 43.5; }).map(node => node.textContent.trim() || node.getAttribute("aria-label"))
}));

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const snap = [360, 390].includes(width);
      // A. Not bought: $6.30 on both rows, purchase sheet, Stripe test checkout (kind=shop).
      {
        const label = `${width}px buy`;
        const { ctx, page, state } = await open(browser, width);
        assert.equal(await page.locator("#shopAiSetup").getAttribute("aria-label"), "Draft it with AI, $6.30");
        assert.equal(await page.locator("#shopAiListing").getAttribute("aria-label"), "Draft this listing with AI, $6.30");
        assert.deepEqual((await geometry(page)).small, [], `${label}: 44px rows`);
        if (snap) { await page.locator("#shopAiSetup").scrollIntoViewIfNeeded(); await shot(page, `1-rows-${width}`); }
        await page.locator("#shopAiSetup").click();
        const sheet = page.locator("dialog.shop-ai-sheet");
        await sheet.waitFor({ state: "visible" });
        assert.match(await sheet.textContent(), /Up to 10 listing drafts from your photos/);
        assert.match(await sheet.textContent(), /\$6\.30\s*\(\$5\.00 \+ \$1\.30 fee\)/);
        assert.ok((await sheet.textContent()).includes(DISCLAIMER)); assert.match(await sheet.textContent(), /No refund once a draft is made/);
        if (snap) await shot(page, `2-start-${width}`);
        await sheet.getByRole("button", { name: "Continue" }).click();
        assert.equal((await sheet.locator(".epk-ai-bill").textContent()).replace(/\s+/g, ""), "AIshop$5.00DanzStakfee$1.30Total$6.30");
        await sheet.getByRole("button", { name: "Pay $6.30" }).click();
        await page.waitForURL(/checkout\.stripe\.com/);
        assert.deepEqual(state.bodies["/tour-manager/ai-epk/checkout"], { kind: "shop" });
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
      // B. Bought: setup draft fills the shop form; a listing from a photo fills the product form; nothing saved.
      {
        const label = `${width}px drafts`;
        const { ctx, page, state } = await open(browser, width, { owned: true, listingsLeft: 10 });
        assert.equal(await page.locator("#shopAiSetup").getAttribute("aria-label"), "Draft it with AI", `${label}: no price once bought`);
        assert.equal(await page.locator("#shopAiListing").getAttribute("aria-label"), "Draft this listing with AI, 10 left");
        await page.locator("#shopAiSetup").click();
        const sheet = page.locator("dialog.shop-ai-sheet");
        await sheet.waitFor({ state: "visible" });
        await sheet.locator("select[name=kind]").selectOption("records");
        await sheet.locator("input[name=about]").fill("Used punk and metal vinyl.");
        await sheet.locator("input[name=city]").fill("Oakland");
        await sheet.locator("input[name=shipping]").fill("Stiff mailer within 3 days, returns if damaged");
        if (snap) await shot(page, `3-setup-questions-${width}`);
        await sheet.getByRole("button", { name: "Draft it with AI" }).click();
        await sheet.locator(".profile-ai-draft").waitFor();
        assert.deepEqual(state.bodies["/shop/ai/setup"], { answers: { kind: "records", shopName: "Hazard Records", about: "Used punk and metal vinyl.", city: "Oakland", shipping: "Stiff mailer within 3 days, returns if damaged" } });
        await sheet.getByRole("button", { name: "Use this" }).click();
        await sheet.waitFor({ state: "hidden" });
        assert.match(await page.locator("#shopDescription").inputValue(), /Ships in a stiff mailer within 3 days/);
        // A listing from a photo picked on the phone.
        await page.locator("#shopAiListing").click();
        await sheet.waitFor({ state: "visible" });
        assert.match(await sheet.textContent(), /DanzStak doesn't keep it, and it's never used to train AI/);
        await sheet.locator("input[type=file]").setInputFiles({ name: "lp.png", mimeType: "image/png", buffer: PNG });
        await sheet.locator(".shop-ai-preview").waitFor({ state: "visible" });
        await sheet.locator("input[name=notes]").fill("Orange vinyl, 2024 pressing");
        assert.ok(!/null|undefined/.test(await sheet.textContent()), `${label}: no stray null/undefined text`);
        const g = await geometry(page); assert.equal(g.overflow, false, `${label}: overflow`); assert.deepEqual(g.small, [], `${label}: targets`);
        if (snap) await shot(page, `4-listing-photo-${width}`);
        await sheet.getByRole("button", { name: "Draft it with AI" }).click();
        await sheet.locator(".profile-ai-draft").waitFor();
        const sent = state.bodies["/shop/ai/listing"];
        assert.equal(sent.image.mediaType, "image/jpeg", `${label}: shrunk to JPEG in the browser`);
        assert.ok(Buffer.from(sent.image.data, "base64").slice(0, 2).equals(Buffer.from([0xff, 0xd8])), `${label}: real JPEG bytes`);
        assert.equal(sent.notes, "Orange vinyl, 2024 pressing");
        if (snap) await shot(page, `5-listing-draft-${width}`);
        await sheet.getByRole("button", { name: "Use this" }).click();
        await sheet.waitFor({ state: "hidden" });
        assert.equal(await page.locator("#productTitle").inputValue(), "Signal Lost LP, orange vinyl");
        assert.equal(await page.locator("#productDescription").inputValue(), "Condition: Very good.\n\nOrange vinyl LP in its original sleeve. Light shelf wear on the corners.");
        assert.equal(await page.locator("#productPrice").inputValue(), "", `${label}: the seller sets the price`);
        assert.equal(await page.locator("#shopAiListing").getAttribute("aria-label"), "Draft this listing with AI, 9 left");
        assert.equal(state.saves, 0, `${label}: nothing saved until the seller saves`);
        assert.deepEqual(state.errors, [], `${label}: page errors`);
        await ctx.close();
      }
      // C. Without the key: coming soon on both rows.
      if ([360, 1366].includes(width)) {
        const { ctx, page } = await open(browser, width, { available: false });
        for (const id of ["#shopAiSetup", "#shopAiListing"]) { assert.equal((await page.locator(id).textContent()).trim(), "AI coming soon"); assert.equal(await page.locator(id).isDisabled(), true); }
        await ctx.close();
      }
    }
  } finally { await browser.close(); }
  console.log(`AI shop browser checks passed (${widths.join(", ")}px): two rows with $6.30 until bought then "N left", purchase sheet to Stripe test checkout (kind=shop), shop setup draft, listing from a photo shrunk to JPEG, forms filled without saving, price left to the seller, coming soon.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
