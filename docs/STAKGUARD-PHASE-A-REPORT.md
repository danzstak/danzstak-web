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

The public privacy contact is `privacy@peopleconnect.us`. PeopleConnect's process requires member verification, and its terms prohibit scraping/automated access. StakGuard therefore exposes only a member-operated handoff. California DROP remains a direct official free-tool link. Spokeo's official form is verified; it requires a listing URL and email confirmation and warns that records may reappear. Whitepages and BeenVerified remain **under review** and have no request-email action.

### Government registry findings (checked 2026-11-09)

- The [California Data Broker Registry](https://cppa.ca.gov/data_broker_registry/) publishes a CSV. The current file contained 931 registration rows when checked. Its columns distinguish a **primary contact email** from a separate **website where consumers may exercise privacy rights**. The contact email is not automatically a designated deletion or opt-out inbox and must not be presented as one without source-specific verification.
- California [DROP](https://privacy.ca.gov/drop/) is the free authenticated consumer workflow for one request to active registered brokers. The official flow requires the member to confirm California residency through the state eligibility process. It is not initiated by email, does not publish a consumer mass-deletion email address and must not be bypassed with a DanzStak BCC workflow.
- The [Oregon DOJ consumer guidance](https://www.doj.state.or.us/consumer-protection/id-theft-data-breaches/privacy/privacy-law-faqs-for-consumers/) points to a searchable DCBS registry containing broker contact information and the broker's opt-out method. The official source reviewed here does not establish a bulk downloadable list of opt-out email addresses.
- The [Texas Secretary of State](https://www.sos.state.tx.us/statdoc/data-brokers.shtml) provides a searchable central registry. Its registration form contains a general business email field; that does not establish the email as a designated consumer-rights endpoint.
- Vermont exposes data-broker records through its business-record search. Colorado privacy sources reviewed in this pass describe consumer rights and universal opt-out mechanisms but did not establish a state data-broker registry equivalent to California DROP. Both remain under review; no bulk import or coverage claim is approved.

Any future registry importer must preserve source, retrieval time and the original field meaning. It may ingest broker identity, public website and an explicitly published consumer-rights URL, but it may not convert a general contact email into an opt-out action. Every member-facing request channel still requires source-specific verification before it is enabled.

## Legal and product boundary

Having the member send their own request materially reduces scraping, impersonation and unauthorized automated-submission risk. It does **not** by itself establish that there are no compliance obligations. Before collecting real identifiers or advertising live broker coverage, DanzStak still needs reviewed privacy disclosures, data-minimization/retention controls, account isolation, security controls, jurisdiction-specific wording, accurate consumer claims and re-verification of each broker's current terms and channel.

California's adopted DROP regulation [section 7621](https://cppa.ca.gov/regulations/pdf/data_broker_drop_reg.pdf) requires disclosure when an authorized agent aids a consumer in DROP, while the California Attorney General's [CCPA consumer guidance](https://www.oag.ca.gov/privacy/ccpa) explains the permission and identity checks a business may apply to an authorized-agent request. The Attorney General also says consumers must use a business's designated method, businesses may verify identity, and deletion has exceptions. The tested Phase A path deliberately does not access DROP, submit through DROP, sign or send on a member's behalf, or claim authority. It prepares a direct first-person request locally and leaves the member as the sole sender. This is an engineering boundary for counsel to review, not a claim of blanket legal immunity or guaranteed deletion.

The handoff contains no DanzStak BCC/CC address, hidden forwarding address, tracking pixel or automatic receipt capture. Adding one would transmit the member's request and personal identifiers to DanzStak and would invalidate the current statement that DanzStak does not receive or store the completed draft. Status may not advance to **submitted** without explicit member-supplied evidence or an approved provider acknowledgement.

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
