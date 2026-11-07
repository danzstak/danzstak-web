"use strict";

import { randomUUID } from "node:crypto";

const ALLOWED_STATUSES = new Set(["found_verified", "found_suspected", "not_found", "unknown", "not_supported"]);
const ALLOWED_CATEGORIES = new Set(["name", "email", "phone", "address", "age_range", "relative", "employment", "property"]);
const SOURCE_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const ACCOUNT_ID = /^[A-Za-z0-9:_-]{3,160}$/;

function bounded(value, max, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text.length <= max ? text : text.slice(0, max);
}

function safeHttpsUrl(value, allowedHosts) {
  if (!value) return "";
  let url;
  try { url = new URL(String(value)); } catch { return ""; }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) return "";
  if (allowedHosts.size && !allowedHosts.has(url.hostname.toLowerCase())) return "";
  return url.toString();
}

function normalizeResult(adapter, result, checkedAt, requestId) {
  const status = ALLOWED_STATUSES.has(result?.status) ? result.status : "unknown";
  const categories = [...new Set(Array.isArray(result?.matchedFieldCategories) ? result.matchedFieldCategories : [])]
    .filter(category => ALLOWED_CATEGORIES.has(category));
  const confidence = Number(result?.matchConfidence);
  return Object.freeze({
    sourceId: adapter.id,
    sourceName: adapter.displayName,
    checkedAt,
    coverageVersion: bounded(adapter.coverageVersion, 80, "unversioned"),
    status,
    matchConfidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : null,
    matchedFieldCategories: Object.freeze(categories),
    sourceUrl: safeHttpsUrl(result?.sourceUrl, adapter.allowedHosts),
    evidenceReference: bounded(result?.evidenceReference, 180),
    nextAction: bounded(result?.nextAction, 240),
    providerRequestId: bounded(result?.providerRequestId, 160, requestId),
    errorClass: status === "unknown" ? bounded(result?.errorClass, 60, "provider_unavailable") : ""
  });
}

function publicAdapter(adapter) {
  return Object.freeze({
    id: adapter.id,
    displayName: adapter.displayName,
    mode: adapter.mode,
    enabled: adapter.enabled,
    coverageVersion: adapter.coverageVersion
  });
}

function validateAdapter(input) {
  if (!input || !SOURCE_ID.test(String(input.id || ""))) throw new TypeError("StakGuard adapter id is invalid.");
  if (typeof input.scan !== "function") throw new TypeError(`StakGuard adapter ${input.id} has no scan function.`);
  if (!["licensed_api", "official_public_lookup", "member_handoff"].includes(input.mode)) throw new TypeError(`StakGuard adapter ${input.id} has an invalid mode.`);
  const hosts = new Set((input.allowedHosts || []).map(host => String(host).toLowerCase()).filter(Boolean));
  return Object.freeze({
    id:String(input.id), displayName:bounded(input.displayName, 100, input.id), mode:input.mode,
    enabled:input.enabled === true, coverageVersion:bounded(input.coverageVersion, 80, "unversioned"),
    allowedHosts:hosts, scan:input.scan
  });
}

async function runAdapter(adapter, context, timeoutMs, now) {
  const requestId = randomUUID();
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(context.signal?.reason);
  context.signal?.addEventListener("abort", abortFromParent, { once:true });
  const timer = setTimeout(() => controller.abort(new Error("provider_timeout")), timeoutMs);
  try {
    const result = await adapter.scan({ identity:context.identity, signal:controller.signal, requestId });
    return normalizeResult(adapter, result, now().toISOString(), requestId);
  } catch (error) {
    const errorClass = controller.signal.aborted ? (context.signal?.aborted ? "scan_cancelled" : "provider_timeout") : "provider_error";
    return normalizeResult(adapter, { status:"unknown", errorClass }, now().toISOString(), requestId);
  } finally {
    clearTimeout(timer);
    context.signal?.removeEventListener("abort", abortFromParent);
  }
}

export function createStakGuardProviderCoordinator({ adapters = [], timeoutMs = 8000, now = () => new Date() } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new TypeError("StakGuard provider timeout is invalid.");
  const normalized = adapters.map(validateAdapter);
  if (new Set(normalized.map(adapter => adapter.id)).size !== normalized.length) throw new TypeError("StakGuard adapter ids must be unique.");
  const enabled = normalized.filter(adapter => adapter.enabled && adapter.mode !== "member_handoff");
  return Object.freeze({
    sources:() => Object.freeze(normalized.map(publicAdapter)),
    async scan({ accountId, identity, signal } = {}) {
      if (!ACCOUNT_ID.test(String(accountId || ""))) throw new TypeError("StakGuard account id is invalid.");
      if (!identity || typeof identity !== "object" || Array.isArray(identity)) throw new TypeError("StakGuard scan identity is invalid.");
      if (signal?.aborted) return Object.freeze([]);
      const results = await Promise.all(enabled.map(adapter => runAdapter(adapter, { identity, signal }, timeoutMs, now)));
      return Object.freeze(results);
    }
  });
}

export const STAKGUARD_PROVIDER_STATUSES = Object.freeze([...ALLOWED_STATUSES]);
