"use strict";
// Owner directive 2026-11-16: members choose their own name at signup (no "DanzStak member"),
// then are offered SYNC device registration; without it SYNC is text only.
const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const source = fs.readFileSync("assets/signup-onboarding.js", "utf8");
const context = { window: {}, document: { readyState: "loading", addEventListener() {} }, fetch: async () => ({ ok: false }), localStorage: { getItem() {}, setItem() {} } };
vm.createContext(context); vm.runInContext(source, context);
const { needsName, suggestHandle } = context.window.danzstakSignupOnboarding;
assert.equal(needsName({ isOwner: true, name: "DanzStak member", handle: "danzstak-member" }), true, "placeholder name must be replaced");
assert.equal(needsName({ isOwner: true, name: "Shawn", handle: "danzstak-member" }), true, "placeholder username must be replaced");
assert.equal(needsName({ isOwner: true, name: "Shawn", handle: "eroticon" }), false);
assert.equal(needsName({ isOwner: false, name: "DanzStak member" }), false, "never prompt on someone else's profile");
assert.equal(suggestHandle("Black Flag Fan #1"), "blackflagfan1");
assert.match(source, /addEventListener\("cancel", event => event\.preventDefault\(\)\)/, "the name step cannot be skipped");
assert.match(source, /Later — text only/, "members can skip device registration and keep texting");
assert.match(fs.readFileSync("assets/call-devices.js", "utf8"), /deviceParam=new URLSearchParams\(location\.search\)\.get\("device"\),wantsRegister=deviceParam==="register"\|\|deviceParam==="answer"[\s\S]*?if\(wantsRegister&&!state\.registered&&await\(window\.danzstakSyncApp\?\.afterInstall\?\.\(\)\?\?true\)&&!state\.registered\)openPanel\(\{auto:true,incoming:deviceParam==="answer"\}\)/, "Set up SYNC opens the SYNC device dialog (after the app step)");
// Owner 2026-11-19: sign-up tells members to save SYNC to their device and verify the number, in their own language.
assert.match(source, /"Save the SYNC app to your home screen" : "Save the SYNC app to this computer"\]\), "Verify your number with a text code"\]/, "both parts, app first");
const strings = ["Set up SYNC on this device", "Texting works right away. For calls, video calls and voice messages:", "Save the SYNC app to your home screen", "Save the SYNC app to this computer", "Verify your number with a text code", "Later — text only", "Set up SYNC"];
for (const key of strings) assert.ok(source.includes(JSON.stringify(key)), `the step shows "${key}"`);
const people = fs.readFileSync("assets/i18n-people.js", "utf8");
for (const key of strings) assert.equal(people.split(`${JSON.stringify(key)}:`).length - 1, 3, `"${key}" translated for it, fr and es`);
assert.doesNotMatch(source, />Register this device\?<|>Register now</, "no untranslated words in the SYNC step");
for (const page of ["feed.html", "profile.html", "messages.html"]) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /signup-onboarding\.js/, `${page} runs the onboarding check`);
  assert.match(html, /signup-onboarding\.css/, `${page} styles it without inline styles`);
}
for (const page of ["booking-selections.html", "messages.html"]) assert.match(fs.readFileSync(page, "utf8"), /purchase-terms\.css/, `${page} styles the purchase terms pop-up under a strict CSP`);
console.log("Signup onboarding checks passed: own name + username required, SYNC step offered (save the app, verify the number; text-only if skipped), styles survive strict CSP.");
