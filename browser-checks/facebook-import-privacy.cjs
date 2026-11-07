"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = String(process.env.DANZSTAK_IMPORT_ORIGIN || "http://127.0.0.1:8023").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/issue-13-import-privacy");
const widths = [320, 360, 390, 414, 430, 1366];
fs.mkdirSync(output, { recursive: true });

const importedItems = [
  { identity: "one", originalCreatedAt: "2020-01-15T12:00:00.000Z", content: "Winter rehearsal", mediaPath: "", missingMedia: false },
  { identity: "two", originalCreatedAt: "2021-06-10T12:00:00.000Z", content: "Summer release", mediaPath: "", missingMedia: false },
  { identity: "three", originalCreatedAt: "2021-12-31T12:00:00.000Z", content: "New Year show", mediaPath: "", missingMedia: false },
  { identity: "four", originalCreatedAt: "2022-02-01T12:00:00.000Z", content: "Next tour", mediaPath: "", missingMedia: false }
];

function apiPayload(url) {
  const route = url.pathname;
  if (route === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "artist@danzstak.invalid" } };
  if (route === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Import Test Artist", handle: "import-test", isOwner: true, cloudProfile: true } };
  if (["/profile-posts", "/secure-posts"].includes(route)) return { posts: [] };
  if (["/friends", "/profile-friends"].includes(route)) return { friends: [], incoming: [], outgoing: [] };
  if (route === "/profile-video") return { video: null };
  if (route === "/activity") return { items: [] };
  return {};
}

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", reducedMotion: "reduce" });
      await context.addInitScript(items => {
        class ImportWorker {
          constructor() { this.onmessage = null; this.onerror = null; }
          postMessage() {
            queueMicrotask(() => this.onmessage?.({ data: { ok: true, result: { items, profile: {}, media: [], warnings: { unsupported: 0 } } } }));
          }
          terminate() {}
        }
        window.Worker = ImportWorker;
      }, importedItems);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(apiPayload(new URL(route.request().url()))) }));
      await page.goto(`${origin}/profile.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => typeof window.openDanzStakFacebookImport === "function");
      await page.evaluate(() => window.openDanzStakFacebookImport(document.activeElement));
      await page.locator(".facebook-import-dialog input[type=file]").setInputFiles({ name: "facebook-export.json", mimeType: "application/json", buffer: Buffer.from("{}") });
      await page.locator(".facebook-import-preview").waitFor({ state: "visible" });

      const initial = await page.evaluate(() => {
        const dialog = document.querySelector(".facebook-import-dialog"), right = dialog.getBoundingClientRect().right;
        return {
          audience: document.querySelector("[data-audience]").value,
          selected: document.querySelectorAll(".facebook-import-choice input:checked").length,
          overflow: dialog.scrollWidth > dialog.clientWidth,
          clientWidth: dialog.clientWidth,
          scrollWidth: dialog.scrollWidth,
          offenders: [...dialog.querySelectorAll("*")].filter(node => node.getBoundingClientRect().right > right + 1).map(node => `${node.tagName}.${node.className || ""}`).slice(0, 8)
        };
      });
      assert.equal(initial.audience, "private", `${width}px import must begin as Just me`);
      assert.equal(initial.selected, 0, `${width}px import must not preselect posts`);
      assert.equal(initial.overflow, false, `${width}px import dialog overflows horizontally: ${JSON.stringify(initial)}`);
      await page.screenshot({ path: path.join(output, `facebook-import-default-${width}.png`) });

      await page.locator("[data-date-from]").fill("2021-01-01");
      await page.locator("[data-date-to]").fill("2021-12-31");
      await page.locator("[data-select-range]").click();
      const selectedAfterRange = await page.evaluate(() => [...document.querySelectorAll(".facebook-import-item input[type=checkbox]")].map(input => ({ checked: input.checked, parent: input.parentElement?.className || "" })));
      assert.equal(selectedAfterRange.filter(input => input.checked && input.parent.includes("facebook-import-choice")).length, 2, `${width}px inclusive date selection is incorrect: ${JSON.stringify(selectedAfterRange)}`);
      await page.locator("[data-audience]").selectOption("friends");
      assert.equal(await page.locator("[data-audience]").inputValue(), "friends", `${width}px explicit wider audience choice did not persist`);
      const targets = await page.locator(".facebook-import-date-range input,.facebook-import-date-range button").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
      assert.ok(targets.every(height => height >= 44), `${width}px date controls must remain touch sized: ${targets.join(",")}`);
      const header = await page.locator(".facebook-import-dialog>header").evaluate(node => ({ position: getComputedStyle(node).position, background: getComputedStyle(node).backgroundColor }));
      assert.equal(header.position, "sticky", `${width}px import close control must remain reachable while reviewing a long export`);
      assert.notEqual(header.background, "rgba(0, 0, 0, 0)", `${width}px sticky import header must not let scrolled controls show through`);
      assert.equal(await page.locator("[data-next]").isHidden(), true, `${width}px next actions must wait until Moving Day succeeds`);
      await page.locator("[data-cert]").check();
      await page.locator("[data-import]").click();
      await page.locator("[data-next]").waitFor({ state: "visible" });
      assert.match(await page.locator("[data-next]").textContent(), /finish your profile, build an EPK, invite your people, or join the conversation in Mix/i);
      const nextTargets = await page.locator("[data-next] a").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
      assert.ok(nextTargets.length === 4 && nextTargets.every(height => height >= 44), `${width}px Moving Day next actions must be touch sized: ${nextTargets.join(",")}`);
      assert.equal(errors.length, 0, `${width}px import browser errors: ${errors.join(" | ")}`);
      await page.screenshot({ path: path.join(output, `facebook-import-${width}.png`), fullPage: false });
      await context.close();
    }
    console.log("Moving Day browser checks passed at 320, 360, 390, 414, 430 and 1366px: private default, no preselection, inclusive date range, explicit audience choice, touch targets, participation handoff and zero overflow.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
