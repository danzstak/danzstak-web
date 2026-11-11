import { randomInt, randomUUID } from "node:crypto";
import { challengeRecord, normalizeE164, publicPhoneStatus, verifyChallenge } from "./personal-phone-verification.mjs";

function serviceError(message, statusCode, code) { const error = new Error(message); error.statusCode = statusCode; error.code = code; return error; }

export function createPersonalPhoneService({ adapter, sender, secret, enabled = false, now = () => Date.now(), createCode = () => String(randomInt(0, 1000000)).padStart(6, "0"), createId = randomUUID }) {
  if (!adapter || !sender || !secret) throw new TypeError("Phone verification dependencies are required");

  async function status(userId) { return { ...publicPhoneStatus(await adapter.getByUser(userId), now()), providerAvailable: enabled === true }; }

  async function send({ userId, countryCode, localNumber, requestKey = "" }) {
    if (!enabled) throw serviceError("AWS has not approved SYNC verification texts yet. No text was sent.", 503, "provider_unavailable");
    const number = normalizeE164(countryCode, localNumber), previous = await adapter.getByUser(userId), currentTime = now();
    if (previous?.status === "pending" && Number(previous.resendAfter || 0) > Math.floor(currentTime / 1000)) throw serviceError("Wait before requesting another verification text.", 429, "resend_cooldown");
    const code = createCode(), challenge = challengeRecord({ secret, userId, number, challengeId: createId(), code, now: currentTime });
    const reserved = await adapter.reserveChallenge({ ...challenge, requestKey, previousPhoneHash: previous?.status === "verified" ? previous.phoneHash : "", previousMaskedNumber: previous?.status === "verified" ? previous.maskedNumber : "", previousVerifiedAt: previous?.status === "verified" ? previous.verifiedAt || "" : "" });
    if (!reserved?.accepted) throw serviceError(reserved?.rateLimited ? "Too many verification attempts. Try again later." : "This number cannot be added.", reserved?.rateLimited ? 429 : 409, reserved?.rateLimited ? "rate_limited" : "number_unavailable");
    try { await sender.send({ number, code, challengeId: challenge.challengeId }); await adapter.markSent(challenge); }
    catch { await adapter.cancelChallenge(challenge).catch(() => null); throw serviceError("The verification text could not be sent. No number was verified.", 503, "send_failed"); }
    return publicPhoneStatus(challenge, currentTime);
  }

  async function confirm({ userId, code }) {
    const record = await adapter.getByUser(userId), outcome = verifyChallenge(record, code, secret, now());
    if (!outcome.ok) {
      if (outcome.reason === "invalid") await adapter.recordFailedAttempt(record);
      const errors = { expired: [410, "That code expired. Request a new text."], attempts: [429, "Too many incorrect codes. Request a new text later."], used: [409, "This verification request is no longer active."], invalid: [400, "That code is incorrect."] };
      const [statusCode, message] = errors[outcome.reason] || errors.invalid;
      throw serviceError(message, statusCode, outcome.reason);
    }
    if (!await adapter.markVerified(record)) throw serviceError("This verification request changed. Request a new text.", 409, "challenge_changed");
    return publicPhoneStatus({ ...record, status: "verified" }, now());
  }

  async function remove(userId) { await adapter.remove(userId); return publicPhoneStatus(null, now()); }
  return { status, send, confirm, remove };
}
