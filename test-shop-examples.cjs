"use strict";
// Task 22 (owner 2026-11-18): example shops (fan, band, record shop) that show members how to build theirs.
// The examples are front-end only, so they can never reach /marketplace/bazaar, search or Mix, and nothing is for sale.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const script = fs.readFileSync("assets/shop-example.js", "utf8"), page = fs.readFileSync("shop-example.html", "utf8");
const code = script.split("\n").filter(line => !line.trim().startsWith("//")).join("\n");

// Never talks to the server: no fetch, beacon, socket or API host, so no example reaches the Bazaar or Mix.
assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|api\.danzstak\.com|\/marketplace/, "examples stay in the page");
assert.match(page, /<meta name="robots" content="noindex">/, "not indexed");
assert.doesNotMatch(fs.readFileSync("sitemap.xml", "utf8"), /shop-example/, "not in the sitemap");

// Nothing can be bought: every card has the disabled "Example — not for sale" button and an EXAMPLE tag; no product links.
assert.match(code, /node\("button", "Example — not for sale", "example-buy"\)/);
assert.match(code, /buy\.disabled = true/);
assert.match(code, /node\("span", "Example", "example-tag"\)/);
assert.doesNotMatch(code, /product\.html|checkout/i, "no product page or checkout links");

// Run the data part in a sandbox to check the three shops, the all-in prices and the Discogs walkthrough.
const elements = new Map();
const fakeElement = () => ({ children: [], dataset: {}, style: {}, setAttribute() {}, append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; }, addEventListener() {}, focus() {}, set innerHTML(value) { this.html = value; }, get innerHTML() { return this.html || ""; } });
const tabs = ["fan", "band", "record"].map(shop => ({ ...fakeElement(), dataset: { shop } }));
const context = {
  console, URL, URLSearchParams, Intl, history: { replaceState() {} },
  location: { href: "https://danzstak.com/shop-example.html?shop=record", search: "?shop=record" },
  document: { title: "", activeElement: null, getElementById: id => elements.get(id) || elements.set(id, fakeElement()).get(id), querySelectorAll: () => tabs, createElement: () => fakeElement() },
  window: {}
};
vm.runInNewContext(script, context);
const { shops, allIn } = context.window.DanzStakShopExamples;
assert.deepEqual(Object.keys(shops), ["fan", "band", "record"], "fan shop, band shop and record shop");
assert.equal(allIn(500), 630, "the owner's example: $5 + fees = $6.30");
assert.equal(allIn(8500), 9010, "no $1 order fee at $30 and over");
const items = shop => shop.sections.flatMap(section => section.items);
for (const [key, shop] of Object.entries(shops)) {
  assert.ok(items(shop).length >= 5, `${key} shop shows a real-looking range`);
  for (const item of items(shop)) {
    assert.ok(item.price >= 50 && item.shipping <= item.price, `${key}: ${item.title} has a sane price and shipping`);
    assert.ok(item.art && typeof item.art.kind === "string", `${key}: ${item.title} has original artwork`);
  }
  assert.ok(shop.why.length >= 2, `${key} has guide notes`);
}
assert.ok(items(shops.fan).some(item => item.stock === 1 && (item.badges || []).includes("1 of 1")), "fan shop: one-of-a-kind stock");
assert.ok(items(shops.band).some(item => item.soldOut), "band shop: a tour-only item marked sold out");
assert.ok(items(shops.band).some(item => (item.badges || []).some(badge => /^Pre-order · ships /.test(badge))), "band shop: a pre-order with a ship date");
assert.ok(items(shops.band).some(item => /^Bundle/.test(item.title)), "band shop: an LP + shirt bundle");
assert.equal(shops.band.extras, "Every order comes with free stickers.", "the free-extras line");
assert.ok(items(shops.record).every(item => Array.isArray(item.grade) && item.grade.length === 2), "record shop: Media/Sleeve grades on every record");
assert.ok(items(shops.record).every(item => / – .+\(.+\)$/.test(item.title)), "record shop titles: Artist – Title (Format, Label Cat#)");
assert.ok(items(shops.record).some(item => item.price > 3000 && /Box Set/.test(item.title)), "record shop: a box set over $30");
assert.equal(shops.record.discogs, true, "record shop leads with the Discogs import");
assert.match(code, /\["moving", "Moving Day"[\s\S]*\["pick", "Pick"[\s\S]*\["price", "Price"[\s\S]*\["publish", "Publish"/, "walkthrough: Dashboard → Inventory → Export → CSV → Moving Day → pick → price → publish");
assert.match(code, /start\.href = "moving-day\.html\?source=discogs"/, "Start Moving Day");
assert.match(code, /Export your collection instead[\s\S]*set one for all picked items, or row by row/, "explains inventory vs collection export");

// The way back: Start my shop, plus links in from My Shop and Moving Day; cached for offline.
assert.match(page, /<a class="example-primary" href="store\.html\?manage=1">Start my shop<\/a>/);
// One tab bar everywhere (release trains c-f): the example page uses the shared bar with Bazaar lit, and its go button is green.
assert.match(page, /<nav class="ds-mobile-nav" aria-label="DanzStak mobile navigation"><\/nav>/, "the shared tab bar fills the nav");
assert.match(page, /assets\/app-tabs\.js\?v=\d+/); assert.doesNotMatch(page, /data-icon="store"/, "no hand-written tab bar");
assert.match(fs.readFileSync("assets/app-tabs.js", "utf8"), /"shop-example\.html": "bazaar"/, "Bazaar is the lit tab");
assert.match(fs.readFileSync("assets/shop-example.css", "utf8"), /\.example-primary\{[^}]*background:var\(--ds-btn-go,#15803d\)/, "go buttons are green (owner 2026-11-19)");
assert.match(fs.readFileSync("store.html", "utf8"), /href="shop-example\.html">See example shops/);
assert.match(fs.readFileSync("moving-day.html", "utf8"), /href="shop-example\.html\?shop=record"/);
const sw = fs.readFileSync("service-worker.js", "utf8");
for (const file of ["/shop-example.html", "/assets/shop-example.js", "/assets/shop-example.css"]) assert.ok(sw.includes(`"${file}"`), `${file} is in the offline shell`);
console.log("example shops: ok");
