# DANZSTAK Privacy Shield — data removal and ongoing monitoring

**Owner proposal: 2026-11-04. Status: research and product specification ONLY — not implemented, tested, launched, or a paid service.**

## Mission

DANZSTAK is **not a data brokerage**. Members should have control over their digital identity. Offer optional help to find exposures of their own information on publicly available people-search/data-broker sites, request removals where legally and technically possible, and **watch their exposure change over time**. Include carefully bounded monitoring of dark-web / Tor onion-source exposure where a lawful, licensed source provides coverage. Do **not** claim to scan every onion site, erase the internet, or guarantee deletion.

Normal account privacy controls and access to free government rights/removal mechanisms remain FREE, whether or not someone subscribes to Privacy Shield. Don't mix this with the optional DANZSTAK Phone $3 internal number or allow advertiser access to member data.

## Core product: understandable monitoring dashboard (owner priority)

Member dashboard must display source/category, type of exposure (e.g. phone, email, address), first detected, last checked, evidence and confidence, legal/technical removal eligibility, user consent/authorization and exact request timeline, with these **distinct truthful states**:

1. **Exposure found (verified / suspected)** — never label an unverified name match as the member's information.
2. **Removal available / needs action** — member can review and authorize.
3. **Request submitted** — include timestamp and proof/receipt; never treat an outgoing request as deletion.
4. **Awaiting response / rejected / exempted / unreachable** — explicit status and next step.
5. **Removal confirmed by source** — the controller's response or authorized source check supports this result, with evidence and date.
6. **Search result delisted only** — distinct from deletion at original source.
7. **Not found on recheck (unconfirmed)** — no longer visible in permitted source, not proof globally erased.
8. **Reappeared / newly discovered** — separate alert and history of follow-ups.
9. **Monitoring unavailable / source coverage lost** — don't display false “clean” or zero-exposure state when API/vendor fails.

Show a dated timeline and simple before/after counts for **verified specific sources only**: open exposures, source-confirmed removals, delistings, reappeared, unremovable, and unchecked; show last successful scan date and source coverage. Never present a fabricated "percent of the internet removed" or an unverifiable "privacy score." Make progress visible with accessible charts or activity summaries only when real evidence exists. Allow notifications for newly detected/returned exposures, with safe neutral contents (no raw personal information in push).

### Example of expected dashboard records

- People-search listing A — personal mobile listed — 2026-11-04 found — request sent — awaiting source confirmation.
- Broker B — home address listed — 2026-11-10 source-confirmed removed — evidence retained in private record.
- Google Search result C — delisted — original website still hosts page.
- Tor leak-intelligence match D — potential email exposure — limited signal, source uncontactable; secure account remediation recommended. **Do not mark deleted.**

These are example states, **not real user exposures**.

## Tor / .onion / “dark web” monitoring — explicit owner scope

- **Include dark-web exposure monitoring** but *do not promise “all Tor sites.”* Onion services are independent, not centrally indexed and may change or disappear; even the Tor Project cannot identify or remove their hosts. Reference: https://support.torproject.org/abuse/remove-content-from-onion-address/
- Feasibility first: evaluate reputable licensed breach-intelligence / cyber-threat-monitoring APIs that can lawfully report matching email/phone/alias indicators from available exposure data; document provider coverage, update frequency, exact match confidence, compliance, cost, retention, and takedown limitations. No automatic broad crawl, purchase of stolen databases, illicit-market enrollment, scraping of gated onion sites, or interaction with offenders.
- Authenticate that the request concerns the member's **own data** (or a legitimately authorized dependent/representative). Use minimum necessary exact-match indicators. Do not report nonmatching third-party personal information; do not display or store leaked passwords, authentication tokens, payment card data, or illicit contents. No unfiltered raw dumps, unnecessary credential collection, or onward sharing of leaked content.
- Dark-web alert ≠ confirmed compromise, and removal from an onion site often cannot be compelled. Offer **practical account protection steps**: reset exposed passwords on affected service, enable MFA/passkeys, revoke sessions, replace exposed contact detail if needed, and contact appropriate authorities for credible threats. Notify without revealing actual sensitive leak material in push/email.
- Document that monitoring only covers the sources a vendor can lawfully see. Vendor claims such as “100% of Tor” or “all dark web sites” must be rejected. If no reliable licensed source passes review, postpone the dark-web module rather than fake results.

## Research before building or charging

1. Audit existing DANZSTAK `privacy.html`, authorization, data export/deletion, architecture, third-party access and procurement; propose a separate isolated data model with encryption, per-account access checks, purpose limitation, minimal retention, deletion/export and audit trail. Data used by Privacy Shield MUST NOT be used for ads, caller targeting or to build a broker database. Complete privacy impact and security assessment, processor contracts and jurisdiction review before gathering any real-member PII.
2. Members must specifically opt in, review exact personal identifiers to be scanned, authorize each type of action and be able to stop monitoring, revoke authority and erase their Privacy Shield search profiles. The service must not seek SSNs/government IDs, passwords or identity documents unless a legally justified provider action absolutely requires it, with separate explicit approval and secure procedure. The lowest viable data collection is best.
3. Free legal/official pathways must stay clearly free and directly accessible:
   - California **DROP**: https://privacy.ca.gov/drop/ — free for eligible Californians; users should use it directly. Do not collect their confidential DROP IDs, impersonate government systems, or paywall the link.
   - Google **Results about you**: https://myactivity.google.com/results-about-you — remove/delist qualifying Google Search results only, **not source websites**.
   - GDPR Article 17 erasure is conditional and may have lawful exceptions. Determine jurisdiction and controller, don't claim all records must be erased.
4. Compare build-vs-buy: licensed vendor APIs, brokerage opt-out sources, consent-based assistance, request automation allowed by terms, false-positive review, per-user scanning costs, customer support and ongoing retention. No guaranteed removals or all-site coverage. No paid data scans/services until cost/privacy approval.
5. Optional monetization proposal for owner review: retain **free privacy education, consent settings and links to public removal tools**, and later consider a **paid convenience plan** for authorized request management, periodic rechecks, progress history, and qualifying licensed dark-web alerts. Do not create Stripe products/prices or recurring charges yet; cost margins, price, refunds, actual benefits and data protection obligations must be reviewed first. Use DANZSTAK's own Stripe account exclusively; never touch SFScoop.

## Engineering delivery / proof

**Phase A (first PR):** legal, vendor, cost, feasibility and risks report; user journey and privacy-first dashboard mock populated ONLY with clearly labeled synthetic example data. No real dark-web requests, opt-outs, user PII collection or paid provider accounts.

**Phase B (owner-approved):** connect one lawful source and one genuinely authorized opt-out process, implement source/status provenance and a real before/after timeline. Test that “requested,” “delisted,” “source-confirmed removed,” “not found,” “reappeared,” and “unknown due to outage” are never conflated. No speculative progress claims.

**Phase C (separately approved):** integrate qualifying licensed dark-web signals and periodic rechecks with cautious alerts, coverage disclaimer and account safety guidance; evaluate subscription when unit economics and privacy impact are proved.

For each phase: separate PR, exact automated and real-source tests with consent and authorization, two-account isolation/false-positive checks, provider downtime, deletion and export tests, international translations, accessible 320–430px mobile UI, **verified phone-accessible staging PWA preview**, evidence-linked report and **owner approval before deployment**. Do not release an invented dashboard or new subscriptions from written instructions alone.

**Outcome:** Users can truthfully see what data exposure was found, what has been requested, what was confirmed removed, and what persists or reappears—not a pretend promise that everything online is gone.
