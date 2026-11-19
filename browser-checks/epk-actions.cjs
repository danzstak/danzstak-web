"use strict";
// Audit 36 D6: the EPK builder showed "Unpublish" before anything was published, and its delete button was a raw "🗑️"
// emoji: the variation selector after the emoji kept icon-buttons.js from recognising it as a symbol, so it never
// became the trash icon (the same for every "🗑️" button without a data-icon). Checks at 320/360/390/430px:
// - a draft EPK: no Unpublish; a published EPK: Unpublish shows;
// - Delete EPK is the trash icon (an SVG, no emoji text) with its accessible name and a 44px target, and tapping its
//   centre asks to confirm.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";

async function open(browser, width, published) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url());
    const body = url.pathname === "/auth/session" ? { authenticated: true, user: { sub: me } }
      : url.pathname === "/epk" ? { kit: { artistName: "Night Shift", genre: "techno" }, published, publicId: published ? "night-shift" : "" }
      : url.pathname === "/profiles" ? { profile: { memberId: me, name: "Night Shift", username: "nightshift", handle: "nightshift", isOwner: true, cloudProfile: true } } : {};
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(body) });
  });
  await page.goto(`${base}/epk.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.getElementById("artistName")?.value === "Night Shift", null, { timeout: 8000 });
  await page.waitForTimeout(300);
  return { context, page, errors };
}

const actions = page => page.evaluate(() => {
  const shown = element => Boolean(element && !element.hidden && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
  const remove = document.getElementById("deleteEpk"), box = remove.getBoundingClientRect();
  return {
    unpublish: shown(document.getElementById("unpublishEpk")),
    remove: { svg: Boolean(remove.querySelector("svg")), text: remove.textContent.trim(), name: remove.getAttribute("aria-label"), size: [Math.round(box.width), Math.round(box.height)] }
  };
});

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      let { context, page, errors } = await open(browser, width, false);
      let state = await actions(page);
      assert.equal(state.unpublish, false, `${width}px draft EPK: no Unpublish before anything is published`);
      assert.deepEqual([state.remove.svg, state.remove.text, state.remove.name], [true, "", "Delete EPK"], `${width}px: Delete EPK is the trash icon, not an emoji ${JSON.stringify(state.remove)}`);
      assert.ok(state.remove.size.every(side => side >= 44), `${width}px: Delete EPK is a 44px target ${JSON.stringify(state.remove.size)}`);
      const target = page.locator("#deleteEpk svg");
      await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForSelector(".danzstak-confirm-dialog[open]", { timeout: 3000 });
      assert.deepEqual(errors, [], `${width}px draft: page errors ${errors.join(" | ")}`);
      await context.close();

      ({ context, page, errors } = await open(browser, width, true));
      state = await actions(page);
      assert.equal(state.unpublish, true, `${width}px published EPK: Unpublish shows`);
      assert.deepEqual(errors, [], `${width}px published: page errors ${errors.join(" | ")}`);
      await context.close();
    }
    console.log("EPK action checks passed at 320, 360, 390, 430px: Unpublish only once the EPK is published; Delete EPK is the 44px trash icon, and tapping it asks to confirm.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
