"use strict";
// Owner 2026-11-23 (an EPK's Watch section with YouTube's "Video unavailable" in the player): "Before adding to the
// epk need to make sure the video is there and playable. Youtube is kinda tricky for videos with apps."
// Builder: four "Live video links": one that plays, one whose owner turned embedding off (oEmbed 401), one removed
// (oEmbed 404) and one oEmbed says is fine but the real player refuses (error 150). Each gets its line; the removed one
// stays out of the EPK, the two that won't play inside other sites go in as links (no Load player button).
// Venue's view: a player that errors after it's loaded turns into the link, never YouTube's error box.
// Owner 2026-11-23 (Watch cards that only said "Load YouTube player"): "Links from YouTube need the videos if video
// unavailable then dont put it in the epk". Each video shows its own picture with a play button; a centre tap plays it
// in place (autoplay after the tap); a removed or private video (YouTube's 120x90 stand-in picture, Vimeo's 404) never
// shows, and a Watch section with nothing left goes. i.ytimg.com and Vimeo are stand-ins too.
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
const GONE = new Set(["GONEVIDEO01", "GONEVIDEO02"]);
const PICTURES = {};
const player = id => `<!doctype html><title>player</title><script>addEventListener("message", e => { let d; try { d = JSON.parse(e.data); } catch { return; } if (d.event !== "listening") return; parent.postMessage(JSON.stringify(${id === "BLOCKED0001" ? '{ event: "onError", info: 150 }' : '{ event: "onReady", info: null }'}), "*"); });</script><p>video ${id}</p>`;

async function setup(browser, width, kit) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", hasTouch: true, isMobile: true });
  const page = await context.newPage(); page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  await page.route("https://www.youtube-nocookie.com/embed/**", route => { const id = new URL(route.request().url()).pathname.split("/").pop(); return route.fulfill({ status: 200, contentType: "text/html", body: player(id) }); });
  // YouTube's pictures: a real one for a video that exists, the 120x90 grey stand-in (with a 404) for one that doesn't.
  await page.route("https://i.ytimg.com/vi/**", route => { const id = new URL(route.request().url()).pathname.split("/")[2]; return GONE.has(id) ? route.fulfill({ status: 404, contentType: "image/jpeg", body: PICTURES.missing }) : route.fulfill({ status: 200, contentType: "image/jpeg", body: PICTURES.video }); });
  await page.route("https://vimeo.com/api/oembed.json**", route => { const id = new URL(new URL(route.request().url()).searchParams.get("url")).pathname.split("/").pop(); return id === "404404404" ? route.fulfill({ status: 404, contentType: "application/json", body: "{}" }) : route.fulfill(json({ title: "Vimeo live set", thumbnail_url: `https://i.vimeocdn.com/video/${id}-d_640` })); });
  await page.route("https://i.vimeocdn.com/**", route => route.fulfill({ status: 200, contentType: "image/jpeg", body: PICTURES.video }));
  await page.route("https://player.vimeo.com/video/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>vimeo</title><p>vimeo player</p>" }));
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
    const scratch = await browser.newPage();
    for (const [name, w, h, color] of [["video", 480, 360, "#3b6e8f"], ["missing", 120, 90, "#cccccc"]]) {
      const data = await scratch.evaluate(([w, h, color]) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.fillStyle = color; x.fillRect(0, 0, w, h); x.fillStyle = "#ff5a1f"; x.fillRect(w / 4, h / 4, w / 2, h / 2); return c.toDataURL("image/jpeg", 0.8); }, [w, h, color]);
      PICTURES[name] = Buffer.from(data.split(",")[1], "base64");
    }
    await scratch.close();
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
      const watch = await page.evaluate(() => [...document.querySelectorAll('#epkPreview [data-epk-section="watch"] .epk-media-card')].map(card => `${card.querySelector("h3").textContent}:${card.querySelector("button.epk-video-face") ? "player" : card.querySelector("a.epk-video-face") ? "link" : "none"}`));
      if (JSON.stringify(watch) !== JSON.stringify(["The Delta:player", "Electronic Everyday:link", "Mechanical Fungus:link"])) failures.push(`${label} builder preview: ${JSON.stringify(watch)}`);
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) failures.push(`${label}: sideways scroll`);
      if (await page.locator(".epk-video-probe").count()) failures.push(`${label}: a test player was left on the page`);
      if (width === 360 || width === 390) { await page.locator("#videoLinkChecks").scrollIntoViewIfNeeded().catch(() => {}); await page.screenshot({ path: path.join(output, `builder-${width}.png`) }); }
      if (page.errors.length) failures.push(`${label} builder errors: ${page.errors.join(" | ")}`);
      await context.close();

      // Venue's view of an EPK saved before the checks: every video shows its own picture; the removed ones (YouTube and
      // Vimeo) never show; a saved player that errors once loaded becomes the link; a centre tap plays a video in place.
      ({ context, page } = await setup(browser, width, { artistName: "Eroticon", videoLinks: [
        { label: "The Delta", url: "https://www.youtube.com/watch?v=OKVIDEO0001" },
        { label: "Old clip", url: "https://www.youtube.com/watch?v=GONEVIDEO01" },
        { label: "Mechanical Fungus", url: "https://www.youtube.com/watch?v=BLOCKED0001" },
        { label: "Electronic Everyday", url: "https://youtu.be/EMBEDOFF001", embed: false },
        { label: "Vimeo live set", url: "https://vimeo.com/76979871" },
        { label: "Deleted Vimeo", url: "https://vimeo.com/404404404" }
      ] }));
      await page.goto(`${base}/epk.html?id=eroticon`, { waitUntil: "domcontentloaded" });
      const cards = () => page.evaluate(() => [...document.querySelectorAll('[data-epk-section="watch"] .epk-media-card')].map(card => { const face = card.querySelector(".epk-video-face"), img = face?.querySelector("img"), f = face?.getBoundingClientRect(), i = img?.getBoundingClientRect(); return { title: card.querySelector("h3").textContent, face: face ? face.tagName : "", picture: Boolean(img && !img.hidden && img.complete && img.naturalWidth > 120), fills: Boolean(f && i && Math.abs(f.width - i.width) < 1 && Math.abs(f.height - i.height) < 1), ratio: f ? +(f.width / f.height).toFixed(2) : 0, inside: Boolean(f && f.left >= card.getBoundingClientRect().left - 0.5 && f.right <= card.getBoundingClientRect().right + 0.5) }; }));
      await page.waitForFunction(() => { const list = [...document.querySelectorAll('[data-epk-section="watch"] .epk-media-card')]; return list.length === 4 && list.every(card => card.querySelector(".epk-video-face img")?.naturalWidth > 120); }, null, { timeout: 10000 }).catch(() => {});
      const shown = await cards();
      const titles = shown.map(card => `${card.title}:${card.face}`);
      if (JSON.stringify(titles) !== JSON.stringify(["The Delta:BUTTON", "Mechanical Fungus:BUTTON", "Electronic Everyday:A", "Vimeo live set:BUTTON"])) failures.push(`${label} venue: removed videos must not show, the rest show as videos ${JSON.stringify(titles)}`);
      for (const card of shown) if (!card.picture || !card.fills || Math.abs(card.ratio - 16 / 9) > 0.03 || !card.inside) failures.push(`${label} venue: ${card.title} doesn't show its picture filling a 16:9 frame ${JSON.stringify(card)}`);
      if (await page.locator('[data-epk-section="watch"] .epk-player-load').count()) failures.push(`${label} venue: a video still offers "Load … player" instead of its picture`);
      if (width === 360 || width === 390) { await page.locator('[data-epk-section="watch"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(output, `venue-videos-${width}.png`) }); }
      // A centre tap on the play button plays the video in place, with autoplay (the tap is the go-ahead).
      const tapCentre = async selector => { const spot = await page.evaluate(sel => { const node = document.querySelector(sel); if (!node?.querySelector(".epk-video-play")) return { missing: true }; node.scrollIntoView({ block: "center" }); const play = node.querySelector(".epk-video-play").getBoundingClientRect(), x = play.left + play.width / 2, y = play.top + play.height / 2; return { x, y, hit: node.contains(document.elementFromPoint(x, y)) }; }, selector); if (spot.missing) { failures.push(`${label} venue: no video picture with a play button at ${selector}`); return; } if (!spot.hit) failures.push(`${label} venue: the play button at ${selector} is covered`); await page.touchscreen.tap(spot.x, spot.y); };
      await tapCentre('[data-epk-section="watch"] .epk-media-card:nth-child(1) .epk-video-face');
      await page.waitForSelector('[data-epk-section="watch"] .epk-media-card:nth-child(1) iframe', { timeout: 5000 }).catch(() => {});
      const playing = await page.evaluate(() => { const card = document.querySelector('[data-epk-section="watch"] .epk-media-card'), frame = card.querySelector("iframe"), r = frame?.getBoundingClientRect(); return { src: frame?.src || "", allow: frame?.getAttribute("allow") || "", faceHidden: card.querySelector(".epk-video-face").hidden, ratio: r ? +(r.width / r.height).toFixed(2) : 0, frames: document.querySelectorAll("#epkPreview iframe").length }; });
      if (!/OKVIDEO0001\?.*autoplay=1/.test(playing.src) || !/autoplay/.test(playing.allow) || !playing.faceHidden || Math.abs(playing.ratio - 16 / 9) > 0.03 || playing.frames !== 1) failures.push(`${label} venue: tapping the video didn't play it in place ${JSON.stringify(playing)}`);
      // The blocked one (player error 150) turns into a link to the video on YouTube, keeping its picture.
      await tapCentre('[data-epk-section="watch"] .epk-media-card:nth-child(2) .epk-video-face');
      await page.waitForFunction(() => document.querySelector('[data-epk-section="watch"] .epk-media-card:nth-child(2)')?.dataset.embed === "off", null, { timeout: 8000 }).catch(() => {});
      const after = await page.evaluate(() => { const card = document.querySelector('[data-epk-section="watch"] .epk-media-card:nth-child(2)'), face = card.querySelector(".epk-video-face"); return { off: card.dataset.embed, frame: Boolean(card.querySelector("iframe")), face: face?.tagName, href: face?.href || "", picture: face?.querySelector("img")?.naturalWidth > 120, note: card.querySelector(".epk-player-note")?.textContent || "", firstStopped: !document.querySelector('[data-epk-section="watch"] .epk-media-card:nth-child(1) iframe') }; });
      if (after.off !== "off" || after.frame || after.face !== "A" || !/BLOCKED0001/.test(after.href) || !after.picture || !after.note || !after.firstStopped) failures.push(`${label} venue: the failed player didn't turn into the link ${JSON.stringify(after)}`);
      if (await page.locator(".epk-video-probe, #videoLinkChecks").count()) failures.push(`${label} venue: builder checks ran on a venue's view`);
      if (width === 360 || width === 390) await page.screenshot({ path: path.join(output, `venue-${width}.png`) });
      if (page.errors.length) failures.push(`${label} venue errors: ${page.errors.join(" | ")}`);
      await context.close();

      // An EPK whose only video is gone has no Watch section at all.
      ({ context, page } = await setup(browser, width, { artistName: "Eroticon", shortBio: "Since 1988.", videoLinks: [{ label: "Old clip", url: "https://youtu.be/GONEVIDEO02" }] }));
      await page.goto(`${base}/epk.html?id=eroticon`, { waitUntil: "domcontentloaded" });
      await page.locator('[data-epk-section="about"]').waitFor({ timeout: 10000 });
      await page.waitForFunction(() => !document.querySelector('[data-epk-section="watch"]'), null, { timeout: 8000 }).catch(() => failures.push(`${label} venue: a Watch section with only a removed video still shows`));
      if (page.errors.length) failures.push(`${label} empty watch errors: ${page.errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join("\n"));
  console.log("EPK video check passed at 320–430px: plays / embedding off / removed / blocked-in-player each get their line; removed stays out, the others go in as links; on a venue's view every video shows its own picture in a 16:9 frame, a centre tap plays it in place, removed YouTube and Vimeo videos never show (nor an empty Watch section), and a player that errors turns into the link.");
})().catch(error => { console.error(error.message || error); process.exitCode = 1; });
