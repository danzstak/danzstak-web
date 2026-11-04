# DANZSTAK Privacy Shield — data removal and ongoing monitoring

**Owner proposal: 2026-11-04. Status: research and product specification ONLY — not implemented, tested, launched, or a paid service.**

## Mission

DANZSTAK is **not a data brokerage**. Members should have control over their digital identity. Offer optional help to find exposures of their own information on publicly available people-search/data-broker sites, request removals where legally and technically possible, and **watch their exposure change over time**. Include carefully bounded monitoring of dark-web / Tor onion-source exposure where a lawful, licensed source provides coverage. Do **not** claim to scan every onion site, erase the internet, or guarantee deletion.

Normal account privacy controls and access to free government rights/removal mechanisms remain FREE, whether or not someone subscribes to Privacy Shield. Don't mix this with the optional DANZSTAK Phone $3 internal number or allow advertiser access to member data.

## Owner prioritization — broker removals FIRST (2026-11-04)

**This is the immediate build order.** Do not begin with Tor crawling, a sweeping universal internet-removal claim or a generic “privacy score.” Start with **data-broker / people-search site listings and correctly scoped opt-out or deletion notices**, plus an evidence-backed progress dashboard. Tor exposure monitoring remains a separate later-phase research item.

### Initial supported workflow

1. **Discover:** Audit 5–10 high-relevance active broker/people-search companies and their current official opt-out/deletion URLs, supported jurisdictions, proof-of-identity requirements, expected response handling, permitted automation and source access terms. Curate a dated broker registry with verified sites and official links, not guessed URLs. Include both California/US and GDPR-eligible users where a validated process applies. Never confuse broker sites with regulated investment brokerage firms.
2. **Review exposure:** Show each member the actual source page, matched personal fields, match confidence and detection date; avoid false positives involving namesakes. The user opts into scanning only their own information or that of a legally authorized representative.
3. **Authorize:** Offer a source-specific **Prepare removal request** workflow. Pre-fill a user-reviewable privacy deletion/opt-out notice with the correct recipient/source, source URL, exact information, applicable jurisdiction and legal basis *only when verified*, and requested suppression or deletion. A privacy deletion/opt-out notice is **not a DMCA copyright takedown**. Never falsely assert a legal right or impersonate the member.
4. **Submit only with authority:** Start with a user-controlled copy/email or official opt-out link; log the source and time as **User opened form** or **Draft created**, not “submitted.” Where automated agent submissions are later explicitly authorized, require proof the target's terms allow it, explicit user consent and a true provider acknowledgment/receipt before moving to **Request submitted**. No unsanctioned CAPTCHA bypass, private-login scraping or government system automation.
5. **Track:** Exact states for Found, Draft prepared, Submitted with evidence, Awaiting source response, Rejected/exempted, Confirmed source removal, No longer visible on recheck, and Reappeared. Schedule rechecks only after user opt-in; preserve dates, limited proof and source-of-truth. Don't mark “removed” because a search-engine result disappeared or a form was opened.
6. **Monitor:** Dated scans of authorized sources, show **X of Y sites checked**, real confirmed results and failures. If a source is temporarily unavailable, mark its status **Unknown**, never “Clean.” Notify members if a listing returns, without exposing their address/phone in push notifications.
7. **Minimize data:** Do not collect driver's licenses, passport scans, SSNs or other unnecessary information simply to make opt-outs convenient. If a source requires sensitive proof of identity, explain the requirement and **send member directly to the official source** unless a separate owner-approved regulated process is ready. Do not keep extra broker data to monetize it or resell it.
8. **Respect free tools:** Directly link the official California DROP at https://privacy.ca.gov/drop/ (free to eligible California residents; government processing began Aug 2026), and never charge as though DANZSTAK owns government deletion rights. For non-Californians show jurisdiction-specific rights where established and otherwise use site-specific procedures. The FTC notes one-by-one opt-outs are commonly free, that data may reappear, and that opt-outs do not wipe government public records: https://consumer.ftc.gov/articles/what-know-about-people-search-sites-sell-your-information. EU GDPR Article 17 is conditional: https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en.

### MVP developer deliverable — small and testable

- **Milestone 1 (audit/design):** Curated evidence-backed registry of 5–10 active broker opt-out processes and a functional synthetic-data prototype showing reviewable requests and honest status history. No real PII, paid scanning providers or actual submissions. Document legal and international differences, source terms, unit costs and maintenance burden.
- **Milestone 2 (separately approved):** With consent, test one legitimate self-service opt-out end to end (including authenticated receipt/status where available) and provide real recheck evidence using the consenting account; prove account isolation, audit trail, revocation and deletion before expanding. Pilot 5–10 brokers progressively; do not promise full automation or guaranteed removal.
- **Milestone 3 (separately approved):** Scale authorized source coverage, recheck scheduling and member-facing progress; price paid *convenience/monitoring* only after support cost and provider terms are verified. Tor comes after a credible broker MVP.

**Acceptance criterion:** A member should be able to open Privacy Shield, see a legitimately discovered broker listing, **review a correctly addressed removal request**, send it using the official authorized channel, and later see an accurate state change backed by a source response/recheck. Not merely receive a generic letter generator. Test 320–430px installed-PWA layout, 15 supported languages (or verified current list), secure per-account boundaries, source failures and retention. All phases require a PR, evidence, staging preview and explicit owner approval before production.


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

## Owner directive — subscription monetization (2026-11-04)

The owner confirms that **Privacy Shield should be an optional recurring subscription business**, built on ongoing broker scans, opt-out support, honest removal progress, and reappearance alerts. A one-time “take it down” sale is insufficient because data brokers periodically recirculate personal information. Use DANZSTAK's own Stripe account only; no SFScoop account, products, webhooks, customer data or credentials.

### Proposed tier and pricing hypotheses — NOT approved Stripe prices

| Tier | Illustrative price | Scope and guardrails |
| --- | --- | --- |
| Free DIY | $0 | Privacy education; links to official free government and broker self-opt-outs; personal data controls; optionally a modest clearly limited exposure overview if technically/privacy-feasible. No paywall on privacy rights or core DANZSTAK account controls. |
| Monitor | **$2.99/month or $29/year** (proposal) | Consent-based scans of a clearly enumerated set of **actually supported** public broker sources; progress dashboard, history, exposure/reappearance alerts, and user-guided removal notices. Scanning frequency and broker coverage must be accurately stated at checkout. No claim of automated submissions if none occur. |
| Managed | **$6.99/month or $69/year** (proposal, later) | Everything in Monitor plus validated opt-out/removal request handling for **only** explicitly supported brokers where user authorization and site terms permit; periodic verified source rechecks; bounded support and retries. Do not launch before real end-to-end removal evidence and cost review. |
| Family, dark-web or expanded coverage | **Later, price TBD** | Separate future research and consent/legal/vendor approval. Do not claim all-Tor monitoring or dark-web removal. |

These prices are **brainstorming hypotheses, not owner-finalized purchase terms**. The MVP with 5–10 researched brokers is a **pilot** and must not advertise the Managed plan as broad automated coverage. Scale source coverage and prove unit economics before launching a paid tier. No arbitrary “unlimited removals,” no invented source counts or claims that monitoring occurs continuously if rechecks are periodic.

### Market pricing and competitiveness — verified public reference pages, Nov 2026

- Optery Free Basic offers self-service and exposure reports; Core advertises **$3.99/month or $39/year** for 380+ supported sites (vendor claim): https://www.optery.com/pricing/
- EasyOptOuts advertises **$19.99/year** and removal from 200+ high-visibility broker sites, with three scans per year (vendor claim): https://www.easyoptouts.com/pricing
- Incogni Standard advertises **$7.99/month effective price billed annually** ($95.88/year) for 420+ data brokers; monthly billing is more expensive (vendor claim): https://incogni.com/pricing
- Codex must refresh actual prices and terms before proposing DANZSTAK's launch catalog and **confront the competition gap**. Do not sell a 10-broker-only pilot as equivalent to established 200–400+ site subscriptions. Differentiation should be verifiable source-by-source evidence, understandable status, privacy safeguards, and integrated account UX—not fabricated coverage.

### Subscription implementation and operating rules

1. Present a truly optional, clearly priced recurring subscription only **after** owner approval of launch scope, actual broker coverage, provider/site permissions and cost model; show monthly/annual billing amount, renewal date, exact included sites/actions, frequency, jurisdiction, exclusions, refund terms and cancellation path. Free DIY stays fully available.
2. Model recurring scanning and follow-up cost per subscriber: vendor search/API charges, engineering, per-source recheck frequency, notification/email, verification, manual support, disputes, incident response, taxes, Stripe fees and GDPR/consumer compliance. Test sensitivity at 100, 1,000 and 10,000 subscribers and repeat exposures. No negative-margin “unlimited” service.
3. Use server-verified DANZSTAK-specific Stripe subscriptions and signed webhooks, idempotent enrollment/renewal/update/cancellation, entitlement reconciliation, failed payments, refunds, billing proration policy and self-service customer portal. **No direct automatic Stripe writes, live charges or subscriptions before explicit owner approval.**
4. A member can cancel monitoring, stop/delete their scanned identifiers, request data export and revoke removal authorizations; define clear expiration/retention of history and consent records. No dark patterns, unsolicited outreach, sale of personal information, or use of Privacy Shield data for ads or DANZSTAK Phone caller targeting.
5. Display **exact actual check dates and source coverage**. A subscription must not be sold as a guarantee of deletion or immunity from spam; any disputed/out-of-scope broker remains correctly labeled. Alerts for reappearance are useful only if the source has actually been checked.
6. First deliverable: revised documented business case and optional prototype pricing UI with **synthetic data**, not real subscriptions. Include comparison of a lean in-house tool vs licensed removal provider. Separate PR, tests, owner-verified staging PWA and report before launch.

**Owner gate:** Subscription-based revenue direction is approved *as a strategy*, **not** these exact prices or any real Stripe billing activation.
