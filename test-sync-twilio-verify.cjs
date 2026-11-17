"use strict";
// SYNC device verification through Twilio Verify (owner 2026-11-17). Twilio is mocked at the HTTP layer: no network.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const root = __dirname, load = file => import(pathToFileURL(path.join(root, "infrastructure/auth-api", file)));
  const tw = await load("personal-phone-twilio.mjs"), { createPersonalPhoneService } = await load("personal-phone-service.mjs"), verification = await load("personal-phone-verification.mjs");

  // ---- Locale: base code, kept regional tags, allowlist, "en" fallback ----
  const cases = [["it-IT", "it"], ["it", "it"], ["pt-BR", "pt-BR"], ["pt-PT", "pt"], ["zh-CN", "zh-CN"], ["zh-HK", "zh-HK"], ["zh-TW", "en"], ["en-GB", "en"], ["en-US", "en"], ["es-419", "es"], ["fr_CA", "fr"], ["de-DE", "de"], ["fil", "en"], ["xx-YY", "en"], ["<script>", "en"], ["", "en"], [undefined, "en"], ["ja-JP-u-ca-japanese", "ja"]];
  for (const [input, expected] of cases) assert.equal(tw.verifyLocale(input), expected, `locale ${input}`);
  assert.equal(tw.verifyLocale(["zh-TW", "it-IT", "en"]), "it", "the first allowed language in the phone's list wins");
  assert.equal(tw.verifyLocale(["klingon", "<x>", "pt-BR"]), "pt-BR");
  assert.equal(tw.verifyLocale(Array(50).fill("xx")), "en");
  for (const locale of tw.TWILIO_VERIFY_SMS_LOCALES) assert.match(locale, /^[a-z]{2}(?:-[A-Z]{2})?$/, `allowlist entry ${locale}`);
  assert.equal(tw.TWILIO_VERIFY_SMS_LOCALES.has("en-GB"), false, "en-GB is voice-only on Twilio Verify");
  assert.match(fs.readFileSync(path.join(root, "infrastructure/auth-api/personal-phone-twilio.mjs"), "utf8"), /https:\/\/www\.twilio\.com\/docs\/verify\/supported-languages/, "the allowlist cites its source");

  // ---- E.164 and masking ----
  assert.equal(verification.normalizeE164("+39", "333 123 4567"), "+393331234567");
  assert.equal(verification.normalizeE164("", "+1 (202) 555-0123"), "+12025550123");
  for (const bad of ["12345", "+0123456789", "+1234567890123456", "abc"]) assert.throws(() => verification.normalizeE164("", bad), /valid international mobile number/, bad);
  assert.equal(tw.isE164("+393331234567"), true); assert.equal(tw.isE164("393331234567"), false);
  const logged = tw.maskForLog("+393331234567");
  assert.match(logged, /67$/); assert.doesNotMatch(logged, /3331234/, "logs keep only the last 2 digits");
  assert.equal(tw.maskForLog("not a number"), "[invalid]");
  assert.equal(verification.maskPhone("+393331234567"), "•••• 4567", "the owner's private settings still show the last four");

  // ---- Error mapping ----
  const expectError = (code, status, key) => { const info = tw.twilioErrorInfo(code); assert.deepEqual([info.status, info.code], [status, key], `Twilio ${code}`); assert.ok(info.message.length > 10); };
  expectError(60200, 400, "invalid_number"); expectError(60203, 429, "max_send_attempts"); expectError(60410, 403, "fraud_blocked"); expectError(60605, 403, "geo_blocked"); expectError(20429, 429, "rate_limited");
  expectError(20404, 410, "expired"); expectError(60202, 429, "attempts"); expectError(99999, 503, "send_failed");

  // ---- Credentials only from env; never echoed ----
  const SID = "AC" + "a".repeat(32), SERVICE = "VA" + "b".repeat(32), KEY = "SK" + "c".repeat(32), SECRET = "s3cr3t-value-1234567", TOKEN = "t0ken-value-1234567";
  assert.deepEqual([...tw.twilioCredentialsFromEnv({}).missing], ["TWILIO_ACCOUNT_SID", "TWILIO_VERIFY_SERVICE_SID", "TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (or TWILIO_AUTH_TOKEN)"]);
  const withKey = tw.twilioCredentialsFromEnv({ TWILIO_ACCOUNT_SID: SID, TWILIO_VERIFY_SERVICE_SID: SERVICE, TWILIO_API_KEY_SID: KEY, TWILIO_API_KEY_SECRET: SECRET, TWILIO_AUTH_TOKEN: TOKEN });
  assert.deepEqual([withKey.ok, withKey.username, withKey.password], [true, KEY, SECRET], "an API key is preferred");
  const withToken = tw.twilioCredentialsFromEnv({ TWILIO_ACCOUNT_SID: SID, TWILIO_VERIFY_SERVICE_SID: SERVICE, TWILIO_AUTH_TOKEN: TOKEN });
  assert.deepEqual([withToken.ok, withToken.username, withToken.password], [true, SID, TOKEN], "Auth Token as the fallback");
  assert.doesNotMatch(JSON.stringify(tw.twilioCredentialsFromEnv({ TWILIO_ACCOUNT_SID: SID, TWILIO_API_KEY_SECRET: SECRET })), new RegExp(SECRET), "missing-settings report never contains values");

  // ---- Fake Twilio: records requests, answers like the Verify API ----
  const requests = [], logs = [];
  let twilio = { start: { status: 201, body: { sid: "VE" + "1".repeat(32), status: "pending" } }, check: { status: 200, body: { status: "approved", valid: true } } };
  const fetchImpl = async (url, options) => {
    const form = Object.fromEntries(new URLSearchParams(options.body));
    requests.push({ url, form, auth: options.headers.Authorization });
    const reply = url.endsWith("/Verifications") ? twilio.start : twilio.check;
    return { ok: reply.status < 300, status: reply.status, json: async () => reply.body };
  };
  const client = tw.createTwilioVerifyClient({ credentials: withKey, fetchImpl, log: (event, fields) => logs.push([event, JSON.stringify(fields)]) });
  const started = await client.start({ to: "+393331234567", locale: "it-IT" });
  assert.equal(started.verificationSid, "VE" + "1".repeat(32));
  assert.equal(requests[0].url, `https://verify.twilio.com/v2/Services/${SERVICE}/Verifications`);
  assert.deepEqual(requests[0].form, { To: "+393331234567", Channel: "sms", Locale: "it" }, "SMS only, in the phone's language");
  assert.equal(requests[0].auth, "Basic " + Buffer.from(`${KEY}:${SECRET}`).toString("base64"));
  // Approved only.
  for (const [status, valid, expected] of [["approved", true, true], ["pending", false, false], ["canceled", false, false], ["approved", false, false], ["max_attempts_reached", false, false]]) {
    twilio.check = { status: 200, body: { status, valid } };
    assert.equal((await client.check({ verificationSid: started.verificationSid, code: "123456" })).approved, expected, `status ${status}`);
  }
  assert.deepEqual(requests.at(-1).form, { VerificationSid: "VE" + "1".repeat(32), Code: "123456" }, "checked by SID, so the number is never needed again");
  twilio.start = { status: 400, body: { code: 60410, message: "Fraud" } };
  await assert.rejects(client.start({ to: "+393331234567", locale: "it" }), error => error.code === "fraud_blocked" && error.statusCode === 403);
  assert.ok(logs.length && logs.every(([, fields]) => !fields.includes("3331234") && !fields.includes(SECRET)), "logs never carry the number or the secret");

  // ---- Integration: service + verifier, send -> check, with an in-memory store ----
  // In-memory store that behaves like the DynamoDB adapter, including the atomic "one text per tap" condition.
  const store = new Map();
  let saved = null, failed = 0, checksAllowed = true;
  const keep = (userId, value) => { if (value) store.set(userId, value); else store.delete(userId); saved = value; };
  const adapter = {
    getByUser: async userId => store.get(userId) || null,
    reserveChallenge: async value => {
      const current = store.get(value.userId);
      if (current?.status === "pending" && Number(current.resendAfter) > Math.floor(clock / 1000)) return { accepted: false, rateLimited: true };
      keep(value.userId, { ...value }); return { accepted: true };
    },
    markSent: async value => keep(value.userId, { ...store.get(value.userId), verificationSid: value.verificationSid }),
    cancelChallenge: async value => keep(value.userId, null),
    cancelAfterWrongCode: async value => keep(value.userId, { ...store.get(value.userId), status: "canceled" }),
    recordFailedAttempt: async value => { failed++; keep(value.userId, { ...store.get(value.userId), attempts: (store.get(value.userId).attempts || 0) + 1 }); },
    markVerified: async (value, grant) => { keep(value.userId, { ...value, status: "verified", grant }); return true; },
    remove: async userId => keep(userId, null),
    limitCheck: async () => checksAllowed
  };
  let clock = Date.UTC(2026, 10, 17, 12, 0, 0);
  twilio = { start: { status: 201, body: { sid: "VE" + "2".repeat(32), status: "pending" } }, check: { status: 200, body: { status: "pending", valid: false } } };
  let idCount = 0;
  const service = createPersonalPhoneService({ adapter, secret: "a".repeat(64), enabled: true, verifier: client, now: () => clock, createId: () => `00000000-0000-4000-8000-${String(++idCount).padStart(12, "0")}` });
  const sends = () => requests.filter(r => r.url.endsWith("/Verifications")).length;
  const checks = () => requests.filter(r => r.url.endsWith("/VerificationCheck")).length;
  const cancels = () => requests.filter(r => /\/Verifications\/VE/.test(r.url)).length;
  const deviceChallengeId = "22222222-2222-4222-8222-222222222222", deviceChallenge = "a".repeat(43);
  requests.length = 0;
  const pending = await service.send({ userId: "member-1", countryCode: "+39", localNumber: "333 123 4567", purpose: "sync_device", deviceChallengeId, deviceChallenge, locale: "it" });
  assert.equal(pending.state, "pending"); assert.equal(pending.maskedNumber, "•••• 4567");
  assert.equal(saved.verificationSid, "VE" + "2".repeat(32), "only Twilio's verification SID is stored");
  assert.equal(JSON.stringify(saved).includes("393331234567"), false, "the number is never stored");
  assert.equal(requests.length, 1);
  // Wrong device: refused before Twilio is asked.
  await assert.rejects(service.confirm({ userId: "member-1", code: "123456", purpose: "sync_device", deviceChallengeId: "33333333-3333-4333-8333-333333333333", deviceChallenge }), error => error.code === "device_mismatch");
  await assert.rejects(service.confirm({ userId: "member-1", code: "123456", purpose: "account_trust" }), error => error.code === "purpose_mismatch");
  assert.equal(requests.length, 1, "device and purpose are checked before Twilio");
  // Rate limit on checks: refused before Twilio.
  checksAllowed = false;
  await assert.rejects(service.confirm({ userId: "member-1", code: "123456", purpose: "sync_device", deviceChallengeId, deviceChallenge }), error => error.code === "rate_limited" && error.statusCode === 429);
  assert.equal(requests.length, 1); checksAllowed = true;
  // ---- Rule 11: one SMS per tap, one resend after 60 s then 10 minutes, one wrong code, the code works once ----
  const deviceSend = (extra = {}) => service.send({ userId: "member-1", countryCode: "+39", localNumber: "333 123 4567", purpose: "sync_device", deviceChallengeId, deviceChallenge, locale: "it", ...extra });
  const deviceConfirm = code => service.confirm({ userId: "member-1", code, purpose: "sync_device", deviceChallengeId, deviceChallenge });
  // Duplicate tap: the second request inside the cooldown sends nothing.
  await assert.rejects(deviceSend(), error => error.code === "resend_cooldown" && error.statusCode === 429, "duplicate tap");
  assert.equal(sends(), 1, "one tap, one Twilio call");
  assert.ok(requests.every(r => !r.form.Channel || r.form.Channel === "sms"), "the channel is always sms, never voice");
  // Early resend (before 60 s): refused.
  clock += 59000;
  await assert.rejects(deviceSend(), error => error.code === "resend_cooldown", "early resend");
  assert.equal(sends(), 1);
  // Resend after 60 s: allowed once.
  clock += 2000;
  await deviceSend();
  assert.equal(sends(), 2, "one resend after the cooldown");
  // A second resend within 10 minutes of the first text: refused (tracked per number and per device).
  clock += 61000;
  await assert.rejects(deviceSend(), error => error.code === "resend_window" && /10 minutes/.test(error.message), "only one resend");
  await assert.rejects(service.send({ userId: "member-1", countryCode: "+39", localNumber: "333 999 0000", purpose: "sync_device", deviceChallengeId, deviceChallenge }), error => error.code === "resend_window", "a different number on the same device still waits");
  assert.equal(sends(), 2);
  // One wrong code: the challenge is cancelled here and at Twilio; the member must request a new code.
  await assert.rejects(deviceConfirm("111111"), error => error.code === "invalid" && /Request a new code/.test(error.message));
  assert.equal(failed, 1); assert.equal(checks(), 1); assert.equal(cancels(), 1, "the Twilio verification is cancelled after one wrong code");
  assert.deepEqual(requests.at(-1).form, { Status: "canceled" });
  assert.equal(saved.status, "canceled");
  // Second wrong code (or even the right one) on that cancelled challenge: refused without asking Twilio.
  twilio.check = { status: 200, body: { status: "approved", valid: true } };
  await assert.rejects(deviceConfirm("222222"), error => error.code === "used", "second wrong code");
  await assert.rejects(deviceConfirm("123456"), error => error.code === "used", "a cancelled code can't be approved later");
  assert.equal(checks(), 1, "no Twilio check after the cancellation");
  // After 10 minutes from the first text, a new code can be requested; the right code verifies the device once.
  clock += 10 * 60000;
  await deviceSend();
  const done = await deviceConfirm("123456");
  assert.match(done.deviceGrantId, /^[a-f0-9-]{36}$/); assert.match(done.deviceGrantToken, /^[A-Za-z0-9_-]{43}$/); assert.equal(saved.status, "verified");
  // Reuse of an approved code: refused locally, never sent to Twilio again.
  const checksBefore = checks();
  await assert.rejects(deviceConfirm("123456"), error => error.code === "used", "reuse of an approved code");
  assert.equal(checks(), checksBefore);
  // Expired at Twilio (20404) -> "expired".
  await service.send({ userId: "member-2", countryCode: "+1", localNumber: "202 555 0123", locale: "en" });
  twilio.check = { status: 404, body: { code: 20404 } };
  await assert.rejects(service.confirm({ userId: "member-2", code: "123456" }), error => error.code === "expired");
  // Twilio refuses the send -> mapped error, challenge cancelled, nothing verified.
  twilio.start = { status: 400, body: { code: 60605 } };
  await assert.rejects(service.send({ userId: "member-3", countryCode: "+1", localNumber: "202 555 0199" }), error => error.code === "geo_blocked");
  assert.equal(saved, null, "a refused send leaves no pending challenge");
  // Off without credentials or when disabled: nothing is sent.
  const off = createPersonalPhoneService({ adapter, secret: "a".repeat(64), enabled: false, verifier: client });
  const before = requests.length;
  await assert.rejects(off.send({ userId: "member-4", countryCode: "+1", localNumber: "2025550123" }), error => error.code === "provider_unavailable");
  assert.equal(requests.length, before, "fail-closed: no Twilio call");

  // ---- The DynamoDB adapter enforces the same rules atomically ----
  const dynamo = fs.readFileSync(path.join(root, "infrastructure/auth-api/personal-phone-dynamodb.mjs"), "utf8");
  assert.match(dynamo, /ConditionExpression:"attribute_not_exists\(recordKey\) OR #status <> :pending OR resendAfter <= :nowSeconds"/, "two taps can't both send: the second fails inside the transaction");
  assert.match(dynamo, /RATE#PHONE10#\$\{record\.phoneHash\}#\$\{tenMinutes\}`,2,/, "a text and one resend per 10 minutes per number");
  assert.match(dynamo, /RATE#DEVICE10#\$\{record\.deviceChallengeHash\}#\$\{tenMinutes\}`,2,/, "and per device");
  assert.match(dynamo, /UpdateExpression:"SET #status = :canceled, canceledAt = :at"/, "a wrong code marks the challenge canceled");
  assert.doesNotMatch(fs.readFileSync(path.join(root, "infrastructure/auth-api/personal-phone-twilio.mjs"), "utf8"), /Channel: "(?:call|voice|whatsapp|email)"/i, "no voice or other channel fallback");

  // ---- Wiring ----
  const api = fs.readFileSync(path.join(root, "infrastructure/auth-api/index.mjs"), "utf8");
  assert.match(api, /const otpProvider = String\(process\.env\.OTP_PROVIDER \|\| "twilio"\)\.toLowerCase\(\) === "aws" \? "aws" : "twilio";/, "OTP_PROVIDER switch, default twilio");
  assert.match(api, /\? twilioCredentials\.ok/, "Twilio texts are on only with complete credentials (fail-closed)");
  assert.match(api, /SendNotifyTextMessageCommand/, "AWS Notify stays behind the switch");
  assert.match(api, /const locale = verifyLocale\(/, "the server allowlists the phone's language");
  assert.doesNotMatch(api, /console\.(?:log|warn|error)\([^)]*(?:number|localNumber|TWILIO_AUTH_TOKEN|TWILIO_API_KEY_SECRET)/, "no number or secret in logs");
  const client2 = fs.readFileSync(path.join(root, "assets/phone-verification.js"), "utf8");
  assert.match(client2, /languages:phoneLanguages\(\)/, "the PWA sends navigator.languages with Text me a code");
  for (const key of ["invalid_number", "max_send_attempts", "fraud_blocked", "geo_blocked", "rate_limited"]) assert.match(client2, new RegExp(`${key}: "`), `client message for ${key}`);
  const sync = { window: {} };
  require("node:vm").runInNewContext(fs.readFileSync(path.join(root, "assets/i18n-sync.js"), "utf8"), sync);
  for (const lang of ["it", "fr", "es", "de", "pt"]) for (const text of ["SYNC can't send verification texts to this country yet.", "That code is incorrect. Request a new code.", "You can resend once. Try again in 10 minutes."]) assert.ok(sync.window.danzstakTranslations[lang][text], `${lang}: ${text}`);
  const html = fs.readFileSync(path.join(root, "messages.html"), "utf8");
  assert.ok(html.indexOf("assets/i18n-sync.js") < html.indexOf("assets/i18n.js?v="), "SYNC messages load before i18n.js");
  const all = [api, fs.readFileSync(path.join(root, "infrastructure/auth-api/personal-phone-twilio.mjs"), "utf8"), client2].join("\n");
  assert.doesNotMatch(all, /AC[0-9a-f]{32}|VA[0-9a-f]{32}|SK[0-9a-f]{32}/i, "no Twilio SIDs or keys in the repo");
  console.log("SYNC Twilio Verify checks passed: locale allowlist + en fallback, E.164, 2-digit log masking, error mapping, approved-only, credentials only from env, send -> check with device/purpose/rate checks before Twilio, only the VE SID stored, fail-closed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
