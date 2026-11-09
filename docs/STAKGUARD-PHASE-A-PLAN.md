# StakGuard Phase A plan

**Status:** Owner-directed provider foundation and honest empty-state dashboard. No real member identifiers, broker scans, opt-out submissions, vendor account, Stripe product, charge, or production deployment until a permitted adapter is approved.

## Product boundary

StakGuard is for every DanzStak member under **Settings → Your data**. It is separate from creator-content attribution and tracked DanzStak share links.

- **Free:** show evidence-backed matches from supported data-broker or people-search sources, source/date/confidence, official free removal paths, and a source-specific removal draft the member reviews.
- **Monitoring:** `$4 × whole prepaid months`, 1–12 months, no discount, subscription, or automatic renewal. One reminder 3–4 days before paid time expires. Monitoring must stop at expiry unless the member chooses to pay again.
- Broker removal comes first. Dark-web coverage is later and must never be described as complete.

## Verified legal and source facts (checked 2026-11-07)

1. California's official [DROP](https://privacy.ca.gov/drop/how-drop-works/) is free to eligible California residents. Brokers began processing requests in August 2026, must re-check at least every 45 days, and report states including pending, deleted, exempted, opted out of sale, and not found. DanzStak must link to DROP directly, never collect a member's private DROP ID, and never sell this government right.
2. The [FTC's people-search guidance](https://consumer.ftc.gov/articles/what-know-about-people-search-sites-sell-your-information) says site-by-site opt-outs are generally free, may not remove public records, and may need repeating. StakGuard must not claim an opt-out erases the internet.
3. The European Commission explains that [GDPR erasure is conditional](https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en), with exceptions such as legal obligations, freedom of expression, and legal claims. A draft must use a legal basis only after jurisdiction/controller validation.
4. A viable licensed integration exists in principle: [Optery publishes an API](https://www.optery.com/api/) and a sandbox reference, but public per-member API pricing is not disclosed. No vendor selection is possible until a written quote, DPA/subprocessor review, supported-country list, deletion/export behavior, evidence model, and permitted white-label use are obtained.
5. PeopleConnect's official [Suppression Center](https://suppression.peopleconnect.us/privacy-center), [privacy policy](https://peopleconnect.us/privacy-policy/) and published privacy address (`privacy@peopleconnect.us`) support a member-controlled handoff. Its terms prohibit scraping and automated access. DanzStak may prepare a neutral request and open the member's email application or official form, but must not operate the form, bypass verification, impersonate the member, or describe an opened draft as submitted. Recheck this source before each release because addresses and processes can change.
6. California's adopted DROP regulation [section 7621](https://cppa.ca.gov/regulations/pdf/data_broker_drop_reg.pdf) says an authorized agent that aids a consumer must be disclosed through the consumer's DROP account. California's [CCPA consumer guidance](https://www.oag.ca.gov/privacy/ccpa) separately explains that a business may require proof of signed permission and direct identity verification for an authorized-agent request. Phase A therefore does not enter a member's DROP account, submit through DROP, sign a request, claim authority, or send anything for the member. The prepared PeopleConnect text states that the member is making the request for themself, and the member remains the sole sender through the source's designated channel.
7. A direct consumer email is not a universal delivery mechanism or a guaranteed deletion. The California Attorney General says a consumer must use the business's designated request method, the business may need to verify identity, and statutory exceptions may permit retention. Each registry entry must therefore identify the currently designated channel and may not promise that a generic privacy inbox is sufficient.

This handoff reduces scraping, impersonation and automated-submission risk and is designed to keep DanzStak in a drafting/tracking utility role rather than an authorized-agent role. Product labels do not decide legal status, and this architecture does not prove that StakGuard has no legal obligations. Privacy notices, data minimization, security, consumer-protection claims, jurisdiction-specific rights and each source's current terms still require review before real member data is collected or a supported source is advertised.

StakGuard must not add DanzStak as a hidden BCC/CC recipient, tracking address, forwarding destination, or invisible tracking pixel. Doing so would transmit the member's request and identifiers to DanzStak, contradict the current no-receipt/no-storage promise, and create additional privacy, security, retention and disclosure obligations. A future status update may use an explicit member action such as uploading or forwarding a receipt only after the exact data, purpose, retention and deletion controls are approved and disclosed.

## Phase A deliverable

### 1. Evidence-backed broker registry

Create a dated, versioned registry for 5–10 sources. Each entry records legal entity, countries/jurisdictions, official listing URL, official opt-out/privacy URL, required identifiers, verification/CAPTCHA/manual steps, whether delegated submission is permitted, expected status evidence, last checked date, and maintenance owner.

Initial candidates for verification are California DROP, Spokeo, Whitepages, BeenVerified, PeopleConnect Suppression Center (Intelius/TruthFinder/Instant Checkmate), PeopleFinders, TruePeopleSearch, and Google Results About You. A candidate is not shown as supported until its official process and terms are rechecked. Search-engine delisting remains distinct from source deletion.

### 2. Functional provider-ready dashboard

Add `stakguard.html` plus isolated CSS/JavaScript and a **Your data → StakGuard** entry point. Before a provider is connected, the dashboard shows a real zero/unknown state—never fictional member findings—and demonstrates:

- coverage summary: `X of Y supported sources checked`, last successful check, failures, and unchecked sources, with zero checks until a real provider succeeds;
- exact states: suspected/verified found, draft prepared, submitted with evidence, awaiting response, rejected/exempted, source-confirmed removed, search delisted only, not found on recheck, reappeared, and unknown due to outage;
- source, detection/check dates, exposed field categories without raw values, confidence, and evidence provenance;
- a source-specific removal draft that the member reviews, copies, or hands off to the official form; opening a form is never recorded as submission;
- one verified PeopleConnect handoff that contains placeholders only, keeps edits in the browser, and lets the member copy the request or open their own email application; DanzStak sends nothing and stores no completed draft;
- direct free-tool links, including California DROP, with jurisdiction and limitation copy;
- monitoring price calculator showing `$4 × months`, paid-through behavior, no auto-renewal, one expiry reminder, and an intentionally disabled **Not available yet** purchase control.

Provider fixtures may be used inside automated tests, but the user-facing dashboard must never display fabricated findings or imply a real scan, submission, removal, entitlement, or paid service.

### 3. Privacy and security design

Before Phase B, document and review:

- explicit opt-in and proof that the member is acting for themself or an authorized representative;
- minimum identifiers, field-level encryption, isolated DynamoDB keys, account-scoped authorization, audit trail, export/deletion, retention, and purpose limitation;
- no SSNs, passwords, raw breach contents, government ID storage, contact uploads, advertising, resale, or AI training;
- neutral notifications containing no address, phone, email, or source detail;
- false-positive review for namesakes and two-account isolation;
- source outages displayed as **Unknown**, never clean;
- DPIA/privacy-policy/terms changes and processor agreements for owner and counsel approval.

### 4. Vendor and $4 unit economics gate

Request written, nonbinding information from at least two qualifying vendors only after owner approval. Compare API/data-processing terms, US and EU/Italy coverage, scan cadence, evidence, false-positive handling, deletion/export SLA, sub-processors, security attestations, support, and exact per-member/per-scan cost.

Model 100, 1,000, and 10,000 paid members using:

`$4 revenue − Stripe fee − scan/recheck cost − request cost − reminder cost − storage/logging − refunds/chargebacks − support − tax/compliance reserve`.

At the common US online-card illustrative rate of `2.9% + $0.30`, a $4 payment leaves about `$3.58` before every StakGuard operating cost. This is a planning assumption, not a verified DanzStak rate. If honest monthly monitoring cannot fit, reduce source count/cadence for owner approval; do not raise the price or fake coverage.

## Proposed files

- `docs/STAKGUARD-PHASE-A-REPORT.md` — legal/vendor/cost findings and launch blockers.
- `assets/stakguard-brokers.js` — dated registry with no member data.
- `stakguard.html`, `assets/stakguard.css`, `assets/stakguard.js` — provider-ready dashboard with an honest unscanned state.
- `feed.html`, `assets/device-settings.js` — Your data entry points.
- `service-worker.js` — versioned offline shell entries.
- `test-stakguard-phase-a.cjs` and `browser-checks/stakguard-phase-a.cjs` — static/security and real-browser checks.

## Tests and room fax

- Static tests reject payment/checkout routes, network scan calls, real-looking PII, claims of live monitoring, old product names, auto-renewal, and annual/discount language.
- Browser tests at 320, 360, 390, 414, 430, and 1366px verify no overflow, 44px controls, keyboard/focus behavior, status semantics, disabled purchase control, exact price math, and safe external links.
- Member-handoff tests verify the exact reviewed recipient, placeholder-only draft, official source URL, no network submission, no false sent/removed status and a visible four-tab section navigation at 320px.
- Accessibility checks cover headings, landmarks, status labels, contrast, screen-reader names, and non-color status cues.
- Full `test-regressions.ps1` and all review checks must pass.
- PR includes inspected screenshots at every required width and ends with the Room faxed checklist.

## Effort and gates

| Work | Rough effort | Gate |
| --- | ---: | --- |
| Registry verification + legal/vendor report | 2–4 days | Owner/counsel reviews scope and wording |
| Provider-ready responsive dashboard + tests | 2–3 days | Phone staging walkthrough; no production |
| Vendor quotes, DPIA, unit economics | 2–5 business days plus vendor response | Owner approves vendor and affordable scope |
| Phase B one-source consenting pilot | Separate PR, 1–2 weeks | Explicit new approval; real evidence required |

Phase B cannot start until the owner approves the Phase A report, provider/source terms, privacy changes, unit economics, and one narrowly defined consenting pilot. Stripe remains untouched until free discovery/removal support works and monitoring has a verified provider and sustainable scope.
