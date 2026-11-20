"use strict";
// Task 14-D: Events page, flyer-first creator and poster event page in a real browser (Edge), 320-1366px.
// Run with a local server: DANZSTAK_BASE_URL=http://127.0.0.1:8132 node browser-checks/events-page.cjs
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const baseUrl = String(process.env.DANZSTAK_BASE_URL || "http://127.0.0.1:8132").replace(/\/$/, "");
const widths = [320, 360, 390, 414, 430, 1366];
const output = path.resolve("docs/screenshots/events-page");
const flyer = `${baseUrl}/assets/danzstak-share-fb-v2.jpg`;
const eventId = "33333333-3333-4333-8333-333333333333";
const soon = (hours) => new Date(Date.now() + hours * 3600000).toISOString();
const nights = [
  { id: eventId, title: "Basement Frequencies", venueName: "The Pit", venueAddress: "1 Main St, Oakland, CA", description: "Ghost Rider\nDJ Tarmac\nNoise Cell", startsAt: soon(5), timezone: "America/Los_Angeles", mediaType: "image", mediaUrl: flyer, ticketSalesEnabled: true, namedTickets: true, tiers: [{ id: "44444444-4444-4444-8444-444444444444", name: "General admission", priceCents: 1500, available: 80 }, { id: "55555555-5555-4555-8555-555555555555", name: "Balcony", priceCents: 2500, available: 12 }] },
  { id: "66666666-6666-4666-8666-666666666666", title: "Crust Sunday Matinee", venueName: "924 Gilman", venueAddress: "Berkeley, CA", description: "", startsAt: soon(30), timezone: "America/Los_Angeles", mediaType: "", mediaUrl: "", ticketSalesEnabled: false, ticketUrl: "https://www.eventbrite.com/e/123", tiers: [] },
  { id: "77777777-7777-4777-8777-777777777777", title: "Doom Hall", venueName: "Elbo Room", venueAddress: "Oakland, CA", description: "", startsAt: soon(50), timezone: "America/Los_Angeles", mediaType: "image", mediaUrl: flyer, ticketSalesEnabled: true, tiers: [{ id: "88888888-8888-4888-8888-888888888888", name: "Door", priceCents: 1000, available: 40 }] }
];
const own = [{ ...nights[2], status: "published", tiers: [{ ...nights[2].tiers[0], sold: 23, capacity: 60 }] }];
const myTickets = [{ orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", eventId, title: "Basement Frequencies", startsAt: soon(5), timezone: "America/Los_Angeles", venue: "The Pit, Oakland", tickets: [{ code: "K7QX-3MPA", name: "Ana Rossi", tier: "General admission" }], savedAt: new Date().toISOString() }];

function fixture(pathname, method) {
  if (pathname === "/auth/session") return { authenticated: true, user: { sub: "11111111-1111-4111-8111-111111111111", email: "promoter@danzstak.invalid" } };
  if (pathname === "/profiles") return { profile: { memberId: "11111111-1111-4111-8111-111111111111", name: "Test Promoter", username: "testpromoter" } };
  if (pathname === "/marketplace/events/upcoming") return { events: nights };
  if (pathname === "/marketplace/events" && method === "GET") return { events: own };
  if (pathname === "/marketplace/events" && method === "POST") return { event: { id: "99999999-9999-4999-8999-999999999999" } };
  if (/\/tiers$/.test(pathname)) return { tier: { id: "t" } };
  if (pathname === "/stories" && method === "POST") return { uploadUrl: `${baseUrl}/__upload`, mediaKey: "users/aaaaaaaaaaaaaaaaaaaaaaaa/11111111-1111-4111-8111-111111111111.jpg" };
  if (pathname === `/marketplace/events/${eventId}`) return { event: nights[0] };
  if (pathname === "/secure-posts") return method === "POST" ? { post: { id: "p" } } : { posts: [] };
  if (pathname === "/friends") return { friends: [], incoming: [], outgoing: [] };
  if (pathname === "/notifications" || pathname === "/engagement-notifications") return { notifications: [] };
  if (pathname === "/stories") return { stories: [], reels: [] };
  if (pathname === "/groups") return { groups: [] };
  return {};
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const width of widths) {
      const context = await browser.newContext({ viewport: { width, height: width === 1366 ? 900 : 844 }, serviceWorkers: "block" });
      await context.addInitScript(tickets => { try { localStorage.setItem("danzstak_my_tickets_v1", JSON.stringify(tickets)); } catch {} }, myTickets);
      const page = await context.newPage(), errors = [], posted = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => {
        const request = route.request(), url = new URL(request.url());
        if (request.method() === "POST") posted.push(url.pathname);
        route.fulfill({ status: request.method() === "POST" && url.pathname === "/marketplace/events" ? 201 : 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname, request.method())) });
      });
      await page.route(`${baseUrl}/__upload`, route => route.fulfill({ status: 200, body: "" }));
      // Screen-sized captures scrolled to each section: what a phone shows, with the real top bar and tabs.
      const shot = async (name, locator) => {
        if (![320, 390, 1366].includes(width)) return;
        if (locator) await locator.evaluate(node => { node.scrollIntoView({ block: "start" }); scrollBy(0, -70); });
        await page.waitForTimeout(150);
        for (let attempt = 1; ; attempt++) {
          try { await page.screenshot({ path: path.join(output, `${name}-${width}.png`), animations: "disabled", caret: "hide" }); break; }
          catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(500); }
        }
      };
      const layout = async label => {
        const state = await page.evaluate(() => {
          const visible = n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
          const small = [...document.querySelectorAll(".ev-skin :is(button,input:not([type=checkbox]):not([type=file]),select,textarea,summary,a.ev-night,a.ev-my-ticket), .event-poster :is(button,select,a.event-map), .event-poster .ticket-buy-button")]
            .filter(visible).map(n => ({ label: n.textContent.trim().slice(0, 30) || n.getAttribute("aria-label") || n.tagName, h: Math.round(n.getBoundingClientRect().height) })).filter(t => t.h < 44);
          return { overflow: document.documentElement.scrollWidth > innerWidth, small };
        });
        assert.equal(state.overflow, false, `${width}px ${label} overflows sideways`);
        assert.deepEqual(state.small, [], `${width}px ${label} has targets under 44px`);
      };

      // Fans: search, My tickets, tonight (max 5).
      await page.goto(`${baseUrl}/feed.html?view=events`, { waitUntil: "load" });
      await page.locator(".ev-skin .ev-night").first().waitFor({ timeout: 20000 });
      assert.equal(await page.locator(".ev-search-input").getAttribute("placeholder"), "Night, artist, venue or city");
      assert.equal((await page.locator(".ev-my-ticket-code").first().innerText()).trim(), "K7QX-3MPA", "My tickets shows the door code from this device");
      assert.ok(await page.locator(".ev-block:not(.ev-yours) .ev-nights .ev-night").count() <= 5, "no more than five nights");
      assert.equal(await page.locator(".ev-end").textContent(), "That's it for now.");
      await layout("events");
      await shot("events-top", page.locator(".ev-skin"));
      await page.locator(".ev-search-input").fill("gilman");
      assert.deepEqual(await page.locator(".ev-results .ev-night strong").allInnerTexts(), ["Crust Sunday Matinee"], `${width}px search by venue`);
      await page.locator(".ev-search-input").fill("tarmac");
      assert.deepEqual(await page.locator(".ev-results .ev-night strong").allInnerTexts(), ["Basement Frequencies"], `${width}px search by artist`);
      await page.locator(".ev-search-input").fill("");
      assert.match(await page.locator(".ev-own").first().innerText(), /23\/60[\s\S]*tickets sold/, "promoter sees sales so far");

      // Promoter: pitch, then the flyer-first creator.
      await page.locator(".ev-promo").scrollIntoViewIfNeeded();
      await shot("promoter-pitch", page.locator(".ev-promo"));
      await page.getByRole("button", { name: "Make your poster" }).click();
      assert.equal(await page.locator(".ev-step:not([hidden])").count(), 0, "questions wait for the flyer");
      await page.locator(".ev-file").setInputFiles(path.resolve("assets/danzstak-share-fb-v2.jpg"));
      await page.locator(".ev-poster-media img").waitFor();
      await shot("creator-flyer", page.locator(".ev-creator"));
      assert.equal(await page.locator(".ev-step:not([hidden])").count(), 1, "one question at a time");
      await page.locator(".ev-step:not([hidden]) input").fill("Basement Frequencies");
      assert.equal(await page.locator(".ev-poster-title").innerText(), "BASEMENT FREQUENCIES", "the poster fills in as they type");
      await page.getByRole("button", { name: "Next" }).click();
      await page.locator(".ev-step:not([hidden]) input").fill("2027-02-06T22:00");
      await page.getByRole("button", { name: "Next" }).click();
      const venueInputs = page.locator(".ev-step:not([hidden]) input");
      await venueInputs.nth(0).fill("The Pit"); await venueInputs.nth(1).fill("1 Main St, Oakland");
      await page.getByRole("button", { name: "Next" }).click();
      await page.locator(".ev-step:not([hidden]) input[inputmode=decimal]").fill("15");
      assert.equal((await page.locator(".ev-payout").innerText()).replace(/\s+/g, " "), "Buyer pays $16.90 · You get $15.00");
      await layout("creator");
      await shot("creator-price", page.locator(".ev-step:not([hidden])"));
      await page.getByRole("button", { name: "Next" }).click();
      await page.locator(".ev-step:not([hidden]) textarea").fill("Ghost Rider\nDJ Tarmac");
      assert.equal(await page.getByRole("button", { name: "Publish event" }).count(), 1, "one Publish button");
      await page.locator(".ev-more summary").click();
      await page.getByRole("button", { name: "Add a ticket section" }).click();
      const stub = page.locator(".ev-stub").nth(1);
      await stub.locator("input").nth(0).fill("Balcony"); await stub.locator("input").nth(1).fill("25"); await stub.locator("input").nth(2).fill("20");
      await layout("more options");
      await shot("creator-more", page.locator(".ev-more"));
      // Close the keyboard first, as a phone user would: the field losing focus reflows the page.
      await page.evaluate(() => document.activeElement?.blur());
      await page.getByRole("button", { name: "Publish event" }).click();
      assert.match(await page.locator(".ev-status").innerText(), /Confirm that you made this event post/, "confirmation required");
      await page.locator(".ev-finish input[type=checkbox]").check();
      await page.getByRole("button", { name: "Publish event" }).click();
      await page.locator(".ev-status").filter({ hasText: "Your night is live." }).waitFor({ timeout: 15000 }).catch(async error => { throw new Error(`${width}px publish did not finish: ${await page.locator(".ev-status").textContent()} / posted ${posted.join(",")}`); });
      assert.deepEqual(posted.filter(p => /stories|marketplace|secure-posts/.test(p)), ["/stories", "/marketplace/events", "/marketplace/events/99999999-9999-4999-8999-999999999999/tiers", "/marketplace/events/99999999-9999-4999-8999-999999999999/tiers", "/secure-posts"], `${width}px publish sequence`);

      // Public event page: poster, ticket stubs with Buy, lineup, map link.
      await page.goto(`${baseUrl}/event.html?id=${eventId}`, { waitUntil: "load" });
      await page.locator(".ticket-tier .ticket-buy-button").first().waitFor();
      assert.equal(await page.locator(".ticket-tier").count(), 2);
      assert.deepEqual(await page.locator("#eventLineup li").allInnerTexts(), ["Ghost Rider", "DJ Tarmac", "Noise Cell"]);
      assert.match(await page.locator("#eventMap").getAttribute("href"), /^https:\/\/www\.openstreetmap\.org\/search\?query=The%20Pit%2C%201%20Main%20St/);
      await layout("event page");
      await shot("event-page", page.locator("#eventMain"));
      await shot("event-tickets", page.locator(".event-tickets"));
      assert.equal(errors.length, 0, `${width}px page errors: ${errors.join(" | ")}`);
      await context.close();
    }
    console.log(`Events page browser checks passed at ${widths.join(", ")}px: search, offline My tickets, max-5 tonight list, flyer-first creator with live poster, stubs, one Publish, and the poster event page.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
