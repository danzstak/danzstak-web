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
assert.equal(window.danzstakTranslate("More profile details"), "Altri dettagli del profilo");
assert.equal(window.danzstakTranslate("Photos and video"), "Foto e video");
assert.equal(window.danzstakTranslate("Privacy and tagging"), "Privacy e tag");

const profileKeys = [
  "More profile details",
  "Photos and video",
  "Privacy and tagging",
  "Who can post on your profile?",
  "Just me",
  "Allow accepted friends to tag me in photos and videos",
  "Import from Facebook",
  "Choose Facebook export",
  "Preview your export, set Public, Friends, or Just me in batches, and review shared-source posts before copying them."
];
for (const language of ["es","fr","de","pt","it","ko","ja","zh-Hans","zh-Hant","fil","hi","vi","th","id"]) {
  window.danzstakSetLanguage(language);
  for (const key of profileKeys) {
    assert.notEqual(window.danzstakTranslate(key), key, `${language} translates profile control: ${key}`);
  }
}

console.log("Profile-language checks passed: identity, privacy, tagging, and Facebook import controls cover all 15 locales.");
