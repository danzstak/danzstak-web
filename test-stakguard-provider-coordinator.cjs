"use strict";
const assert = require("node:assert/strict");

(async () => {
  const { createStakGuardProviderCoordinator, STAKGUARD_PROVIDER_STATUSES } = await import("./infrastructure/auth-api/stakguard-providers.mjs");
  assert.deepEqual(STAKGUARD_PROVIDER_STATUSES, ["found_verified", "found_suspected", "not_found", "unknown", "not_supported"]);
  const fixedNow = () => new Date("2026-11-08T00:00:00.000Z");
  const coordinator = createStakGuardProviderCoordinator({ timeoutMs:100, now:fixedNow, adapters:[
    { id:"permitted-source", displayName:"Permitted source", mode:"licensed_api", enabled:true, coverageVersion:"2026-11-08", allowedHosts:["source.invalid"], scan:async () => ({ status:"found_verified", matchConfidence:1.4, matchedFieldCategories:["email","phone","raw_value"], sourceUrl:"https://source.invalid/listing/opaque", evidenceReference:"evidence-1", nextAction:"Review source evidence" }) },
    { id:"outage-source", displayName:"Unavailable source", mode:"official_public_lookup", enabled:true, coverageVersion:"2026-11-08", allowedHosts:["outage.invalid"], scan:async () => { throw new Error("secret provider response must not escape"); } },
    { id:"timeout-source", displayName:"Slow source", mode:"licensed_api", enabled:true, coverageVersion:"2026-11-08", allowedHosts:["timeout.invalid"], scan:async () => new Promise(() => {}) },
    { id:"handoff-only", displayName:"Official form only", mode:"member_handoff", enabled:true, coverageVersion:"2026-11-08", scan:async () => { throw new Error("handoff must never scan"); } },
    { id:"disabled-source", displayName:"Not approved", mode:"licensed_api", enabled:false, coverageVersion:"2026-11-08", scan:async () => { throw new Error("disabled adapter must never scan"); } }
  ] });
  const sources = coordinator.sources();
  assert.equal(sources.length, 5);
  assert.ok(!sources.some(source => "scan" in source || "allowedHosts" in source));
  const startedAt = Date.now();
  const results = await coordinator.scan({ accountId:"member_opaque_123", identity:{ encryptedProfile:"opaque-ciphertext" } });
  assert.ok(Date.now() - startedAt < 1000, "an adapter that ignores AbortSignal must not hold the coordinator open");
  assert.equal(results.length, 3);
  const found = results.find(result => result.sourceId === "permitted-source");
  assert.equal(found.status, "found_verified");
  assert.equal(found.matchConfidence, 1);
  assert.deepEqual(found.matchedFieldCategories, ["email","phone"]);
  assert.equal(found.sourceUrl, "https://source.invalid/listing/opaque");
  assert.equal(found.checkedAt, "2026-11-08T00:00:00.000Z");
  const outage = results.find(result => result.sourceId === "outage-source");
  assert.equal(outage.status, "unknown");
  assert.equal(outage.errorClass, "provider_error");
  assert.ok(!JSON.stringify(outage).includes("secret provider response"));
  const timeout = results.find(result => result.sourceId === "timeout-source");
  assert.equal(timeout.status, "unknown");
  assert.equal(timeout.errorClass, "provider_timeout");
  await assert.rejects(() => coordinator.scan({ accountId:"", identity:{} }), /account id/);
  await assert.rejects(() => coordinator.scan({ accountId:"member_1", identity:null }), /identity/);
  assert.throws(() => createStakGuardProviderCoordinator({ adapters:[
    { id:"same-source", mode:"licensed_api", scan:async()=>({}) },
    { id:"same-source", mode:"licensed_api", scan:async()=>({}) }
  ] }), /unique/);
  assert.throws(() => createStakGuardProviderCoordinator({ adapters:[
    { id:"no-hosts", mode:"licensed_api", enabled:true, scan:async()=>({ status:"not_found" }) }
  ] }), /hostname allowlist/);
  const unsafeEvidence = createStakGuardProviderCoordinator({ timeoutMs:100, now:fixedNow, adapters:[
    { id:"strict-source", displayName:"Strict source", mode:"official_public_lookup", enabled:true, allowedHosts:["source.invalid"], scan:async()=>({ status:"found_verified", sourceUrl:"https://user:pass@source.invalid/listing" }) }
  ] });
  const [strictResult] = await unsafeEvidence.scan({ accountId:"member_opaque_123", identity:{ encryptedProfile:"opaque-ciphertext" } });
  assert.equal(strictResult.sourceUrl, "", "credential-bearing evidence URLs must fail closed");
  console.log("StakGuard provider coordinator checks passed: approved adapters only, bounded evidence, timeout/outage unknown states, safe metadata, and no handoff or disabled scans.");
})().catch(error => { console.error(error); process.exitCode = 1; });
