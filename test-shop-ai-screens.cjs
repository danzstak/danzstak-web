"use strict";
// "Draft it with AI" in My Shop (task 19, queue 5b2): contract checks. Real browser: browser-checks/shop-ai.cjs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const html = fs.readFileSync("store.html", "utf8"), js = fs.readFileSync("assets/shop-ai.js", "utf8"), sw = fs.readFileSync("service-worker.js", "utf8"), music = fs.readFileSync("assets/i18n-music.js", "utf8");
assert.ok(html.indexOf("assets/store.js?v=") < html.indexOf("assets/shop-ai.js?v="), "loads after the store script");
assert.match(html, /assets\/epk-ai\.css\?v=\d+/); assert.match(html, /assets\/buttons\.css\?v=\d+/);
assert.ok(sw.includes('"/assets/shop-ai.js"'));
assert.match(js, /get\("manage"\) !== "1"\) return;/, "only on My Shop");
// One row on each form; price until bought, then "N left" on listings; coming soon without the key.
assert.match(js, /row\("shopAiSetup", byId\("shopForm"\), "setup"\); row\("shopAiListing", byId\("productForm"\), "listing"\)/);
assert.match(js, /!state\.owned \? money\(state\.totalCents\) : id === "shopAiListing" \? `\$\{state\.listingsLeft\} \$\{t\("left"\)\}` : ""/);
assert.ok(js.includes('"AI coming soon"'));
// Purchase: Stripe Checkout only, kind=shop, refund rule + disclaimer.
assert.match(js, /post\("\/tour-manager\/ai-epk\/checkout", \{ kind: "shop" \}\)/);
assert.ok(js.includes(String.raw`/^https:\/\/checkout\.stripe\.com\//.test(res.data.checkoutUrl`));
assert.ok(js.includes("No refund once a draft is made.") && js.includes("state.disclaimer"));
// Photos: shrunk to JPEG in the browser without blob: URLs (the page CSP allows data: and https: only); the
// notice says DanzStak doesn't keep it and it never trains AI.
assert.match(js, /createImageBitmap\(file\)/); assert.doesNotMatch(js, /createObjectURL/);
assert.match(js, /toDataURL\("image\/jpeg", 0\.82\)/);
assert.ok(js.includes("DanzStak doesn't keep it, and it's never used to train AI."));
// Drafts fill the forms; the seller sets the price and saves (no shop or product saves here).
assert.doesNotMatch(js, /\/marketplace\/(shop|products)/, "this script never saves the shop or a product");
assert.match(js, /fill\(\{ productTitle: d\.title, productDescription: condition \+ d\.description \}/);
assert.match(js, /history\.pushState\(\{ shopAiSheet: true \}, ""\)/);
for (const word of ["Fai la bozza con l'AI", "Brouillon avec l'IA", "Borrador con IA", "Negozio AI", "Boutique IA", "Tienda con IA"]) assert.ok(music.includes(word), word);
console.log("AI shop screen checks passed: My Shop only, two rows, price until bought then N left, coming soon, Stripe-only kind=shop, refund rule + disclaimer, CSP-safe photo shrink to JPEG, fill without saving, Back, it/fr/es.");
