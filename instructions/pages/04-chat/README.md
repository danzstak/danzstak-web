# Chat — priority personal messaging experience

## Immediate owner priority
DANZSTAK Chat must be dependable for everyday conversations between real users on mobile, with a familiar Messenger/WhatsApp-style experience. Prioritize functional correctness and privacy over decorative redesign.

## Must work
- One-to-one text messages with durable server-side persistence, correct ordering, sender identity and timestamps.
- Near-real-time incoming delivery without requiring refresh; reconnect and sync missed messages after app resumes or connectivity returns.
- Clear sent/delivered/read states only where backend can substantiate them; never fabricate delivery receipts.
- Unread counts, conversation ordering, typing indication where supported, accessible composer, message grouping, date separators and smooth auto-scroll without jumping while reading older messages.
- Mobile-first full-screen thread, stable on-screen keyboard behavior, safe-area spacing, responsive conversation list and easy back navigation.
- Secure authenticated access: only participants can fetch a private thread or attachments. Validate sender on server, prevent duplicate sends, handle retries and offline/error states.
- Notification integration: when a message arrives, show in-app Buzz and send opted-in PWA push to supported installed phones; tapping push deep-links to the correct thread. Avoid duplicate alerts and respect privacy/mute preferences.
- Do not require DANZSTAK-assigned phone numbers for ordinary account-to-account chat. Phone number service is separate.
- Preserve existing messages, chat data and auth. Do not break current conversations.

## Test matrix
1. Real test account A sends to B while both online; B receives without refresh.
2. B closes/backgrounds installed PWA; opted-in supported phone receives push, tap opens exact thread.
3. B goes offline; A sends messages; B reconnects and sees them once, in order.
4. Refresh both devices; history remains and authorization holds.
5. Multiple rapid messages, emoji, long text, empty message rejection, retries and duplicate suppression.
6. Test Android Chrome installed PWA and iOS installed PWA if available; document actual device/browser, limitations, failures and push permission behavior.
7. Verify no private messages are exposed to unrelated accounts.

## Release
Build on separate PR, provide exact tests, screenshots, staging PWA URL and deployed commit SHA. Do not deploy production without owner approval. Read `instructions/pages/10-notifications/pwa-push.md` and global mobile-first/PWA rules.

## Owner update — verified phone numbers and improved Messenger
- Provide mobile-number verification using a one-time SMS code with international E.164 numbers, expiry, retry limits, anti-enumeration, abuse/rate limits, and secure server-side verification. Do not store plaintext verification codes or expose phone numbers publicly.
- Verification must be separate from optional paid DANZSTAK-assigned phone numbers; never require purchasing a number for account-to-account messaging.
- Review whether verification is mandatory at signup or for selected higher-risk actions before changing existing login flows. Preserve Cognito accounts and existing sessions; no lockouts without migration plan.
- Messenger must support reliable real-time one-to-one chat, persistence, send/retry, unread/read state, typing status, blocking/reporting, secure photo/video attachments, mobile keyboard/safe areas and opted-in PWA push notifications with deep links.
- Respect attachment ownership/permissions, privacy, storage and malware scanning. No audio-only music uploads via chat as a bypass of platform policy.
- Audit current AWS Cognito/SMS delivery setup, costs, quotas, fraud controls and country availability before enabling billable SMS verification. Do not purchase services or deploy without approval.
- Test two users on real mobile devices, including SMS failure, wrong/expired codes, resend, account recovery, offline messages, notification delivery and blocking.

## Owner clarification — privacy-first phone identity and optional in-app number
- **Do not require a personal mobile number for ordinary DANZSTAK signup or account-to-account chat.** Existing email/Cognito authentication remains available. Any phone verification must be optional or narrowly justified by a specific feature and owner-approved before implementation.
- Users should be able to communicate using their DANZSTAK account identity without exposing a personal telephone number to other users.
- Offer an optional, paid **DANZSTAK-assigned in-app number** as a privacy-preserving alias for DANZSTAK-to-DANZSTAK calls/messages. Do not imply it is a carrier/PSTN number, works for ordinary SMS, or can receive calls from outside the platform unless those capabilities are separately implemented and tested.
- Distinguish optional personal-number verification, optional in-app number purchase, and actual public telephone service in UI, billing and terms. Never market the alias as proof of real-world identity.
- Use a clear privacy notice stating what personal data is collected, why, who can see it, retention and deletion options. Do not claim 'we never sell data' unless the actual privacy policy, third-party integrations and business practices substantiate it.
- Preserve prior one-time pricing product IDs only after verifying the configured Stripe products; no new recurring charge or purchase without owner approval.
- Test registration/chat with **no personal phone number**, in-app alias privacy, contact discovery, blocking, abuse prevention, billing failures and account recovery.

## Owner implementation directive — visible phone registration and verification in Messaging

**Owner requirement (2026-11-04):** This must be a functioning, visible part of the DANZSTAK messaging experience, not merely a backend API or a reference in a planning document. Add a clearly discoverable **Phone settings / Add or verify phone** entry point inside `messages.html`, ideally from the existing Chat header overflow/settings action or a compact mobile-appropriate location. Reuse existing styling/icons; do not obstruct the thread, composer, PWA bottom navigation, call controls, or the 320px mobile header. Mirror status in account Settings when appropriate.

### Three separate identities (do not conflate)
1. **Ordinary DANZSTAK account:** email/Cognito login and normal private account-to-account text/voice/video chat remain available *without* any phone number or verification.
2. **User-owned personal telephone number (optional):** a user may add, verify, replace or remove their own international number. Verify possession via real, time-limited, one-time SMS (or vendor-approved verification method), normalized E.164. Number stays private by default and is *never* treated as proof of real-world identity. Verification alone does **not** enable carrier/PSTN/SMS calling from DANZSTAK or guarantee contact matching; only explicitly implemented, consented capabilities may be advertised.
3. **Optional DANZSTAK-assigned in-app number:** separate $3 activation catalog / billing entitlement and provisioning from existing phone pilot PR #3, with its own pending/active/error state. This is an **in-network alias**, not an external carrier number. No hidden paid activation and no change to existing account/chat access if payment is declined.

### Mandatory user interface flow
- `messages.html`: discoverable **Phone & verification** control that opens a responsive, accessible panel or page within Messaging (no deceptive registration wall). Clearly present **Add my number**, **Verify**, **Resend code**, **Change number**, **Remove number** (where verified/registered), and verification state; show masked number only. Respect 44px targets, keyboard/safe areas, screen readers and locale translation.
- Request country code and local number with international support; validation cannot be a US-only 10-digit mask. Only display a verified state after server confirms success for that exact normalized number.
- Use server-generated challenge, expiry, throttled resend/cooldown, maximum attempts, one-time consumption, replay protection, IP/account/number rate limiting, enumeration defenses, recovery/rebinding and appropriate audit/retention. Do not expose OTP or full number in logs/client storage. Use HTTPS, authenticated account binding and provider signature checks where applicable. Do not trust client-only verification.
- Account for wrong/expired code, non-delivery, unsupported country, SMS quota/billing unavailable, duplicate linked number, changed number, offline, app resume, cancelling a flow, rate limiting and provider outage. Give accurate, actionable user-facing errors without falsely claiming verified.
- Separate optional **Get a DANZSTAK number** section from personal-number verification; show its *in-network-only* scope, $3 one-time charge, any ongoing conditions, and accurate provider/Stripe status. Never provision or charge in Live Mode without express owner authorization.
- Do not expose user's personal number to other members, through search, notifications, messages, friend suggestions or public profile by default. Add explicit opt-in and documented authorization before any phone-based contact discovery. Do not upload address books as an implicit side effect.
- Keep all existing messaging reliability requirements: two-account real-time delivery, durable history, read/unread, block/report, offline recovery, opted-in PWA push and account isolation. Verification is an **additional account option**, not a substitute for messaging correctness.

### Release gating
- Audit Cognito/SES/SNS or selected verification provider, country coverage, per-message costs, restrictions and sender ID/registration requirements. Submit budget/architecture for owner approval before enabling billable SMS sends. Existing DANZSTAK Stripe sandbox catalog does not establish live provisioning.
- Build on an isolated PR, with real UI plus backend integration; no demo-only Verify button. Test with two accounts and supported real phone numbers **only when approved**, plus mocked wrong/expired/replay/rate-limit cases, number change/removal, unverified accounts, unapproved contact discovery and no-number chat.
- Run complete regression, mobile visual matrix, CSP and PWA install/refresh tests. Provide passed/failed results, screenshots, actual **phone-accessible staging PWA URL**, integration limitations and owner approval state in `docs/DANZSTAK-DEVELOPMENT-REPORT.md`. Physical-device and real-SMS verification remain *unverified* until actually executed.
- No production deploy, merge, paid provider activation or live charges without explicit owner approval. The instructions are not implementation evidence.


## Owner scope decision — DANZSTAK-issued numbers are internal aliases only (2026-11-04)

**Owner confirmed:** For the current release, DANZSTAK should issue **in-app-only DS numbers**. **Do not buy or rent telephone numbers from a telecom carrier, Telnyx, Twilio or other DID/PSTN/SMS provider to fulfill the $3 DANZSTAK number product.** Internal DS numbers are account aliases/identifiers, not real phone numbers. Any paid or external telecom option is a separate future business decision.

- Generate readable, unique DS-prefixed identifiers (for example `DS-4827-1936`, example only), allocated **server-side** with atomic uniqueness and permanently bound to a DANZSTAK account. Store an immutable internal account ID separately from the public alias. No assumption that they are E.164 telephone numbers, reachable via carrier networks, usable for SMS/2FA, usable in WhatsApp, or able to call someone not on DANZSTAK.
- The existing app's authenticated Chat and WebRTC calling will resolve DS aliases only to eligible DANZSTAK accounts; keep account privacy, block lists, consent, fraud throttling, call safety and TURN/STUN operating-cost checks. **A DS alias is not identity verification**. Members who never purchase an alias can still message and call by DANZSTAK account.
- The $3 **one-time** Stripe activation belongs exclusively to the DANZSTAK sandbox/product catalog until the owner authorizes live payments; provision aliases only after trustworthy backend entitlement validation and idempotent account-scoped reservation, not client-side success screens. Clarify any ongoing service/usage limits before a live sale. Do not promise unlimited free bandwidth or perpetual carrier access.
- In `messages.html`, surface the optional **Get your DANZSTAK number** and **My DANZSTAK number**/status as an accessible phone-friendly interface. Clearly label it “Works only inside DANZSTAK” and keep this separate from any **Verify my personal mobile number** UI; the latter would require an actual SMS provider and must remain optional, not silently activated or made a prerequisite.
- **Prioritize internal alias rollout first.** The separately requested optional verification of a user's *real* personal mobile number remains a distinct feature for a future stage, pending provider selection, SMS budgets, privacy and owner approval; it is not required for DS alias activation. Never substitute a fictitious SMS code for actual verification.
- Existing draft phone PR #3 may supply useful implementation, but is **not deployed**, and testing/provider integration/physical phones are incomplete. Audit it before reimplementing; no carrier integration scope creep. Test alias uniqueness, concurrent activation, double charges, refunds, blocked calls, contact lookup, cross-account access, mobile PWA behavior and unnumbered-account chat. Supply staging PWA and owner approval before release.

**This decision takes precedence over any earlier language suggesting a telecom provider must supply the internal DANZSTAK numbers.**
