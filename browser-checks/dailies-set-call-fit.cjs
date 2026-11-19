"use strict";
// Mix Dailies set calls (owner 2026-11-18): the empty film-strip tiles call the shot ("LIGHTS / SOUND", "ACTION!").
// At 320px the third tile used to wrap "ACTIO" / "N!" because the words could break anywhere. Every set call must sit
// on whole words inside its tile at every phone width: the font scales with the tile instead of splitting a word.
// The three-tiles-across strip and the clapper tile stay as they are.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8141 SHOTS=after node browser-checks/dailies-set-call-fit.cjs
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const prefix = process.env.SHOTS || "after";
const output = path.resolve("docs/screenshots/dailies-set-call-fit");
const widths = [320, 360, 375, 390, 414, 430];
const ownerId = "11111111-1111-4111-8111-111111111111";
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
const tile = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 160"><rect width="90" height="160" fill="#1d2633"/><circle cx="45" cy="70" r="26" fill="#ff5a1f"/></svg>';
const friendStory = { storyId: "s0", memberId: "22222220-2222-4222-8222-222222222222", displayName: "Tour Friend", mediaType: "image", mediaUrl: `${baseUrl}/__dailies/0.svg`, createdAt: new Date().toISOString(), audience: "friends" };

// Test every call sheet the page can pick, read straight from feed.html so a new sheet is covered automatically.
const callSheets = JSON.parse(fs.readFileSync(path.resolve("feed.html"), "utf8").match(/const callSheets = (\[\[[^;]*\]\]);/)[1]);
const longest = sheet => Math.max(...sheet.flatMap(cue => cue.split(" ").map(word => word.length)));
const widestSheet = callSheets.reduce((best, sheet, index) => longest(sheet) > longest(callSheets[best]) ? index : best, 0);

// Runs in the page: every word of every cue line in the empty tiles must be on one line and inside the cue box.
function measure() {
  const problems = [];
  const tiles = [...document.querySelectorAll("#storiesRail .story-placeholder")];
  for (const [n, tileNode] of tiles.entries()) {
    const cue = tileNode.querySelector(".story-placeholder-cue");
    if (!cue) { problems.push(`tile ${n + 1} has no set call`); continue; }
    const t = tileNode.getBoundingClientRect(), c = cue.getBoundingClientRect(), cs = getComputedStyle(cue);
    const box = { left: c.left + parseFloat(cs.paddingLeft) - 0.5, right: c.right - parseFloat(cs.paddingRight) + 0.5 };
    if (c.left < t.left - 0.5 || c.right > t.right + 0.5 || c.top < t.top - 0.5 || c.bottom > t.bottom + 0.5) problems.push(`tile ${n + 1}: the set-call frame spills out of the tile`);
    if (cue.scrollWidth > cue.clientWidth || cue.scrollHeight > cue.clientHeight) problems.push(`tile ${n + 1}: the set call overflows its frame (${cue.scrollWidth}x${cue.scrollHeight} in ${cue.clientWidth}x${cue.clientHeight})`);
    for (const line of cue.querySelectorAll("b")) {
      const text = line.firstChild, size = parseFloat(getComputedStyle(line).fontSize);
      if (line.scrollWidth > line.clientWidth) problems.push(`"${line.textContent}" is wider than its line (${line.scrollWidth} > ${line.clientWidth})`);
      if (size < 8) problems.push(`"${line.textContent}" shrank to ${size}px, too small to read`);
      let offset = 0;
      for (const word of line.textContent.split(" ")) {
        const range = document.createRange();
        range.setStart(text, offset); range.setEnd(text, offset + word.length); offset += word.length + 1;
        const rects = [...range.getClientRects()].filter(r => r.width > 0);
        if (new Set(rects.map(r => Math.round(r.top))).size > 1) problems.push(`"${word}" breaks across lines`);
        const left = Math.min(...rects.map(r => r.left)), right = Math.max(...rects.map(r => r.right));
        if (left < box.left || right > box.right) problems.push(`"${word}" runs outside its tile (${Math.round(left)}-${Math.round(right)} vs ${Math.round(box.left)}-${Math.round(box.right)})`);
      }
    }
  }
  const visible = [...document.querySelectorAll("#storiesRail > .story-create, #storiesRail > .story[data-story-id], #storiesRail > .story-placeholder")].filter(node => node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().left < innerWidth);
  return { problems, placeholders: tiles.length, visible: visible.map(node => ({ own: node.classList.contains("story-create"), width: node.getBoundingClientRect().width })), cues: tiles.map(node => node.textContent) };
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const friends of [0, 1]) for (const width of widths) {
      const label = `${friends ? "one friend" : "own only"} ${width}px`;
      const context = await browser.newContext({ viewport: { width, height: 800 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
      // Pin the call sheet with the longest word so the screenshot shows the hardest case.
      await context.addInitScript(sheet => {
        new MutationObserver((_, observer) => {
          const rail = document.getElementById("storiesRail");
          if (rail) { rail.dataset.callSheet = String(sheet); observer.disconnect(); }
        }).observe(document, { childList: true, subtree: true });
      }, widestSheet);
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route(`${baseUrl}/__dailies/*`, route => route.fulfill({ status: 200, contentType: "image/svg+xml", body: tile }));
      await page.route("https://api.danzstak.com/**", route => {
        const p = new URL(route.request().url()).pathname;
        const body = p === "/auth/session" ? { authenticated: true, user: { sub: ownerId, email: "a@example.test" } }
          : p === "/profiles" ? { profile: { memberId: ownerId, name: "Night Shift", handle: "nightshift", isOwner: true, cloudProfile: true } }
          : p === "/stories" ? { dailyTakeCount: 3, stories: friends ? [friendStory] : [], reels: [] }
          : p === "/secure-posts" ? { posts: [] } : p === "/settings/posts" ? { hiddenPostIds: [] } : {};
        route.fulfill(json(body));
      });
      await page.goto(`${baseUrl}/feed.html?view=feed`, { waitUntil: "domcontentloaded" });
      await page.locator("#storiesRail .story-placeholder").first().waitFor({ state: "attached", timeout: 10000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(400);
      const first = await page.evaluate(measure);
      if (first.placeholders !== 2 - friends) failures.push(`${label}: expected ${2 - friends} empty tile(s), found ${first.placeholders}`);
      if (!/ACTION!$/.test(first.cues.at(-1) || "")) failures.push(`${label}: the last empty tile does not say ACTION! (${JSON.stringify(first.cues)})`);
      // The strip itself is unchanged: three tiles across, the member's own clapper tile first, each a third of the screen.
      if (first.visible.length !== 3 || !first.visible[0].own || first.visible.some(t => Math.abs(t.width - (width - 4) / 3) > 3)) failures.push(`${label}: the strip is no longer three equal tiles with the own tile first (${JSON.stringify(first.visible)})`);
      first.problems.forEach(problem => failures.push(`${label}: ${problem}`));
      if ([320, 390].includes(width)) await page.screenshot({ path: path.join(output, `${prefix}-${friends ? "one-friend" : "own"}-${width}.png`), clip: { x: 0, y: 0, width, height: 300 } });
      // Every other call sheet in the lead-up tile, using the page's own cue markup.
      if (!friends) for (const [index, sheet] of callSheets.entries()) {
        if (index === widestSheet) continue;
        const result = await page.evaluate(([words, measureSource]) => {
          const cue = document.querySelector("#storiesRail .story-placeholder .story-placeholder-cue"), template = cue.querySelector("b:not(.is-action)");
          cue.replaceChildren(...words.map(word => { const line = template.cloneNode(false); line.textContent = word; return line; }));
          return (0, eval)(`(${measureSource})`)();
        }, [sheet, measure.toString()]);
        result.problems.forEach(problem => failures.push(`${label} [${sheet.join(" / ")}]: ${problem}`));
      }
      if (errors.length) failures.push(`${label}: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) { console[process.env.AUDIT_ONLY ? "log" : "error"](`Dailies set calls: ${unique.length} problem(s)\n- ${unique.join("\n- ")}`); if (!process.env.AUDIT_ONLY) process.exitCode = 1; return; }
  console.log(`Dailies set-call checks passed: all ${callSheets.length} call sheets and ACTION! stay on whole words inside their tiles at ${widths.join(", ")}px; the strip is still three tiles with the own tile first.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
