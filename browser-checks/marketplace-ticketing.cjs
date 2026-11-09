"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8017").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 1366];
const captureDir = process.env.DANZSTAK_CAPTURE_DIR ? path.resolve(process.env.DANZSTAK_CAPTURE_DIR) : "";
const eventId = "33333333-3333-4333-8333-333333333333";

const officialStore = {
  id: "official",
  name: "DanzStak Official Store",
  description: "Official DanzStak merchandise.",
  official: true,
  status: "published",
  products: [{ id: "official-shirt", title: "DanzStak tour shirt", description: "Heavyweight cotton shirt with the silver-and-orange DanzStak mark.", imageUrl: `${baseUrl}/assets/danzstak-share-fb-v2.jpg`, images: [`${baseUrl}/assets/danzstak-share-fb-v2.jpg`], itemSpecifics: { medium: "Cotton", dimensions: "Size L", condition: "New", yearCreated: 2026, signatureStatus: "Unsigned" }, priceCents: 2500, shippingCents: 500, available: true }]
};
const memberShop = {
  id: "member-shop",
  name: "Night Circuit Shop",
  description: "Physical releases, shirts and tour merchandise from Night Circuit.",
  official: false,
  status: "published",
  revision: 2,
  products: [{ id: "tour-shirt", revision: 3, title: "Signal tour shirt", description: "Black cotton tour shirt.\n\nPrinted by hand for the winter tour.", imageUrl: `${baseUrl}/assets/danzstak-share-fb-v2.jpg`, images: [`${baseUrl}/assets/danzstak-share-fb-v2.jpg`, `${baseUrl}/assets/favicon-512.png`], itemSpecifics: { medium: "Heavyweight cotton", dimensions: "Size L", condition: "New", yearCreated: 2026, signatureStatus: "Unsigned" }, priceCents: 3000, shippingCents: 600, inventory: 12, status: "published", available: true }]
};
const bazaar = {
  listings: [
    { id: "tour-shirt", memberId: "11111111-1111-4111-8111-111111111111", shopName: "Night Circuit Shop", title: "Signal tour shirt", description: "Black cotton tour shirt.", imageUrl: `${baseUrl}/assets/danzstak-share-fb-v2.jpg`, images: [`${baseUrl}/assets/danzstak-share-fb-v2.jpg`], itemSpecifics: { medium: "Cotton", dimensions: "Size L", condition: "New", yearCreated: 2026, signatureStatus: "Unsigned" }, priceCents: 3000, shippingCents: 600, available: true },
    { id: "screen-print", memberId: "22222222-2222-4222-8222-222222222222", shopName: "Basement Prints", title: "Hand-pulled show poster", description: "Numbered screen print from the winter tour.", imageUrl: `${baseUrl}/assets/danzstak-share-fb-v2.jpg`, images: [`${baseUrl}/assets/danzstak-share-fb-v2.jpg`], itemSpecifics: { medium: "Screen print", dimensions: "18 × 24 in", condition: "Mint", yearCreated: 2026, signatureStatus: "Signed and numbered" }, priceCents: 1800, shippingCents: 400, available: true }
  ],
  nextCursor: ""
};
const publishedEvent = {
  id: eventId,
  title: "Night Circuit at The Room",
  description: "An all-ages live electronic set with local support.",
  venueName: "The Room",
  venueAddress: "1 Main Street, Seattle, WA",
  startsAt: "2027-01-06T04:00:00.000Z",
  endsAt: "2027-01-06T07:00:00.000Z",
  timezone: "America/Los_Angeles",
  status: "published",
  ticketSalesEnabled: true,
  tiers: [{ id: "general", name: "General admission", description: "Standing room admission.", priceCents: 1500, available: 80, status: "on_sale" }]
};

function payload(pathname) {
  if (pathname === "/marketplace/store") return { shop: officialStore };
  if (pathname === "/marketplace/bazaar") return bazaar;
  if (pathname === "/marketplace/shop") return { shop: memberShop };
  if (pathname.startsWith("/marketplace/shop/")) return { shop: memberShop };
  if (pathname === `/marketplace/events/${eventId}`) return { event: publishedEvent };
  return {};
}

async function inspect(page, width, label) {
  const result = await page.evaluate(() => {
    const visible = element => {
      const rect = element.getBoundingClientRect();
      return !element.hidden && getComputedStyle(element).display !== "none" && getComputedStyle(element).visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const targets = [...document.querySelectorAll("a,button,input,textarea,select")].filter(visible).map(element => {
      const rect = element.getBoundingClientRect();
      return { label: element.getAttribute("aria-label") || element.textContent?.trim() || element.id || element.tagName, width: rect.width, height: rect.height, left: rect.left, right: rect.right };
    });
    const media = [...document.querySelectorAll(".product-image")].filter(visible).map(element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width, naturalWidth: element.naturalWidth, complete: element.complete, objectFit: getComputedStyle(element).objectFit };
    });
    const allProductImagesLoaded = [...document.querySelectorAll(".product-image,.product-thumbnails img")].filter(visible).every(image => image.complete && image.naturalWidth > 0);
    return { overflow: document.documentElement.scrollWidth > innerWidth, targets, media, allProductImagesLoaded };
  });
  assert.equal(result.overflow, false, `${width}px ${label} overflows horizontally`);
  assert.ok(result.targets.every(target => target.left >= -1 && target.right <= width + 1), `${width}px ${label} has a clipped control: ${JSON.stringify(result.targets)}`);
  assert.ok(result.targets.every(target => target.height >= 44), `${width}px ${label} has a control below 44px: ${JSON.stringify(result.targets)}`);
  assert.ok(result.media.every(media => media.complete && media.naturalWidth > 0), `${width}px ${label} has unloaded product media: ${JSON.stringify(result.media)}`);
  assert.equal(result.allProductImagesLoaded, true, `${width}px ${label} has an unloaded gallery thumbnail`);
  assert.ok(result.media.every(media => media.objectFit === "contain"), `${width}px ${label} product media must preserve the complete item with object-fit contain: ${JSON.stringify(result.media)}`);
  if (width <= 430 && label !== "bazaar" && result.media.length) assert.ok(result.media.every(media => media.left <= 1 && media.right >= width - 1), `${width}px ${label} media must align edge-to-edge: ${JSON.stringify(result.media)}`);
  if (width <= 430 && label === "bazaar" && result.media.length) assert.ok(result.media.every(media => media.width >= 100 && media.width <= width / 2), `${width}px Bazaar media must form a compact two-column marketplace grid with 12px card padding: ${JSON.stringify(result.media)}`);
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    if (captureDir) fs.mkdirSync(captureDir, { recursive: true });
    for (const width of widths) {
      for (const screen of [
        { label: "official-store", url: "store.html", ready: "DanzStak tour shirt" },
        { label: "bazaar", url: "store.html?view=bazaar", ready: "Signal tour shirt" },
        { label: "member-shop", url: "store.html?member=11111111-1111-4111-8111-111111111111", ready: "Signal tour shirt" },
        { label: "member-product", url: "store.html?member=11111111-1111-4111-8111-111111111111&product=tour-shirt", ready: "Item specifics" },
        { label: "shop-manager", url: "store.html?manage=1", ready: "Open or edit your shop" },
        { label: "published-event", url: `event.html?id=${eventId}`, ready: "General admission" }
      ]) {
        const context = await browser.newContext({ viewport: { width, height: width === 1366 ? 900 : 844 }, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/**", route => {
          const pathname = new URL(route.request().url()).pathname;
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(payload(pathname)) });
        });
        await page.goto(`${baseUrl}/${screen.url}`, { waitUntil: "domcontentloaded" });
        await page.getByText(screen.ready, { exact: true }).first().waitFor({ state: "visible" });
        if (screen.label === "bazaar") {
          assert.equal(await page.locator(".bazaar-card").count(), 2, `${width}px Bazaar must show the mixed member-shop catalog`);
          const firstItemHref = await page.locator(".bazaar-card h2 a").first().getAttribute("href");
          assert.match(firstItemHref || "", /^store\.html\?member=.+&product=.+$/, `${width}px Bazaar item must deep-link to the original member shop and product`);
          await page.locator("#bazaarSearch").fill("Basement Prints");
          assert.equal(await page.locator(".bazaar-card").count(), 1, `${width}px Bazaar search must filter by seller shop name`);
          await page.locator("#clearBazaarSearch").click();
          assert.equal(await page.locator(".bazaar-card").count(), 2, `${width}px Bazaar clear must restore the mixed catalog`);
        }
        if (screen.label === "member-product") {
          assert.equal(await page.locator(".product-detail").count(), 1, `${width}px product deep-link must open the detail view`);
          assert.equal(await page.locator(".product-thumbnails button").count(), 2, `${width}px product detail must expose every product image`);
          assert.equal(await page.locator(".product-description p").count(), 2, `${width}px product description must preserve paragraph breaks`);
          assert.equal(await page.locator(".item-specifics dd").count(), 5, `${width}px product detail must show complete item specifics`);
        }
        if (screen.label !== "published-event") await page.waitForFunction(() => [...document.querySelectorAll(".product-image")].every(image => image.complete && image.naturalWidth > 0));
        await page.waitForTimeout(100);
        assert.equal(errors.length, 0, `${width}px ${screen.label} page errors: ${errors.join(" | ")}`);
        await inspect(page, width, screen.label);
        if (captureDir && [390, 1366].includes(width)) await page.screenshot({ path: path.join(captureDir, `${screen.label}-${width}.png`), fullPage: true, animations: "disabled", caret: "hide" });
        await context.close();
      }
    }
    console.log(`Marketplace and ticketing browser checks passed at ${widths.join(", ")}px with responsive catalogs, shop management and public event details.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
