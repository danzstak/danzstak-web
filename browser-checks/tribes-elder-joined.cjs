"use strict";
// Audit A8 (2026-11-19): an Elder saw an orange "Join" on their own Tribe and the Tribes list opened on Discover.
// The server's membership list can leave out Tribes you run; an Elder is always a member, and the list opens on
// Your Tribes when you have any.
// Run: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/tribes-elder-joined.cjs
const { chromium } = require("playwright");
const base = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const me = "11111111-1111-4111-8111-111111111111";
const tribe = { id: "t-elder-1", name: "Bay Area Hardcore", category: "Local Scenes", description: "Shows and rides.", memberCount: 12, isElder: true, isOwner: true };
const fixture = (p, method) => p === "/auth/session" ? { authenticated: true, user: { sub: me, email: "elder@example.test" } }
  : p === "/profiles" ? { profile: { memberId: me, name: "Elder", handle: "elder", cloudProfile: true, isOwner: true } }
  : p === "/groups" && method === "GET" ? { groups: [tribe] }
  : p === "/groups/membership" ? { groupIds: [] }
  : p === "/secure-posts" ? { posts: [] } : p === "/stories" ? { stories: [], reels: [] } : {};
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const failures = [];
  try {
    for (const width of [360, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => { const request = route.request(); route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }, body: JSON.stringify(fixture(new URL(request.url()).pathname, request.method())) }); });
      await page.goto(`${base}/feed.html#groups`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2500);
      const state = await page.evaluate(name => {
        const card = [...document.querySelectorAll(".group-card, article")].find(node => node.textContent.includes(name));
        const buttons = card ? [...card.querySelectorAll("button")].map(b => b.textContent.trim()) : [];
        const selected = document.querySelector('.groups-tab[aria-selected="true"]')?.textContent.trim();
        return { found: Boolean(card), buttons, selected };
      }, tribe.name);
      if (!state.found) failures.push(`${width}px: the Elder's Tribe is not listed`);
      if (state.buttons.includes("Join")) failures.push(`${width}px: the Elder sees "Join" on their own Tribe (${state.buttons.join(", ")})`);
      if (state.selected !== "Your Tribes") failures.push(`${width}px: Tribes opened on "${state.selected}", not Your Tribes`);
      if (errors.length) failures.push(`${width}px: script errors: ${errors.join(" | ")}`);
      await context.close();
    }
  } finally { await browser.close(); }
  if (failures.length) { console.error(failures.join("\n")); process.exit(1); }
  console.log("Tribes Elder checks passed: an Elder's Tribe shows Joined and the list opens on Your Tribes.");
})();
