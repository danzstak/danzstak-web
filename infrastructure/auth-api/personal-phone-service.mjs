import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { challengeRecord, deviceChallengeDigest, normalizeE164, phoneDigest, publicPhoneStatus, verifyChallenge } from "./personal-phone-verification.mjs";

const RESEND_WINDOW_SECONDS = 600, SENDS_PER_WINDOW = 2; // a text and one resend, then wait 10 minutes (rule 11)

function serviceError(message, statusCode, code) { const error = new Error(message); error.statusCode = statusCode; error.code = code; return error; }

// Two delivery modes:
// - sender (AWS Notify): DanzStak generates the code, stores only its keyed hash and asks the sender to text it.
// - verifier (Twilio Verify): Twilio generates, texts and checks the code; DanzStak stores only the verification SID.
// Either way DanzStak owns rate limits, expiry, attempts, device binding and the one-time device grant.
export function createPersonalPhoneService({ adapter, sender = null, verifier = null, secret, enabled = false, now = () => Date.now(), createCode = () => String(randomInt(0, 1000000)).padStart(6, "0"), createId = randomUUID, log = () => {} }) {
  if (!adapter || !(sender || verifier) || !secret) throw new TypeError("Phone verification dependencies are required");
  const providerError = error => error?.name === "TwilioVerifyError" ? serviceError(error.message, error.statusCode, error.code) : null;

  async function status(userId) { return { ...publicPhoneStatus(await adapter.getByUser(userId), now()), providerAvailable: enabled === true }; }

  async function send({ userId, countryCode, localNumber, requestKey = "", purpose = "account_trust", deviceChallengeId = "", deviceChallenge = "", locale = "en" }) {
    if (!enabled) throw serviceError("SYNC verification texts aren't available yet. No text was sent.", 503, "provider_unavailable");
    const number = normalizeE164(countryCode, localNumber), previous = await adapter.getByUser(userId), currentTime = now();
    if (previous?.status === "pending" && Number(previous.resendAfter || 0) > Math.floor(currentTime / 1000)) throw serviceError("Wait before requesting another verification text.", 429, "resend_cooldown");
    if (purpose !== "account_trust" && purpose !== "sync_device") throw serviceError("Unsupported verification purpose.", 400, "invalid_purpose");
    const boundHash = purpose === "sync_device" ? deviceChallengeDigest(deviceChallengeId, deviceChallenge) : "";
    // Rule 11: one resend per number and per device, then a 10-minute wait from the first text.
    const seconds = Math.floor(currentTime / 1000), phoneHash = phoneDigest(secret, number);
    const sameTarget = previous && (previous.phoneHash === phoneHash || (boundHash && previous.deviceChallengeHash === boundHash));
    const inWindow = sameTarget && Number(previous.sendWindowStart || 0) > seconds - RESEND_WINDOW_SECONDS;
    const sendsInWindow = inWindow ? Number(previous.sendsInWindow || 1) : 0;
    if (sendsInWindow >= SENDS_PER_WINDOW) throw serviceError("You can resend once. Try again in 10 minutes.", 429, "resend_window");
    // One number, up to 10 DanzStak accounts (owner 2026-11-17). Checked before any text is sent.
    if (typeof adapter.linkCapacity === "function" && !await adapter.linkCapacity(phoneHash, userId)) throw serviceError("This number is already linked to 10 DanzStak accounts.", 409, "number_limit");
    const code = createCode(), challenge = challengeRecord({ secret, userId, number, challengeId: createId(), code, now: currentTime, purpose, deviceChallengeId, deviceChallengeHash: boundHash });
    challenge.sendWindowStart = inWindow ? Number(previous.sendWindowStart) : seconds;
    challenge.sendsInWindow = sendsInWindow + 1;
    const reserved = await adapter.reserveChallenge({ ...challenge, requestKey, previousPhoneHash: previous?.status === "verified" ? previous.phoneHash : "", previousMaskedNumber: previous?.status === "verified" ? previous.maskedNumber : "", previousVerifiedAt: previous?.status === "verified" ? previous.verifiedAt || "" : "" });
    if (!reserved?.accepted) throw serviceError(reserved?.rateLimited ? "Too many verification attempts. Try again later." : "This number cannot be added.", reserved?.rateLimited ? 429 : 409, reserved?.rateLimited ? "rate_limited" : "number_unavailable");
    try {
      if (verifier) { const started = await verifier.start({ to: number, locale }); await adapter.markSent({ ...challenge, verificationSid: started.verificationSid }); }
      else { await sender.send({ number, code, challengeId: challenge.challengeId }); await adapter.markSent(challenge); }
    } catch (error) {
      await adapter.cancelChallenge(challenge).catch(() => null);
      const mapped = providerError(error) || serviceError("The verification text could not be sent. No number was verified.", 503, "send_failed");
      // Our side failed (provider down, timeout, 5xx): the member keeps every send they had (directive L2).
      // A refusal about the number itself (invalid, blocked, too many codes) still counts, so the anti-abuse limits hold.
      if (mapped.statusCode >= 500 && typeof adapter.releaseRateCounters === "function") {
        await adapter.releaseRateCounters(reserved.rateKeys || []).catch(releaseError => log("phone send counters not released", { error: releaseError?.name || "Error" }));
      }
      throw mapped;
    }
    return publicPhoneStatus(challenge, currentTime);
  }

  async function confirm({ userId, code, purpose = "account_trust", deviceChallengeId = "", deviceChallenge = "", requestKey = "" }) {
    if (typeof adapter.limitCheck === "function" && !await adapter.limitCheck({ userId, requestKey })) throw serviceError("Too many verification attempts. Try again later.", 429, "rate_limited");
    const record = await adapter.getByUser(userId);
    let outcome;
    if (verifier) {
      // Everything DanzStak can check locally is checked before Twilio is asked, so a wrong device or purpose can't
      // spend a Twilio attempt or the one-time approval.
      const local = !record || record.status !== "pending" ? "used" : Number(record.expiresAt || 0) <= Math.floor(now() / 1000) ? "expired" : Number(record.attempts || 0) >= 5 ? "attempts" : !/^\d{6}$/.test(String(code || "")) ? "invalid" : "";
      if (local) outcome = { ok: false, reason: local };
      else {
        if (record.purpose !== purpose) throw serviceError("This code was requested for a different action.", 409, "purpose_mismatch");
        if (purpose === "sync_device" && (record.deviceChallengeId !== deviceChallengeId || record.deviceChallengeHash !== deviceChallengeDigest(deviceChallengeId, deviceChallenge))) throw serviceError("This code belongs to a different device registration.", 409, "device_mismatch");
        if (!record.verificationSid) throw serviceError("This verification request is no longer active.", 409, "used");
        let checked;
        try { checked = await verifier.check({ verificationSid: record.verificationSid, code: String(code) }); }
        catch (error) { const mapped = providerError(error); if (mapped?.code === "expired" || mapped?.code === "attempts") outcome = { ok: false, reason: mapped.code }; else throw mapped || serviceError("Phone verification is unavailable.", 503, "unavailable"); }
        if (!outcome) outcome = checked?.approved === true ? { ok: true } : { ok: false, reason: "invalid" };
        if (outcome.reason === "invalid") await verifier.cancel?.({ verificationSid: record.verificationSid });
      }
    } else outcome = verifyChallenge(record, code, secret, now());
    if (!outcome.ok) {
      // Rule 11: one wrong code cancels the challenge; the member requests a new code.
      if (outcome.reason === "invalid" && record?.status === "pending") {
        await adapter.recordFailedAttempt(record);
        if (typeof adapter.cancelAfterWrongCode === "function") await adapter.cancelAfterWrongCode(record); else await adapter.cancelChallenge(record);
      }
      const errors = { expired: [410, "That code expired. Request a new text."], attempts: [429, "Too many incorrect codes. Request a new text later."], used: [409, "This verification request is no longer active."], invalid: [400, "That code is incorrect. Request a new code."] };
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
