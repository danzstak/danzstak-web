# StakGuard scan-provider boundary

Yes, DanzStak can own the scan coordinator. It must not pretend every data broker is safely or lawfully machine-searchable.

## Provider model

One internal coordinator accepts an authenticated member-owned search profile and calls independent source adapters. An adapter may use only one of these approved modes:

1. **Licensed API** — a processor contract and documented API permit the scan.
2. **Official public lookup** — the source's current terms and robots/access rules permit automated lookup without login, CAPTCHA bypass, rate-limit evasion, or collection of unrelated people.
3. **Member handoff** — automation is not permitted or needs sensitive proof; DanzStak links the official form and records only member-controlled milestones.

## Member-controlled request handoff

A handoff is functional removal help, not a scan and not delegated submission:

1. The registry names the verified broker/controller, official privacy page, current request address or form, last-checked date and jurisdiction.
2. DanzStak prepares a neutral template containing placeholders only. The member reviews and completes it locally.
3. **Copy request** writes the reviewed text to the member's clipboard. **Open my email app** creates a `mailto:` draft addressed to the verified privacy contact. The member decides whether to send it. The official form remains available separately.
4. DanzStak does not receive the completed draft, send the message, log into a broker, solve a CAPTCHA, scrape a results page or impersonate the member.
5. Opening a draft/form is not **submitted**. Submission needs member-supplied receipt evidence or an approved provider acknowledgement. **Removed** needs controller evidence or a permitted recheck.
6. The draft has no hidden BCC/CC recipient, forwarding address, tracking pixel or automatic receipt capture. If a later release lets a member explicitly forward or upload a receipt, it needs a separately approved data model, disclosure, retention period, export/deletion controls and account isolation.
7. Use the source's verified designated channel. Do not assume an arbitrary email address creates a valid statutory request, bypasses identity verification, eliminates legal exceptions, or guarantees deletion.

The first verified handoff is PeopleConnect, checked against its [Suppression Center](https://suppression.peopleconnect.us/privacy-center), [privacy policy](https://peopleconnect.us/privacy-policy/) and published `privacy@peopleconnect.us` contact on 2026-11-09. Other listed sources remain under review and expose no prepared email action. Every contact and template must be rechecked before release.

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
- Enabled scan adapters must declare a non-empty exact-host evidence allowlist. Evidence URLs fail closed when the allowlist is missing or the URL contains credentials, a fragment or an unexpected host.
- Coordinator timeout is enforced outside the adapter promise, so a provider that ignores `AbortSignal` cannot hold a member request open indefinitely.

## Build order

1. Pure coordinator contract, encrypted scan-profile model, synthetic adapter, outage tests, and two-account isolation tests.
2. One owner-approved official or licensed source adapter with a consenting test account and captured evidence.
3. Recheck scheduler and truthful timeline states.
4. Add adapters one at a time; never make the number of sources a marketing promise.

The Phase A dashboard shows no findings until an approved adapter returns real source evidence. Synthetic adapters are test-only and never populate a member-facing page.
