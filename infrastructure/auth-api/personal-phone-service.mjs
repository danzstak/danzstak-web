import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { challengeRecord, deviceChallengeDigest, normalizeE164, publicPhoneStatus, verifyChallenge } from "./personal-phone-verification.mjs";

function serviceError(message, statusCode, code) { const error = new Error(message); error.statusCode = statusCode; error.code = code; return error; }

export function createPersonalPhoneService({ adapter, sender, secret, enabled = false, now = () => Date.now(), createCode = () => String(randomInt(0, 1000000)).padStart(6, "0"), createId = randomUUID }) {
  if (!adapter || !sender || !secret) throw new TypeError("Phone verification dependencies are required");

  async function status(userId) { return { ...publicPhoneStatus(await adapter.getByUser(userId), now()), providerAvailable: enabled === true }; }

  async function send({ userId, countryCode, localNumber, requestKey = "", purpose = "account_trust", deviceChallengeId = "", deviceChallenge = "" }) {
    if (!enabled) throw serviceError("AWS has not approved SYNC verification texts yet. No text was sent.", 503, "provider_unavailable");
    const number = normalizeE164(countryCode, localNumber), previous = await adapter.getByUser(userId), currentTime = now();
    if (previous?.status === "pending" && Number(previous.resendAfter || 0) > Math.floor(currentTime / 1000)) throw serviceError("Wait before requesting another verification text.", 429, "resend_cooldown");
    if (purpose !== "account_trust" && purpose !== "sync_device") throw serviceError("Unsupported verification purpose.", 400, "invalid_purpose");
    const boundHash = purpose === "sync_device" ? deviceChallengeDigest(deviceChallengeId, deviceChallenge) : "";
    const code = createCode(), challenge = challengeRecord({ secret, userId, number, challengeId: createId(), code, now: currentTime, purpose, deviceChallengeId, deviceChallengeHash: boundHash });
    const reserved = await adapter.reserveChallenge({ ...challenge, requestKey, previousPhoneHash: previous?.status === "verified" ? previous.phoneHash : "", previousMaskedNumber: previous?.status === "verified" ? previous.maskedNumber : "", previousVerifiedAt: previous?.status === "verified" ? previous.verifiedAt || "" : "" });
    if (!reserved?.accepted) throw serviceError(reserved?.rateLimited ? "Too many verification attempts. Try again later." : "This number cannot be added.", reserved?.rateLimited ? 429 : 409, reserved?.rateLimited ? "rate_limited" : "number_unavailable");
    try { await sender.send({ number, code, challengeId: challenge.challengeId }); await adapter.markSent(challenge); }
    catch { await adapter.cancelChallenge(challenge).catch(() => null); throw serviceError("The verification text could not be sent. No number was verified.", 503, "send_failed"); }
    return publicPhoneStatus(challenge, currentTime);
  }

  async function confirm({ userId, code, purpose = "account_trust", deviceChallengeId = "", deviceChallenge = "" }) {
    const record = await adapter.getByUser(userId), outcome = verifyChallenge(record, code, secret, now());
    if (!outcome.ok) {
      if (outcome.reason === "invalid") await adapter.recordFailedAttempt(record);
      const errors = { expired: [410, "That code expired. Request a new text."], attempts: [429, "Too many incorrect codes. Request a new text later."], used: [409, "This verification request is no longer active."], invalid: [400, "That code is incorrect."] };
      const [statusCode, message] = errors[outcome.reason] || errors.invalid;
      throw serviceError(message, statusCode, outcome.reason);
    }
    if (record.purpose !== purpose) throw serviceError("This code was requested for a different action.", 409, "purpose_mismatch");
    let grant = null, grantResponse = {};
    if (purpose === "sync_device") {
      const suppliedHash = deviceChallengeDigest(deviceChallengeId, deviceChallenge);
      if (record.deviceChallengeId !== deviceChallengeId || record.deviceChallengeHash !== suppliedHash) throw serviceError("This code belongs to a different device registration.", 409, "device_mismatch");
      const grantId = createId(), grantToken = randomBytes(32).toString("base64url"), verifiedAt = new Date(now()).toISOString();
      grant = { grantId, grantTokenHash:createHash("sha256").update(grantToken).digest("hex"), verifiedAt, expiresAt:Math.floor(now()/1000)+300 };
      grantResponse = { deviceGrantId:grantId, deviceGrantToken:grantToken, deviceGrantExpiresAt:new Date(grant.expiresAt*1000).toISOString() };
    }
    if (!await adapter.markVerified(record, grant)) throw serviceError("This verification request changed. Request a new text.", 409, "challenge_changed");
    return { ...publicPhoneStatus({ ...record, status: "verified" }, now()), ...grantResponse };
  }

  async function remove(userId) { await adapter.remove(userId); return publicPhoneStatus(null, now()); }
  return { status, send, confirm, remove };
}
