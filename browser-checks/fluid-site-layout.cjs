"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const origin = process.env.DANZSTAK_LOCAL_URL || "http://127.0.0.1:8021";
const output = path.resolve("docs/screenshots/fluid-site-layout");
const widths = [390, 1366];
const ownerId = "11111111-1111-4111-8111-111111111111";
fs.mkdirSync(output, { recursive: true });

function response(pathname) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: ownerId, email: "artist@example.test" } };
  if (pathname === "/profiles") return { profile: { memberId: ownerId, name: "Alice Rivera", handle: "alice-rivera", cloudProfile: true } };
  if (pathname === "/epk") return { epk: null };
  if (pathname === "/tour-manager/outreach") return { outreach: [] };
  if (pathname === "/tour-manager/credits") return { available: 0, balance: 0 };
  if (pathname === "/conversations") return { conversations: [] };
  if (pathname === "/friends") return { friends: [] };
  if (pathname === "/calls/directory" || pathname === "/people") return { users: [] };
  if (pathname === "/calls/inbox") return { events: [] };
  if (pathname === "/calls/devices") return { devices: [] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/posts") return { posts: [] };
  return {};
}

const pages = [
  { name: "mix", url: "/feed.html?view=feed", selector: "#postComposer" },
  { name: "friends", url: "/feed.html#friends", selector: ".friends-directory-workspace" },
  { name: "hq", url: "/feed.html?view=hq", selector: ".artist-hq-card" },
  { name: "sync", url: "/messages.html", selector: ".chat-shell" },
  { name: "booking", url: "/booking.html", selector: ".booking-main" },
  { name: "booking-identity", url: "/booking.html", selector: ".booking-identity" },
  { name: "tour-manager", url: "/booking-selections.html", selector: ".tour-manager-dashboard" },
  { name: "tour-pitch", url: "/booking-selections.html", selector: ".artist-workspace" },
  { name: "epk", url: "/epk.html", selector: ".epk-form" },
  { name: "epk-guide", url: "/epk.html", selector: ".epk-guide" },
  { name: "profile", url: "/profile.html", selector: ".card" }
];

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      for (const item of pages) {
        const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, hasTouch: width < 700, isMobile: width < 700, serviceWorkers: "block" });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("https://api.danzstak.com/**", route => {
          const body = response(new URL(route.request().url()).pathname);
          return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
        });
        await page.goto(origin + item.url, { waitUntil: "domcontentloaded" });
        const target = page.locator(item.selector).first();
        await target.waitFor({ state: "attached" });
        const style = await target.evaluate(element => {
          const computed = getComputedStyle(element);
          return { background: computed.backgroundColor, shadow: computed.boxShadow, borderTop: computed.borderTopWidth, documentWidth: document.documentElement.scrollWidth };
        });
        assert.equal(style.background, "rgba(0, 0, 0, 0)", `${item.name} still has an outer container background at ${width}px`);
        assert.equal(style.shadow, "none", `${item.name} still has an outer container shadow at ${width}px`);
        assert.equal(style.borderTop, "0px", `${item.name} still has an outer container line at ${width}px`);
        assert.ok(style.documentWidth <= width, `${item.name} overflows at ${width}px`);
        assert.deepEqual(errors, [], `${item.name} raised browser errors at ${width}px: ${errors.join(" | ")}`);
        await page.screenshot({ path: path.join(output, `${item.name}-${width}.png`), fullPage: false });
        await context.close();
      }
    }
    console.log(`Fluid site-layout checks passed for ${pages.map(page => page.name).join(", ")} at ${widths.join(" and ")}px.`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
