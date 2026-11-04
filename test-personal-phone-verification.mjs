import assert from "node:assert/strict";
import {
  challengeRecord,
  maskPhone,
  normalizeE164,
  phoneDigest,
  phoneVerificationPolicy,
  publicPhoneStatus,
  safeDigestEqual,
  verificationDigest,
  verifyChallenge
} from "./infrastructure/auth-api/personal-phone-verification.mjs";

const secret = "test-only-secret-never-used-in-production";
const now = Date.parse("2026-11-04T20:00:00.000Z");
assert.equal(normalizeE164("+1", "(415) 555-0100"), "+14155550100");
assert.equal(normalizeE164("39", "347 123 4567"), "+393471234567");
assert.equal(normalizeE164("+49", "0171 12345678"), "+4917112345678");
assert.equal(normalizeE164("", "+44 7700 900123"), "+447700900123");
assert.throws(() => normalizeE164("+1", "123"), /valid international/);
assert.throws(() => normalizeE164("00", "12345678"), /valid international/);
assert.equal(maskPhone("+14155550100"), "•••• 0100");
assert.equal(maskPhone("not-a-phone"), "");

const phoneHash = phoneDigest(secret, "+14155550100");
assert.match(phoneHash, /^[a-f0-9]{64}$/);
assert.notEqual(phoneHash, phoneDigest(secret, "+14155550101"));
const challengeHash = verificationDigest(secret, "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", phoneHash, "123456");
assert.equal(safeDigestEqual(challengeHash, challengeHash), true);
assert.equal(safeDigestEqual(challengeHash, "0".repeat(64)), false);

const record = challengeRecord({ secret, userId: "member-1", number: "+14155550100", challengeId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", code: "123456", now });
assert.equal(record.maskedNumber, "•••• 0100");
assert.equal(record.expiresAt, Math.floor(now / 1000) + 600);
assert.equal(record.resendAfter, Math.floor(now / 1000) + 60);
assert.equal(JSON.stringify(record).includes("+14155550100"), false, "challenge record must not contain the plaintext number");
assert.equal(JSON.stringify(record).includes("123456"), false, "challenge record must not contain the plaintext code");
assert.deepEqual(verifyChallenge(record, "123456", secret, now + 1000), { ok: true });
assert.deepEqual(verifyChallenge(record, "000000", secret, now + 1000), { ok: false, reason: "invalid" });
assert.deepEqual(verifyChallenge({ ...record, attempts: 5 }, "123456", secret, now + 1000), { ok: false, reason: "attempts" });
assert.deepEqual(verifyChallenge(record, "123456", secret, now + 601000), { ok: false, reason: "expired" });
assert.deepEqual(verifyChallenge({ ...record, status: "verified" }, "123456", secret, now + 1000), { ok: false, reason: "used" });
assert.deepEqual(publicPhoneStatus(record, now), { configured: true, state: "pending", verified: false, maskedNumber: "•••• 0100", resendAfter: "2026-11-04T20:01:00.000Z", expiresAt: "2026-11-04T20:10:00.000Z" });
assert.deepEqual(publicPhoneStatus({ ...record, status: "verified" }, now), { configured: true, state: "verified", verified: true, maskedNumber: "•••• 0100", resendAfter: "", expiresAt: "" });
assert.deepEqual(publicPhoneStatus(null, now), { configured: true, state: "none", verified: false, maskedNumber: "" });
assert.deepEqual(phoneVerificationPolicy, { codeDigits: 6, validityMinutes: 10, maximumAttempts: 5, resendCooldownSeconds: 60, maximumSendsPerHour: 3, maximumSendsPerDay: 6 });

console.log("Personal phone verification checks passed: international normalization, masking, protected OTP records, expiry, replay, and attempt limits.");
