"use strict";
// Task 14-D (owner 2026-11-17): the Events page is search + My tickets + a short tonight list, a flyer-first
// creator for promoters, and a poster-style public event page. Every new word has it/fr/es.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = file => fs.readFileSync(file, "utf8");
// Values from the vm sandbox have their own Array prototype; compare plain JSON copies.
const same = (actual, expected, message) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message);

const store = new Map();
const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) };
const sandbox = { window: {}, document: { documentElement: { lang: "en" } }, localStorage, console, URL };
vm.runInNewContext(read("assets/events-page.js"), sandbox);
const ev = sandbox.window.danzstakEvents;

// Prices and the buyer-paid fee shown to promoters.
assert.equal(ev.parsePrice("15"), 1500);
assert.equal(ev.parsePrice("$12.5"), 1250);
assert.equal(ev.parsePrice("abc"), null);
assert.equal(ev.buyerFees(1500), 190, "$15 ticket: 90c + $1");
assert.equal(ev.buyerFees(3000), 180, "$30 and up: no $1");

// Search: night, artist, venue or city.
const nights = [
  { id: "1", title: "Basement Frequencies", venueName: "The Pit", venueAddress: "Oakland, CA", description: "Ghost Rider\nDJ Tarmac", startsAt: "2027-02-06T06:00:00.000Z" },
  { id: "2", title: "Crust Sunday", venueName: "924 Gilman", venueAddress: "Berkeley, CA", description: "", startsAt: "2027-02-08T01:00:00.000Z" },
  { id: "3", title: "Doom Hall", venueName: "Elbo Room", venueAddress: "Oakland, CA", description: "", startsAt: "2027-03-01T04:00:00.000Z" }
];
same(ev.search(nights, "oakland").map(n => n.id), ["1", "3"], "city");
same(ev.search(nights, "gilman").map(n => n.id), ["2"], "venue");
same(ev.search(nights, "tarmac").map(n => n.id), ["1"], "artist from the lineup");
same(ev.search(nights, "doom oakland").map(n => n.id), ["3"], "every word must match");
same(ev.search(nights, "  "), [], "empty search shows nothing extra");

// Tonight & this weekend: max 5, never a feed.
const friday = new Date("2027-02-05T20:00:00");
const many = Array.from({ length: 9 }, (_, i) => ({ id: String(i), title: `Night ${i}`, startsAt: new Date(friday.getTime() + i * 3600000).toISOString() }));
let tonight = ev.tonightAndWeekend(many, friday);
assert.equal(tonight.soon, true);
assert.equal(tonight.list.length, 5, "at most five nights");
const later = [{ id: "x", title: "Far", startsAt: "2027-04-01T20:00:00.000Z" }];
tonight = ev.tonightAndWeekend(later, friday);
same([tonight.soon, tonight.list.length], [false, 1], "falls back to Coming up when nothing is on this weekend");
assert.equal(ev.tonightAndWeekend([{ id: "old", startsAt: "2026-01-01T00:00:00.000Z" }], friday).list.length, 0, "past nights are not listed");

// My tickets: saved on this device, readable offline, newest order wins, past nights drop off.
same([...ev.readTickets()], []);
const order = { orderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", eventId: "e1", title: "Basement Frequencies", startsAt: "2099-02-06T06:00:00.000Z", timezone: "America/Los_Angeles", venue: "The Pit, Oakland", tickets: [{ code: "ABCD-EFGH", name: "Ana Rossi", tier: "GA" }] };
ev.saveTickets(order);
ev.saveTickets({ ...order, tickets: [{ code: "ABCD-EFGH", name: "Ana Rossi", tier: "GA" }, { code: "JKMN-PQRS", name: "Luca Bianchi", tier: "GA" }] });
let saved = ev.readTickets();
assert.equal(saved.length, 1, "the same order is stored once");
same(saved[0].tickets.map(t => t.code), ["ABCD-EFGH", "JKMN-PQRS"]);
ev.saveTickets({ ...order, orderId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", startsAt: "2020-01-01T00:00:00.000Z" });
assert.equal(ev.readTickets().length, 1, "tickets for long-past nights are not shown");
ev.saveTickets({ orderId: "not-an-id", tickets: [{ code: "X" }] });
assert.equal(JSON.parse(store.get("danzstak_my_tickets_v1")).length, 2, "invalid orders are ignored");
assert.match(read("assets/event-tickets.js"), /window\.danzstakEvents\?\.saveTickets\(\{ orderId, eventId: event\.id/, "the order page saves tickets for offline use");

// Wiring.
const feed = read("feed.html"), eventPage = read("event.html"), worker = read("service-worker.js"), enhancements = read("assets/feed-enhancements.js");
assert.match(enhancements, /window\.danzstakEvents\.render\(workspace, \{ isCurrent: isCurrentWorkspace, postActionFetch \}\)/, "the Events workspace renders the new page");
assert.doesNotMatch(enhancements, /textContent = "Add Event"|renderUpcomingEvents/, "the old long form is gone");
for (const file of ["events-page.css", "events-page.js", "i18n-events.js"]) {
  assert.ok(feed.includes(`assets/${file}?v=`), `feed.html loads ${file}`);
  assert.ok(worker.includes(`"/assets/${file}"`), `the offline shell caches ${file}`);
}
assert.ok(feed.indexOf("assets/i18n-events.js") < feed.indexOf("assets/i18n.js?v="), "translations load before i18n.js");
assert.ok(eventPage.indexOf("assets/i18n-events.js") < eventPage.indexOf("assets/i18n.js?v="), "the public event page is translated");
assert.ok(eventPage.indexOf("assets/events-page.js") < eventPage.indexOf("assets/event-tickets.js"), "event page can save tickets");
assert.match(eventPage, /id="eventMap"[^>]*rel="noopener noreferrer"/, "venue map link opens safely");
assert.match(eventPage, /id="eventLineup"/);
const eventJs = read("assets/event.js");
assert.match(eventJs, /openstreetmap\.org\/search\?query=\$\{encodeURIComponent\(query\)\}/, "venue map link");
assert.match(eventJs, /"ticket-tier-tear"\); tear\.append\(text\("span", "Admit one"\)\)/, "ticket types are stubs");
assert.match(eventJs, /event details are temporarily unavailable/i);

// The creator: flyer first, one question at a time, More options, one orange Publish.
const page = read("assets/events-page.js");
for (const required of ['"Drop your flyer"', '"Sell tickets to your night"', '"Keep the full ticket price."', '"Buyers pay the 6% fee (+$1 under $30)."', '"QR + plain-text tickets."', '"Door list."', '"Named tickets against scalpers."', '"More options"', '"Publish event"', '"Night, artist, venue or city"', '"My tickets"', '"Tonight & this weekend"', '"Ticket delivery"', '"Add a ticket section"', '"Admit one"'])
  assert.ok(page.includes(required), `creator copy: ${required}`);
assert.equal((page.match(/className: "ev-primary ev-publish"/g) || []).length, 1, "one Publish button");
assert.match(page, /seconds > 0 && seconds <= 15\.5/, "videos must be 15 seconds or less");
assert.match(page, /MAX_TONIGHT = 5/, "short list, not a feed");

// Skin: EPK-builder tokens, square edges, 44px targets.
const css = read("assets/events-page.css");
for (const token of ["#0b0b0c", "#ededea", "#ff5a1f", "Archivo", "JetBrains Mono", "font-stretch:125%"]) assert.ok(css.includes(token), `skin token ${token}`);
assert.match(css, /\.ev-skin :is\(button,input,select,textarea,summary\)\{min-height:44px/, "44px touch targets");
assert.doesNotMatch(css, /border-radius:(?!0)[1-9]/, "square edges in the creator skin");

// Fix-it 18 (owner 2026-11-17): the composer is not printed on the Events page. A + next to search (and
// "Make your poster") opens it as its own screen; device Back closes it and keeps the draft; the date reads back
// in the member's language under the picker.
assert.match(page, /className: "ev-add"[\s\S]*?"aria-label", "Post an event"/, "+ button with an accessible name");
assert.match(page, /el\("form", \{ className: "ev-search", role: "search" \}, searchInput, addButton\)/, "+ sits beside search");
assert.match(page, /className: "ev-creator-screen", role: "dialog", hidden: true/, "the composer is its own screen, closed at first");
assert.match(page, /host\.append\(searchForm, results, myTickets, tonight, promo, yours, status, screen\)/, "no composer printed inline on the page");
assert.match(page, /danzstakEventCreator: true/, "opening the composer adds a history entry");
assert.match(page, /if \(!fromHistory && history\.state\?\.danzstakEventCreator === true\) \{ history\.back\(\); return true; \}/, "close goes back through history");
assert.doesNotMatch(page, /creatorHost\.replaceChildren\(\); creatorHost\.hidden = true/, "closing never throws the draft away");
assert.match(enhancements, /function restoreWorkspaceRoute\(\) \{\r?\n  \/\/ Back from the Events composer[^\n]*\r?\n  if \(globalThis\.danzstakEvents\?\.closeCreatorFromHistory\?\.\(\)\) return;/, "Back closes the composer before the Events page re-renders");
assert.match(page, /\[field\("Doors open", startsIn\), startsRead\]/, "the date reads back under the picker");
assert.match(css, /\.ev-add\{[^}]*width:44px;height:44px/, "44px + button");
assert.match(css, /\.ev-creator-screen\{position:fixed;inset:0;z-index:10050/, "full screen on phones");
assert.match(css, /\.ev-screen-close\{[^}]*width:44px;height:44px/, "44px close");
{
  // Behaviour: the Back hook only closes when the creator's history entry was popped.
  const hist = { state: null };
  const hb = { window: {}, document: { documentElement: { lang: "it" } }, localStorage, console, URL, history: hist };
  vm.runInNewContext(read("assets/events-page.js"), hb);
  assert.equal(hb.window.danzstakEvents.closeCreatorFromHistory(), false, "nothing open: route restore runs as before");
  const read1 = hb.window.danzstakEvents.longDate("2027-02-06T21:30");
  assert.match(read1, /2027/, "long date includes the year");
  assert.match(read1, /febbraio/i, "the date reads in the member's language (Italian)");
  assert.equal(hb.window.danzstakEvents.longDate(""), "", "no date, no line");
}

// Every new word has it/fr/es.
const tsandbox = { window: {} };
vm.runInNewContext(read("assets/i18n-events.js"), tsandbox);
const dict = tsandbox.window.danzstakTranslations;
const literals = new Set();
const collect = (source, re) => { for (const m of source.matchAll(re)) literals.add(m[1]); };
collect(page, /(?:textContent|placeholder|message|label|hint): "([^"$`{}]+)"/g);
collect(page, /"aria-label", "([^"]+)"/g);
collect(page, /el\("option", \{ value: v, textContent: l \}\)\)\)|\["(?:public|friends|private)", "([^"]+)"\]/g);
collect(page, /onStatus\("([^"]+)"\)/g);
collect(page, /status\.textContent = "([^"]+)"/g);
collect(page, /field\("([^"]+)"/g);
collect(eventJs, /text\("(?:p|span|h2)", "([^"$]+)"/g);
collect(eventJs, /status\.textContent = "([^"]+)"/g);
for (const extra of ["Doors", "Map", "Lineup", "Tickets", "DanzStak event", "Checking event details.", "Loading event…"]) literals.add(extra);
literals.delete(undefined);
for (const text of literals) {
  if (!/[A-Za-z]{2}/.test(text) || text === "https://" || text.includes("\\n")) continue; // numbers and URLs are not words
  for (const lang of ["it", "fr", "es"]) assert.ok(dict[lang]?.[text], `${lang} translation missing for "${text}"`);
}
assert.ok(literals.size > 80, `checked ${literals.size} strings`);
console.log(`Events page checks passed: search, tonight (max 5), offline My tickets, flyer-first creator, poster event page, EPK skin and it/fr/es for ${literals.size} strings.`);
