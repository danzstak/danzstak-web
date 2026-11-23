// One server-side error mapper for the Auth API (directive L1, owner 2026-11-19).
// Members see a short message the app can translate by its `code`; AWS, Stripe and stack details stay in the logs.
// A raw AWS message once reached a member's screen with the account number and the role name in it.

// Things that must never be in an error a member can see.
const INTERNAL_PATTERNS = [
  /\barn:aws[a-z-]*:/i,
  /\barn:[a-z0-9-]+:[a-z0-9-]*:/i,
  /is not authorized to perform/i,
  /AccessDenied/i,
  /\bassumed-role\//i,
  /(?<![\d.])\d{12}(?![\d.])/,                  // an AWS account number
  /\n\s*at\s+\S+\s*\(?[^)]*:\d+:\d+\)?/,          // a stack frame
  /\bat\s+(?:async\s+)?\S+\s+\((?:file:\/\/|\/var\/task|node:)/,
  /\/var\/task\//,
  /\b(?:ValidationException|ConditionalCheckFailedException|ResourceNotFoundException|ProvisionedThroughputExceededException|ThrottlingException|TransactionCanceledException|UnrecognizedClientException|ExpiredTokenException|InternalServerError)\b/,
  /\bdynamodb:|\bsecretsmanager:|\bs3:|\bsns:|\bses:|\bkms:|\bcognito-idp:/i
];

export function leaksInternals(text) {
  const value = String(text ?? "");
  return value !== "" && INTERNAL_PATTERNS.some(pattern => pattern.test(value));
}

// An error DanzStak wrote for members: a 4xx (or an explicit `expose`) with our own message, never an SDK error.
function memberSafe(error) {
  if (!error || typeof error.message !== "string" || !error.message) return false;
  if (error.$metadata || error.$fault || error.$response) return false;   // AWS SDK v3 errors
  if (leaksInternals(error.message)) return false;
  const status = Number(error.statusCode || error.status || 0);
  return error.expose === true || (status >= 400 && status < 500);
}

// Turns any thrown error into { statusCode, error, code } that is safe to send.
// `fallback` is the member-facing line for anything that went wrong on our side.
export function publicError(error, { fallback = "Something went wrong on our side. Try again in a minute.", code = "try_again", status = 503 } = {}) {
  if (memberSafe(error)) {
    return { statusCode: Number(error.statusCode || error.status || 400), error: error.message, code: typeof error.code === "string" && /^[a-z_]{2,40}$/.test(error.code) ? error.code : "refused" };
  }
  const statusCode = Number(error?.statusCode || error?.status || 0);
  return { statusCode: statusCode >= 500 && statusCode < 600 ? statusCode : status, error: fallback, code };
}

const GENERIC = { error: "Something went wrong on our side. Try again in a minute.", code: "try_again" };

// Last line of defence for every route: an error response whose body carries AWS or stack details is replaced.
// Only error responses are scanned (a member's own post may legitimately mention anything).
export function sanitizeErrorResponse(response, { route = "", log = console.error } = {}) {
  if (!response || typeof response !== "object") return response;
  const status = Number(response.statusCode || 0);
  if (status < 400 || typeof response.body !== "string" || !leaksInternals(response.body)) return response;
  try { log("Error response held back (internal details)", { route, statusCode: status }); } catch { /* logging never breaks a reply */ }
  const headers = { ...(response.headers || {}), "content-type": "application/json", "cache-control": "no-store" };
  return { ...response, headers, body: JSON.stringify(GENERIC) };
}
