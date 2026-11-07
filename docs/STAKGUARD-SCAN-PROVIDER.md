# StakGuard scan-provider boundary

Yes, DanzStak can own the scan coordinator. It must not pretend every data broker is safely or lawfully machine-searchable.

## Provider model

One internal coordinator accepts an authenticated member-owned search profile and calls independent source adapters. An adapter may use only one of these approved modes:

1. **Licensed API** — a processor contract and documented API permit the scan.
2. **Official public lookup** — the source's current terms and robots/access rules permit automated lookup without login, CAPTCHA bypass, rate-limit evasion, or collection of unrelated people.
3. **Member handoff** — automation is not permitted or needs sensitive proof; DanzStak links the official form and records only member-controlled milestones.

Each adapter returns the same evidence envelope:

```text
sourceId, checkedAt, coverageVersion, status,
matchConfidence, matchedFieldCategories,
sourceUrl, evidenceReference, nextAction,
providerRequestId, errorClass
```

Allowed scan statuses are `found_verified`, `found_suspected`, `not_found`, `unknown`, and `not_supported`. A timeout, block, rate limit, changed page, provider outage, or lost coverage always returns `unknown`, never `not_found` or `clean`.

## Safety requirements

- The API accepts only an authenticated account's own approved identifiers or an explicitly authorized representative profile.
- Raw identifiers are encrypted and purpose-bound; logs contain opaque request IDs, never names, addresses, emails, or phone numbers.
- Exact-match results are returned only to the owning account. Namesake results remain suspected until the member reviews them.
- Results have a source version, timestamp, expiry, and recheck history. No adapter can mark a removal confirmed without source evidence.
- Per-account and per-source rate limits, bounded timeouts, retry backoff, circuit breakers, and deletion/export are mandatory.
- No SSN, password, government-ID image, DROP ID, address-book upload, raw breach material, CAPTCHA bypass, private-login scraping, or cross-member search.
- Every new adapter ships disabled and requires source-specific legal/terms review, controlled tests, and owner approval before it can receive member data.

## Build order

1. Pure coordinator contract, encrypted scan-profile model, synthetic adapter, outage tests, and two-account isolation tests.
2. One owner-approved official or licensed source adapter with a consenting test account and captured evidence.
3. Recheck scheduler and truthful timeline states.
4. Add adapters one at a time; never make the number of sources a marketing promise.

The Phase A dashboard shows no findings until an approved adapter returns real source evidence. Synthetic adapters are test-only and never populate a member-facing page.
