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


## Owner pricing decision — 250 minutes monthly with optional paid upgrades (2026-11-04)

**Owner confirmed** that the optional DANZSTAK in-network DS-number service must **not be unlimited**. Starter includes **250 connected voice-call minutes each month**; after the allowance, offer an **explicit, paid higher plan**. This is NOT authorization to switch on live payments or to activate a new Stripe subscription yet.

### Proposed catalog — engineering and owner approval required for upsell prices
| Tier | Included voice minutes per month | Proposed price | Billing |
|---|---:|---:|---|
| Starter | 250 | $3 activation once | No recurring charge on base plan |
| Plus | 500 total | $3 / month | Optional subscription, pending owner cost approval |
| Pro | 1,000 total | $5 / month | Optional subscription, pending owner cost approval |

The Plus and Pro minutes are **totals**, not an additional 500/1,000 on top of Starter. The existing $3 Starter activation is separate from the proposed upgrades; do not bill activation again when changing tiers. The upgraded minute levels and subscription amounts are **proposals**, not finalized prices or existing Stripe products. Determine whether a prepaid minute pack is economically superior and report it for owner review; do not silently add it to the catalog. Never claim Starter is cost-free to operate forever merely because its activation is one-time.

### Required behavior
- Count **actual connected 1:1 voice minutes**, not dialing, ringing, unanswered calls, failed signaling, or time in the messaging UI; no fake billing from client timers. Define whether allowance follows the DS-number holder's account for inbound and outbound routed calls; prevent double accounting, reconnect exploits, simultaneous-call overages and abuse. Account for fractional seconds accurately; define a documented rounding rule. If video calling is included, separately estimate its much larger TURN bandwidth and do not imply the voice allowance automatically covers video.
- Display in `messages.html` under **My DANZSTAK number**: current plan, monthly allowance, used/remaining minutes, next reset date, upgrade/manage/cancel options, and exact charges before confirmation. Preserve normal free messaging (and existing account-based calls unless separately owner-approved) independent from the paid DS-number feature.
- Define a transparent recurring allowance reset (e.g. consistent UTC cycle keyed to activation/subscription anniversary) and show the user the renewal/reset date in their locale. Implement idempotent atomic metering, graceful reconnection handling, per-session usage ledger and recovery after server outages.
- Notify in the UI at ~80% and ~95% of quota; offer **Upgrade plan**, not an automatic charge. When exhausted, refuse *new DS-number-routed voice calls* with a clear explanation and upgrade path. Handle an active call approaching its limit with an advance warning and a narrowly bounded, documented grace period; do not unexpectedly bill or silently allow unlimited minutes. No ability to make ordinary emergency calls through a DS number; disclose that this is an in-app internet calling service.
- Handle upgrades/downgrades, cancellation, expired/unpaid subscription, refunds/chargebacks and failures using **server-verified DANZSTAK-only Stripe webhook entitlements**. No sensitive tokens or live secrets in source. Specify whether upgrades take effect immediately, how partial periods are prorated, and the effective date of downgrades/cancellations; don't implement monetary rules without owner approval.
- Codex must first measure estimated relay/TURN/voice costs under realistic network conditions, include Stripe recurring fees and taxes, expected per-tier margins, and abuse/spam costs. The existing phone pilot PR #3 is still draft and needs review; reuse tested code rather than creating a parallel call system.
- Test with two DANZSTAK accounts, under/exactly/over 250 minutes using accelerated clocks, two simultaneous sessions, dropped calls, midnight and month boundaries, UI warnings, plan changes, failed/refunded Stripe events, account isolation, and real-device PWA flows. Stage, document results and request owner approval before paid release.

**Do not create/activate Plus or Pro live subscriptions or enable metered billing until owner explicitly approves the catalog, ongoing operating costs and test evidence.**


## Owner update — voicemail when a call goes unanswered (2026-11-04)

- In the phone PWA, after a genuine **no-answer**, missed, declined or unavailable call, offer an optional **Leave voice message** action. The owner reports missing audible ringback even after a PWA update; the ringback and hidden Video Call defects must still be fixed under [Issue #27](https://github.com/Danzstak/Danzstak-web/issues/27).
- Only start microphone recording after an explicit user tap and permission. Cap an initial voicemail at 60 seconds; provide stop, preview/playback, re-record, send and cancel, plus a text fallback if the mic is inaccessible. Never record the live call or the recipient without consent.
- Store-and-forward to the specific private Chat, even when recipient is offline, with in-app/opted-in push notice, clear sender/time/duration and safe playback/deletion. No unsupported claims of delivered/read receipt.
- This is **not music or general audio upload hosting**. Follow the narrowly scoped voicemail exception documented with [Issue #28](https://github.com/Danzstak/Danzstak-web/issues/28): purpose-specific authenticated user-recorded short voice, strict server-side validation, quota, retention, privacy and no arbitrary audio-file uploads. Resolve the audio-only policy conflict before implementation.
- A missed/unanswered call and voicemail do **not** consume the optional DS-alias 250 connected minutes per month; ordinary free chat is unaffected. Estimate storage and bandwidth before enabling a paid backend.
- Test two different accounts on different devices, offline delivery, Safari/Android recording formats, microphone errors, timeout/decline/cancel/retry, unauthorized requests, blocked user, data isolation, idempotent uploads, expiry and deletion. Provide an authentic phone-accessible staging PWA and owner approval before any production deployment.


## Owner requirement — calling device registration (2026-11-04)

For DANZSTAK Phone, each browser/PWA installation that originates or receives voice/video calls must be explicitly registered to the signed-in member's account. See [Issue #29 — secure device registration](https://github.com/Danzstak/Danzstak-web/issues/29) for implementation and test requirements.

- In `messages.html`, expose **Register this device** and **My devices** with clear registered/unregistered/revoked state, editable friendly name and incoming-call preference.
- Preserve ordinary free Chat, user login and other non-calling social functions on unregistered devices. Registering a calling device must not require personal telephone/SMS verification or purchase of the optional $3 internal DS-number alias. The DS alias belongs to the account, not to a particular phone.
- Bind each calling installation to the authenticated account via secure, challenge-based registration and revocable server-side authorization, **not** hardware fingerprints, IMEI or self-asserted device IDs alone. Users can register multiple devices, rename them and revoke a lost device. Handle PWA reinstall and browser storage clearing.
- Direct signaling and incoming notifications only to eligible, currently registered and opted-in devices. Allow foreground calls without requiring push permissions; explain that background/locked-screen audible ringing depends on OS/browser support. Multiple devices may ring; first accepted call wins and all other devices stop ringing.
- Apply revocation to signaling/call permissions and device-associated push subscriptions; prevent stale/replayed registrations, cross-account routing and silent impersonation. Keep normal message authorization, block/privacy behavior, voice/video transport, and usage metering intact.
- Coordinate this work with the user-reported audio ringtone and missing Video Call fixes (#27), voicemail (#28), and in-network DS-number/capped minutes work (#21). Implement on a distinct PR, test multi-device calling and revocation, deliver a **real phone-accessible PWA preview**, and request owner approval before production.

## Owner feature — invite friends outside DANZSTAK by text message (2026-11-04)

- Add visible **Invite to DANZSTAK → Invite by Text** in Messaging, with the same action available from Friends. This is **native device SMS sharing**, not text messaging from a DS in-app alias.
- On supported phones, user-initiated action opens the native SMS composer with a short, editable localized message and the real sign-up link `https://danzstak.com/`. User selects the recipient and sends; no silent/bulk transmission, address-book upload or SMS API integration.
- Provide Share and Copy Link fallbacks for devices without an SMS app; do not claim SMS was delivered or the invitation accepted merely from composer launch. Existing nonmembers land on the public signup, and current members can sign in as usual.
- Invite flow is **free** and does not require a personal number, phone OTP, DS alias, registered calling device or paid tier. Preserve current Chat, calls, push, privacy, auth and billing behavior. See [GitHub Issue #30](https://github.com/Danzstak/Danzstak-web/issues/30) for exact implementation, privacy and test requirements.
- Complete isolated implementation PR, native SMS composer tests, localization, real mobile/PWA preview, regression evidence and owner approval before deploying. Posting this instruction does not mean it is implemented.


## Owner clarification — privacy choice when invited member joins (2026-11-04)

**Owner's intention:** When a friend joins DANZSTAK through a text/share invitation, give them a transparent option to avoid adding their personal phone number and, if they want a separate contact identity, buy an **optional $3 DANZSTAK-issued in-network DS alias**. Do **not** imply that a phone number must be supplied or purchased in order to join. Core accounts remain email/Cognito-based and ordinary social communication remains free.

- After successful normal signup, show a concise optional **Your number, your choice** onboarding step (or the equivalent discoverable Phone Settings after signup). Present three truthful paths: **Continue without a phone number (free, default)**; **Add my personal mobile number (optional, not exposed by default, real SMS verification only if an approved provider has been implemented)**; and **Get a DANZSTAK number — $3 one-time activation** with precise internal-only scope. All options must be dismissible and revisitable; no upsell roadblock, fake security warning, preselected paid checkout, or coercive dark pattern. Do not insert unavailable SMS verification as a functioning signup option.
- Paid DS number is a distinct server-owned account alias, not an E.164 carrier number and not a substitute for phone verification or legal identity. It cannot receive invitation SMS or calls outside DANZSTAK, provide emergency services, or be used in third-party messengers. Its benefit is a separate contact identifier that does **not expose the personal number**; it does not by itself make WebRTC or the account more secure than existing free account calling.
- Clearly disclose the planned Starter scope: **$3 once, 250 connected voice minutes per month** for eligible DS-routed calls, subsequent paid upgrades optional and still subject to unit-economics/owner approval. Explain any call limits and the internet connection requirement. Do not imply unlimited usage or guaranteed background ringing; show `Test Mode` prominently in a staging checkout and never sell until call metering, provider costs and entitlements are verified.
- When a newly invited person joins, the invite should end at normal signup, not auto-register a device or buy an alias. Provide a safe transition to Phone Settings afterward. Device registration for calling (Issue #29) is a separate authenticated step, not a reason to block joining or buying the alias.
- The public invitation mechanism is separate: current members invite via the **sender's own SMS app / OS share sheet** (Issue #30). The DS alias itself has no carrier-SMS ability. Do not ask the new member for a telephone number simply to accept an invitation, message a friend, or join a group.
- Implement cohesive mobile-first translated UI on the actual signup/onboarding and `messages.html`, not placeholder copy alone. Test signup with zero telephone number, skip/resume flows, optional personal number privacy, simulated test-mode purchase success/failure/refund, correct DS allocation, no cross-account leaks, device independence and safe return to Messaging. Supply isolated PR, tests, verified phone-accessible staging PWA and owner review before merge/production.

**This is a new specification and NOT evidence that registration, DS-number provisioning or Stripe checkout works.**


## Owner network policy — identity control, no advertising or spam calls (2026-11-04)

**Owner commitment:** A DANZSTAK member chooses how they can be reached. Owning a $3 internal DS alias must **not** expose their real mobile number or turn the account into a target for telemarketing. DANZSTAK must not make unsolicited promotional calls to its members, and advertisers must have **no access** to call them through DANZSTAK Phone. These are enforceable product and backend requirements, not just marketing language.

- **Privacy by default:** The member's real mobile number, if provided voluntarily, is private. It is never shared with other users, callers, invitees, advertisers, ad tech or public directories without explicit, separate permission. The DS alias is an in-network account identifier, **not** a verified phone number or a security guarantee. Never sell, rent or share telephone numbers, DS aliases, calling lists, contacts or call-relationship metadata for advertising.
- **Incoming caller permissions:** Default incoming voice/video calls to accepted friends and mutually permitted contacts. Unsolicited calls from unknown people should be blocked by default, or require a member-initiated, consent-based call request they can decline without revealing presence or identifying information. Allow separate user controls for who can call, who can send a contact request, quiet hours and device-specific ringing. Do not make a purchased DS alias automatically public or searchable.
- **Strict anti-marketing rule:** No advertiser, sponsor, bulk-call service, promotional bot or DANZSTAK marketing team may originate unsolicited voice/video calls or voicemail campaigns through the network. No telemarketing API access, advertiser dialing dashboard, number-list export or premium "reach users" product. If service-related notices are necessary, deliver via consented in-app notifications or email, not unrequested voice calls.
- **Enforcement:** Server-side participant relationship/block checks, device registration authorization, per-sender call-request and ringing rate limits, call-setup quotas, spam detection with review/appeal, one-tap **Block / Report caller**, muted or declined unknown requests, and immediate enforcement of blocks across calls, chat invitations and voicemail. A blocked caller must not bypass restrictions by switching devices, recreating a DS alias, or forging caller identity. Avoid unsafe claims of perfect detection.
- **Controls and transparency:** In `messages.html`/Phone Settings, give members an accessible **Who can call me?** control (Friends only as initial default; additional choices only after privacy review), a clear **My number visibility** setting and the ability to turn incoming calls off. Display caller identity from the authenticated account, not an arbitrary display name asserted by signaling. Provide a clear, readable statement: "DANZSTAK will not sell your number or allow advertising calls. Only people you permit can call you." Confirm this wording matches actual operations and privacy/terms before publishing.
- **Invitation separation:** A member may invite a friend using the phone's native SMS composer (Issue #30), but DANZSTAK does not acquire recipient phone numbers or permission to contact the invitee. **An invitation is not consent for future calls or advertisements.** A member joining without a personal phone number has the same privacy controls as one buying a DS alias.
- **Tests:** Two-account incoming-call permissions, unrelated stranger with guessed DS alias, blocked/revoked callers, repeat-call flood, fake sender, alternate device/account, silent hours, voicemail bypass and friend-state changes. Verify neither personal numbers nor call graphs appear in public APIs, client logs, analytics, admin ad features or exported marketing datasets. Prove the server denies disallowed calling—not just that a button is hidden. Provide automated results and owner-reviewed phone-accessible staging PWA before production.

**Honest promise:** No platform can guarantee that nobody ever attempts abuse. The aim is to prevent unauthorized or marketing calls by design, give members full control, and enforce restrictions promptly. These rules do not require purchasing a DS number or disclosing a personal telephone number.


## Owner direction — comfortable conversation-first chat layout (2026-11-04)

**Owner request:** “The chat module should be more like this one.” Treat the conversational interface the user is interacting with as a **comfort and flow reference**: **simple, natural messaging first**, not an imitation of another company's copyrighted brand, proprietary layout or software. Retain familiar WhatsApp/Messenger-style participant chat patterns, DANZSTAK branding, light mode and phone-first accessibility.

**Owner's actual Android screenshot** of the Mary conversation shows an oversized secondary “You can message Mary directly” notice, very prominent Mute / red Hang Up strip, small list of bubbles in a large dotted background, and the message composer at the bottom. Use it as a concrete UX review reference; do **not** confuse its visible call controls with evidence of a working phone call. Separate bug #27 addresses missing ringback/incoming ringtone.

### Desired experience
1. **Conversation dominates the screen.** Small compact header with avatar, name and truthful availability; clear back, an **obvious phone and video call action**, and unobtrusive overflow for secondary settings. In normal chat mode, no oversized call toolbar, extraneous explanatory banner or unhelpful decorative box taking message space.
2. **Message flow feels natural:** clear left/right attribution, comfortable bubble widths and padding, grouped messages, compact readable timestamps, receipts only when genuine, date separators as needed, replies and reactions without covering a message. No distracting dotted wallpaper required; visually calm background and modest DANZSTAK accent. Don't waste room with excessive heading, spacer, line wraps or filler.
3. **Composer stays convenient:** ergonomic message entry, send button, camera/attachment, emojis/reply where implemented; keyboard not covering composer, safe-area padding at bottom, supports longer drafts, messages and emoji. Attachment previews are optional and not required to type.
4. **Calls have their own visual state:** when a call is active or dialing, show a compact call status/controls surface with accessible Mute and Hang Up (and Video where supported) that preserves message history and does not obscure composer unnecessarily. No false “Ringing” text when callee delivery isn't established, no phantom call banner after end. **Actual ringing, WebRTC and background push bugs are owned by Issue #27** and must be fixed before calling Phone finished.
5. **Reliable and comfortable behavior:** fast load, persistence, smooth scroll (don't snap a reader away from older text), display a new-message indicator if reading history, sending/retry/offline indicator, opt-in notifications and verified incoming calls; no auto-play sound/media from other messages. Chat supports normal DANZSTAK accounts without personal/paid phone number.
6. **No full-screen redesign surprise:** audit current mobile \`messages.html\`, \`assets/direct-messages.js\`, \`assets/chat.css\` plus active messaging wrapper. Keep existing secure auth, conversation IDs, permissions and message backend; don't duplicate APIs, break profile routes or rearrange main app navigation. No new platform or external messaging dependency.

### Demonstration and acceptance
- Audit actual 320/360/390/414/430px Android-like viewport, tablet and desktop screenshots. Show **before/after** for the exact Mary-style conversation with messages, alongside a longer thread, keyboard open, attachment preview, ongoing call, and returned/failed call. Visual changes should be measured as more usable space for messages and predictable touch targets (approximately 44px).
- Test two real account chat flows: send/receive/reconnect/history/scroll/attachment/call entry point and authorization, with all existing 15 locales and screen reader. Verify independent voice/video actions remain discoverable.
- Deliver small isolated chat UX PR, tests and screenshots, verified staging PWA, release SHA and explicit owner approval gate. **Do not merge chat UX changes with the P0 calling bug if that increases risk or delays the ringing fix.**

**Desired feel:** calm as a direct conversation, familiar as a messenger, and recognizably DANZSTAK.


## Owner requirement — Copy message text for outside translation (2026-11-04)

**Owner use case:** Their partner does not speak English. Members must be able to **copy incoming or outgoing message text** from any DANZSTAK one-to-one Chat bubble and paste it into a translation app of their choice. This is part of comfortable conversation-first messaging and must work with international text.

### Exact current UI conflict
- In current \`assets/direct-messages.js\`, \`directMessageItem()\` attaches a 550ms \`pointerdown\` timer that opens \`openMessageReactions()\` and a \`contextmenu\` listener that calls \`preventDefault()\` (current \`main\` approximately lines 579–581). Thus the usual Android long-press text-selection/copy interface is displaced by the reaction popup.
- \`openMessageReactions()\` (approximately line 359) offers emoji reactions, owner Edit, and Delete but **no Copy action**. Correct this instead of adding a confusing second long-press gesture or implementing a different messenger.
- The displayed plain text is sourced from \`message.content\` via \`.message-text\`; copy the **actual message content**, not timestamps, read receipts, markup, attachment URLs, person/account metadata, other messages, or placeholder text.

### UX and behavior
1. A member **long-presses a text bubble** (or opens its options using right-click, Shift+F10, or the accessible message actions) and sees a prominent, labeled **Copy** action alongside reactions and any permitted Edit/Delete actions. Available for **both received and sent** messages; no paywall or phone number required.
2. Tapping **Copy** copies **that message's exact plain text** to the device clipboard via an explicit user interaction; close the menu and briefly show **Copied** feedback only if the clipboard write succeeds. On denial or unsupported clipboard, provide a safe, selectable text fallback and an honest failure message, not a false “Copied.”
3. Let the user **select and copy part of a long message** using ordinary text selection (or a clear **Select text** mode); preserve native selection handles on touch screens where possible. Reconcile existing long-press reaction handler and \`preventDefault\` to avoid the selection getting trapped; don't disable text selection in CSS.
4. Make multiline, emoji, URLs, Unicode, Italian, English and the app's other localized content copy correctly. Copy user-authored text verbatim without HTML or escaped metadata. Opening links, replies, reaction counts, edit/delete, attachments and the scroll position must still work.
5. Do **not automatically send private message contents to any translator, analytics endpoint, external API or server**. A user may voluntarily paste the copied text into Google Translate, DeepL, a phone translator, etc. Any future direct **Translate** option must separately specify explicit consent, translation provider and privacy handling.
6. Keep the Copy action understandable on 320/360/390/414/430px screens, with labeled ~44px touch targets, keyboard/screen-reader access, correct placement above keyboard, translated menu labels and Android/iOS PWA compatibility.

### Test and acceptance
- With two controlled DANZSTAK accounts, receive an English message; long-press → **Copy** → paste into a separate translation app and verify the exact copied text. Repeat incoming/outgoing, Italian, multi-paragraph text, emoji, URL, long message and optional partial text selection.
- Test copy failure/restricted clipboard, screen-reader/keyboard menu, background/resume, failed network and different message author. Prevent accidental **Delete** taps; no copied text in analytics/logging.
- Codex: deliver a narrow independent PR, actual automated/manual phone checks, before/after screenshots, staging PWA and owner review. Keep P0 ringing repair (#27) separate. **Spec only; not a tested or deployed feature.**


## Real-world language barrier — optional in-chat translation (2026-11-04)

**Owner use case:** Two DANZSTAK users communicate in different languages (concretely English and Italian). One presently must copy messages into a separate translation app. Make that workflow immediately possible with the **Copy** control above, then implement a distinct, opt-in **Translate** action so they can actually understand each other without constantly switching applications. This product feature must not depend on the separate P0 phone-ringing/audio fixes.

### User experience, simple and respectful
1. Every real text message, incoming or outgoing, provides **Copy** and optional **Translate** in its message-actions menu (long-press/right-click/keyboard/accessible alternative). Copy works regardless of translation service availability.
2. On **Translate**, offer an understandable per-user target language (English or Italian as first demonstration; reuse the app's existing language list only where actually supported). Provide **Show translation / Show original** without changing the durable original post, its sender, timestamps, receipts or attachments. Make it visually clear which text is the user's original and which is a machine-generated translation; warn translations may be imperfect, especially idioms and slang.
3. Let each member optionally set **My preferred chat language** (separate from the other person's UI language) and remember it safely. **No need for the other member to have the same setting or install a translator.**
4. Initial MVP is **explicit per-message translation**. A later opt-in "Translate messages in this conversation automatically" may be prototyped only if privacy, provider cost and data-sharing disclosure pass review; **off by default**. If supported, either party can change their own setting without changing the other's experience.
5. Sending: messages remain in the language the author actually typed. Optionally preview a translated draft before sending in a separate reviewed milestone; **never silently rewrite or auto-send an AI translation** as though it was the author's own message.
6. Privacy: first audit feasible **on-device translation**. If a server/third-party translation provider is required, disclose the provider, precisely what message text would be transmitted, retention/processing and privacy safeguards **before user consent**; transmit only the selected text on deliberate action. No automatic surveillance, chat scanning, provider reuse for training/ads, silent analytics storage, or sharing entire history. Obtain approval of provider contract, security, GDPR/cross-border processing and per-message costs before activating paid APIs. Do not use a third-party translator SDK or API as a required dependency for normal messaging.
7. Performance/comfort: low-clutter labels, accurate status and failures, partial/slow network retry, original accessible offline, preserve scroll and selection, accessible screen reader announcement, 320–430px mobile and long/emoji/URLs/links/multiline/Italian accents. Copy works even when translation provider is unavailable or denied.
8. Keep basic social chat free; evaluate unit economics before offering any expensive AI translation service, no new Stripe product or forced subscription. Preserve existing conversations and secure authorization.

### Codex release gate
- Ship **Copy** quickly as a small independently testable PR, without waiting for translation research.
- Develop **Translate** as a separate isolated PR following a privacy/vendor/cost feasibility review; a synthetic-data demo is not evidence of working real chat translations.
- Two controlled participants exchange English and Italian texts, each chooses their own preferred language, taps Translate and toggles original/translation, copy remains functional, and different permissions/providers/consent refusals are handled honestly. Test no text leaks to unrelated accounts, malicious prompt strings/HTML, rate limits, PWA caching, offline, Android/iOS real phone availability and all localizations.
- Provide owner verified staging PWA, SHA, results, costs/privacy limitations and explicit approval before production or live provider calls.

**Product principle:** people should not need a shared language to be friends, and machine translation must remain under their control.
