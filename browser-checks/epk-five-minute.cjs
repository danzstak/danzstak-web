"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_EPK_ORIGIN || "http://127.0.0.1:8027";
const widths = [320, 360, 390, 414, 430, 1366];
const output = path.resolve("docs/screenshots/epk-five-minute");
fs.mkdirSync(output, { recursive:true });

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport:{ width, height:width < 700 ? 844 : 900 }, serviceWorkers:"block", reducedMotion:"reduce" });
      const page = await context.newPage();
      const errors = [];
      let existing = false;
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status:200, contentType:"application/json", body:JSON.stringify({ kit:existing ? { artistName:"Saved Act", shortPitch:"Saved private EPK" } : null, published:false, privateShared:false }) }));
      await page.goto(`${origin}/epk.html`, { waitUntil:"domcontentloaded" });
      await page.waitForFunction(() => document.body.classList.contains("epk-guided"), null, { timeout:10000 }).catch(async error => {
        throw new Error(`${width}px guide did not initialize [${await page.locator("body").getAttribute("class")}]: ${errors.join(" | ") || await page.locator("#epkStatus").textContent()} (${error.message})`);
      });
      await page.locator("#epkStatus").filter({ hasText:"Start with the act name" }).waitFor();

      const initial = await page.evaluate(() => {
        const visibleSteps = [...document.querySelectorAll("[data-epk-step]")].filter(node => getComputedStyle(node).display !== "none");
        const preview = document.querySelector("#epkPreview");
        const toggle = document.querySelector("#toggleMobilePreview");
        return {
          documentWidth:document.documentElement.scrollWidth,
          visibleSteps:visibleSteps.map(node => node.dataset.epkStep),
          previewVisible:getComputedStyle(preview).display !== "none",
          toggleVisible:getComputedStyle(toggle).display !== "none",
          touchTargets:[...document.querySelectorAll("#epkGuide button")].filter(node => getComputedStyle(node).display !== "none").map(node => node.getBoundingClientRect().height)
        };
      });
      assert.equal(errors.length, 0, `${width}px initial EPK errors: ${errors.join(" | ")}`);
      assert.ok(initial.documentWidth <= width, `${width}px EPK overflow: ${JSON.stringify(initial)}`);
      assert.deepEqual(initial.visibleSteps, ["1"], `${width}px should show only the first guided step`);
      assert.ok(initial.touchTargets.every(height => height >= 44), `${width}px guide controls need 44px targets: ${JSON.stringify(initial.touchTargets)}`);
      assert.equal(initial.previewVisible, width >= 700, `${width}px preview visibility should be intentional`);
      assert.equal(initial.toggleVisible, width < 700, `${width}px phone preview control visibility is wrong`);

      await page.locator("#artistName").fill("Road Test");
      await page.locator("#shortPitch").fill("A direct live set built for independent rooms.");
      await page.locator("#guideNext").click();
      assert.equal(await page.locator('[data-epk-step="2"]').evaluate(node => getComputedStyle(node).display !== "none"), true);
      await page.locator("#shortBio").fill("Road Test is an independent live act booking a first regional run.");
      await page.locator("#guideNext").click();
      await page.locator("#musicLinks").fill("Bandcamp | https://example.bandcamp.com/album/road-test");
      const progress = await page.locator("#epkGuideProgress").getAttribute("value");
      assert.equal(progress, "3", `${width}px guide should count actual completed essentials`);

      if (width < 700) {
        await page.locator("#toggleMobilePreview").click();
        const phonePreview = await page.evaluate(() => ({
          preview:getComputedStyle(document.querySelector("#epkPreview")).display,
          form:getComputedStyle(document.querySelector("#epkForm")).display,
          title:document.querySelector("#epkPreview h1")?.textContent,
          pitch:document.querySelector("#epkPreview .lead")?.textContent
        }));
        assert.equal(phonePreview.preview, "block");
        assert.equal(phonePreview.form, "none");
        assert.equal(phonePreview.title, "Road Test");
        assert.equal(phonePreview.pitch, "A direct live set built for independent rooms.");
        if (width === 390) await page.screenshot({ path:path.join(output, "epk-preview-390.png"), fullPage:false });
        await page.locator("#toggleMobilePreview").click();
      }

      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path:path.join(output, `epk-builder-${width}.png`), fullPage:false });
      existing = true;
      await page.reload({ waitUntil:"domcontentloaded" });
      await page.locator("#epkStatus").filter({ hasText:"Private draft loaded" }).waitFor();
      assert.equal(await page.locator("body").evaluate(node => node.classList.contains("epk-guided")), false, `${width}px saved EPK should open the complete editor`);
      assert.equal(await page.locator('[data-epk-step="2"]').evaluate(node => getComputedStyle(node).display !== "none"), true, `${width}px advanced saved fields should remain available`);
      await context.close();
    }
    console.log(`Five-minute EPK browser checks passed at ${widths.join(", ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
