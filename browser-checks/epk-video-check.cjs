"use strict";
// Owner 2026-11-23 (an EPK's Watch section with YouTube's "Video unavailable" in the player): "Before adding to the
// epk need to make sure the video is there and playable. Youtube is kinda tricky for videos with apps."
// Builder: four "Live video links": one that plays, one whose owner turned embedding off (oEmbed 401), one removed
// (oEmbed 404) and one oEmbed says is fine but the real player refuses (error 150). Each gets its line; the removed one
// stays out of the EPK, the two that won't play inside other sites go in as links (no Load player button).
// Venue's view: a player that errors after it's loaded turns into the link, never YouTube's error box.
// YouTube's player is replaced by a stand-in page at the same address that answers like it (onReady / onError).
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 node browser-checks/epk-video-check.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const output = path.resolve("docs/screenshots/epk-video-check");
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const PREVIEW = {
  OKVIDEO0001: { playable: true, title: "The Delta (More Machine Than Human)" },
  EMBEDOFF001: { playable: false, reason: "embed_off", title: "Electronic Everyday" },
  GONEVIDEO01: { playable: false, reason: "unavailable", title: "" },
  BLOCKED0001: { playable: true, title: "Mechanical Fungus" }
};
const LINKS = "The Delta | https://www.youtube.com/watch?v=OKVIDEO0001\nElectronic Everyday | https://youtu.be/EMBEDOFF001\nOld clip | https://www.youtube.com/watch?v=GONEVIDEO01\nMechanical Fungus | https://www.youtube.com/watch?v=BLOCKED0001";
// The stand-in player: says ready, or reports error 150 like a video that won't play on other sites.
const player = id => `<!doctype html><title>player</title><script>addEventListener("message", e => { let d; try { d = JSON.parse(e.data); } catch { return; } if (d.event !== "listening") return; parent.postMessage(JSON.stringify(${id === "BLOCKED0001" ? '{ event: "onError", info: 150 }' : '{ event: "onReady", info: null }'}), "*"); });</script><p>video ${id}</p>`;

async function setup(browser, width, kit) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", hasTouch: true, isMobile: true });
  const page = await context.newPage(); page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  await page.route("https://www.youtube-nocookie.com/embed/**", route => { const id = new URL(route.request().url()).pathname.split("/").pop(); return route.fulfill({ status: 200, contentType: "text/html", body: player(id) }); });
  await page.route("https://api.danzstak.com/**", route => {
    const url = new URL(route.request().url()), p = url.pathname;
    if (p === "/link-preview") { const id = (url.searchParams.get("url").match(/([A-Z0-9]{11})/) || [])[1]; return route.fulfill(json({ preview: { url: url.searchParams.get("url"), video: true, ...PREVIEW[id] } })); }
    if (p.startsWith("/epk/public/")) return route.fulfill(json({ kit, published: true }));
    if (p === "/epk") return route.fulfill(json({ kit: { artistName: "Eroticon" }, published: false }));
    return route.fulfill(json({}));
  });
  return { context, page };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const channel = process.env.DANZSTAK_BROWSER_CHANNEL ?? "msedge";
  const browser = await chromium.launch(channel ? { channel, headless: true } : { headless: true });
  const failures = [];
  try {
    for (const width of [320, 360, 390, 430]) {
      const label = `${width}px`;
      // Builder.
      let { context, page } = await setup(browser, width);
      await page.goto(`${base}/epk.html`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.danzstakEpkVideoCheck && document.getElementById("videoLinkChecks"));
      await page.evaluate(links => { const area = document.getElementById("videoLinks"); area.value = links; area.dispatchEvent(new Event("change", { bubbles: true })); }, LINKS);
      await page.waitForFunction(() => { const rows = [...document.querySelectorAll("#videoLinkChecks li")]; return rows.length === 4 && rows.every(row => row.dataset.state !== "checking"); }, null, { timeout: 25000 }).catch(() => {});
      const rows = await page.evaluate(() => [...document.querySelectorAll("#videoLinkChecks li")].map(row => `${row.querySelector("strong").textContent}=${row.dataset.state}`));
      const want = ["The Delta=ok", "Electronic Everyday=link", "Old clip=gone", "Mechanical Fungus=link"];
      if (JSON.stringify(rows) !== JSON.stringify(want)) failures.push(`${label} builder: ${JSON.stringify(rows)}`);
      const watch = await page.evaluate(() => [...document.querySelectorAll('#epkPreview [data-epk-section="watch"] .epk-media-card')].map(card => `${card.querySelector("h3").textContent}:${card.querySelector(".epk-player-load") ? "player" : "link"}`));
      if (JSON.stringify(watch) !== JSON.stringify(["The Delta:player", "Electronic Everyday:link", "Mechanical Fungus:link"])) failures.push(`${label} builder preview: ${JSON.stringify(watch)}`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push(`${label}: sideways scroll`);
      if (await page.locator(".epk-video-probe").count()) failures.push(`${label}: a test player was left on the page`);
      if (width === 360 || width === 390) { await page.locator("#videoLinkChecks").scrollIntoViewIfNeeded().catch(() => {}); await page.screenshot({ path: path.join(output, `builder-${width}.png`) }); }
      if (page.errors.length) failures.push(`${label} builder errors: ${page.errors.join(" | ")}`);
      await context.close();

      // Venue's view: a saved player that errors once loaded becomes the link.
      ({ context, page } = await setup(browser, width, { artistName: "Eroticon", videoLinks: [{ label: "Mechanical Fungus", url: "https://www.youtube.com/watch?v=BLOCKED0001" }, { label: "Electronic Everyday", url: "https://youtu.be/EMBEDOFF001", embed: false }] }));
      await page.goto(`${base}/epk.html?id=eroticon`, { waitUntil: "domcontentloaded" });
      const load = page.locator('[data-epk-section="watch"] .epk-player-load').first();
      await load.waitFor({ timeout: 10000 });
      if (await page.locator('[data-epk-section="watch"] .epk-player-load').count() !== 1) failures.push(`${label} venue: a link marked embed:false still offers a player`);
      const box = await load.boundingBox();
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(() => document.querySelector('[data-epk-section="watch"] .epk-media-card')?.dataset.embed === "off", null, { timeout: 8000 }).catch(() => {});
      const after = await page.evaluate(() => { const card = document.querySelector('[data-epk-section="watch"] .epk-media-card'); return { off: card.dataset.embed, frame: Boolean(card.querySelector("iframe")), load: Boolean(card.querySelector(".epk-player-load")), link: card.querySelector("a")?.href || "", note: card.querySelector(".epk-player-note")?.textContent || "" }; });
      if (after.off !== "off" || after.frame || after.load || !/BLOCKED0001/.test(after.link) || !after.note) failures.push(`${label} venue: the failed player didn't turn into the link ${JSON.stringify(after)}`);
      if (await page.locator(".epk-video-probe, #videoLinkChecks").count()) failures.push(`${label} venue: builder checks ran on a venue's view`);
      if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `venue-${width}.png`) });
      if (page.errors.length) failures.push(`${label} venue errors: ${page.errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log("EPK video check passed at 320–430px: plays / embedding off / removed / blocked-in-player each get their line; removed stays out, the others go in as links; a venue's player that errors turns into the link.");
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
