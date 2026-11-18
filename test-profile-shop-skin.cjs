"use strict";
// Owner 2026-11-18: the profile Shop tab is the shop itself (header + 2-column product grid), no extra "Shop" button.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const js = fs.readFileSync("assets/profile-editor.js", "utf8"), css = fs.readFileSync("assets/profile-shop.css", "utf8"), html = fs.readFileSync("profile.html", "utf8"), worker = fs.readFileSync("service-worker.js", "utf8");
assert.match(js, /function renderProfileShop\(shop = \{\}, profile = \{\}\)/, "Shop tab renders the shop");
assert.match(js, /tabMessage\.replaceChildren\(renderProfileShop\(profileShop, profile\)\);/);
assert.match(js, /name !== "Shop"\) tabMessage\.prepend\(profileMoreNavigation\(name\)\)/, "no duplicate Shop button above the shop");
assert.match(js, /card\.href = `product\.html\?id=\$\{encodeURIComponent\(item\.id\)\}`/, "tap a product to open it");
assert.match(js, /filter\(item => own \|\| item\.available\)/, "visitors only see what is for sale");
assert.doesNotMatch(js, /Eroticon|Sleeping Dragon/, "no hard-coded shop data");
assert.match(css, /\.profile-shop-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/, "2-column grid on phones");
assert.match(css, /\.profile-shop-image\{[^}]*aspect-ratio:1/, "square product photos");
assert.match(css, /\.profile-add-bio--icon\{flex:0 0 auto!important;width:auto!important/, "+ bio keeps icon size");
assert.match(html, /assets\/profile-shop\.css\?v=\d+/);
assert.match(worker, /"\/assets\/profile-shop\.css"/, "cached offline");
console.log("Profile shop skin checks passed: shop header, square 2-column grid, product links, no extra button, + bio icon size.");
