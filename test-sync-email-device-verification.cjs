"use strict";
// SYNC device registration by email code: bound to the device challenge, single use,
// rate limited, fail-closed when switched off, and never touches phone records.
const assert = require("node:assert/strict"), fs = require("node:fs");

(async () => {
  const { createEmailDeviceVerification, maskEmail } = await import("./infrastructure/auth-api/email-device-verification.mjs");
  const challengeId = "11111111-1111-4111-8111-111111111111", challenge = "a".repeat(43);
  function fakeAdapter() {
    const store = { record: null, grants: [], reserves: 0 };
    return { store,
      async get() { return store.record ? { ...store.record } : null; },
      async reserve(record) { if (++store.reserves > 3) return false; store.record = { ...record, status: "pending", attempts: 0 }; return true; },
      async cancel() { store.record = null; },
      async failedAttempt() { store.record.attempts++; },
      async consume(record, grant) { if (!store.record || store.record.challengeId !== record.challengeId) return false; store.record = null; store.grants.push(grant); return true; } };
  }
  let clock = 1_800_000_000_000; const now = () => clock;
  const sent = [];
  const make = (adapter, enabled = true, sender = { async send(m) { sent.push(m); } }) => createEmailDeviceVerification({ adapter, sender, secret: "s".repeat(64), enabled, now, createCode: () => "123456" });

  // Off by default: no email, clear message.
  await assert.rejects(make(fakeAdapter(), false).send({ userId: "u1", email: "a@b.com", deviceChallengeId: challengeId, deviceChallenge: challenge }), e => e.code === "provider_unavailable" && /No email was sent/.test(e.message));
  assert.equal(sent.length, 0);

  // Happy path: email goes to the account address, response is masked, code never returned.
  const adapter = fakeAdapter(), svc = make(adapter);
  const started = await svc.send({ userId: "u1", email: "Shawn@Example.com", deviceChallengeId: challengeId, deviceChallenge: challenge });
  assert.equal(sent[0].email, "shawn@example.com"); assert.equal(sent[0].code, "123456");
  assert.equal(started.maskedEmail, "s•••@example.com"); assert.ok(!JSON.stringify(started).includes("123456"));
  assert.ok(!JSON.stringify(adapter.store.record).includes("123456"), "code is stored only as a keyed hash");

  // Resend cooldown.
  await assert.rejects(svc.send({ userId: "u1", email: "shawn@example.com", deviceChallengeId: challengeId, deviceChallenge: challenge }), e => e.code === "resend_cooldown");

  // Wrong code counts an attempt; another device's challenge is refused.
  await assert.rejects(svc.confirm({ userId: "u1", code: "000000", deviceChallengeId: challengeId, deviceChallenge: challenge }), e => e.code === "invalid");
  assert.equal(adapter.store.record.attempts, 1);
  await assert.rejects(svc.confirm({ userId: "u1", code: "123456", deviceChallengeId: challengeId, deviceChallenge: "b".repeat(43) }), e => e.code === "device_mismatch");

  // Correct code on the right device issues a one-time grant (hash stored, token returned once).
  const ok = await svc.confirm({ userId: "u1", code: "123456", deviceChallengeId: challengeId, deviceChallenge: challenge });
  assert.match(ok.deviceGrantId, /^[a-f0-9-]{36}$/); assert.match(ok.deviceGrantToken, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(adapter.store.grants.length, 1); assert.notEqual(adapter.store.grants[0].grantTokenHash, ok.deviceGrantToken);

  // Replay fails.
  await assert.rejects(svc.confirm({ userId: "u1", code: "123456", deviceChallengeId: challengeId, deviceChallenge: challenge }), e => e.code === "used");

  // Expiry.
  clock += 61_000; const a2 = fakeAdapter(), s2 = make(a2);
  await s2.send({ userId: "u2", email: "x@y.it", deviceChallengeId: challengeId, deviceChallenge: challenge });
  clock += 11 * 60_000;
  await assert.rejects(s2.confirm({ userId: "u2", code: "123456", deviceChallengeId: challengeId, deviceChallenge: challenge }), e => e.code === "expired");

  // Send failure leaves the device unregistered and the challenge cancelled.
  const a3 = fakeAdapter();
  await assert.rejects(make(a3, true, { async send() { throw new Error("ses down"); } }).send({ userId: "u3", email: "z@z.de", deviceChallengeId: challengeId, deviceChallenge: challenge }), e => e.code === "send_failed");
  assert.equal(a3.store.record, null);

  // No usable account email.
  await assert.rejects(make(fakeAdapter()).send({ userId: "u4", email: "", deviceChallengeId: challengeId, deviceChallenge: challenge }), e => e.code === "no_account_email");
  assert.equal(maskEmail("ab@c.org"), "a•••@c.org");

  // Wiring: routes, deploy flag defaults off, separate record keys from phone, UI offers email.
  const api = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8"), mod = fs.readFileSync("infrastructure/auth-api/email-device-verification.mjs", "utf8");
  const tpl = fs.readFileSync("infrastructure/engagement/template.yaml", "utf8"), ps = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
  const ui = fs.readFileSync("assets/phone-verification.js", "utf8"), html = fs.readFileSync("messages.html", "utf8");
  assert.ok(api.includes('path === "/device-verification/email/send"') && api.includes('path === "/device-verification/email/confirm"'));
  assert.ok(api.includes('process.env.DEVICE_EMAIL_OTP_ENABLED === "true"'));
  assert.ok(tpl.includes("POST /device-verification/email/send") && tpl.includes("POST /device-verification/email/confirm"));
  assert.match(ps, /DEVICE_EMAIL_OTP_ENABLED = if \(\$EnableDeviceEmailOtp\)/); assert.match(ps, /\$EmailDeviceSource,\$Package/);
  assert.ok(mod.includes("EMAIL_DEVICE#") && !mod.includes("ACCOUNT#") && !mod.includes("PHONE#"), "email codes never touch phone verification records");
  assert.ok(html.includes('id="syncEmailSend"') && ui.includes("/device-verification/email/send"));
  console.log("SYNC email device verification checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
