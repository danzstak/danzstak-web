import assert from "node:assert/strict";
import { createPersonalPhoneService } from "./infrastructure/auth-api/personal-phone-service.mjs";

const secret = "test-only-secret-never-used-in-production";
let clock = Date.parse("2026-11-04T20:00:00.000Z");
const records = new Map();
const claims = new Map();
const sent = [];
const adapter = {
  async getByUser(userId) { return records.get(userId) || null; },
  async reserveChallenge(record) {
    const owner = claims.get(record.phoneHash);
    if (owner && owner !== record.userId) return { accepted: false };
    claims.set(record.phoneHash, record.userId);
    records.set(record.userId, { ...record });
    return { accepted: true };
  },
  async markSent() {},
  async cancelChallenge(record) { records.delete(record.userId); if (claims.get(record.phoneHash) === record.userId) claims.delete(record.phoneHash); },
  async recordFailedAttempt(record) { records.set(record.userId, { ...record, attempts: Number(record.attempts || 0) + 1 }); },
  async markVerified(record) {
    if (records.get(record.userId)?.challengeId !== record.challengeId) return false;
    records.set(record.userId, { ...record, status: "verified" });
    return true;
  },
  async remove(userId) { const record = records.get(userId); records.delete(userId); if (record && claims.get(record.phoneHash) === userId) claims.delete(record.phoneHash); }
};
const sender = { async send(payload) { sent.push(payload); } };
const service = createPersonalPhoneService({ adapter, sender, secret, enabled: true, now: () => clock, createCode: () => "123456", createId: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" });

assert.deepEqual(await service.status("member-1"), { configured: true, state: "none", verified: false, maskedNumber: "", providerAvailable: true });
const pending = await service.send({ userId: "member-1", countryCode: "+1", localNumber: "415 555 0100", requestKey: "request-a" });
assert.equal(pending.state, "pending");
assert.equal(pending.maskedNumber, "•••• 0100");
assert.deepEqual(sent, [{ number: "+14155550100", code: "123456", challengeId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }]);
assert.equal(JSON.stringify(records.get("member-1")).includes("123456"), false, "adapter must never receive plaintext OTP");
assert.equal(JSON.stringify(records.get("member-1")).includes("+14155550100"), false, "adapter must never receive plaintext number");
await assert.rejects(() => service.send({ userId: "member-1", countryCode: "+1", localNumber: "4155550100" }), error => error.statusCode === 429 && error.code === "resend_cooldown");
await assert.rejects(() => service.confirm({ userId: "member-1", code: "000000" }), error => error.statusCode === 400 && error.code === "invalid");
assert.equal(records.get("member-1").attempts, 1);
const verified = await service.confirm({ userId: "member-1", code: "123456" });
assert.equal(verified.verified, true);
assert.equal(verified.maskedNumber, "•••• 0100");
await assert.rejects(() => service.confirm({ userId: "member-1", code: "123456" }), error => error.statusCode === 409 && error.code === "used", "a verified code must not replay");

clock += 61_000;
await assert.rejects(() => service.send({ userId: "member-2", countryCode: "+1", localNumber: "4155550100" }), error => error.statusCode === 409 && error.code === "number_unavailable", "a number must belong to only one account");
assert.equal((await service.remove("member-1")).state, "none");

const disabled = createPersonalPhoneService({ adapter, sender, secret, enabled: false });
await assert.rejects(() => disabled.send({ userId: "member-3", countryCode: "+1", localNumber: "4155550102" }), error => error.statusCode === 503 && error.code === "provider_unavailable" && /No text was sent/.test(error.message));

const failingSender = { async send() { throw new Error("provider outage"); } };
const failing = createPersonalPhoneService({ adapter, sender: failingSender, secret, enabled: true, now: () => clock, createCode: () => "654321", createId: () => "ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee" });
await assert.rejects(() => failing.send({ userId: "member-4", countryCode: "+1", localNumber: "4155550104" }), error => error.statusCode === 503 && error.code === "send_failed");
assert.equal(records.has("member-4"), false, "provider failure must release the pending challenge");

console.log("Personal phone service checks passed: honest disabled state, send, cooldown, wrong code, replay, uniqueness, removal, and provider failure cleanup.");
