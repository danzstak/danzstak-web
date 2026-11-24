"use strict";
// Task 20: "Verify your act" in the EPK builder (Publish disabled with a reason until verified), the verified mark
// and "Report impersonation" on the public EPK. Runs against a local static server with the API mocked.
//   python3 -m http.server 8132   (repo root), then: node browser-checks/epk-artist-verification.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = (process.env.DANZSTAK_WIDTHS || "320,360,375,390,414,430,768,1024").split(",").map(Number);
const output = path.resolve("docs/screenshots/epk-artist-verification");
fs.mkdirSync(output, { recursive: true });
const kit = { artistName: "Road Test", hometown: "Tacoma, WA", actType: "band", genres: ["Punk"], shortBio: "Road Test plays fast and loud.", musicLinks: [{ label: "Bandcamp", url: "https://example.com/music" }], videoLinks: [], socialLinks: [], lineup: [], releases: [], notableShows: [], achievements: [], pressQuotes: [], media: [], production: { plotItems: [], inputs: [] }, publicDetails: {} };
const notVerified = { actName: "Road Test", status: "not_verified", method: "", verifiedAt: "", expiresAt: "", code: "", codeExpiresAt: "", lastCheckResult: "", reviewReason: "", note: "", protectedName: false };

// Tap the centre of the control, the way a finger does, after checking nothing covers it there.
async function tap(page, locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  assert.ok(box && box.height >= 44, `touch target is ${box?.height}px tall`);
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  const hit = await locator.evaluate((element, point) => { const at = document.elementFromPoint(point.x, point.y); return Boolean(at && (at === element || element.contains(at))); }, { x, y });
  assert.ok(hit, "nothing covers the centre of the control");
  await page.mouse.click(x, y);
}

(async () => {
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL || "msedge";
  const browser = await chromium.launch(channel === "bundled" ? { headless: true } : { channel, headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, serviceWorkers: "block", reducedMotion: "reduce", deviceScaleFactor: 1 });
      const page = await context.newPage(), errors = [], calls = [];
      let verification = { ...notVerified };
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", async route => {
        const request = route.request(), url = new URL(request.url()), method = request.method();
        calls.push(`${method} ${url.pathname}`);
        let body = {}, status = 200;
        if (url.pathname === "/auth/session") body = { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111" } };
        else if (url.pathname === "/epk") body = { kit, publicId: "road-test", published: false, privateShared: false };
        else if (url.pathname === "/epk/verify") body = { verification, hold: false, editor: false };
        else if (url.pathname === "/epk/verify/code") { verification = { ...verification, code: "DZ-7K4Q9M", codeExpiresAt: new Date(Date.now() + 86400000).toISOString() }; body = { verification }; }
        else if (url.pathname === "/epk/verify/check") {
          assert.deepEqual(request.postDataJSON(), { actName: "Road Test", method: "page", url: "https://roadtest.bandcamp.com" });
          verification = { ...verification, status: "verified", method: "page", code: "", verifiedAt: "2026-11-18T18:00:00.000Z", expiresAt: "2027-11-18T18:00:00.000Z" };
          body = { verification, message: "Verified. You can remove the code from that page now." };
        } else if (url.pathname === "/epk/public/road-test") body = { kit, verified: { at: "2026-11-18T18:00:00.000Z", method: "page" }, publicId: "road-test" };
        else if (url.pathname === "/epk/verify/report") { assert.deepEqual(request.postDataJSON(), { publicId: "road-test" }); body = { reported: true, message: "Thanks. A DanzStak editor will look at this EPK." }; }
        else if (url.pathname === "/profiles") body = { profile: { name: kit.artistName } };
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      });

      // Builder, not verified: the step shows, Publish is disabled with a one-line reason, drafts still save.
      await page.goto(`${origin}/epk.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.getElementById("artistName")?.value === "Road Test");
      const step = page.locator("#epkVerify");
      await step.waitFor();
      await page.locator("#epkVerifyChip", { hasText: "Not verified" }).waitFor();
      assert.equal(await page.locator("#publishEpk").isDisabled(), true, `${width}px: Publish disabled before verification`);
      assert.match(await page.locator("#epkPublishReason").innerText(), /Verify your act to publish/);
      assert.equal(await page.locator("#saveDraft").isDisabled(), false, "private drafts always save");
      await step.scrollIntoViewIfNeeded();
      await tap(page, page.locator("#epkVerifyGetCode"));
      await page.locator("#epkVerifyCode", { hasText: "DZ-7K4Q9M" }).waitFor();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      assert.ok(overflow <= 0, `${width}px: no horizontal overflow (${overflow})`);
      for (const target of await page.locator("#epkVerify button:visible, #epkVerify .epk-verify__way:visible").all()) {
        const box = await target.boundingBox();
        assert.ok(box.height >= 44, `${width}px: touch target ${await target.innerText()} is ${box.height}px tall`);
      }
      await step.screenshot({ path: path.join(output, `builder-code-${width}.png`) });

      await page.locator("#epkVerify input[type=url]").first().fill("https://roadtest.bandcamp.com");
      await tap(page, page.getByRole("button", { name: "Check page" }));
      await page.locator("#epkVerifyChip", { hasText: "Verified" }).waitFor();
      assert.equal(await page.locator("#publishEpk").isDisabled(), false, `${width}px: Publish enabled once verified`);
      assert.equal(await page.locator("#epkPublishReason").isHidden(), true);
      await step.screenshot({ path: path.join(output, `builder-verified-${width}.png`) });

      // Public EPK: verified mark and Report impersonation.
      await page.goto(`${origin}/epk.html?id=road-test`, { waitUntil: "domcontentloaded" });
      await page.locator(".epk-verified-mark", { hasText: "Verified artist on DanzStak" }).waitFor();
      const report = page.getByRole("button", { name: "Report impersonation" });
      await report.waitFor();
      assert.ok((await report.boundingBox()).height >= 44);
      await page.screenshot({ path: path.join(output, `public-${width}.png`), fullPage: false });
      await tap(page, report);
      await tap(page, page.getByRole("button", { name: "Report", exact: true }));
      await page.locator("#epkReportStatus", { hasText: "A DanzStak editor will look at this EPK" }).waitFor();
      assert.deepEqual(errors, [], `${width}px: no page errors`);
      assert.ok(calls.includes("POST /epk/verify/report"));
      await context.close();
      console.log(`ok ${width}px`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
