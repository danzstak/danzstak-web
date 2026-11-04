const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const page = fs.readFileSync("messages.html", "utf8");
const client = fs.readFileSync("assets/phone-verification.js", "utf8");
const css = fs.readFileSync("assets/phone-verification.css", "utf8");
const backend = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
const template = fs.readFileSync("infrastructure/engagement/template.yaml", "utf8");
const exportClient = fs.readFileSync("assets/account-export.js", "utf8");
const exportCore = fs.readFileSync("assets/account-export-core.js", "utf8");
const erasure = fs.readFileSync("infrastructure/auth-api/account-erasure.mjs", "utf8");

assert.match(page, /id="phoneVerificationOpen"[^>]+aria-label="Phone and verification"/, "Chat must have a discoverable phone-settings control");
assert.match(page, /id="phoneVerificationDialog"[^>]+aria-labelledby="phoneVerificationTitle"/, "phone settings must be an accessible dialog");
assert.match(page, /not required for Chat, Friends, signup, or calls inside DanzStak/, "the personal-number flow must remain optional");
assert.match(page, /works only inside DANZSTAK/, "the in-app DS alias must be distinguished from a personal phone");
assert.match(client, /\/phone-verification\/send/);
assert.match(client, /\/phone-verification\/confirm/);
assert.match(client, /method: "DELETE"/);
assert.match(client, /providerAvailable !== true/, "unavailable SMS must disable the send action");
assert.match(client, /No text will be sent/, "the disabled provider state must be honest");
assert.match(client, /numberForm\.requestSubmit\(\)/, "resend must reuse the still-visible in-memory number instead of making users retype it");
assert.doesNotMatch(client, /localStorage|sessionStorage/, "phone numbers and OTP codes must not enter browser storage");
assert.match(css, /min-height:44px/);
assert.match(css, /font-size:16px/, "phone inputs must avoid iPhone focus zoom");
assert.match(css, /safe-area-inset-(?:top|bottom)/);
assert.match(backend, /PHONE_VERIFICATION_ENABLED === "true"/, "real SMS must remain fail-closed behind an explicit server flag");
assert.match(backend, /SendNotifyTextMessageCommand/);
assert.match(template, /sms-voice:SendNotifyTextMessage/);
assert.doesNotMatch(template, /sms-voice:(?:CreateNotifyConfiguration|SetNotifyMessageSpendLimitOverride)/, "runtime IAM must not buy/configure SMS or change spend limits");
assert.match(exportClient, /phoneVerification: "\/phone-verification"/);
assert.match(exportCore, /phoneVerification:/);
assert.match(erasure, /ACCOUNT_TABLES\.phoneVerifications/);

const window = {};
const context = vm.createContext({ window });
vm.runInContext(fs.readFileSync("assets/languages.js", "utf8"), context);
vm.runInContext(fs.readFileSync("assets/brand-language-aliases.js", "utf8"), context);
for (const [language] of window.danzstakLanguages) {
  if (language === "en") continue;
  const dictionary = window.danzstakTranslations[language];
  for (const key of ["Phone and verification", "Phone & verification", "Send verification text", "Phone verified", "Verification texts are not enabled yet. No text will be sent."]) {
    assert.ok(dictionary[key] && dictionary[key] !== key, `${language} must translate ${key}`);
  }
}

console.log("Personal phone UI checks passed: visible optional flow, honest provider state, privacy boundaries, mobile geometry, translations, export, and erasure coverage.");
