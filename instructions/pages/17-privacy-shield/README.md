# DANZSTAK Data Watch — data removal and ongoing monitoring

**Owner proposal: 2026-11-04. Status: research and product specification ONLY — not implemented, tested, launched, or a paid service.**

## Mission

DANZSTAK is **not a data brokerage**. Members should have control over their digital identity. Offer optional help to find exposures of their own information on publicly available people-search/data-broker sites, request removals where legally and technically possible, and **watch their exposure change over time**. Include carefully bounded monitoring of dark-web / Tor onion-source exposure where a lawful, licensed source provides coverage. Do **not** claim to scan every onion site, erase the internet, or guarantee deletion.

Normal account privacy controls and access to free government rights/removal mechanisms remain FREE, whether or not someone purchases Data Watch monitoring time. Don't mix this with the optional DANZSTAK Phone $3 internal number or allow advertiser access to member data.

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

**Acceptance criterion:** A member should be able to open Data Watch, see a legitimately discovered broker listing, **review a correctly addressed removal request**, send it using the official authorized channel, and later see an accurate state change backed by a source response/recheck. Not merely receive a generic letter generator. Test 320–430px installed-PWA layout, 15 supported languages (or verified current list), secure per-account boundaries, source failures and retention. All phases require a PR, evidence, staging preview and explicit owner approval before production.


## Audience — everyday members, not only musicians

**Owner clarification (2026-11-04):** DANZSTAK serves ordinary people worldwide as well as musicians. Data Watch is a **general consumer privacy service**: a parent, teacher, retired person, student, shop worker or musician should be able to understand and use it. No artist profile, EPK, booking account, music subscription, DANZSTAK internal number, real personal telephone number, or paid social account tier is a prerequisite.

- Make `Privacy & Data` accessible from the main account Settings for all members. Everyday free functions: understand what DANZSTAK holds, privacy settings, export and request deletion of owned DANZSTAK account data. This is distinct from optional external data-broker removals.
- For Data Watch, use simple language: **Where was my information found? Can I ask for removal? Did they confirm? Has it returned?** Avoid technical jargon, scare tactics or fabricated privacy scores.
- Support typical personal information concerns across demographics: names, email, telephone numbers and addresses voluntarily supplied by the verified user. No unnecessary government ID collection; do not automatically import or expose social contacts.
- Translate workflows into all actually supported DANZSTAK languages; design for accessible phone PWA, screen readers and people with no technical expertise. Price and scope must be clearly understandable.
- Keep all normal DANZSTAK social participation, account deletion/export, and links to free public opt-out rights **free**. Optional subscription value is verified outside-broker monitoring/removal *assistance*, not a requirement to protect one's DANZSTAK account.
- Test with distinct non-artist member profiles and a musician profile; verify same eligibility, privacy controls, account isolation and correctly scoped notices. Never market the service as exclusively for bands, DJs or EPK users.

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

1. Audit existing DANZSTAK `privacy.html`, authorization, data export/deletion, architecture, third-party access and procurement; propose a separate isolated data model with encryption, per-account access checks, purpose limitation, minimal retention, deletion/export and audit trail. Data used by Data Watch MUST NOT be used for ads, caller targeting or to build a broker database. Complete privacy impact and security assessment, processor contracts and jurisdiction review before gathering any real-member PII.
2. Members must specifically opt in, review exact personal identifiers to be scanned, authorize each type of action and be able to stop monitoring, revoke authority and erase their Data Watch search profiles. The service must not seek SSNs/government IDs, passwords or identity documents unless a legally justified provider action absolutely requires it, with separate explicit approval and secure procedure. The lowest viable data collection is best.
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

## Final owner pricing and renewal directive — $4 monthly, voluntary renewal, no annual contracts (2026-11-04)

**This section supersedes ALL earlier proposed pricing in this specification**, including Free DIY/$2.99 Monitor/$6.99 Managed and annual options. Do not present old tier prices or annual subscriptions in the UI, pricing design or Stripe configuration.

### Single product, two straightforward choices

| Choice | Member charge | Actual product |
| --- | --- | --- |
| **Free: Find my data and request removal** | **$0** | Member can see supported data-broker/people-search matches with verified source and dates, review prepared source-specific deletion/opt-out requests, and authorize submission via legitimate approved means. Official government/self-service options stay free. No Data Watch monitoring purchase needed. |
| **Data Watch Monitoring** | **$4 USD per month** | Recheck only genuinely supported sources on a disclosed schedule; show whether requests were submitted, confirmed removed, only delisted, no longer found, still visible, unverified, or reappeared; send appropriate opt-in monitoring alerts. Monitoring coverage, checks per month and limitations must be disclosed accurately. |

The member does **not** pay to see who may have their data or to issue the **initial eligible opt-out/removal requests**. “Blast the first ones off brokerages” means batch PREPARE and member-APPROVE genuinely authorized, source-specific requests, never unsolicited bulk spam, speculative legal demands, bypassing CAPTCHA/terms or pretending a form was submitted. Individual free public-rights tools must remain accessible even if this commercial product is not launched.

### Simple prepaid monthly access — owner clarification

- Data Watch monitoring is **always $4 per month**, however the member pays. Optional advance payment is available for any whole number of months at $4 each, up to **12 months/$48** under the under-$50 individual payment policy. Example: **$20 pays for five months**. No discounts, different subscription tiers or annual plans.
- Member chooses the number of months, pays once, and sees the exact **paid-through date**. No annual plan, contract or automatic renewal.
- Additional prepaid months extend the existing paid-through date; **never discard unused paid time**. Use verified server-side Stripe payments and idempotent entitlement updates.
- Send one gentle reminder **3–4 days before the entire prepaid period expires**, not every month. New payment only if the member chooses it. Without payment, monitoring ends at expiry and no money is collected.
- Let members stop monitoring and delete their monitoring profile whenever they want; plainly disclose any refund rules for unused prepaid time before payment. Keep free broker discovery and initial authorized removal requests available.
- Test $4 for 1 month, $20 for 5 months, a second purchase before expiry, cancelled/failed/refunded payments, calendar-month boundaries, reminder timing, expiry and no automatic charge. No real Stripe charges or product creation until explicit owner approval.

### Site-wide low-price / no lock-in policy

Owner directive across DANZSTAK: **Optional purchases should be small and affordable. No long-term recurring commitments or annual contracts; voluntary advance payment for multiple months is allowed, with no single optional consumer charge of $50 or more.** Existing inexpensive one-time products can remain one-time; recurring features must have an understandable monthly rate, with optional prepaid months and no automatic renewals or cancellation fees. The choice to pay for a *new* month must be the member's, not an accidental default. Any exception requires a **fresh, explicit owner decision** before it is offered. Do not raise prices, combine purchases into expensive compulsory bundles, or create misleading “save 80% if you pay yearly” pricing. Low price does not excuse unbounded infrastructure cost, deceptive underdelivery or compromised privacy.

### Feasibility and launch gates remain mandatory

1. **First deliverable**: research, source coverage, legitimate take-down mechanisms, accurate free vs $4 monitor UX with synthetic example data, real cost comparison and per-subscriber unit economics. Calculate Stripe processing cost, scans, broker requests, reminders, storage, refunds, support and taxes at 100/1,000/10,000 paid members. If $4 cannot cover the promised monitoring frequency and source coverage sustainably, **report the constraint** and propose a smaller honest scope for owner approval; do not silently charge more.
2. **No Stripe live charges or premature products**. Keep DANZSTAK completely separate from SFScoop. Test Mode payment catalog and entitlement code may be prepared only after required architecture/source feasibility review; never enable real billing without explicit owner approval. Free discovery and first removals must have working authorized provider support before claiming them operational.
3. After user opt-in, keep privacy scans narrowly scoped to user-owned/authorized identities; secure data in transit/at rest, no data resale, least-privilege access, deletion/export, vendor compliance, and verified source evidence. No invented broker coverage or guaranteed takedowns.
4. Codex must deliver isolated PR, exact test pass/fail report, renewal reminder/expiry/cancel test matrix, verified phone-accessible staging PWA, pricing disclosure screenshots and owner sign-off request. Do not mark any step complete just because this instruction was posted.

**User-facing promise, once proven:** “Find where your information is exposed and make your first removal requests free. Keep an eye on supported brokers for $4 per month. Renew only when you want. Cancel anytime.”
