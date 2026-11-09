"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const widths = [320, 360, 390, 414, 430, 1366];
const baseUrl = (process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8021").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/stakguard-phase-a");
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel:"msedge", headless:true });
  try {
    for (const width of widths) {
      const page = await browser.newPage({ viewport:{ width, height:width < 700 ? 844 : 900 }, serviceWorkers:"block" });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${baseUrl}/stakguard.html`, { waitUntil:"domcontentloaded" });
      await page.locator(".findings-empty").waitFor();
      const state = await page.evaluate(() => ({
        overflow:document.documentElement.scrollWidth > innerWidth,
        findingCount:document.querySelectorAll(".finding").length,
        registryCount:document.querySelectorAll("#sourceRegistry li").length,
        disabled:document.getElementById("monitorUnavailable").disabled,
        minimumTargets:[...document.querySelectorAll("button,a:not(.skip-link),select,textarea")].map(node => ({ label:node.textContent.trim() || node.getAttribute("aria-label"), height:node.getBoundingClientRect().height })).filter(target => target.height),
        sectionNavFits:document.querySelector(".section-jump").scrollWidth <= document.querySelector(".section-jump").clientWidth + 1,
        safeExternalLinks:[...document.querySelectorAll('a[target="_blank"]')].every(link => link.relList.contains("noopener") && link.relList.contains("noreferrer")),
        prepareCount:document.querySelectorAll(".source-actions button").length,
        notice:document.querySelector(".prototype-notice").innerText,
        total:document.getElementById("monitorTotal").textContent
      }));
      assert.deepEqual(errors, [], `${width}px page errors: ${errors.join(" | ")}`);
      assert.equal(state.overflow, false, `${width}px page overflows horizontally`);
      assert.equal(state.findingCount, 0);
      assert.equal(state.registryCount, 5);
      assert.equal(state.disabled, true);
      assert.match(state.notice, /No scan provider connected/i);
      assert.equal(state.total, "$4");
      assert.equal(state.sectionNavFits, true, `${width}px section navigation hides actions without an affordance`);
      assert.equal(state.safeExternalLinks, true, `${width}px has an unsafe external link`);
      assert.equal(state.prepareCount, 1, `${width}px must expose only the verified PeopleConnect member handoff`);
      assert.ok(state.minimumTargets.every(target => target.height >= 44), `${width}px has a touch target below 44px: ${JSON.stringify(state.minimumTargets)}`);
      for (const target of ["#overview", "#findings", "#removalTools", "#monitoring"]) {
        await page.locator(`.section-jump a[href="${target}"]`).click();
        assert.equal(new URL(page.url()).hash, target, `${width}px ${target} section control did not work`);
      }
      await page.selectOption("#monitorMonths", "5");
      await page.waitForFunction(() => document.getElementById("monitorTotal").textContent === "$20");
      assert.match(await page.locator(".findings-empty").innerText(), /No broker findings yet/);
      await page.locator(".source-actions button").click();
      await page.locator("#removalDialog[open]").waitFor();
      const request = await page.evaluate(() => ({
        draft:document.getElementById("removalDraft").value,
        email:document.getElementById("emailRemovalDraft").getAttribute("href"),
        form:document.getElementById("officialRemovalForm").href,
        warning:document.querySelector(".dialog-warning").textContent,
        note:document.querySelector(".dialog-note").textContent
      }));
      assert.match(request.draft, /\[YOUR FULL NAME\]/);
      assert.match(request.draft, /\[YOUR EMAIL\]/);
      assert.match(request.email, /^mailto:privacy@peopleconnect\.us\?/);
      assert.equal(request.form, "https://suppression.peopleconnect.us/privacy-center");
      assert.match(request.warning, /does not receive, store, or send/i);
      assert.match(request.note, /does not mean the request was sent/i);
      if (width === 390 || width === 1366) await page.screenshot({ path:path.join(output, `stakguard-request-${width}.png`) });
      await page.locator('[aria-label="Close request"]').click();
      await page.locator("#removalDialog").waitFor({ state:"hidden" });
      await page.evaluate(() => { history.replaceState(null, "", location.pathname); scrollTo(0, 0); });
      await page.waitForTimeout(50);
      await page.screenshot({ path:path.join(output, `stakguard-${width}.png`) });
      await page.close();
    }
    console.log(`StakGuard browser checks passed at ${widths.join(", ")}px.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
