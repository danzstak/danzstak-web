"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const window = { parent: null };
const document = {
  readyState: "complete",
  documentElement: { lang: "it", dir: "ltr" },
  body: { querySelectorAll: () => [] },
  querySelectorAll: () => [],
  createTreeWalker: () => ({ nextNode: () => null })
};
const context = vm.createContext({
  window,
  document,
  NodeFilter: { SHOW_TEXT: 4 },
  MutationObserver: class { observe() {} },
  localStorage: { getItem: () => "it", setItem() {} },
  navigator: { language: "it-IT", languages: ["it-IT", "it"] },
  addEventListener() {},
  queueMicrotask: callback => callback(),
  URL,
  location: { origin: "https://danzstak.com", href: "https://danzstak.com/profile.html" }
});

vm.runInContext(fs.readFileSync("assets/languages.js", "utf8"), context);
vm.runInContext(fs.readFileSync("assets/i18n.js", "utf8"), context);

assert.equal(window.danzstakTranslate("Edit Profile"), "Modifica profilo");
assert.equal(window.danzstakTranslate("Display name"), "Nome visualizzato");
assert.equal(window.danzstakTranslate("Username"), "Nome utente");
assert.equal(window.danzstakTranslate("Who can post on your profile?"), "Chi può pubblicare sul tuo profilo?");
assert.equal(window.danzstakTranslate("Just me"), "Solo io");
assert.equal(window.danzstakTranslate("Allow accepted friends to tag me in photos and videos"), "Consenti agli amici accettati di taggarmi in foto e video");
assert.equal(window.danzstakTranslate("Profile posting and tagging"), "Pubblicazione e tag sul profilo");
assert.equal(window.danzstakTranslate("Allow friends to tag me"), "Consenti agli amici di taggarmi");
assert.equal(window.danzstakTranslate("Edit your name, username, and profile"), "Modifica nome, nome utente e profilo");

console.log("Italian profile-language checks passed: identity, privacy, and tagging controls are understandable end to end.");
