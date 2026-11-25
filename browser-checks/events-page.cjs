"use strict";
// Task 14-D: Events page, Create event (UI kit screen 2, CLAUDE.md F10) and poster event page in a real browser (Edge),
// 320-1366px, taps at the centre of each control.
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
        if (![320, 360, 390, 1366].includes(width)) return;
        if (locator) await locator.evaluate(node => { node.scrollIntoView({ block: "start" }); scrollBy(0, -70); });
        await page.waitForTimeout(150);
        for (let attempt = 1; ; attempt++) {
          try { await page.screenshot({ path: path.join(output, `${name}-${width}.png`), animations: "disabled", caret: "hide" }); break; }
          catch (error) { if (attempt >= 3) throw error; await page.waitForTimeout(500); }
        }
      };
      // Taps land on the centre of the control, and the control must be the thing drawn there (nothing covers it).
      const tap = async locator => {
        await locator.evaluate(node => node.scrollIntoView({ block: "center" })); // a person scrolls it into view, clear of the tab bar
        await page.waitForTimeout(50);
        const box = await locator.boundingBox();
        assert.ok(box, `${width}px tap target is on screen`);
        const x = box.x + box.width / 2, y = box.y + box.height / 2;
        const hit = await locator.evaluate((node, [px, py]) => { const top = document.elementFromPoint(px, py); return !!top && (node === top || node.contains(top) || (node.tagName === "INPUT" && top.closest("label") === node.closest("label"))); }, [x, y]);
        assert.ok(hit, `${width}px something covers the centre of ${await locator.evaluate(n => n.getAttribute("aria-label") || n.textContent.trim().slice(0, 30) || n.className)}`);
        await page.mouse.click(x, y);
      };
      // A sheet slides up in 220 ms; measure and tap once it has settled.
      const sheetReady = () => page.waitForFunction(() => { const panel = document.querySelector(".ds-sheet.is-open .ds-sheet__panel"); return !!panel && getComputedStyle(panel).transform === "none" && getComputedStyle(panel).opacity === "1"; });
      const layout = async label => {
        const state = await page.evaluate(() => {
          const visible = n => { const r = n.getBoundingClientRect(), s = getComputedStyle(n); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none"; };
          const small = [...document.querySelectorAll(".ev-skin :is(button,input:not([type=checkbox]):not([type=file]),select,textarea,summary,a.ev-night,a.ev-my-ticket), .event-poster :is(button,select,a.event-map), .event-poster .ticket-buy-button, .ev-creator-screen:not([hidden]) :is(button,input:not([type=checkbox]):not([type=file]),textarea,label.ds-btn,label.ds-switch-row), .ds-sheet.is-open .ds-sheet__panel :is(button,input:not([type=checkbox]),textarea,label.ds-switch-row)")]
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

      // Fix-it 18: nothing of the composer is printed on the page; + beside search opens Create event as its own
      // screen (UI kit screen 2, CLAUDE.md F10).
      assert.equal(await page.locator(".ev-creator-screen").count(), 0, "Create event is not in the page until opened");
      assert.equal(await page.locator(".ev-skin input[type=file]:visible, .ev-skin input[type=datetime-local]:visible").count(), 0, "no form fields printed on Events");
      const add = page.getByRole("button", { name: "Post an event" });
      const addBox = await add.boundingBox();
      assert.ok(addBox.width >= 44 && addBox.height >= 44, `${width}px + is a 44px target`);
      const historyBefore = await page.evaluate(() => history.length);
      await tap(add);
      const screen = page.locator(".ev-creator-screen");
      await screen.waitFor({ state: "visible" });
      const screenBox = await screen.locator(".ds-form-screen__panel").boundingBox();
      if (width < 760) assert.deepEqual([screenBox.x, screenBox.y, Math.round(screenBox.width), Math.round(screenBox.height)], [0, 0, width, 844], `${width}px Create event fills the screen`);
      assert.equal(await page.locator(".ds-form-screen__title").innerText(), "Create event");
      const create = screen.locator(".ev-publish");
      assert.equal(await create.isDisabled(), true, "Create event waits for the flyer, the name and the time");
      assert.match(await screen.getByLabel("Start date and time").inputValue(), /^\d{4}-\d\d-\d\dT\d\d:00$/, "start prefilled to the next hour");
      assert.equal(await screen.locator(".ds-person__name").innerText(), "Test Promoter", "the host row shows you");
      const footBox = await screen.locator(".ds-form-screen__foot").boundingBox();
      assert.ok(Math.abs(footBox.y + footBox.height - (width === 1366 ? screenBox.y + screenBox.height : 844)) <= 1, `${width}px the button sits at the bottom of the screen`);
      await shot("composer-open", null);
      // Device Back closes the screen and the draft survives.
      await screen.locator(".ev-flyer input[accept^=image]").setInputFiles(path.resolve("assets/danzstak-share-fb-v2.jpg"));
      await screen.locator(".ds-media-pick__media img").waitFor();
      await screen.getByLabel("Event name").fill("Back Test Night");
      assert.equal(await create.isDisabled(), false, "flyer + name + time: Create event is ready");
      await page.goBack();
      await screen.waitFor({ state: "hidden" });
      assert.equal(await page.locator(".ev-skin .ev-night").count() > 0, true, "Back lands on the Events list, not Mix");
      assert.match(page.url(), /feed\.html\?view=events$/, "Back stays on Events");
      // Close (the ← in the bar) behaves the same.
      await tap(add);
      assert.equal(await screen.getByLabel("Event name").inputValue(), "Back Test Night", "the draft is kept after Back");
      await tap(screen.getByRole("button", { name: "Close" }));
      await screen.waitFor({ state: "hidden" });
      assert.equal(await page.evaluate(() => history.length), historyBefore + 1, "closing does not stack history entries");

      // Promoter: the pitch's button opens the same screen.
      await page.locator(".ev-promo").scrollIntoViewIfNeeded();
      await shot("promoter-pitch", page.locator(".ev-promo"));
      await tap(page.locator(".ev-promo .ev-primary"));
      await screen.waitFor({ state: "visible" });
      await screen.getByLabel("Event name").fill("Basement Frequencies");
      await screen.getByLabel("Start date and time").fill("2027-02-06T22:00");
      assert.match(await screen.locator(".ev-date-read").innerText(), /Saturday, February 6, 2027/, "the date reads back in words");
      await tap(screen.locator(".ev-end-chip"));
      assert.equal(await screen.getByLabel("Ends (optional)").isVisible(), true, "+ End time shows the end field");
      assert.match(await screen.locator(".ev-zone").innerText(), /Time zone/, "time zone chip");
      await screen.getByLabel("Venue").fill("The Pit");
      await screen.getByLabel("Address (optional)").fill("1 Main St, Oakland");
      await shot("composer-date", screen.locator(".ev-host"));

      // Who can see it?: a sheet; Back closes only the sheet.
      await tap(screen.locator(".ev-audience"));
      const sheet = page.locator(".ds-sheet.is-open");
      await sheet.waitFor();
      await sheetReady();
      assert.equal(await sheet.getByRole("radio").count(), 3);
      assert.equal(await sheet.getByRole("radio", { name: /Public/ }).getAttribute("aria-checked"), "true", "Public by default");
      await layout("who can see it");
      await shot("composer-audience", null);
      await page.goBack();
      await page.locator(".ds-sheet").waitFor({ state: "detached" });
      assert.equal(await screen.isVisible(), true, "Back closed the sheet, not the screen");
      assert.equal(await screen.getByLabel("Event name").inputValue(), "Basement Frequencies");
      await tap(screen.locator(".ev-audience"));
      await sheetReady();
      await tap(page.locator(".ds-sheet.is-open").getByRole("radio", { name: /Friends/ }));
      await page.locator(".ds-sheet").waitFor({ state: "detached" });
      assert.match(await screen.locator(".ev-audience .ds-pick__value").innerText(), /Friends/, "the row shows the pick");

      // Tickets: a sheet with ticket stubs, the buyer price and the payout.
      await tap(screen.locator(".ev-tickets"));
      const tickets = page.locator(".ds-sheet.is-open");
      await tickets.waitFor();
      await sheetReady();
      await tickets.locator(".ev-stub").first().getByLabel("Price").fill("15");
      assert.equal((await tickets.locator(".ev-payout").innerText()).replace(/\s+/g, " "), "Buyer pays $16.90 · You get $15.00");
      await tap(tickets.locator(".ev-add-section"));
      const stub = tickets.locator(".ev-stub").nth(1);
      await stub.getByLabel("Ticket").fill("Balcony"); await stub.getByLabel("Price").fill("25"); await stub.getByLabel("How many").fill("20");
      await page.evaluate(() => document.activeElement?.blur());
      await layout("tickets");
      await shot("composer-tickets", null);
      await tap(tickets.getByRole("button", { name: "Done" }));
      await page.locator(".ds-sheet").waitFor({ state: "detached" });
      assert.match((await screen.locator(".ev-tickets .ds-pick__value").innerText()).replace(/\s+/g, " "), /From \$16\.90/, "the row shows the all-in price");
      await screen.getByLabel("Lineup").fill("Ghost Rider\nDJ Tarmac");
      await page.evaluate(() => document.activeElement?.blur());
      await layout("creator");

      // Ticketed nights must be Public: the row says so.
      await tap(create);
      assert.match(await screen.locator(".ev-screen-status").innerText(), /must be Public/);
      await tap(screen.locator(".ev-audience"));
      await sheetReady();
      await tap(page.locator(".ds-sheet.is-open").getByRole("radio", { name: /Public/ }));
      await page.locator(".ds-sheet").waitFor({ state: "detached" });
      // The made-it-yourself switch is required.
      await tap(create);
      assert.match(await screen.locator(".ev-screen-status").innerText(), /Confirm that you made this event post/, "confirmation required");
      const cert = screen.getByRole("switch", { name: /I made this event post/ });
      assert.equal(await cert.getAttribute("aria-invalid"), "true", "the switch is marked");
      await tap(cert);
      assert.equal(await cert.isChecked(), true);
      await shot("composer-ready", screen.locator(".ev-audience"));
      await tap(create);
      await page.locator(".ev-skin > .ev-status").filter({ hasText: "Your night is live." }).waitFor({ timeout: 15000 }).catch(async () => { throw new Error(`${width}px publish did not finish: ${await screen.locator(".ev-screen-status").textContent()} / posted ${posted.join(",")}`); });
      await screen.waitFor({ state: "hidden" });
      await shot("composer-published", page.locator(".ev-skin > .ev-status"));
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
    // Create event in Night (the phone's dark mode) and in Italian, at phone widths: the kit's tokens apply, every word
    // on the screen and in the Tickets sheet is translated, and nothing overflows. Screenshots for spec 39 step 2.
    fs.mkdirSync("docs/screenshots/launch", { recursive: true });
    for (const [width, dark, italian] of [[360, false, true], [390, true, false], [390, false, false], [360, true, false]]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block", colorScheme: dark ? "dark" : "light" });
      if (italian) await context.addInitScript(() => { try { localStorage.setItem("danzstak_language", "it"); } catch {} });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("https://api.danzstak.com/**", route => { const url = new URL(route.request().url()); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture(url.pathname, route.request().method())) }); });
      await page.goto(`${baseUrl}/feed.html?view=events`, { waitUntil: "load" });
      await page.locator(".ev-skin .ev-night").first().waitFor({ timeout: 20000 });
      await page.locator(".ev-add").tap();
      const screen = page.locator(".ev-creator-screen");
      await screen.waitFor({ state: "visible" });
      const colours = await screen.evaluate(node => [getComputedStyle(node.querySelector(".ds-form-screen__panel")).backgroundColor, getComputedStyle(node.querySelector(".ds-form-screen__title")).color]);
      assert.deepEqual(colours, dark ? ["rgb(21, 21, 23)", "rgb(237, 237, 234)"] : ["rgb(255, 255, 255)", "rgb(11, 11, 12)"], `${width}px ${dark ? "Night" : "Day"} tokens`);
      if (italian) {
        await page.waitForTimeout(300);
        assert.equal(await page.locator(".ds-form-screen__title").innerText(), "Crea evento");
        assert.equal(await screen.locator(".ev-publish").innerText(), "Crea evento");
        assert.match(await screen.locator(".ds-media-pick__empty").innerText(), /Aggiungi un flyer/);
        assert.match(await screen.locator(".ev-audience").innerText(), /Chi può vederlo\?/);
      }
      await page.screenshot({ path: `docs/screenshots/launch/event-create-${width}-${italian ? "it" : dark ? "night" : "day"}.png` });
      await screen.locator(".ev-tickets").tap();
      await page.locator(".ds-sheet.is-open").waitFor();
      await page.waitForTimeout(400);
      if (italian) assert.match(await page.locator(".ds-sheet.is-open").innerText(), /Vendi i biglietti su DanzStak[\s\S]*Biglietti nominativi[\s\S]*Fatto/, "the Tickets sheet is in Italian");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px no sideways scroll`);
      await page.screenshot({ path: `docs/screenshots/launch/event-create-tickets-${width}-${italian ? "it" : dark ? "night" : "day"}.png` });
      assert.equal(errors.length, 0, errors.join(" | "));
      await context.close();
    }
    console.log(`Events page browser checks passed at ${widths.join(", ")}px (+ Night and Italian at 360/390px): search, offline My tickets, max-5 tonight list, Create event on the UI kit (flyer, host, fields, Who can see it? and Tickets sheets, Back closes a sheet first, one green Create event), and the poster event page.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
