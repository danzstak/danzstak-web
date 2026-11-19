// Live contact check before any booking pitch (task 07, part A).
// Never waste a pitch or a credit on a dead address: valid syntax, a domain that accepts mail (MX),
// not opted out, and no hard bounce reported to any DanzStak member in the last 12 months.
// The shared bounce record is privacy-safe: a hash of the address, the date and a reason class only.
import { promises as dns } from "node:dns";

export const BOUNCE_WINDOW_DAYS = 365;
const DAY_MS = 86400000;
const MX_CACHE_MS = 60 * 60 * 1000;
const DNS_TIMEOUT_MS = 3000;

export const CONTACT_MESSAGES = Object.freeze({
  syntax: "This doesn't look like a working email address. Find a newer contact.",
  no_mail: "This address can't receive email (its domain has no mail server). Find a newer contact.",
  dns_unavailable: "We couldn't check this address right now. Nothing was sent and no credit was used. Try again in a minute.",
  bounced: "This address bounced — find a newer contact.",
  opted_out: "This contact opted out of DanzStak booking pitches and cannot be emailed."
});

// Stricter than "something@something.something": real labels, an alphabetic TLD, no dots at the edges.
export function emailSyntaxOk(value) {
  const address = String(value || "").trim().toLowerCase();
  if (address.length > 254) return false;
  const match = address.match(/^([a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*)@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,63}|xn--[a-z0-9-]{1,59}))$/);
  return Boolean(match) && match[1].length <= 64;
}

export function emailDomain(value) { return String(value || "").trim().toLowerCase().split("@").pop() || ""; }

// The suppression item blocks a send when it is an opt-out or complaint (always),
// or a permanent bounce within the last 12 months. An older bounce no longer blocks: the club may have fixed its mailbox.
export function suppressionBlock(item, nowMs) {
  if (!item) return "";
  if (item.reason?.S !== "permanent_bounce") return "opted_out";
  const at = Date.parse(item.optedOutAt?.S || "");
  return Number.isFinite(at) && nowMs - at >= BOUNCE_WINDOW_DAYS * DAY_MS ? "" : "bounced";
}

// For DynamoDB ConditionChecks that must agree with suppressionBlock().
export function bounceCutoffIso(nowMs) { return new Date(nowMs - BOUNCE_WINDOW_DAYS * DAY_MS).toISOString(); }
export const SUPPRESSION_CLEAR_CONDITION = "attribute_not_exists(userId) OR (reason = :bounceReason AND optedOutAt <= :bounceCutoff)";
export function suppressionClearValues(nowMs) { return { ":bounceReason": { S: "permanent_bounce" }, ":bounceCutoff": { S: bounceCutoffIso(nowMs) } }; }

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Object.assign(new Error("DNS timeout"), { code: "ETIMEOUT" })), ms); })]).finally(() => clearTimeout(timer));
}

// Returns "" when the domain accepts mail, "no_mail" when DNS says it can't, "dns_unavailable" when DNS didn't answer.
// A null MX (RFC 7505: a single "." record) means the domain refuses mail.
export function createMailDomainCheck({ resolveMx = domain => dns.resolveMx(domain), clock = Date.now, timeoutMs = DNS_TIMEOUT_MS } = {}) {
  const cache = new Map();
  return async function mailDomainProblem(domain) {
    const key = String(domain || "").toLowerCase(), now = clock(), cached = cache.get(key);
    if (cached && cached.until > now) return cached.problem;
    let problem;
    try {
      const records = await withTimeout(Promise.resolve(resolveMx(key)), timeoutMs);
      const usable = (Array.isArray(records) ? records : []).filter(record => String(record?.exchange || "").replace(/\.$/, "").length > 0);
      problem = usable.length ? "" : "no_mail";
    } catch (error) {
      problem = ["ENOTFOUND", "ENODATA", "ENONAME", "NXDOMAIN"].includes(error?.code) ? "no_mail" : "dns_unavailable";
    }
    if (problem !== "dns_unavailable") cache.set(key, { problem, until: now + MX_CACHE_MS });
    return problem;
  };
}

// Full check in the order an artist would want to hear about it. Returns { ok, reason, message }.
export async function checkBookingContact({ to, suppressionItem, mailDomainProblem, nowMs }) {
  const fail = reason => ({ ok: false, reason, message: CONTACT_MESSAGES[reason] });
  if (!emailSyntaxOk(to)) return fail("syntax");
  const blocked = suppressionBlock(suppressionItem, nowMs);
  if (blocked) return fail(blocked);
  const problem = await mailDomainProblem(emailDomain(to));
  if (problem) return fail(problem);
  return { ok: true, reason: "", message: "" };
}
