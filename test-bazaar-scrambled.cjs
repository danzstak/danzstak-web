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
  assert.deepEqual(scrambleBySeller(items, "visit1").map(item => item.id), out.map(item => item.id), "same seed, same order (Show more stays consistent)");
  const others = ["visit2", "visit3", "visit4"].map(seed => scrambleBySeller(items, seed).map(item => item.id).join());
  assert.ok(others.some(order => order !== out.map(item => item.id).join()), "a new visit gets a new mix");
  const market = fs.readFileSync("infrastructure/auth-api/marketplace.mjs", "utf8"), page = fs.readFileSync("assets/bazaar.js", "utf8");
  assert.match(market, /if \(!term\) all = scrambleBySeller\(all, seed \|\|/, "the server scrambles every unsearched Bazaar page");
  assert.match(page, /&seed=\$\{seed\}&q=/, "the browser sends one seed per visit");
  assert.match(page, /scrambledExamples\(\)\.filter/, "examples are mixed too");
  assert.match(page, /catalog = search\.value\.trim\(\) \? products : scramble\(products\)/, "each page is mixed in the browser as well");
  console.log("Bazaar scramble checks passed: shops alternate, nothing lost, stable per visit, new mix each visit.");
})().catch(error => { console.error(error); process.exit(1); });
