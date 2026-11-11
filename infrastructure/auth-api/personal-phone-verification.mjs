import { createHmac, timingSafeEqual } from "node:crypto";

const E164 = /^\+[1-9]\d{7,14}$/;
const CODE = /^\d{6}$/;
const digits = value => String(value || "").replace(/\D/g, "");

export function normalizeE164(countryCode, localNumber) {
  const raw = String(localNumber || "").trim();
  const normalized = raw.startsWith("+")
    ? `+${digits(raw)}`
    : `+${digits(countryCode)}${digits(raw).replace(/^0+/, "")}`;
  if (!E164.test(normalized)) throw new Error("Enter a valid international mobile number.");
  return normalized;
}

export function maskPhone(number) {
  return E164.test(String(number || "")) ? `•••• ${number.slice(-4)}` : "";
}

export function phoneDigest(secret, number) {
  if (!secret || !E164.test(String(number || ""))) throw new TypeError("A protected E.164 number is required");
  return createHmac("sha256", secret).update(`phone:${number}`).digest("hex");
}

export function verificationDigest(secret, challengeId, numberHash, code) {
  if (!secret || !/^[a-f0-9-]{16,80}$/i.test(String(challengeId || "")) || !/^[a-f0-9]{64}$/.test(String(numberHash || "")) || !CODE.test(String(code || ""))) throw new TypeError("A complete verification challenge is required");
  return createHmac("sha256", secret).update(`verify:${challengeId}:${numberHash}:${code}`).digest("hex");
}

export function safeDigestEqual(left, right) {
  if (!/^[a-f0-9]{64}$/.test(String(left || "")) || !/^[a-f0-9]{64}$/.test(String(right || ""))) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export function challengeRecord({ secret, userId, number, challengeId, code, now = Date.now() }) {
  const phoneHash = phoneDigest(secret, number);
  return {
    userId: String(userId || ""), phoneHash, challengeId,
    challengeHash: verificationDigest(secret, challengeId, phoneHash, code),
    status: "pending", createdAt: new Date(now).toISOString(),
    expiresAt: Math.floor(now / 1000) + 600,
    resendAfter: Math.floor(now / 1000) + 60,
    attempts: 0, maskedNumber: maskPhone(number)
  };
}

export function verifyChallenge(record, code, secret, now = Date.now()) {
  if (!record || record.status !== "pending") return { ok: false, reason: "used" };
  if (Number(record.expiresAt || 0) <= Math.floor(now / 1000)) return { ok: false, reason: "expired" };
  if (Number(record.attempts || 0) >= 5) return { ok: false, reason: "attempts" };
  if (!CODE.test(String(code || ""))) return { ok: false, reason: "invalid" };
  const supplied = verificationDigest(secret, record.challengeId, record.phoneHash, code);
  return safeDigestEqual(supplied, record.challengeHash) ? { ok: true } : { ok: false, reason: "invalid" };
}

export function publicPhoneStatus(record, now = Date.now()) {
  if (!record) return { configured: true, state: "none", verified: false, maskedNumber: "" };
  const state = record.status === "verified" ? "verified" : record.status === "pending" && Number(record.expiresAt || 0) > Math.floor(now / 1000) ? "pending" : "none";
  return {
    configured: true, state, verified: state === "verified",
    maskedNumber: state === "none" ? "" : String(record.maskedNumber || ""),
    resendAfter: state === "pending" ? new Date(Number(record.resendAfter || 0) * 1000).toISOString() : "",
    expiresAt: state === "pending" ? new Date(Number(record.expiresAt || 0) * 1000).toISOString() : ""
  };
}

export const phoneVerificationPolicy = Object.freeze({ codeDigits: 6, validityMinutes: 10, maximumAttempts: 5, resendCooldownSeconds: 60, maximumSendsPerHour: 3, maximumSendsPerDay: 6 });
