# StakGuard directive audit

**Audited:** 2026-11-09  
**Scope:** `CLAUDE.md`, `docs/OWNER-DIRECTIVES.md`, `instructions/pages/17-privacy-shield`, current Phase A code and tests.  
**Status:** Phase A foundation only. No production scan, payment, broker submission, vendor account or real-member identifier collection.

StakGuard is one member-facing privacy product with distinct internal capabilities. External broker discovery/removal must remain technically separate from DanzStak creator-content ownership and in-service share provenance so neither system overstates what the other can do.

| Directive | Current evidence | Status | Next gate |
| --- | --- | --- | --- |
| Every member can open StakGuard from **Settings → Your data** | `stakguard.html`, `assets/device-settings.js`, `feed.html` | Implemented in draft | Owner phone preview before any release |
| Free official tools and removal preparation | California DROP/FTC links and one verified PeopleConnect member handoff | Partially implemented | Verify 5–10 current source processes; enable only verified entries |
| Show where information was found with source/date/confidence | Provider result contract exists; dashboard truthfully shows no provider/no findings | Foundation only | One owner-approved lawful source and consenting pilot |
| Member reviews and sends each request | Local editor, copy action, `mailto:` and official-form link; no network submission | Implemented for PeopleConnect | Recheck designated channel before release |
| DanzStak is not a hidden participant in the email | No BCC/CC, forwarding address, tracker or receipt capture | Enforced by regression test | Any receipt feature requires explicit member action and new privacy review |
| Honest status history | Status vocabulary is documented; no persistent timeline exists | Planned | Account-scoped persistence plus evidence requirements |
| Source failures show **Unknown**, never falsely clean | Provider coordinator normalizes timeout/error to `unknown` | Implemented and unit-tested | Integration test with approved adapter |
| Minimal, protected scan identifiers | Encryption/account isolation/retention/export/deletion are documented only | Missing implementation | DPIA/security design and two-account tests before real PII |
| Monitoring costs `$4 × prepaid months`, 1–12, no auto-renew | Calculator and disclosure exist; checkout is disabled | UI foundation only | Provider coverage, unit economics, notices, refund rules and owner approval |
| Reminder and expiry behavior | Required in spec, not implemented | Missing | Entitlement scheduler tests before payment activation |
| Broker removal before dark-web coverage | No dark-web adapter or claim exists | Satisfied for Phase A | Licensed-source research only in later separately approved phase |
| Phone-first quality | Browser checks pass at 320, 360, 390, 414, 430 and 1366px | Tested locally | Installable staging-PWA phone walkthrough |
| Supported-language behavior | No StakGuard translation matrix or localized copy | Missing | Confirm current supported languages and add locale tests |
| Legal/consumer claims | Direct-member boundary is documented; no zero-risk or guaranteed-removal claim | Partially reviewed | Owner counsel reviews privacy/terms before real-member launch |

## Additional mobile and canonical-issue directives

The canonical StakGuard issue contains additional requirements beyond the Phase A screen. They are part of the same product contract:

| Additional directive | Current status | Required evidence before release |
| --- | --- | --- |
| Work for ordinary members without an artist, EPK, booking or phone-number product | The static surface has no artist-role gate, but no representative non-artist account test exists | Authenticated artist and non-artist account tests proving equal access and isolation |
| Distinguish search-engine delisting from deletion at the original source | Status vocabulary is documented; no real timeline exists | Provider evidence and timeline tests that never conflate the two states |
| Never show a fabricated privacy score or percentage of “the web removed” | No score exists in Phase A | Static and browser assertions plus copy review |
| Scan only the member's own approved identifiers with explicit opt-in and per-action authorization | Provider contract accepts opaque encrypted input; consent/profile UI and persistence do not exist | Consent record, revocation, purpose binding, account isolation and negative tests |
| Show exact country/jurisdiction eligibility and source coverage | Registry has partial jurisdiction fields; visible coverage remains unavailable | Verified per-source eligibility, last-checked date and member-facing limitations |
| If licensed breach signals later indicate credentials, recommend password reset/MFA without receiving or exposing passwords | No dark-web/breach provider exists, correctly deferred | Licensed provider review, bounded indicators, no raw credential storage, cautious alert tests |
| Permit stopping scans and deleting the StakGuard search profile at any time | Not implemented | Authenticated stop/delete/export flow with storage and cache deletion tests |
| Send one reminder 3–4 days before final prepaid expiry; push/email only with channel consent | Not implemented | Scheduler, deduplication, consent, privacy-safe notification and expiry tests |
| Additional payments extend the existing paid-through date rather than replacing remaining time | Checkout and entitlement are disabled | Atomic entitlement tests covering concurrent payments, expiry and refunds |
| Keep StakGuard billing and member data independent of SFScoop | No payment/provider integration exists | DanzStak-account-only configuration and boundary tests before checkout is enabled |

## Non-negotiable compliance boundary

- DanzStak may maintain a dated source directory, prepare a first-person draft locally and open the member's own email application or an official form.
- The member remains the sender and makes the final decision. Opening a draft or form is not submission.
- Do not silently BCC DanzStak, insert a tracking pixel, capture the completed draft, enter a broker account, bypass verification, solve a CAPTCHA or claim to act with authority.
- A broker may require its designated channel and identity verification, and legal exceptions may permit retention. Never promise that an email must be honored or that deletion is guaranteed.
- **Submitted**, **removed**, **not found** and **clean** are evidence states, not optimistic UI labels.

## Claims explicitly rejected

The product, marketing, Terms and support copy must not claim that this design makes DanzStak **100% legally insulated**, creates **zero regulatory burden**, eliminates privacy/data-security liability, guarantees a broker will honor email, or removes lawsuit/CFAA risk. A member-operated handoff narrows the technical role; it does not decide DanzStak's legal classification or erase duties created when DanzStak collects identifiers, records status, receives a forwarded receipt, sells monitoring or uses a processor.

The current Phase A boundary therefore rejects outbound BCC tracking and automatic inbound parsing. Those features would cause DanzStak to receive and process request content and identifiers. A future explicit receipt-forwarding option requires owner approval, counsel/privacy review, a disclosed lawful purpose, minimum collection, security, account isolation, retention, export/deletion and a truthful statement that forwarding is optional.

## Correct build order

1. Finish and review the dated source registry and privacy/security design.
2. Fax the existing Phase A screen and provide an installable staging preview.
3. After explicit approval, connect one lawful source for one consenting test account and capture real evidence.
4. Add the account-scoped timeline, export/delete, retention and isolation controls.
5. Prove monitoring cost and coverage before adding the disabled `$4` checkout flow.
6. Add sources one at a time; keep dark-web coverage as a separate later research phase.
