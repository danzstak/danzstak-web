// Task 20 (owner 2026-11-17): an artist proves they are the act before the EPK is public or pitched.
// Elsewhere people have signed up claiming to be famous artists; on DanzStak a fake EPK would pitch real venues in a
// real artist's name. Anyone can build and preview privately. Publishing, venue EPK links, booking emails and the
// Verified mark need a verified act.
//
// Verification means "this member showed control of the act's public page", never a legal guarantee of identity.
// Never a password to another platform, never a platform API, never ID documents or selfies. DanzStak fetches the
// public page once, keeps only the match result (never the page contents), and the artist can remove the code after.
//
// Records live in the tours table next to the EPK:
//   <member>                          / ARTIST_VERIFICATION#<actKey>   one per member per act (a band can have several)
//   ARTIST_VERIFICATION#REVIEWS        / <member>#<actKey>              editor queue (manual review, famous names, reports)
//   ARTIST_VERIFICATION#REPORTS#<id>   / <reporter hash>                one impersonation report per member per public EPK
//   ARTIST_VERIFICATION#PROTECTED_NAMES / <look-alike key>              acts members reported; always manual review
import { createHash, randomInt } from "node:crypto";
import { lookup, resolveTxt } from "node:dns/promises";
import { isIP } from "node:net";
import { safePublicUrl } from "./link-preview.mjs";
import { PROTECTED_ARTIST_NAMES } from "./protected-artist-names.mjs";

export const CODE_TTL_SECONDS = 24 * 3600;
export const VERIFIED_FOR_SECONDS = 365 * 86400;
export const REPORTS_TO_HOLD = 2;
export const MAX_CHECKS_PER_CODE = 20;
export const MAX_CODES_PER_DAY = 6;
export const MAX_REPORTS_PER_DAY = 5;
// Per member per day across every act name, so inventing names cannot turn DanzStak into a page fetcher.
export const MAX_MEMBER_CODES_PER_DAY = 20;
export const MAX_MEMBER_CHECKS_PER_DAY = 60;
const CHECK_SPACING_SECONDS = 5;
export const RECORD_PREFIX = "ARTIST_VERIFICATION#";
export const REVIEW_PARTITION = "ARTIST_VERIFICATION#REVIEWS";
export const REPORT_PREFIX = "ARTIST_VERIFICATION#REPORTS#";
export const PROTECTED_PARTITION = "ARTIST_VERIFICATION#PROTECTED_NAMES";
const REPORT_RATE_PREFIX = "ARTIST_VERIFICATION#REPORTS_SENT#";
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const MAX_PAGE_BYTES = 1_500_000, FETCH_TIMEOUT_MS = 6000, MAX_REDIRECTS = 3;

export const VERIFY_MESSAGE = "Verify your act before you publish or pitch. Open your EPK and use Verify your act.";
export const REVIEW_MESSAGE = "A DanzStak editor is reviewing this act. Publishing and pitches open once it is approved.";
export const HOLD_MESSAGE = "This EPK is on hold after an impersonation report. A DanzStak editor will review it.";
export const HONEST_NOTE = "Verified means this member showed control of the act's public page. It is not a legal guarantee of identity.";

const sha = value => createHash("sha256").update(String(value)).digest("hex");
const fold = value => String(value || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

// The act a verification belongs to: case, spacing, accents, punctuation, "official" and a leading "the" do not
// change it. Renaming the act to anything else gives a new key, which re-opens verification (spec: name change).
export function actKey(name) {
  const words = fold(name).replace(/&/g, " and ").split(/[^a-z0-9]+/).filter(word => word && word !== "official");
  if (words[0] === "the" && words.length > 1) words.shift();
  const key = words.join("").slice(0, 80);
  if (key) return key;
  const raw = String(name || "").trim().toLowerCase();
  return raw ? `x${sha(raw).slice(0, 20)}` : ""; // acts like "!!!" still get a stable key
}

// Stricter than actKey, used only to spot famous and reported names: also folds look-alike characters
// (0/o, 1/l, 3/e, Cyrillic letters...) and noise words impersonators add ("real", "vevo", "music", "fans").
const LOOKALIKE = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "$": "s", "@": "a", "!": "i", "|": "l", "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "к": "k", "м": "m", "н": "h", "т": "t", "в": "b" };
const NOISE_WORDS = new Set(["the", "official", "real", "vevo", "music", "tv", "fan", "fans", "page", "band"]);
export function lookalikeKey(name) {
  const text = fold(name).replace(/[0134578$@!|аеорсухіјкмнтв]/g, char => LOOKALIKE[char] || char).replace(/&/g, " and ");
  const words = text.split(/[^a-z0-9]+/).filter(Boolean), kept = words.filter(word => !NOISE_WORDS.has(word));
  return (kept.length ? kept : words).join("").replace(/i/g, "l").slice(0, 80); // capital I and lower-case l look alike
}

function withinOneEdit(a, b) {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i += 1; j += 1; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i += 1; else if (b.length > a.length) j += 1; else { i += 1; j += 1; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const PROTECTED_KEYS = new Map(PROTECTED_ARTIST_NAMES.map(name => [lookalikeKey(name), name]));
// Returns the protected name this act matches, or "". Long names also catch one-letter typos ("Katy Perrry").
export function protectedNameMatch(name, reportedKeys = []) {
  const key = lookalikeKey(name);
  if (!key) return "";
  if (PROTECTED_KEYS.has(key)) return PROTECTED_KEYS.get(key);
  if ([...reportedKeys].includes(key)) return String(name).trim();
  if (key.length >= 8) for (const [known, original] of PROTECTED_KEYS) if (known.length >= 8 && withinOneEdit(key, known)) return original;
  return "";
}

export function newVerificationCode(random = randomInt) {
  let code = "DZ-";
  for (let index = 0; index < 6; index += 1) code += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return code;
}
export const validCode = code => /^DZ-[2-9A-HJKMNP-Z]{6}$/.test(String(code || ""));

// Looks for this member's code for this act in the fetched page: a <meta name="danzstak-verify"> tag counts as
// "own website", anything else (a bio or channel description, often JSON- or HTML-escaped) as "public page".
export function pageHasCode(html, code) {
  if (!validCode(code)) return { found: false };
  const text = String(html || "");
  for (const [tag] of text.matchAll(/<meta\b[^>]*>/gi)) {
    if (/\bname\s*=\s*["']danzstak-verify["']/i.test(tag) && (tag.match(/\bcontent\s*=\s*["']\s*([^"']*?)\s*["']/i) || [])[1]?.toUpperCase() === code) return { found: true, method: "meta" };
  }
  const plain = text.replace(/\\u002[dD]/g, "-").replace(/&#0*45;|&#x0*2d;|&hyphen;|&dash;/gi, "-").replace(/[‐‑‒–]/g, "-");
  const pattern = new RegExp(`(^|[^A-Za-z0-9])${code.replace("-", "\\s?-\\s?")}($|[^A-Za-z0-9])`, "i");
  return pattern.test(plain) ? { found: true, method: "page" } : { found: false };
}

// The bio code must sit on a page that is clearly the act's: the page has to name the act somewhere
// (title, header or profile data), compared without case, spacing, accents or punctuation.
export function pageNamesAct(html, name) {
  const key = actKey(name);
  if (!key || /^x[a-f0-9]{20}$/.test(key)) return true;
  return fold(String(html || "").replace(/\\u0026|&amp;/g, " and ")).replace(/[^a-z0-9]+/g, "").includes(key);
}

export function validDomain(raw) {
  const host = String(raw || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[/?#].*$/, "").replace(/\.$/, "");
  return host.length <= 253 && !isIP(host) && /^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host) ? host : "";
}
export function txtHasCode(records, code) {
  if (!validCode(code)) return false;
  return (records || []).some(parts => (Array.isArray(parts) ? parts.join("") : String(parts || "")).trim().toLowerCase() === `danzstak-verify=${code}`.toLowerCase());
}

// One public page fetch: https only, public addresses only, at most 3 redirects, 1.5 MB, 6 seconds.
export async function fetchPublicPage(raw, { fetcher = fetch, resolver = lookup } = {}) {
  let url = await safePublicUrl(raw, resolver);
  if (!url) return { ok: false, reason: "unsafe_url" };
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetcher(url.href, { redirect: "manual", signal: controller.signal, headers: { "user-agent": "DanzStakArtistVerify/1.0 (+https://danzstak.com)", accept: "text/html,application/xhtml+xml" } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const next = await safePublicUrl(new URL(response.headers?.get?.("location") || "", url).href, resolver);
        if (!next) return { ok: false, reason: "unsafe_url" };
        url = next;
        continue;
      }
      if (!response.ok) return { ok: false, reason: "unreachable", url: url.href };
      const reader = response.body?.getReader?.();
      let html = "", received = 0;
      if (reader) {
        const decoder = new TextDecoder();
        while (received < MAX_PAGE_BYTES) { const { done, value } = await reader.read(); if (done) break; received += value.length; html += decoder.decode(value, { stream: true }); }
        try { await reader.cancel(); } catch { /* already closed */ }
      } else html = String(await response.text()).slice(0, MAX_PAGE_BYTES);
      return { ok: true, html, url: url.href };
    } catch {
      return { ok: false, reason: "unreachable", url: url.href };
    } finally { clearTimeout(timer); }
  }
  return { ok: false, reason: "unreachable" };
}

const attr = (item, name) => item?.[name]?.S || "";
const num = (item, name) => Number(item?.[name]?.N || 0);

// What the member (and the gates) see. Statuses: not_verified · verified · needs_review ("Checking" is the
// moment a check is running in the browser).
export function verificationView(item, nowSeconds, actName = "") {
  const view = { actName: attr(item, "actName") || String(actName || "").trim().slice(0, 120), status: "not_verified", method: "", verifiedAt: "", expiresAt: "", checkedUrl: "", code: "", codeExpiresAt: "", lastCheckAt: "", lastCheckResult: "", reviewReason: "", note: "", protectedName: item?.protectedName?.BOOL === true };
  if (!item) return view;
  const status = attr(item, "status"), expiresAt = num(item, "expiresAt"), codeExpiresAt = num(item, "codeExpiresAt");
  view.method = attr(item, "method");
  view.checkedUrl = attr(item, "checkedUrl");
  view.lastCheckAt = attr(item, "lastCheckAt");
  view.lastCheckResult = attr(item, "lastCheckResult");
  view.reviewReason = attr(item, "reviewReason");
  view.note = attr(item, "reviewNote");
  if (status === "verified" && expiresAt > nowSeconds) Object.assign(view, { status: "verified", verifiedAt: attr(item, "verifiedAt"), expiresAt: new Date(expiresAt * 1000).toISOString() });
  else if (status === "needs_review") view.status = "needs_review";
  else if (status === "verified") view.lastCheckResult = "expired"; // yearly re-check
  if (view.status !== "verified" && validCode(attr(item, "code")) && codeExpiresAt > nowSeconds && !attr(item, "codeUsedAt")) Object.assign(view, { code: attr(item, "code"), codeExpiresAt: new Date(codeExpiresAt * 1000).toISOString() });
  return view;
}

export function kitArtistName(epkItem) {
  try { return String(JSON.parse(epkItem?.plan?.S || "{}")?.artistName || "").trim().slice(0, 120); } catch { return ""; }
}

const CHECK_MESSAGES = {
  verified: "Verified. You can remove the code from that page now.",
  needs_review: "Code found. Because this name is protected, a DanzStak editor confirms it before you can publish.",
  not_found: "We could not find your code on that page yet. Save the page with the code, wait a minute and check again.",
  name_missing: "We found the code, but that page does not name your act. Use the act's own page.",
  unsafe_url: "Use a public https link to the act's page.",
  unreachable: "That page could not be opened right now. Check the link or try again shortly.",
  dns_not_found: "We could not find the TXT record yet. DNS changes can take up to an hour.",
  bad_domain: "Enter the act's domain, like theband.com."
};

export function createArtistVerification({ db, commands, tableName, authenticate, accountEmail = async () => "", corsHeaders, originAllowed, isEditor = () => false, epkWorkspaceKey, epkPublicPartition, fetcher = fetch, resolver = lookup, txtResolver = resolveTxt, clock = Date.now }) {
  const { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand, DeleteItemCommand } = commands;
  const nowSeconds = () => Math.floor(clock() / 1000);
  const nowIso = () => new Date(clock()).toISOString();
  const recordKey = (userId, key) => ({ userId: { S: userId }, tourId: { S: `${RECORD_PREFIX}${key}` } });
  const reviewKey = (userId, key) => ({ userId: { S: REVIEW_PARTITION }, tourId: { S: `${userId}#${key}` } });
  const epkKey = userId => ({ userId: { S: userId }, tourId: { S: epkWorkspaceKey } });
  const get = async Key => (await db.send(new GetItemCommand({ TableName: tableName, Key, ConsistentRead: true }))).Item;
  const parse = event => { try { return JSON.parse(event.body || "{}") || {}; } catch { return {}; } };
  const actNameFrom = value => String(value || "").replace(/\s+/g, " ").trim().slice(0, 120);

  async function editorFor(userId) {
    try { return Boolean(isEditor(String(await accountEmail(userId) || ""))); } catch { return false; }
  }
  // A review item keeps the public EPK id from a report hold, so approving it also clears those reports.
  async function reviewPut(userId, key, fields) {
    const existing = await get(reviewKey(userId, key)), keep = {};
    if (existing?.publicId?.S && !fields.publicId) keep.publicId = existing.publicId;
    if (existing?.reason?.S && ["reported", "editor_flag"].includes(existing.reason.S)) keep.reason = existing.reason;
    return { Put: { TableName: tableName, Item: { ...reviewKey(userId, key), memberId: { S: userId }, actKey: { S: key }, ...fields, ...keep } } };
  }
  const raced = error => error?.name === "ConditionalCheckFailedException" || error?.name === "TransactionCanceledException";
  // Counts one use of a daily allowance (codes or checks) for this member; false once the day's cap is reached.
  async function withinDailyCap(userId, kind, max) {
    try {
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: { userId: { S: userId }, tourId: { S: `${RECORD_PREFIX}${kind}#${nowIso().slice(0, 10)}` } }, UpdateExpression: "ADD useCount :one SET expiresAt = :expires", ConditionExpression: "attribute_not_exists(useCount) OR useCount < :max", ExpressionAttributeValues: { ":one": { N: "1" }, ":max": { N: String(max) }, ":expires": { N: String(nowSeconds() + 2 * 86400) } } }));
      return true;
    } catch (error) { if (raced(error)) return false; throw error; }
  }
  async function reportedNameKeys(name) {
    const key = lookalikeKey(name);
    if (!key) return [];
    return (await get({ userId: { S: PROTECTED_PARTITION }, tourId: { S: key } })) ? [key] : [];
  }

  // The single rule every gate uses (publish, venue EPK link, booking email; replies only check the hold).
  async function gate({ userId, artistName, epkItem, purpose = "pitch" }) {
    if (epkItem?.impersonationHold?.BOOL === true) return { ok: false, status: "needs_review", hold: true, message: HOLD_MESSAGE };
    if (purpose === "reply") return { ok: true, status: "reply" };
    const name = actNameFrom(artistName), key = actKey(name);
    if (!key) return { ok: false, status: "not_verified", message: "Add your act name first." };
    const view = verificationView(await get(recordKey(userId, key)), nowSeconds(), name);
    if (view.status === "verified") return { ok: true, status: "verified", verifiedAt: view.verifiedAt, method: view.method };
    return { ok: false, status: view.status, message: view.status === "needs_review" ? REVIEW_MESSAGE : VERIFY_MESSAGE };
  }

  async function placeHold({ ownerId, publicId, reason, at }) {
    const epkItem = await get(epkKey(ownerId)), name = kitArtistName(epkItem), key = actKey(name);
    const transaction = [{ Delete: { TableName: tableName, Key: { userId: { S: epkPublicPartition }, tourId: { S: publicId } } } }];
    if (!epkItem) { await db.send(new TransactWriteItemsCommand({ TransactItems: transaction })); return; }
    transaction.push({ Update: { TableName: tableName, Key: epkKey(ownerId), UpdateExpression: "SET published = :false, impersonationHold = :true, holdAt = :at", ExpressionAttributeValues: { ":false": { BOOL: false }, ":true": { BOOL: true }, ":at": { S: at } } } });
    if (key) {
      transaction.push(
        { Update: { TableName: tableName, Key: recordKey(ownerId, key), UpdateExpression: "SET #status = :review, reviewReason = :reason, actName = if_not_exists(actName, :name), actKey = :key, updatedAt = :at", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":review": { S: "needs_review" }, ":reason": { S: reason }, ":name": { S: name }, ":key": { S: key }, ":at": { S: at } } } },
        { Put: { TableName: tableName, Item: { ...reviewKey(ownerId, key), memberId: { S: ownerId }, actKey: { S: key }, actName: { S: name }, reason: { S: reason }, publicId: { S: publicId }, requestedAt: { S: at } } } },
        { Put: { TableName: tableName, Item: { userId: { S: PROTECTED_PARTITION }, tourId: { S: lookalikeKey(name) || key }, actName: { S: name }, addedAt: { S: at }, source: { S: "report" } } } }
      );
    }
    await db.send(new TransactWriteItemsCommand({ TransactItems: transaction }));
  }

  const routes = {
    // Status for the act in the member's EPK (or ?act=...), plus whether this member is a DanzStak editor.
    async status({ userId, event }) {
      const epkItem = await get(epkKey(userId));
      const name = actNameFrom(event.queryStringParameters?.act) || kitArtistName(epkItem), key = actKey(name);
      const view = verificationView(key ? await get(recordKey(userId, key)) : null, nowSeconds(), name);
      if (key && !view.protectedName) view.protectedName = Boolean(protectedNameMatch(name, await reportedNameKeys(name)));
      return [200, { verification: view, hold: epkItem?.impersonationHold?.BOOL === true, editor: await editorFor(userId), note: HONEST_NOTE }];
    },
    // A fresh 24-hour code for this member and act (or the unexpired one already issued).
    async code({ userId, body }) {
      const name = actNameFrom(body.actName), key = actKey(name);
      if (!key) return [400, { error: "Add your act name first." }];
      const item = await get(recordKey(userId, key)), view = verificationView(item, nowSeconds(), name);
      if (view.status === "verified" || view.code) return [200, { verification: view }];
      const day = nowIso().slice(0, 10), issuedToday = attr(item, "codeDay") === day ? num(item, "codesIssuedToday") : 0;
      if (issuedToday >= MAX_CODES_PER_DAY || !await withinDailyCap(userId, "CODES", MAX_MEMBER_CODES_PER_DAY)) return [429, { error: "You asked for several codes today. Use the latest one or try again tomorrow." }];
      const code = newVerificationCode(), at = nowIso(), reported = await reportedNameKeys(name), famous = Boolean(protectedNameMatch(name, reported));
      await db.send(new UpdateItemCommand({
        TableName: tableName, Key: recordKey(userId, key),
        UpdateExpression: "SET actName = :name, actKey = :key, code = :code, codeIssuedAt = :at, codeExpiresAt = :expires, codeDay = :day, codesIssuedToday = :count, checksOnCode = :zero, protectedName = :famous, updatedAt = :at, #status = if_not_exists(#status, :none) REMOVE codeUsedAt",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":name": { S: name }, ":key": { S: key }, ":code": { S: code }, ":at": { S: at }, ":expires": { N: String(nowSeconds() + CODE_TTL_SECONDS) }, ":day": { S: day }, ":count": { N: String(issuedToday + 1) }, ":zero": { N: "0" }, ":famous": { BOOL: famous }, ":none": { S: "not_verified" } }
      }));
      return [200, { verification: verificationView(await get(recordKey(userId, key)), nowSeconds(), name) }];
    },
    // Checks the code on a public page or the act's DNS. Found -> verified (or editor review for protected names).
    async check({ userId, body }) {
      const name = actNameFrom(body.actName), key = actKey(name), method = body.method === "dns" ? "dns" : "page";
      if (!key) return [400, { error: "Add your act name first." }];
      const item = await get(recordKey(userId, key)), view = verificationView(item, nowSeconds(), name), code = attr(item, "code");
      if (view.status === "verified") return [200, { verification: view, message: CHECK_MESSAGES.verified }];
      if (!view.code) return [409, { error: "Your code expired or was already used. Get a new code and add it to the page.", verification: view }];
      if (num(item, "checksOnCode") >= MAX_CHECKS_PER_CODE) return [429, { error: "Too many checks for this code. Get a new code tomorrow or ask for a manual review." }];
      const target = method === "dns" ? validDomain(body.domain) : String(body.url || "").trim().slice(0, 600);
      if (!target) return [400, { error: method === "dns" ? CHECK_MESSAGES.bad_domain : CHECK_MESSAGES.unsafe_url }];
      const at = nowIso();
      try {
        await db.send(new UpdateItemCommand({ TableName: tableName, Key: recordKey(userId, key), UpdateExpression: "SET checksOnCode = if_not_exists(checksOnCode, :zero) + :one, lastCheckAt = :at, lastCheckEpoch = :now", ConditionExpression: "code = :code AND (attribute_not_exists(checksOnCode) OR checksOnCode < :max) AND (attribute_not_exists(lastCheckEpoch) OR lastCheckEpoch <= :spacing)", ExpressionAttributeValues: { ":zero": { N: "0" }, ":one": { N: "1" }, ":at": { S: at }, ":now": { N: String(nowSeconds()) }, ":code": { S: code }, ":max": { N: String(MAX_CHECKS_PER_CODE) }, ":spacing": { N: String(nowSeconds() - CHECK_SPACING_SECONDS) } } }));
      } catch (error) {
        if (error.name === "ConditionalCheckFailedException") return [429, { error: "A check is already running. Wait a few seconds and try again." }];
        throw error;
      }
      if (!await withinDailyCap(userId, "CHECKS", MAX_MEMBER_CHECKS_PER_DAY)) return [429, { error: "That is a lot of checks for one day. Try again tomorrow or ask for a manual review." }];
      let result = "not_found", found = null, checkedUrl = "";
      if (method === "dns") {
        checkedUrl = `dns:${target}`;
        let records = [];
        try { records = await txtResolver(target); } catch { records = []; }
        if (txtHasCode(records, code)) found = { method: "dns" }; else result = "dns_not_found";
      } else {
        const page = await fetchPublicPage(target, { fetcher, resolver });
        checkedUrl = page.url || "";
        if (!page.ok) result = page.reason === "unsafe_url" ? "unsafe_url" : "unreachable";
        else {
          const match = pageHasCode(page.html, code);
          if (match.found && match.method === "page" && !pageNamesAct(page.html, name)) result = "name_missing";
          else if (match.found) found = match;
        }
        // The page contents are dropped here; only the match result is stored.
      }
      if (!found) {
        await db.send(new UpdateItemCommand({ TableName: tableName, Key: recordKey(userId, key), UpdateExpression: "SET lastCheckResult = :result, checkedUrl = :url", ExpressionAttributeValues: { ":result": { S: result }, ":url": { S: checkedUrl.slice(0, 600) } } }));
        return [200, { verification: verificationView(await get(recordKey(userId, key)), nowSeconds(), name), message: CHECK_MESSAGES[result] || CHECK_MESSAGES.not_found }];
      }
      const famous = Boolean(protectedNameMatch(name, await reportedNameKeys(name))) || item?.protectedName?.BOOL === true;
      const values = { ":code": { S: code }, ":at": { S: at }, ":method": { S: found.method }, ":url": { S: checkedUrl.slice(0, 600) }, ":famous": { BOOL: famous } };
      const transaction = famous ? [
        { Update: { TableName: tableName, Key: recordKey(userId, key), UpdateExpression: "SET #status = :review, reviewReason = :reason, #method = :method, checkedUrl = :url, codeUsedAt = :at, lastCheckResult = :result, protectedName = :famous", ConditionExpression: "code = :code AND attribute_not_exists(codeUsedAt)", ExpressionAttributeNames: { "#status": "status", "#method": "method" }, ExpressionAttributeValues: { ...values, ":review": { S: "needs_review" }, ":reason": { S: "protected_name" }, ":result": { S: "needs_review" } } } },
        await reviewPut(userId, key, { actName: { S: name }, reason: { S: "protected_name" }, method: { S: found.method }, checkedUrl: { S: checkedUrl.slice(0, 600) }, autoCheckPassed: { BOOL: true }, requestedAt: { S: at } })
      ] : [
        { Update: { TableName: tableName, Key: recordKey(userId, key), UpdateExpression: "SET #status = :verified, #method = :method, checkedUrl = :url, codeUsedAt = :at, verifiedAt = :at, expiresAt = :expires, lastCheckResult = :result, protectedName = :famous REMOVE reviewReason, reviewNote", ConditionExpression: "code = :code AND attribute_not_exists(codeUsedAt)", ExpressionAttributeNames: { "#status": "status", "#method": "method" }, ExpressionAttributeValues: { ...values, ":verified": { S: "verified" }, ":expires": { N: String(nowSeconds() + VERIFIED_FOR_SECONDS) }, ":result": { S: "verified" } } } },
        { Delete: { TableName: tableName, Key: reviewKey(userId, key) } } // an open manual request is no longer needed
      ];
      try { await db.send(new TransactWriteItemsCommand({ TransactItems: transaction })); }
      catch (error) { if (raced(error)) return [409, { error: "This code was already used. Refresh to see the result." }]; throw error; }
      return [200, { verification: verificationView(await get(recordKey(userId, key)), nowSeconds(), name), message: famous ? CHECK_MESSAGES.needs_review : CHECK_MESSAGES.verified }];
    },
    // Fallback for acts with almost no web presence: an editor checks a gig listing, label page or press mention.
    async review({ userId, body }) {
      const name = actNameFrom(body.actName), key = actKey(name), note = String(body.note || "").replace(/\s+/g, " ").trim().slice(0, 500);
      if (!key) return [400, { error: "Add your act name first." }];
      let evidence;
      try { evidence = new URL(String(body.evidenceUrl || "").trim()); } catch { evidence = null; }
      if (!evidence || evidence.protocol !== "https:" || evidence.username || evidence.password || evidence.href.length > 600) return [400, { error: "Add an https link to a gig listing, label page or press mention that names the act." }];
      const item = await get(recordKey(userId, key));
      if (verificationView(item, nowSeconds(), name).status === "verified") return [200, { verification: verificationView(item, nowSeconds(), name) }];
      const at = nowIso();
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: { TableName: tableName, Key: recordKey(userId, key), UpdateExpression: "SET #status = :review, reviewReason = if_not_exists(reviewReason, :reason), actName = :name, actKey = :key, evidenceUrl = :evidence, updatedAt = :at", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":review": { S: "needs_review" }, ":reason": { S: "manual" }, ":name": { S: name }, ":key": { S: key }, ":evidence": { S: evidence.href }, ":at": { S: at } } } },
        await reviewPut(userId, key, { actName: { S: name }, reason: { S: attr(item, "reviewReason") || "manual" }, evidenceUrl: { S: evidence.href }, ...(note ? { note: { S: note } } : {}), requestedAt: { S: at } })
      ] }));
      return [200, { verification: verificationView(await get(recordKey(userId, key)), nowSeconds(), name), message: "Sent to a DanzStak editor. You will see the result here." }];
    },
    // "Report impersonation" on a public EPK. Two members' reports, or one editor's, unpublish it pending review.
    async report({ userId, body }) {
      const publicId = String(body.publicId || "").trim().toLowerCase(), reason = String(body.reason || "").replace(/\s+/g, " ").trim().slice(0, 300);
      if (!/^[a-z0-9-]{3,64}$/.test(publicId)) return [404, { error: "EPK not found." }];
      const publicItem = await get({ userId: { S: epkPublicPartition }, tourId: { S: publicId } }), ownerId = attr(publicItem, "ownerId");
      if (!publicItem || !ownerId) return [404, { error: "EPK not found." }];
      if (ownerId === userId) return [400, { error: "You cannot report your own EPK." }];
      const at = nowIso(), day = at.slice(0, 10), reporterHash = sha(`artist-report:${userId}`).slice(0, 32);
      try {
        await db.send(new TransactWriteItemsCommand({ TransactItems: [
          { Update: { TableName: tableName, Key: { userId: { S: userId }, tourId: { S: `${REPORT_RATE_PREFIX}${day}` } }, UpdateExpression: "ADD sentCount :one SET expiresAt = :expires", ConditionExpression: "attribute_not_exists(sentCount) OR sentCount < :max", ExpressionAttributeValues: { ":one": { N: "1" }, ":max": { N: String(MAX_REPORTS_PER_DAY) }, ":expires": { N: String(nowSeconds() + 2 * 86400) } } } },
          { Put: { TableName: tableName, Item: { userId: { S: `${REPORT_PREFIX}${publicId}` }, tourId: { S: reporterHash }, ownerId: { S: ownerId }, reportedAt: { S: at }, ...(reason ? { reason: { S: reason } } : {}) }, ConditionExpression: "attribute_not_exists(userId)" } }
        ] }));
      } catch (error) {
        if (error.name !== "TransactionCanceledException") throw error;
        const reasons = error.CancellationReasons || [];
        if (reasons[0]?.Code === "ConditionalCheckFailed") return [429, { error: "You sent several reports today. Try again tomorrow." }];
        return [200, { reported: true, duplicate: true, message: "Thanks. You already reported this EPK." }];
      }
      const editor = await editorFor(userId);
      const count = (await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :partition", ExpressionAttributeValues: { ":partition": { S: `${REPORT_PREFIX}${publicId}` } }, Select: "COUNT", ConsistentRead: true }))).Count || 0;
      if (editor || count >= REPORTS_TO_HOLD) await placeHold({ ownerId, publicId, reason: editor ? "editor_flag" : "reported", at });
      return [200, { reported: true, message: "Thanks. A DanzStak editor will look at this EPK." }];
    },
    async reviews({ userId }) {
      if (!await editorFor(userId)) return [403, { error: "Only DanzStak editors can review artists." }];
      const items = (await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :partition", ExpressionAttributeValues: { ":partition": { S: REVIEW_PARTITION } }, ConsistentRead: true, Limit: 200 }))).Items || [];
      return [200, { reviews: items.map(item => ({ id: attr(item, "tourId"), actName: attr(item, "actName"), reason: attr(item, "reason"), method: attr(item, "method"), checkedUrl: attr(item, "checkedUrl"), evidenceUrl: attr(item, "evidenceUrl"), note: attr(item, "note"), publicId: attr(item, "publicId"), autoCheckPassed: item.autoCheckPassed?.BOOL === true, requestedAt: attr(item, "requestedAt") })).sort((a, b) => a.requestedAt.localeCompare(b.requestedAt)) }];
    },
    // Editor decision. Approve -> verified (and any report hold lifts); reject -> not verified with the editor's note.
    async decide({ userId, body }) {
      if (!await editorFor(userId)) return [403, { error: "Only DanzStak editors can review artists." }];
      const id = String(body.id || ""), decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : "", note = String(body.note || "").replace(/\s+/g, " ").trim().slice(0, 300);
      const match = id.match(/^([^#]{1,200})#([a-z0-9]{1,80})$/);
      if (!match || !decision) return [400, { error: "Choose a review and approve or reject." }];
      const [, memberId, key] = match, request = await get(reviewKey(memberId, key));
      if (!request) return [404, { error: "This review was already handled." }];
      const at = nowIso(), record = await get(recordKey(memberId, key)), publicId = attr(request, "publicId");
      const transaction = [{ Delete: { TableName: tableName, Key: reviewKey(memberId, key), ConditionExpression: "attribute_exists(userId)" } }];
      if (decision === "approve") {
        // An automatic check that passed (famous name) or an act verified before a report keeps its method.
        const keepsMethod = request.autoCheckPassed?.BOOL === true || ["reported", "editor_flag"].includes(attr(request, "reason"));
        const approvedMethod = keepsMethod && attr(record, "method") ? attr(record, "method") : "manual";
        transaction.push({ Update: { TableName: tableName, Key: recordKey(memberId, key), UpdateExpression: "SET #status = :verified, #method = :method, verifiedAt = :at, expiresAt = :expires, reviewerId = :editor, reviewedAt = :at, actName = if_not_exists(actName, :name), actKey = :key REMOVE reviewReason, reviewNote", ExpressionAttributeNames: { "#status": "status", "#method": "method" }, ExpressionAttributeValues: { ":verified": { S: "verified" }, ":method": { S: approvedMethod }, ":at": { S: at }, ":expires": { N: String(nowSeconds() + VERIFIED_FOR_SECONDS) }, ":editor": { S: userId }, ":name": { S: attr(request, "actName") }, ":key": { S: key } } } });
        const epkItem = await get(epkKey(memberId));
        if (epkItem?.impersonationHold?.BOOL === true && actKey(kitArtistName(epkItem)) === key) transaction.push({ Update: { TableName: tableName, Key: epkKey(memberId), UpdateExpression: "REMOVE impersonationHold, holdAt" } });
      } else {
        transaction.push({ Update: { TableName: tableName, Key: recordKey(memberId, key), UpdateExpression: "SET #status = :rejected, reviewerId = :editor, reviewedAt = :at, reviewNote = :note REMOVE reviewReason", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":rejected": { S: "rejected" }, ":editor": { S: userId }, ":at": { S: at }, ":note": { S: note || "An editor could not confirm this act. Ask for a review again with a stronger link." } } } });
      }
      if (decision === "approve" && publicId) {
        const reports = (await db.send(new QueryCommand({ TableName: tableName, KeyConditionExpression: "userId = :partition", ExpressionAttributeValues: { ":partition": { S: `${REPORT_PREFIX}${publicId}` } }, ConsistentRead: true, Limit: 20 }))).Items || [];
        for (const report of reports) transaction.push({ Delete: { TableName: tableName, Key: { userId: report.userId, tourId: report.tourId } } }); // fresh start after approval
      }
      try { await db.send(new TransactWriteItemsCommand({ TransactItems: transaction })); }
      catch (error) { if (raced(error)) return [409, { error: "This review was already handled." }]; throw error; }
      return [200, { decided: decision }];
    }
  };

  const ROUTES = {
    "GET /epk/verify": ["status", false],
    "POST /epk/verify/code": ["code", true],
    "POST /epk/verify/check": ["check", true],
    "POST /epk/verify/review": ["review", true],
    "POST /epk/verify/report": ["report", true],
    "GET /epk/verify/reviews": ["reviews", false],
    "POST /epk/verify/reviews": ["decide", true]
  };

  // Returns a Lambda response for /epk/verify routes, or null for any other path.
  async function handle(event, method, path) {
    const route = ROUTES[`${method} ${path}`];
    if (!route) return null;
    const origin = event.headers?.origin || event.headers?.Origin, headers = { ...corsHeaders(origin), "cache-control": "no-store, private" };
    const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
    if (!originAllowed(origin)) return reply(403, { error: "Forbidden origin" });
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Authentication required." });
    const [statusCode, data] = await routes[route[0]]({ userId, event, body: route[1] ? parse(event) : {} });
    return reply(statusCode, data);
  }

  return { handle, gate, placeHold, routes };
}
