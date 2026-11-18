"use strict";
// Fix-it 18, Bazaar (owner 2026-11-17): "Two search boxes (top bar and body). Keep one." and "Empty state is three
// lines of text on a grey page. One line plus a '+ Sell something' action." Behaviour is covered in
// browser-checks/bazaar-one-search.cjs; this guards the contract so the second box or the long empty state can't return.
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("bazaar.html", "utf8");
const js = fs.readFileSync("assets/bazaar.js", "utf8");
const css = fs.readFileSync("assets/bazaar.css", "utf8");
const top = fs.readFileSync("assets/top-search.js", "utf8");
const music = fs.readFileSync("assets/i18n-music.js", "utf8");
const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));

// One search: no form or input in the page body; the shared top bar's search is the only one.
assert.doesNotMatch(main, /<form|<input|bazaar-search|bazaarQuery/, "the Bazaar body has no second search box");
assert.doesNotMatch(main, /bazaar-intro|market-eyebrow|Physical releases, art, gear/, "no intro block above the products");
assert.match(main, /<h1 id="bazaarTitle" class="sr-only">DanzStak Bazaar<\/h1>/, "the page keeps a heading for screen readers");
assert.match(main, /<p id="bazaarFilter" class="bazaar-filter" hidden><\/p>/, "an active search shows as a chip");
assert.match(html, /assets\/top-search\.js\?v=\d+/, "the shared top-bar search loads on the Bazaar");
assert.ok(html.indexOf("assets/bazaar.js") < html.indexOf("assets/top-search.js"), "bazaar.js listens before the top search mounts");

// The shared search lets a page add its own section; the Bazaar adds products above People.
assert.match(top, /dispatchEvent\(new CustomEvent\("danzstak:top-search", \{ detail: \{ dialog, input, close:/, "top-search.js announces its sheet");
assert.match(js, /addEventListener\("danzstak:top-search"/, "the Bazaar joins the shared search");
assert.match(js, /t\("Search the Bazaar or people"\)/, "the sheet says it finds both");
assert.match(js, /page\.products\.slice\(0, 4\)/, "at most four product rows in the sheet");
assert.match(js, /!query\.startsWith\("@"\)/, "@username stays a member search");
assert.match(js, /bazaar\.html\?q=\$\{encodeURIComponent/, "See all filters the page through ?q=");
assert.match(js, /history\.replaceState\(null, "", all\.href\)/, "See all replaces the sheet's history entry, so Back returns to the whole Bazaar");
assert.match(js, /addEventListener\("popstate"/, "Back re-reads ?q=");
assert.doesNotMatch(js, /stopImmediatePropagation/, "the top-bar search button is not hijacked");

// Empty state: one line and one action.
assert.match(js, /term \? "Nothing matches that search\." : "Nothing for sale yet\."/);
assert.match(js, /sell\.href = "store\.html\?manage=1"/, "+ Sell something opens My Shop");
assert.match(js, /node\("span", "Sell something"\)/);
assert.doesNotMatch(js, /The community is stocking its shops|No published products are available right now/, "the old three-line empty state is gone");
assert.match(css, /\.bazaar-sell\{[^}]*min-height:44px/, "Sell something is a 44px target");
assert.match(css, /\.bazaar-filter-clear\{[^}]*width:44px;height:44px/, "the chip's clear button is a 44px target");

// Translations for the new words.
for (const [lang, words] of Object.entries({
  it: ["Cerca nel Bazaar o persone", "Vedi tutto nel Bazaar", "Niente nel Bazaar corrisponde.", "Cancella ricerca", "Ancora niente in vendita.", "Vendi qualcosa"],
  fr: ["Chercher dans le Bazaar ou des personnes", "Tout voir dans le Bazaar", "Rien ne correspond dans le Bazaar.", "Effacer la recherche", "Rien à vendre pour l'instant.", "Vendre quelque chose"],
  es: ["Buscar en el Bazaar o personas", "Ver todo en el Bazaar", "Nada coincide en el Bazaar.", "Borrar búsqueda", "Todavía no hay nada a la venta.", "Vender algo"]
})) for (const word of words) assert.ok(music.includes(`"${word}"`), `${lang}: ${word}`);

console.log("Bazaar one-search checks passed: no body search box or intro, shared top-bar sheet with Bazaar rows, ?q= filter, one-line empty state with + Sell something, translations.");
