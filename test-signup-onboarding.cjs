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
assert.match(fs.readFileSync("assets/call-devices.js", "utf8"), /wantsRegister=new URLSearchParams\(location\.search\)\.get\("device"\)==="register"[\s\S]*?if\(wantsRegister&&!state\.registered\)openPanel\(\{auto:true\}\)/, "Register now opens the SYNC device dialog");
for (const page of ["feed.html", "profile.html", "messages.html"]) {
  const html = fs.readFileSync(page, "utf8");
  assert.match(html, /signup-onboarding\.js/, `${page} runs the onboarding check`);
  assert.match(html, /signup-onboarding\.css/, `${page} styles it without inline styles`);
}
for (const page of ["booking-selections.html", "messages.html"]) assert.match(fs.readFileSync(page, "utf8"), /purchase-terms\.css/, `${page} styles the purchase terms pop-up under a strict CSP`);
console.log("Signup onboarding checks passed: own name + username required, device registration offered (text-only if skipped), styles survive strict CSP.");
