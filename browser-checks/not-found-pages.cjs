"use strict";
// Audit 36 D2/D3: a link to an event or product that doesn't exist says "not found" and offers the way back. Before:
// the event page's title stayed "Loading event…" and the product page showed "This product link is not valid" with
// nowhere to go. Checks at 320/360/390/430px, for a malformed link and for one the server doesn't know (404): the
// heading says not found, the message stays, there is one 44px "Back to …" link, tapping its centre goes back to the
// Bazaar / Events, and nothing scrolls sideways.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/not-found-pages");
const unknown = "99999999-9999-4999-8999-999999999999";
const CASES = [
  { page: "product.html?id=not-a-product", title: "Product not found", message: "This product link is not valid.", back: "Back to the Bazaar", to: "bazaar.html" },
  { page: `product.html?id=${unknown}`, title: "Product not found", message: "Product not found.", back: "Back to the Bazaar", to: "bazaar.html" },
  { page: "event.html?id=not-an-event", title: "Event not found", message: "This event link is invalid.", back: "Back to Events", to: "feed.html?view=events" },
  { page: `event.html?id=${unknown}`, title: "Event not found", message: "Event not found.", back: "Back to Events", to: "feed.html?view=events" }
];

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of [320, 360, 390, 430]) {
      for (const item of CASES) {
        const label = `${width}px ${item.page}`;
        const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
        const page = await context.newPage(), errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/**", route => {
          const url = new URL(route.request().url());
          const headers = { "access-control-allow-origin": base, "access-control-allow-credentials": "true" };
          if (url.pathname === "/auth/session") return route.fulfill({ status: 200, contentType: "application/json", headers, body: JSON.stringify({ authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111" } }) });
          if (url.pathname.includes(unknown)) return route.fulfill({ status: 404, contentType: "application/json", headers, body: JSON.stringify({ error: item.page.startsWith("product") ? "Product not found." : "Event not found." }) });
          return route.fulfill({ status: 200, contentType: "application/json", headers, body: "{}" });
        });
        await page.goto(`${base}/${item.page}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("a.page-missing-back", { timeout: 8000 });
        const state = await page.evaluate(() => {
          const shown = element => element && element.getClientRects().length && getComputedStyle(element).visibility !== "hidden" && !element.closest("[hidden]");
          const headings = [...document.querySelectorAll("main h1")].filter(shown).map(node => node.textContent.trim());
          const links = [...document.querySelectorAll("a.page-missing-back")].filter(shown);
          const box = links[0]?.getBoundingClientRect();
          return { headings, status: document.querySelector('main [role="status"]')?.textContent.trim(), links: links.map(link => [link.textContent.trim(), link.getAttribute("href")]), height: box ? Math.round(box.height) : 0, overflow: document.documentElement.scrollWidth > innerWidth };
        });
        assert.deepEqual(state.headings, [item.title], `${label}: the heading says ${item.title}`);
        assert.equal(state.status, item.message, `${label}: the message stays`);
        assert.deepEqual(state.links, [[item.back, item.to]], `${label}: one way back`);
        assert.ok(state.height >= 44, `${label}: the way back is a 44px target (${state.height})`);
        assert.equal(state.overflow, false, `${label}: no sideways scroll`);
        if (width === 390 && item.page.includes("not-a")) await page.screenshot({ path: path.join(output, `${item.page.split(".")[0]}-390.png`) });
        const box = await page.locator("a.page-missing-back").boundingBox();
        await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForURL(url => `${url.pathname.split("/").pop()}${url.search}` === item.to, { timeout: 8000 });
        assert.deepEqual(errors, [], `${label}: page errors ${errors.join(" | ")}`);
        await context.close();
      }
    }
    console.log("Not-found checks passed at 320, 360, 390, 430px: a malformed or unknown product or event link says not found, keeps the message, and its one 44px link goes back to the Bazaar or Events.");
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
