"use strict";
// Task 16-C site-wide sweep (owner 2026-11-17): no "HTML-looking" buttons anywhere. One area per PR; this check audits
// every visible button on the chosen area at 360 and 390px (plus 320/430) and fails on grey bevels, borders over 1px,
// browser-grey fills, uppercase blocks, labels that wrap, touch targets under 44px and blue outline "text buttons".
// Usage: AREA=mix node browser-checks/buttons-site-audit.cjs   (AUDIT_ONLY=1 SHOTS=before just reports)
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8141").replace(/\/$/, "");
const area = process.env.AREA || "mix";
const prefix = process.env.SHOTS || "after";
const widths = (process.env.WIDTHS || "320,360,390,430").split(",").map(Number);
const output = path.resolve("docs/screenshots/buttons-site", area);
const ownerId = "11111111-1111-4111-8111-111111111111";
const json = body => ({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

const posts = [
  { postId: "33333333-3333-4333-8333-333333333331", userId: ownerId, authorName: "Night Shift", content: "Warehouse set last night. Thank you Oakland.", createdAt: "2026-11-16T21:30:00.000Z", audience: "public", isOwner: true, viewCount: 42 },
  { postId: "33333333-3333-4333-8333-333333333332", userId: "22222222-2222-4222-8222-222222222222", authorName: "Tour Friend", content: "See you at load-in.", createdAt: "2026-11-15T17:30:00.000Z", audience: "public", isOwner: false, viewCount: 7 }
];
function fixture(p) {
  if (p === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "artist@example.test" } };
  if (p === "/profiles") return { profile: { memberId: ownerId, name: "Night Shift", handle: "nightshift", isOwner: true, cloudProfile: true } };
  if (p === "/secure-posts") return { posts };
  if (p === "/stories") return { stories: [], reels: [] };
  if (p === "/friends") return { friends: [] };
  if (p === "/calls/directory" || p === "/people") return { users: [] };
  if (p === "/notifications" || p === "/engagement-notifications") return { notifications: [] };
  if (p === "/groups") return { groups: [] };
  if (p === "/news") return { articles: [] };
  if (p === "/conversations") return { conversations: [] };
  if (p === "/calls/devices") return { devices: [] };
  if (p === "/calls/inbox") return { events: [] };
  if (p === "/settings/presence") return { visible: true };
  if (p === "/settings/posts") return { hiddenPostIds: [] };
  if (p === "/profile-video") return { video: null };
  return {};
}
const areas = {
  mix: { url: "/feed.html?view=feed", ready: ".reels-rail, #feed .post", scope: "main, #feed, body" },
  hq: { url: "/feed.html?view=hq", ready: ".artist-hq, #artistHq, [data-feature='hq']", scope: "body" },
  events: { url: "/feed.html?view=events", ready: "main", scope: "body" },
  bazaar: { url: "/bazaar.html", ready: "main", scope: "body" },
  profile: { url: "/profile.html", ready: ".profile-actions", scope: "body" },
  epk: { url: "/epk.html", ready: "main", scope: "body" },
  booking: { url: "/booking.html", ready: "main", scope: "body" }
};

const audit = (page, scope) => page.evaluate(scope => {
  const roots = scope.split(",").map(s => document.querySelector(s.trim())).filter(Boolean);
  const root = roots[0] || document.body;
  const problems = [], seen = new Set();
  // Links count as buttons when they are drawn like one (a fill or a border around padded text).
  const buttonLike = (node, cs) => node.tagName !== "A" || node.matches("a.button, a[role='button']") || ((parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none") || !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) && parseFloat(cs.paddingLeft) >= 6 && /flex|block|grid/.test(cs.display);
  for (const node of root.querySelectorAll("button, a, input[type=submit], input[type=button], label[data-icon]")) {
    if (seen.has(node)) continue; seen.add(node);
    const r = node.getBoundingClientRect(), cs = getComputedStyle(node);
    if (!buttonLike(node, cs) || node.closest("header.app-header, .topbar, nav[aria-label='Primary']") && node.tagName === "A" && !node.matches("a.button")) continue;
    if (!r.width || !r.height || cs.visibility === "hidden" || node.closest("[hidden], dialog:not([open]), .ds-mobile-nav, [aria-hidden='true']")) continue;
    if (r.bottom < 0 || r.right < 0 || r.left > innerWidth) continue; // off-screen carousel items are checked when scrolled in
    const name = (node.getAttribute("aria-label") || node.textContent || node.value || node.className).trim().replace(/\s+/g, " ").slice(0, 40);
    const tag = `${node.id ? "#" + node.id : "." + String(node.className).split(" ")[0]} "${name}"`;
    if (Math.min(r.width, r.height) < 43.5 && !node.matches("[role='tab'], .post-reaction-pick, .emoji-pick")) problems.push(`${tag}: touch target ${Math.round(r.width)}x${Math.round(r.height)}`);
    const borders = ["Top", "Right", "Bottom", "Left"].map(side => parseFloat(cs[`border${side}Width`]) * (cs[`border${side}Style`] === "none" ? 0 : 1));
    if (borders.some(width => width > 1.01)) problems.push(`${tag}: border ${borders.map(Math.round).join("/")}px`);
    if (["outset", "inset", "groove", "ridge"].includes(cs.borderTopStyle)) problems.push(`${tag}: bevel border`);
    // A single-edge inset (an active-tab underline such as "inset 0 -3px") is a tab indicator, not a bevel.
    if (/inset/.test(cs.boxShadow) && !(node.matches("[aria-current], [aria-selected='true'], [role='tab']") && /(^|\) )0px -?\d+px 0px( 0px)? inset$/.test(cs.boxShadow.trim()))) problems.push(`${tag}: inset bevel shadow`);
    if (/^rgb\((239|240|221), (239|240|221), (239|240|221)\)$/.test(cs.backgroundColor)) problems.push(`${tag}: browser-grey background`);
    if (cs.textTransform === "uppercase" && node.textContent.trim().length > 3) problems.push(`${tag}: uppercase block`);
    // Blue outline text buttons ("Open bookings" style): a coloured border on a white/transparent text button.
    const blue = c => { const m = c.match(/\d+/g); return m && +m[2] > 150 && +m[2] > +m[0] + 40; };
    // Outlined text buttons (border around a word on a white/clear fill, e.g. "Open bookings") read as HTML: secondary is tonal.
    const clear = /rgba\(0, 0, 0, 0\)|rgb\(255, 255, 255\)|transparent/.test(cs.backgroundColor);
    const words = node.textContent.trim().replace(/\s+/g, " ");
    if (borders.some(w => w > 0) && clear && words.length > 3 && !node.matches("[class*='composer'], [class*='opener'], [role='tab']")) problems.push(`${tag}: outlined text button${blue(cs.color) || blue(cs.borderTopColor) ? " (blue)" : ""}`);
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let lines = 0;
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim() || t.parentElement.closest(".sr-only, [aria-hidden='true']")) continue;
      const range = document.createRange(); range.selectNodeContents(t);
      lines = Math.max(lines, new Set([...range.getClientRects()].filter(x => x.width > 1 && x.height > 4).map(x => Math.round(x.top / 4))).size);
    }
    if (lines > 1) problems.push(`${tag}: label wraps to ${lines} lines`);
  }
  if (document.documentElement.scrollWidth > innerWidth) problems.push(`sideways overflow ${document.documentElement.scrollWidth}px`);
  return problems;
}, scope);

(async () => {
  const config = areas[area];
  if (!config) throw new Error(`unknown AREA ${area}`);
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block", hasTouch: true, isMobile: true, deviceScaleFactor: 2, reducedMotion: "reduce" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => route.fulfill(json(fixture(new URL(route.request().url()).pathname))));
      await page.goto(baseUrl + config.url, { waitUntil: "domcontentloaded" });
      await page.locator(config.ready).first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(900);
      // Audit the page top to bottom in screen-sized steps so every button is checked where it renders.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0, i = 0; y < Math.min(height, 6000); y += 700, i++) {
        await page.evaluate(top => scrollTo(0, top), y);
        await page.waitForTimeout(150);
        (await audit(page, config.scope)).forEach(problem => failures.push(`${width}px: ${problem}`));
        if ([360, 390].includes(width) && i < 3) for (let attempt = 0; attempt < 3; attempt++) { try { await page.screenshot({ path: path.join(output, `${prefix}-${i + 1}-${width}.png`), animations: "disabled", caret: "hide" }); break; } catch { await page.waitForTimeout(300); } }
      }
      if (errors.length) failures.push(`${width}px: page errors ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  const unique = [...new Set(failures)];
  if (unique.length) { console[process.env.AUDIT_ONLY ? "log" : "error"](`Buttons (${area}): ${unique.length} problem(s)\n- ${unique.join("\n- ")}`); if (!process.env.AUDIT_ONLY) process.exitCode = 1; return; }
  console.log(`Button sweep (${area}) passed at ${widths.join(", ")}px: no bevels, borders, grey fills, uppercase blocks, blue outlines, wrapped labels or small targets.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
