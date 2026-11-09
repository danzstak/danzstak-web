# StakGuard Phase A report

**Status:** DRAFT REVIEW — member-controlled removal handoff and provider boundary tested locally; no live scan, payment, AWS change or deployment.

## What is functional

- A phone-first StakGuard dashboard gives every member official free-tool links, an honest unscanned state and the owner-set `$4 × whole months` monitoring explanation with checkout disabled.
- The verified PeopleConnect entry prepares a placeholder-only privacy request. The member can edit it locally, copy it, open it in their own email application, or use the official suppression form.
- DanzStak does not send the email, submit the form, collect the completed draft, impersonate the member, scrape a protected page, bypass verification or mark the request submitted merely because a draft/form opened.
- The server-side provider coordinator accepts only explicitly enabled licensed/official adapters, fails evidence URLs closed against an exact hostname allowlist, and returns `unknown` within the bounded timeout even when an adapter ignores cancellation.

## Source verification

PeopleConnect was checked on 2026-11-09 against:

- <https://suppression.peopleconnect.us/privacy-center>
- <https://peopleconnect.us/privacy-policy/>
- <https://peopleconnect.us/terms-of-use/>

The public privacy contact is `privacy@peopleconnect.us`. PeopleConnect's process requires member verification, and its terms prohibit scraping/automated access. StakGuard therefore exposes only a member-operated handoff. California DROP remains a direct official free-tool link. Spokeo, Whitepages and BeenVerified remain **under review** and have no request-email action.

## Legal and product boundary

Having the member send their own request materially reduces scraping, impersonation and unauthorized automated-submission risk. It does **not** by itself establish that there are no compliance obligations. Before collecting real identifiers or advertising live broker coverage, DanzStak still needs reviewed privacy disclosures, data-minimization/retention controls, account isolation, security controls, jurisdiction-specific wording, accurate consumer claims and re-verification of each broker's current terms and channel.

## Remaining gates

1. Owner phone walkthrough of the draft handoff and wording.
2. Counsel/privacy review before collecting real member PII or enabling a live source.
3. Separately approve one licensed or explicitly permitted discovery source if StakGuard is to automatically show where a member's data appears.
4. Keep monitoring payment disabled until real coverage, recheck cost, notices and deletion/export behavior are verified.

## Test evidence

- `test-stakguard-provider-coordinator.cjs`: passed, including non-cooperative timeout and fail-closed evidence-host controls.
- `test-stakguard-phase-a.cjs`: passed, including placeholder-only request, verified recipient, no `fetch`, no checkout and PWA shell coverage.
- `browser-checks/stakguard-phase-a.cjs`: passed at 320, 360, 390, 414, 430 and 1366px; no overflow, hidden section tab, unsafe external link, inaccessible control or false status.
- Complete `test-regressions.ps1`: passed, including release verification, 16-page site smoke and 153,861-byte infrastructure validation.

No production deployment, vendor signup, Stripe product, charge, broker submission or real-member scan is part of Phase A.
