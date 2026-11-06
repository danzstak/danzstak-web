"use strict";

const assert = require("node:assert/strict");

const apiUrl = String(process.env.DANZSTAK_HEALTH_API_URL || "https://api.danzstak.com").replace(/\/$/, "");
const siteOrigin = String(process.env.DANZSTAK_HEALTH_SITE_ORIGIN || "https://danzstak.com").replace(/\/$/, "");
const token = String(process.env.DANZSTAK_SYNTHETIC_SESSION_A || "");
const query = String(process.env.DANZSTAK_BOOKING_SMOKE_QUERY || "punk clubs in Tacoma, Washington, United States").trim();
const timeoutMs = Number(process.env.DANZSTAK_HEALTH_TIMEOUT_MS || 35000);

assert.match(token, /^[a-f0-9]{64}$/i, "DANZSTAK_SYNTHETIC_SESSION_A must be a controlled 64-character session token");
assert.ok(query.length >= 3 && query.length <= 240, "DANZSTAK_BOOKING_SMOKE_QUERY must be 3–240 characters");

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      signal: controller.signal,
      redirect: "error",
      headers: {
        origin: siteOrigin,
        authorization: `Bearer ${token}`,
        "user-agent": "DANZSTAK-booking-provider-smoke/1.0",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => ({}));
    assert.ok(response.ok, `${options.method || "GET"} ${path} returned HTTP ${response.status}: ${body.error || "unknown error"}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const session = await request("/auth/session");
  assert.equal(session.authenticated, true, "Controlled smoke session must be authenticated");

  const data = await request("/venues/search", {
    method: "POST",
    body: JSON.stringify({ query, page: 0, radiusMiles: 40 })
  });

  assert.equal(typeof data.location?.label, "string", "Venue discovery must resolve a locality label");
  assert.ok(Array.isArray(data.venues), "Venue discovery must return a venues array");
  assert.ok(Array.isArray(data.researchLeads), "Venue discovery must return a research-leads array");
  assert.ok(data.providers && typeof data.providers === "object", "Venue discovery must disclose provider status");
  const providerStates = Object.fromEntries(Object.entries(data.providers).map(([name, value]) => [name, String(value?.status || value || "unknown")]));
  assert.ok(Object.keys(providerStates).length > 0, "At least one discovery provider must report status");

  const sourcedVenueCount = data.venues.filter(venue =>
    Array.isArray(venue.sources) && venue.sources.some(source => /^https:\/\//i.test(String(source?.url || "")))
  ).length;
  const sourcedResearchCount = data.researchLeads.filter(lead => /^https:\/\//i.test(String(lead?.url || ""))).length;
  assert.ok(sourcedVenueCount + sourcedResearchCount > 0, "Real-provider smoke must return at least one source-attributed venue or research lead");

  process.stdout.write(JSON.stringify({
    status: "PASS",
    mode: "authenticated-read-only-real-provider",
    localityResolved: true,
    venueCount: data.venues.length,
    sourcedVenueCount,
    researchLeadCount: data.researchLeads.length,
    sourcedResearchCount,
    providerStates,
    expandedRadius: Number(data.radiusMiles || 0) > 40
  }, null, 2) + "\n");
}

main().catch(error => {
  console.error(`Booking provider smoke failed: ${error.name === "AbortError" ? "request timed out" : error.message}`);
  process.exitCode = 1;
});
