"use strict";
// Owner 2026-11-16: Booking, EPK, Record Stores, Bazaar and Shop speak the visitor's language.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const read = file => fs.readFileSync(`${__dirname}/${file}`, "utf8");
const documentElement = { lang: "en", dir: "ltr" };
const context = { console, queueMicrotask, localStorage: { getItem: () => "", setItem() {} }, navigator: { language: "en", languages: ["en"] }, addEventListener() {}, document: { documentElement, readyState: "loading", addEventListener() {}, body: null } };
context.window = context;
vm.createContext(context);
for (const file of ["assets/languages.js", "assets/i18n-music.js", "assets/i18n.js"]) vm.runInContext(read(file), context, { filename: file });
const say = (lang, text) => { documentElement.lang = lang; return context.danzstakTranslate(text); };
assert.equal(say("it", "Where do you want to play?"), "Dove vuoi suonare?");
assert.equal(say("fr", "Where do you want to play?"), "Où veux-tu jouer ?");
assert.equal(say("es", "Where do you want to play?"), "¿Dónde quieres tocar?");
assert.equal(say("fr", "Publish EPK"), "Publier l'EPK");
assert.equal(say("it", "Search the Bazaar"), "Cerca nel Bazaar");
assert.equal(say("fr", "Salt Lake City → Detroit (one way)"), "Salt Lake City → Detroit (aller simple)");
assert.equal(say("it", "10-day target calendar · 8 proposed shows"), "Calendario di 10 giorni · 8 concerti proposti");
assert.equal(say("es", "Host first · backup Motel 6"), "Primero un anfitrión · reserva Motel 6");
assert.equal(say("it", "Travel / rest"), "Viaggio / riposo");
assert.equal(say("en", "Where do you want to play?"), "Where do you want to play?");
// Every page in this area loads the translations.
for (const page of ["booking.html", "epk.html", "bazaar.html", "store.html", "record-stores.html", "booking-reply.html", "booking-opt-out.html", "booking-selections.html"]) {
  const html = read(page);
  for (const script of ["assets/languages.js", "assets/i18n-music.js", "assets/i18n.js"]) assert.ok(html.includes(script), `${page} must load ${script}`);
  assert.ok(html.indexOf("assets/i18n-music.js") < html.indexOf("assets/i18n.js"), `${page} loads music translations before i18n.js`);
}
console.log("Music-tool translations checks passed.");
