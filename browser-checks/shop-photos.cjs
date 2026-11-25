"use strict";
// Owner 2026-11-19: "in shops there needs to be an option to upload an image as shop cover image, not just http://",
// "a shop album for users to put their photos in", "when a user creates a shop they get a shop album".
// The shop manager uploads a cover, album photos and a product photo from the phone (file pickers, not links).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/shop-photos.cjs
const { chromium } = require("playwright");
const path = require("node:path"), fs = require("node:fs"), os = require("node:os");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const file = path.join(os.tmpdir(), "danzstak-shop-photo.png"); fs.writeFileSync(file, png);
const pic = "data:image/png;base64," + png.toString("base64");
(async () => {
  const browser = await chromium.launch(process.env.DANZSTAK_BROWSER_CHANNEL === "bundled" ? { headless: true } : { channel: process.env.DANZSTAK_BROWSER_CHANNEL || "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [], saves = [];
      page.on("pageerror", error => errors.push(error.message));
      let n = 0, shop = { name: "Night Shift", description: "", status: "published", coverUrl: "", album: [], products: [] };
      await page.route("https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com/**", route => route.fulfill({ status: 200, body: "" }));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), p = new URL(request.url()).pathname, method = request.method();
        const reply = body => route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
        if (p === "/auth/session") return reply({ authenticated: true, user: { sub: me, email: "a@example.test" } });
        if (p === "/stories" && method === "POST") { n += 1; return reply({ uploadUrl: "https://danzstak-call-signaling-mediabucket-abx9qfpinhje.s3.us-west-1.amazonaws.com/test-upload-" + n, mediaKey: `users/${"a".repeat(24)}/0000000${n}-0000-4000-8000-000000000000.png` }); }
        if (p === "/marketplace/shop" && method === "PUT") {
          const body = JSON.parse(request.postData() || "{}"); saves.push(body);
          if (body.coverKey !== undefined) shop.coverUrl = body.coverKey ? pic : "";
          if (body.albumKeys) shop.album = body.albumKeys.map(key => ({ key, url: pic }));
          return reply({ shop });
        }
        if (p === "/marketplace/shop") return reply({ shop });
        if (p === "/marketplace/payouts") return reply({});
        return reply({});
      });
      await page.goto(`${base}/store.html?manage=1`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
      // Cover from the phone.
      let chooser = page.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null);
      await page.locator("#chooseShopCover").click();
      let picked = await chooser;
      if (!picked) failures.push(`${width}px: "Choose cover photo" opened no photo picker`);
      else {
        await picked.setFiles(file);
        // F21: the shop front opens Move to fit, then offers itself to the profile (Keep shop only here).
        await page.locator(".ds-fit-save").click({ timeout: 5000 }).catch(() => failures.push(`${width}px: Move to fit did not open for the shop front`));
        await page.locator("#shopFrontKeep").click({ timeout: 5000 }).catch(() => failures.push(`${width}px: the "use it on your profile?" sheet did not open`));
        await page.waitForTimeout(500);
      }
      if (!saves.some(s => s.coverKey)) failures.push(`${width}px: the cover photo was not saved to the shop`);
      if (await page.locator("#shopCoverPreview").isHidden()) failures.push(`${width}px: the cover preview did not show`);
      // Album: several photos at once.
      chooser = page.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null);
      await page.locator("#addAlbumPhotos").click();
      picked = await chooser;
      if (!picked) failures.push(`${width}px: "+ Add photos" opened no photo picker`);
      else { if (!picked.isMultiple()) failures.push(`${width}px: the album picker takes one photo at a time`); await picked.setFiles([file, file]); await page.waitForTimeout(1000); }
      if ((await page.locator("#shopAlbumEditor img").count()) !== 2) failures.push(`${width}px: album shows ${await page.locator("#shopAlbumEditor img").count()} photos, expected 2`);
      // Product photo from the phone (not only an https link).
      chooser = page.waitForEvent("filechooser", { timeout: 4000 }).catch(() => null);
      await page.locator("#addProduct").click(); // the listing form is its own screen (UI kit)
      await page.locator("#chooseProductPhoto").click();
      picked = await chooser;
      if (!picked) failures.push(`${width}px: "Choose photo" for a product opened no photo picker`);
      else { await picked.setFiles(file); await page.waitForTimeout(800); if (!(await page.locator("#productImageKey").inputValue())) failures.push(`${width}px: the product photo key was not kept for saving`); }
      const raw = await page.evaluate(() => /Cannot read propert|undefined|is not a function/.test(document.body.innerText));
      if (raw) failures.push(`${width}px: raw error text on screen`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (overflow) failures.push(`${width}px: the page scrolls sideways`);
      if (errors.length) failures.push(`${width}px: script errors: ${errors.join(" | ")}`);
      await page.screenshot({ path: `docs/screenshots/shop-photos/manager-${width}.png`, fullPage: true }).catch(() => {});
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Shop photo checks passed: cover, album (several at once) and product photo come from the phone, at 360 and 390px.");
})();
