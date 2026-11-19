// SYNC device verification texts through Twilio Verify (owner 2026-11-17).
// Twilio generates, texts and checks the 6-digit code over SMS; DanzStak keeps its own challenge record (rate limits,
// expiry, attempts, device binding, one-time grant) and stores only Twilio's verification SID (VE...), never the code.
// Plain fetch against the Verify REST API (no npm package). Credentials come only from environment variables and are
// never logged. Numbers are never logged in full (maskForLog keeps the last 2 digits).

const VERIFY_API = "https://verify.twilio.com/v2";

// Locales Twilio Verify supports for the SMS channel.
// Source: https://www.twilio.com/docs/verify/supported-languages (checked 2026-11-17).
// Not usable for SMS per that page: en-GB (voice only); zh-TW, pt-PT, es-AR, es-ES, es-MX, en-US, fil, zu (WhatsApp only).
export const TWILIO_VERIFY_SMS_LOCALES = Object.freeze(new Set([
  "ab", "aa", "af", "ak", "sq", "am", "ar", "an", "hy", "as", "av", "ae", "ay", "az", "bm", "ba", "eu", "be", "bn", "bh", "bi", "bs", "br", "bg", "my", "ca", "ch", "ce", "ny",
  "zh-HK", "zh", "zh-CN", "cu", "cv", "kw", "co", "cr", "hr", "cs", "da", "dv", "nl", "en", "eo", "et", "ee", "fo", "fj", "fi", "fr", "ff", "gl", "ka", "de", "el", "gn", "gu",
  "ht", "ha", "he", "hz", "hi", "ho", "hu", "is", "io", "ig", "id", "ia", "ie", "iu", "ik", "ga", "it", "ja", "jv", "kl", "kn", "kr", "ks", "kk", "km", "ki", "rw", "ky", "rn",
  "kv", "kg", "ko", "ku", "kj", "lo", "la", "lv", "li", "ln", "lt", "lu", "lg", "lb", "mk", "mg", "ms", "ml", "mt", "gv", "mi", "mr", "mh", "mn", "na", "nv", "ng", "ne", "nd",
  "se", "nb", "no", "nn", "ii", "oc", "oj", "or", "om", "os", "pi", "pa", "ps", "fa", "pl", "pt", "pt-BR", "qu", "ro", "rm", "ru", "sm", "sg", "sa", "sc", "gd", "sr", "sn",
  "sd", "si", "sk", "sl", "so", "nr", "st", "es", "su", "sw", "ss", "sv", "tl", "ty", "tg", "ta", "tt", "te", "th", "bo", "ti", "to", "ts", "tn", "tr", "tk", "tw", "ug", "uk",
  "ur", "uz", "ve", "vi", "vo", "wa", "cy", "fy", "wo", "xh", "yi", "yo", "za"
]));

// Reduce a browser language tag to a Twilio Verify SMS locale. Regional tags Twilio supports are kept ("pt-BR", "zh-HK",
// "zh-CN"); anything else falls to its base ("it-IT" -> "it"); unknown or unsupported -> "en". The client value is never
// trusted without this allowlist.
export function verifyLocale(input) {
  const candidates = (Array.isArray(input) ? input : [input]).map(value => String(value || "").trim().replace(/_/g, "-")).filter(value => /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{1,8})*$/.test(value)).slice(0, 8);
  for (const tag of candidates) {
    const [base, ...rest] = tag.split("-"), lang = base.toLowerCase(), region = rest[0] || "";
    const regional = region ? `${lang}-${region.length === 2 ? region.toUpperCase() : region}` : "";
    if (lang === "zh" && /^(?:hant|tw|mo)$/i.test(region)) continue; // Traditional Chinese for Taiwan/Macau isn't an SMS locale; try the next language
    if (regional && TWILIO_VERIFY_SMS_LOCALES.has(regional)) return regional;
    if (lang === "zh" && /^(?:hk)$/i.test(region)) return "zh-HK";
    if (TWILIO_VERIFY_SMS_LOCALES.has(lang)) return lang;
  }
  return "en";
}

const E164 = /^\+[1-9]\d{7,14}$/;
export function isE164(number) { return E164.test(String(number || "")); }
// For logs only: keep the last 2 digits.
export function maskForLog(number) { const text = String(number || ""); return isE164(text) ? `+${"•".repeat(Math.max(0, text.length - 3))}${text.slice(-2)}` : "[invalid]"; }

// Twilio error codes -> what we tell the member. The client translates by `code`.
// https://www.twilio.com/docs/api/errors (60200, 60202, 60203, 60410, 60605, 20404, 20429)
export const TWILIO_ERRORS = Object.freeze({
  60200: { status: 400, code: "invalid_number", message: "That mobile number isn't valid. Check the country code and number." },
  60203: { status: 429, code: "max_send_attempts", message: "Too many codes were sent to this number. Try again later." },
  60202: { status: 429, code: "attempts", message: "Too many incorrect codes. Request a new text later." },
  60410: { status: 403, code: "fraud_blocked", message: "Texts to this number are blocked to prevent fraud. Use another mobile number." },
  60605: { status: 403, code: "geo_blocked", message: "SYNC can't send verification texts to this country yet." },
  20404: { status: 410, code: "expired", message: "That code expired. Request a new text." },
  20429: { status: 429, code: "rate_limited", message: "Too many verification attempts. Try again later." }
});
export function twilioErrorInfo(twilioCode) {
  return TWILIO_ERRORS[Number(twilioCode)] || { status: 503, code: "send_failed", message: "The verification text could not be sent. No number was verified." };
}
export class TwilioVerifyError extends Error {
  constructor(twilioCode, httpStatus) { const info = twilioErrorInfo(twilioCode); super(info.message); this.name = "TwilioVerifyError"; this.twilioCode = Number(twilioCode) || 0; this.httpStatus = httpStatus; this.statusCode = info.status; this.code = info.code; }
}

// Credentials only from the environment: an API key (preferred) or the Auth Token as a fallback.
export function twilioCredentialsFromEnv(env = process.env) {
  const accountSid = String(env.TWILIO_ACCOUNT_SID || ""), serviceSid = String(env.TWILIO_VERIFY_SERVICE_SID || "");
  const keySid = String(env.TWILIO_API_KEY_SID || ""), keySecret = String(env.TWILIO_API_KEY_SECRET || ""), authToken = String(env.TWILIO_AUTH_TOKEN || "");
  const missing = [];
  if (!/^AC[0-9a-f]{32}$/i.test(accountSid)) missing.push("TWILIO_ACCOUNT_SID");
  if (!/^VA[0-9a-f]{32}$/i.test(serviceSid)) missing.push("TWILIO_VERIFY_SERVICE_SID");
  const useKey = /^SK[0-9a-f]{32}$/i.test(keySid) && keySecret.length >= 16;
  if (!useKey && authToken.length < 16) missing.push("TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET (or TWILIO_AUTH_TOKEN)");
  if (missing.length) return { ok: false, missing };
  return { ok: true, accountSid, serviceSid, username: useKey ? keySid : accountSid, password: useKey ? keySecret : authToken };
}

// Owner rule: secrets live in AWS Secrets Manager. The secret danzstak/twilio/verify holds JSON
// {accountSid, serviceSid, authToken} (or apiKeySid + apiKeySecret). Key names are trimmed in case of stray spaces.
export function twilioCredentialsFromSecret(raw) {
  let data = {};
  try { data = JSON.parse(String(raw || "{}")) || {}; } catch { data = {}; }
  const value = name => { const key = Object.keys(data).find(item => item.replace(/\s+/g, "") === name); return key ? String(data[key] ?? "").trim() : ""; };
  return twilioCredentialsFromEnv({ TWILIO_ACCOUNT_SID: value("accountSid"), TWILIO_VERIFY_SERVICE_SID: value("serviceSid"), TWILIO_AUTH_TOKEN: value("authToken"), TWILIO_API_KEY_SID: value("apiKeySid"), TWILIO_API_KEY_SECRET: value("apiKeySecret") });
}

export function createTwilioVerifyClient({ credentials, fetchImpl = fetch, timeoutMs = 10000, log = () => {} }) {
  if (!credentials?.ok) throw new TypeError("Twilio Verify credentials are not configured");
  const auth = "Basic " + Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
  async function call(path, form) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${VERIFY_API}/Services/${credentials.serviceSid}${path}`, { method: "POST", headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString(), signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new TwilioVerifyError(data?.code, response.status);
      return data;
    } catch (error) {
      if (error instanceof TwilioVerifyError) throw error;
      throw new TwilioVerifyError(0, 0);
    } finally { clearTimeout(timer); }
  }
  return {
    // Start an SMS verification; returns only Twilio's verification SID.
    async start({ to, locale }) {
      if (!isE164(to)) throw new TwilioVerifyError(60200, 400);
      try {
        const data = await call("/Verifications", { To: to, Channel: "sms", Locale: verifyLocale(locale) });
        if (!/^VE[0-9a-f]{32}$/i.test(String(data.sid || ""))) throw new TwilioVerifyError(0, 0);
        return { verificationSid: data.sid, status: String(data.status || "") };
      } catch (error) { log("twilio_verify_send_failed", { to: maskForLog(to), twilioCode: error.twilioCode || 0 }); throw error; }
    },
    // Cancel a verification (rule 11: one wrong code ends it). Best effort; DanzStak's own record is cancelled anyway.
    async cancel({ verificationSid }) {
      if (!/^VE[0-9a-f]{32}$/i.test(String(verificationSid || ""))) return false;
      try { await call(`/Verifications/${verificationSid}`, { Status: "canceled" }); return true; }
      catch (error) { log("twilio_verify_cancel_failed", { twilioCode: error.twilioCode || 0 }); return false; }
    },
    // Check a code. Only Twilio status "approved" counts as verified.
    async check({ verificationSid, code }) {
      if (!/^VE[0-9a-f]{32}$/i.test(String(verificationSid || "")) || !/^\d{4,10}$/.test(String(code || ""))) return { approved: false, status: "invalid" };
      try {
        const data = await call("/VerificationCheck", { VerificationSid: verificationSid, Code: code });
        return { approved: data.status === "approved" && data.valid !== false, status: String(data.status || "") };
      } catch (error) { log("twilio_verify_check_failed", { twilioCode: error.twilioCode || 0 }); throw error; }
    }
  };
}
