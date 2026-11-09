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

## Non-negotiable compliance boundary

- DanzStak may maintain a dated source directory, prepare a first-person draft locally and open the member's own email application or an official form.
- The member remains the sender and makes the final decision. Opening a draft or form is not submission.
- Do not silently BCC DanzStak, insert a tracking pixel, capture the completed draft, enter a broker account, bypass verification, solve a CAPTCHA or claim to act with authority.
- A broker may require its designated channel and identity verification, and legal exceptions may permit retention. Never promise that an email must be honored or that deletion is guaranteed.
- **Submitted**, **removed**, **not found** and **clean** are evidence states, not optimistic UI labels.

## Correct build order

1. Finish and review the dated source registry and privacy/security design.
2. Fax the existing Phase A screen and provide an installable staging preview.
3. After explicit approval, connect one lawful source for one consenting test account and capture real evidence.
4. Add the account-scoped timeline, export/delete, retention and isolation controls.
5. Prove monitoring cost and coverage before adding the disabled `$4` checkout flow.
6. Add sources one at a time; keep dark-web coverage as a separate later research phase.
