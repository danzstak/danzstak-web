"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const i18n = fs.readFileSync("assets/i18n.js", "utf8");
const source = fs.readFileSync("assets/incoming-calls.js", "utf8");
const keysMatch = i18n.match(/const globalCallKeys=(\[[^;]+\]);/);
const guidancePattern = /const globalCallGuidance=(\{[\s\S]*?\r?\n \});\r?\n for\(const \[language,values\] of Object\.entries\(globalCallGuidance\)\)/;
const guidanceMatch = i18n.match(guidancePattern);

assert.ok(keysMatch && guidanceMatch, "global incoming-call translations should remain inspectable");
const tableContext = vm.createContext({ result: null });
vm.runInContext(`result={keys:${keysMatch[1]},guidance:${guidanceMatch[1]}}`, tableContext);
const { keys, guidance } = tableContext.result;
const languages = ["es", "fr", "de", "pt", "it", "ko", "ja", "zh-Hans", "zh-Hant", "fil", "hi", "vi", "th", "id"];

assert.equal(keys.length, 3, "caller fallback, incoming sentence, and decline recovery should be localized");
assert.deepEqual(Object.keys(guidance).sort(), [...languages].sort(), "every supported non-English locale needs global call translations");
for (const language of languages) {
  assert.equal(guidance[language].length, keys.length, `${language} should translate every global call state`);
  guidance[language].forEach((value, index) => {
    assert.ok(String(value).trim(), `${language} global call translation ${index + 1} cannot be blank`);
    assert.notEqual(value, keys[index], `${language} global call translation ${index + 1} cannot fall back to English`);
  });
}

const control = () => ({ hidden: true, disabled: false, handlers: {}, setAttribute() {}, focus() {}, addEventListener(name, fn) { this.handlers[name] = fn; } });
const popup = control();
const answer = control();
const decline = control();
const label = {};
popup.querySelector = selector => selector === "[data-answer]" ? answer : selector === "[data-decline]" ? decline : label;
const offer = { eventId: "offer-1", callId: "11111111-1111-4111-a111-111111111111", senderName: "Liana", senderEmail: "internal@example.com", mode: "phone", signalType: "offer" };
const translations = {
  "{name} is calling by {mode}.": "{name} chiama tramite {mode}.",
  phone: "telefono",
  "Could not decline the call. Please try again.": "Impossibile rifiutare la chiamata. Riprova."
};
let poll;
const context = vm.createContext({
  document: { hidden: false, documentElement: {}, activeElement: null, createElement: () => popup, body: { appendChild() {} }, addEventListener() {} },
  HTMLElement: class {},
  window: { danzstakTranslate: value => translations[value] || value, danzstakSyncDeviceRegistered: () => true, openMessageDrawer() {} },
  navigator: { vibrate() {} },
  location: { href: "https://danzstak.com/feed.html", assign() {} },
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  setInterval: fn => { poll = fn; },
  fetch: async () => ({ ok: true, json: async () => ({ events: [offer] }) })
});
vm.runInContext(source, context);

(async () => {
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(label.textContent, "Liana chiama tramite telefono.", "the visible incoming-call sentence should use the selected language");
  assert.doesNotMatch(label.textContent, /@/, "the incoming-call banner must not expose an account email");
  assert.match(source, /t\("Could not decline the call\. Please try again\."\)/, "decline failures should use localized recovery guidance");
  assert.match(source, /MutationObserver\(renderCurrentCall\)/, "changing languages should refresh an already-visible call");
  assert.equal(typeof poll, "function", "call polling should remain active");
  console.log("Global call localization checks passed: visible caller prompts, fallback identity, decline recovery, and language changes cover all supported locales.");
})().catch(error => { console.error(error); process.exitCode = 1; });
