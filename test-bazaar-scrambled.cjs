"use strict";
// Owner 2026-11-19: "the bazaar needs to have items mixed up from users, not just one user's items then another user's
// items; it needs to be scrambled". Server pages are a seeded scramble dealt out shop by shop; the browser sends one
// seed per visit and mixes examples and each page the same way.
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const { scrambleBySeller } = await import("./infrastructure/auth-api/marketplace.mjs");
  const items = [];
  for (const [seller, count] of [["A", 8], ["B", 4], ["C", 4], ["D", 2]]) for (let i = 0; i < count; i++) items.push({ memberId: seller, id: `${seller}${i}` });
  const out = scrambleBySeller(items, "visit1");
  assert.equal(out.length, items.length, "no item lost or duplicated");
  assert.deepEqual([...out].map(item => item.id).sort(), items.map(item => item.id).sort());
  // While several shops still have items, no shop appears twice in a row.
  const firstRound = out.slice(0, 12).map(item => item.memberId);
  for (let i = 1; i < firstRound.length; i++) assert.notEqual(firstRound[i], firstRound[i - 1], `shops alternate: ${firstRound.join("")}`);
  // F15f: the owner's case, one real shop of 5 items plus example shops: in the phone's 2-column grid no card shares a
  // shop with the card to its left or the one above it, for every visit's seed.
  const owner = [];
  for (const [seller, count] of [["eroticon", 5], ["Static Ward", 3], ["Night Tram Records", 3], ["Basement Dispatch", 3], ["Grave Orbit", 3]]) for (let i = 0; i < count; i++) owner.push(seller === "eroticon" ? { memberId: "m-eroticon", id: `e${i}` } : { shopName: seller, id: `${seller}${i}` });
  for (const seed of ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"]) {
    const shops = scrambleBySeller(owner, seed).map(item => item.memberId || item.shopName);
    for (let i = 1; i < shops.length; i++) {
      if (i % 2) assert.notEqual(shops[i], shops[i - 1], `seed ${seed}: card ${i} repeats the shop to its left: ${shops.join(", ")}`);
      if (i >= 2) assert.notEqual(shops[i], shops[i - 2], `seed ${seed}: card ${i} repeats the shop above it: ${shops.join(", ")}`);
    }
  }
  // One function for the browser and the server: the Auth API package carries an identical copy.
  const block = text => text.slice(text.indexOf("// <scramble-by-seller>"), text.indexOf("// </scramble-by-seller>"));
  const shared = fs.readFileSync("assets/scramble-by-seller.js", "utf8");
  assert.ok(block(shared).length > 500, "the shared block exists");
  assert.equal(block(fs.readFileSync("infrastructure/auth-api/marketplace.mjs", "utf8")), block(shared), "the server's scrambleBySeller is identical to assets/scramble-by-seller.js");
  assert.deepEqual(require("./assets/scramble-by-seller.js").scrambleBySeller(owner, "a1").map(item => item.id), scrambleBySeller(owner, "a1").map(item => item.id), "browser and server give the same order for the same seed");
  assert.deepEqual(scrambleBySeller(items, "visit1").map(item => item.id), out.map(item => item.id), "same seed, same order (Show more stays consistent)");
  const others = ["visit2", "visit3", "visit4"].map(seed => scrambleBySeller(items, seed).map(item => item.id).join());
  assert.ok(others.some(order => order !== out.map(item => item.id).join()), "a new visit gets a new mix");
  const market = fs.readFileSync("infrastructure/auth-api/marketplace.mjs", "utf8"), page = fs.readFileSync("assets/bazaar.js", "utf8");
  assert.match(market, /if \(!term\) all = scrambleBySeller\(all, seed \|\|/, "the server scrambles every unsearched Bazaar page");
  assert.match(page, /&seed=\$\{seed\}&q=/, "the browser sends one seed per visit");
  assert.match(page, /scrambledExamples\(\)\.filter/, "examples are mixed too");
  assert.match(page, /scramble\(\[\.\.\.real, \.\.\.examples\.map\(example => \(\{ \.\.\.example, example: true \}\)\)\]\)/, "real items and examples are one mix (F15f)");
  assert.match(page, /const scramble = items => window\.danzstakScrambleBySeller\(items, seed\);/, "the page uses the shared function");
  assert.match(page, /catalog = search\.value\.trim\(\) \? products : scramble\(products\)/, "each page is mixed in the browser as well");
  console.log("Bazaar scramble checks passed: shops alternate, never left of or above the same shop in the 2-column grid, nothing lost, stable per visit, new mix each visit, browser and server identical.");
})().catch(error => { console.error(error); process.exit(1); });
