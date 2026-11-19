"use strict";
// Owner 2026-11-18: "All example until it goes live" — fill the Bazaar with the Eroticon items and model items,
// clearly labelled, so it looks like something is there; nothing can be bought until launch.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("assets/bazaar-examples.js", "utf8"), bazaar = fs.readFileSync("assets/bazaar.js", "utf8");
const css = fs.readFileSync("assets/bazaar.css", "utf8"), page = fs.readFileSync("bazaar.html", "utf8");
const context = { window: {} }; vm.createContext(context); vm.runInContext(source, context);
const examples = context.window.danzstakBazaarExamples;
assert.ok(examples.length >= 12, "enough examples to look like a real Bazaar");
assert.equal(context.window.danzstakBazaarExampleLimit, 24);
const ids = new Set();
for (const item of examples) {
  assert.equal(item.example, true);
  assert.match(item.id, /^example-[a-z0-9-]+$/, "example ids can never collide with real product ids");
  assert.ok(!ids.has(item.id)); ids.add(item.id);
  assert.ok(item.title && item.shopName && Number.isInteger(item.priceCents) && item.priceCents > 0);
  assert.match(item.imageUrl, /^assets\/shop\/(eroticon|examples)\/[a-z0-9-]+\.(jpg|svg)$/);
  assert.ok(fs.existsSync(item.imageUrl), `${item.imageUrl} exists`);
  assert.ok(Object.isFrozen(item));
}
assert.ok(examples.filter(item => item.shopName === "Eroticon").length >= 7, "every Eroticon photo is in the examples");
// Examples are never links, never buyable, labelled, after real items, gone during search and at 24 real items.
assert.match(bazaar, /const card = document\.createElement\("article"\); card\.className = "bazaar-card bazaar-example"/);
assert.doesNotMatch(bazaar.slice(bazaar.indexOf("function exampleCard"), bazaar.indexOf("function render")), /\.href|createElement\("(a|button)"\)|fetch\(/, "example cards have no link, button or request");
assert.match(bazaar, /return term \|\| realCount >= limit \? \[\] : scrambledExamples\(\)\.filter\(item => !realShops\.has\(item\.shopName\.toLowerCase\(\)\)\)\.slice\(0, Math\.max\(0, limit - realCount\)\);/, "a shop with real items is never shown as an example");
assert.match(bazaar, /if \(nextOffset === null\) for \(const product of examples\) list\.append\(exampleCard\(product\)\);/, "examples come after every real item");
assert.match(bazaar, /"Example · not for sale"/);
assert.match(bazaar, /nothing here is for sale yet/);
assert.match(css, /\.bazaar-example-tag\{[^}]*text-transform:uppercase/);
assert.match(css, /\.bazaar-example-price\{color:var\(--market-muted\)!important\}/);
assert.ok(page.indexOf("assets/bazaar-examples.js") > 0 && page.indexOf("assets/bazaar-examples.js") < page.indexOf("assets/bazaar.js"));
// The made-up example art names no real brands (checked by hand; keep the list fictional).
for (const file of fs.readdirSync("assets/shop/examples")) assert.doesNotMatch(fs.readFileSync(`assets/shop/examples/${file}`, "utf8"), /<script|href=/i, `${file} is plain artwork`);
console.log("Bazaar examples ok");
