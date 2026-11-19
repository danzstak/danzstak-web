"use strict";
// The Bazaar mix (directive F15f, owner 2026-11-19: "these products should be jumbled up and switched around every time
// you come in… not the same shop in a row so it's a variety"). Used by the Bazaar page for real items and examples
// together; the Auth API carries the identical block (its package can't load files from assets/), and
// test-bazaar-scrambled.cjs fails if the two copies differ.
(root => {
// <scramble-by-seller>
function seededRandom(seed) {
  let h = 2166136261;
  for (const char of String(seed || "")) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
// Seeded shuffle, then deal the cards out shop by shop: each card goes to the shop with the most items left that is not
// one of the previous `gap` cards (2 = the card to its left and the one above it in the phone's 2-column grid), so a
// shop never sits next to itself while another shop still has items. Same seed, same order; never paid, never ranked.
function scrambleBySeller(items, seed, gap = 2) {
  const random = seededRandom(seed), shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) { const swap = Math.floor(random() * (index + 1)); [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]]; }
  const shopOf = item => String(item.memberId || item.shopName || "").trim().toLowerCase();
  const queues = new Map();
  for (const item of shuffled) { const key = shopOf(item); if (!queues.has(key)) queues.set(key, []); queues.get(key).push(item); }
  const order = [...queues.keys()], out = [];
  while (out.length < shuffled.length) {
    const recent = out.slice(-gap).map(shopOf), last = recent[recent.length - 1];
    let pick = null, pickRank = null;
    for (const key of order) {
      const left = queues.get(key).length;
      if (!left) continue;
      const rank = [key === last ? 2 : recent.includes(key) ? 1 : 0, -left];
      if (!pickRank || rank[0] < pickRank[0] || (rank[0] === pickRank[0] && rank[1] < pickRank[1])) { pick = key; pickRank = rank; }
    }
    out.push(queues.get(pick).shift());
  }
  return out;
}
// </scramble-by-seller>
  if (typeof module === "object" && module.exports) module.exports = { scrambleBySeller };
  else root.danzstakScrambleBySeller = scrambleBySeller;
})(globalThis);
