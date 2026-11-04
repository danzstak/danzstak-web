## Premium standalone-quality SYNC inside DANZSTAK — owner-defined bar (2026-11-04)

**Owner statement:** "It needs to look and feel very good ... really not part of DANZSTAK it's that good. Better than a phone, better than WhatsApp, better than Messenger it needs to be that good."

**Product interpretation:** SYNC must **feel like a complete, dedicated, premium communications app the instant it opens**, not an embedded chat widget, generic plugin, overlay iframe, unfinished module or DANZSTAK feed with a message sidebar. Its own tightly consistent **SYNC visual identity and navigation** live inside one DANZSTAK account/service initially. It can someday be packaged separately (#43), but do **not** launch a second app, create a second signup or duplicate chat accounts now. The DJ-inspired SYNC button remains the familiar entrance.

### Independent-app experience inside DANZSTAK
- **Own screen and visual language:** opening SYNC takes the user to an immersive, native-feeling full-height SYNC interface (not a tiny crowded drawer). Purpose-designed typography, appropriate density, excellent touch targets and polished light-mode depth, recognizable SYNC/DJ-control identity, restrained active green; no stock component-library feel, huge wasted white gaps, random cards, jitter, clutter or copied Messenger/WhatsApp branding. A discreet Back to DANZSTAK returns home without losing drafts or call state.
- **Quality of interaction:** conversations and contacts appear promptly without flicker or fake loading states; scroll stays smooth with long history; keyboard opens/closes without bouncing messages; photos, timestamps and delivery states render consistently; smooth conversation-to-contact-details-to-conversation Back; clear offline, retry and send/receive receipts. Unread badge, push notifications and online indicators reflect actual backend state. Make frequently used actions one or two comfortable taps away, with rare settings contextual.
- **Feature depth without clutter:** familiar Messenger discovery/inbox, WhatsApp-level conversation mechanics, message copying/editing/replies, selective translations, voice notes, media, missed calls and voicemail as those are truly implemented. SYNC should not be visually simpler by excluding owner-approved capabilities, but by designing them into coherent, discoverable flows.
- **Phone-class call experience target:** immediate, obvious Voice and Video entry; convincing connected/incoming/rejected states backed by signaling, honest ringing/ringback, **both sides hear each other** with reliable microphone, speaker/earpiece, mute, echo handling, call interruption, drop/reconnect/cancel/timeout paths. No sound bleeding into The Roll or Dailies. **PWA limitation honesty:** background/locked-phone incoming ringing, call audio routing and native telecom features may be limited by OS/browser. Codex must identify where native app packaging or a service/provider is needed to reach a phone-class result; do not promise carrier-grade reachability or "better than a phone" as a verified fact without real comparative tests.
- **Private, secure and inclusive:** optional real personal SMS OTP (#21), private number by default, no mandatory phone/paywall for free member-to-member chat; separate optional in-network DS alias (not a real PSTN/SMS number), secure authorization, blocked-contact enforcement, no surveillance/AI analysis of private messages without explicit member consent. Responsive Android/iOS/desktop and screen reader, keyboard and reduced-motion support.

### Engineering quality gates — beat alternatives in measured experience, not claims
1. Codex first diagnoses and repairs core failures, particularly P0 **incoming ringtone / actual two-way audio #27**, SMS verification **#21**, and message reliability **#39**. A new visual skin does not count if calls fail.
2. Codex produces **two distinct visual directions** for a full-screen standalone-quality SYNC *within the existing DANZSTAK product* (no copied proprietary graphics), including cold/warm launch, inbox, thread with keyboard, incoming/ringing/active call, contact details, personal OTP and unread states. Pick an owner-reviewed direction before large UI changes.
3. Build an independently navigable client shell using existing auth and one backend, not a feed-specific iframe that breaks when launched directly. Progressive PRs: reliable core, app-shell/navigation, visual polish/performance, optional advanced actions. Preserve all existing member data and deep links, with no speculative rewrite.
4. **Objective evaluation:** run actual installed Android PWA and an eligible iPhone/device for supported capabilities, Wi-Fi/cellular, 320/360/390/414/430px, screen capture and test logs. Measure time from SYNC tap to a usable inbox and to a thread, dropped/stuttered frames on long-thread scroll, send-to-delivery/ack, unread and notification correctness, two-way call setup/speech in both directions, call reconnection/failure disclosure and battery/network effects. State performance targets based on measured baseline and user-agreed thresholds rather than inventing guarantees.
5. Do task-based, hands-on usability comparisons against normal expectations from dedicated messengers: a new member can find a contact, send/reply, copy, share media, optionally verify phone and make/answer a real call **without confusion, stale controls, phantom statuses or extra navigation**. Log problems and fix them until the owner's test is convincingly smooth. Report exactly what is supported in PWA vs requires native app and get security/owner approval before release.

**Success criterion:** People would genuinely want to keep SYNC open and use it as their everyday messenger even if they never use the rest of DANZSTAK. Design goal: **premium standalone app quality, immediately integrated into DANZSTAK, architecturally ready to stand alone**. An issue/spec is not shipped code or proof SYNC currently outperforms existing apps.


## Standalone-grade SYNC — single backend, future separate app — owner-approved direction (2026-11-04)

**Owner:** "I would like SYNC to be so tight that it can be an app on its own." **Owner confirmed: "Yes."** Design and deliver SYNC inside DANZSTAK as a **self-contained, dependable messenger/communications product** whose frontend can ultimately be packaged separately **without rebuilding the chat data, phone services, auth or contact relationships**. This is a *future option*, not permission to launch or brand a second app now.

**Keep one actual backend, one account and one source of truth.** Continue to use DANZSTAK Cognito/member identities, existing secure messaging/history, privacy/block rules, contacts, call signaling, notifications, attachments, verified phone state and DS in-network alias. A future SYNC standalone client should use the same authorized services and data, not duplicate user profiles, conversations, push identities or charge members for normal messaging. SYNC remains the DJ-console-inspired **button** that opens existing communications inside DANZSTAK.

**Engineering direction:** 
- Audit `messages.html`, `assets/direct-messages.js`, `assets/chat.js`, `assets/chat.css`, `feed.html` `#messagesNav`, Cognito/session routing, API/push/service worker and phone registration. Map hidden dependencies on feed globals/DOM and refactor only as needed using small PRs.
- Make opening `messages.html` directly work as a complete mobile-first SYNC screen on a newly launched PWA, including authenticated deep-link return, chats, history, search, avatars, contact details, notification state, drafts, media, Voice/Video actions and privacy. Existing feed SYNC button opens that same experience. Preserve navigation/back and shared unread state.
- Build stable client/service interfaces and test with **two app entry points using one backend** on real phones, avoiding divergent messages, duplicate alerts, separate sign-ups, conflicting registration or broken payments. Modular architecture and standalone quality matter more than launching another shell immediately.
- Keep current urgent P0 **real messaging reliability (#39), actual optional phone SMS OTP (#21), two-way calling/ringtone (#27)** and device enrollment (#29) as release blockers. Do not postpone concrete fixes for a speculative future client. Preserve full feature vision, Messenger/WhatsApp familiarity, distinctive uncluttered SYNC design and actual call security.
- A separate app/PWA/store build, domain, app name rights review or new deployment occurs **only after owner approval** and a report on store-background calling/push limitations, shared identity, costs, privacy, testing and support.

**Codex deliverable:** evidence-backed direct-entry SYNC staging PWA, real two-account tests from both DANZSTAK and independent chat entry, phone screens at 320–430px, background/notifications/keyboard and logout, exact commit SHA, pass/fail, modularization summary and owner review. Create **no duplicate backend or live second product** merely from this spec. Track future-ready architecture in [Issue #43](https://github.com/Danzstak/Danzstak-web/issues/43). Requirements are not deployment evidence.


## SYNC as central DANZSTAK communications pillar — owner product priority (2026-11-04)

Owner says: **"SYNC will be very important to DANZSTAK."** This makes the **SYNC chat-launch button and the complete reliable communications experience it opens a flagship/core product priority**, not a throwaway decorative renaming exercise. Keep the exact public launcher label **SYNC**, with the DJ-console transport-button visual reference (restrained illuminated green when active), but do **not** rename the underlying internal messaging API or build another redundant chatbot.

**The member experience:** SYNC is visible, immediately discoverable, and opens one dependable, familiar communications destination. Within it: a clean Messenger-like inbox/contact strip, comfortable WhatsApp-like conversations, authorized photo/avatar navigation, reliable message persistence and notifications, actual phone-number SMS verification for opt-in personal numbers, working in-network voice/video including real recipient ring/remote audio, optional DS in-app identity and the existing approved advanced features as they pass tests. Chats and calling remain free without a paid number or mandatory verification. No fake verified/call/online states.

**Order of execution:** prioritize a fast working SYNC launcher and basic send/receive/history, genuine SMS OTP (#21), and two-device ringtone/two-way-call repairs (#27); then iteratively deliver polished UX, media, translation and other approved options. This is a **full-feature vision**, not a request to cut enhancements. Stability, real Android PWA usability, privacy and genuine functioning are release blockers. No production claim or launch before a tested PR, staging, pass/fail matrix, and owner review.

**Success criterion:** ordinary users quickly find the SYNC button, enter real Chats, can message and call each other without frustration, and trust that status and verification are truthful. Preserve DANZSTAK's independent visual identity and users' privacy; do not touch any other company or product.


## Owner naming decision — the chat entry control is the SYNC button (2026-11-04)

**Owner's exact correction:** "I want to name the chatbot SYNC" followed by **"It's the SYNC button."** Treat **SYNC** (uppercase) as the **user-visible name/label of the existing DANZSTAK chat launcher button**—not a request to create a separate AI chatbot, rename internal APIs, replace the Chats backend, or rebrand every conversation screen as SYNC.

**Expected member experience:** The familiar, well-placed SYNC button, with a compact chat/message icon where appropriate, **opens the existing DANZSTAK Chat / Messenger–WhatsApp-style inbox** and preserves unread badge/notifications. Label its visible caption **SYNC** (not generic "Messages" where that control is labeled) and give it a clear accessible name such as "SYNC — open chats". On a tiny phone, keep the control readable, thumb-friendly and discoverable without consuming disproportionate screen space. Inside the Chat destination, existing plain "Chats", contact names and conversation labels remain understandable; don't indiscriminately relabel every Chat UI string or create a fake AI conversation.

**Current actual source cues (main):** In `feed.html`, the existing top feed entry `#messagesNav` currently has `aria-label="Messages"` and `title="Messages"` and opens `messages.html` via its existing drawer/route logic. `messages.html` has a Chat bottom-nav link (`data-icon="chat"` / `aria-label="Chat"`) and a `Chats` inbox heading. Audit all true Chat entry points (phone/desktop/menu), choose consistent **SYNC** launcher presentation, and preserve existing route URLs `messages.html`, screen state, message count/badges, notification targeting, sign-in permissions, Back, accessibility, localization and keyboard/navigation behavior. The SYNC button must actually open Chats, not a dead click target.

**Do not block core P0 reliability:** SMS phone verification #21, real two-way calling/ringing #27 and actual message send/receive remain highest functional gates. SYNC naming is an **in-place, owner-approved label/launcher UX change**, not a separate product, extra subscription, bot that reads private conversations or backend migration.

**Codex acceptance:** visible and accessible SYNC launcher on mobile and desktop in light mode; tap/click routes to actual existing chat; unread count, existing conversations, back/close, keyboard focus and 320–430px responsiveness work. Provide isolated PR/staging evidence and owner approval before deployment. **Documentation update does not mean site label changed yet.**

## Final Chat UX design standard — Messenger navigation, WhatsApp functionality, DANZSTAK finish (owner directive, 2026-11-04)

**Owner's exact design goal:** "A cross between Messenger and WhatsApp should be the DANZSTAK cleaner better functioning." This is the **top-priority final product UX standard** for the existing Chats/Phone module, not a request to install Meta/WhatsApp products, copy trademarked visuals or replace the existing backend.

**Distinct responsibilities:**
1. **Messenger-familiar inbox/navigation:** one clean mobile Chats screen with a horizontal, swipeable row of **real authorized friends' profile photos** (no fake contacts/presence), easy search, legible recent-conversation list, unread states and previews from actual messages. Tapping top-row photo or conversation row reliably opens the existing member thread. A small-screen header must not bury actions or waste vertical space.
2. **WhatsApp-familiar conversation mechanics:** natural paired message bubbles, compact timestamps, readable long text, reliable send/delivered/read indicators only when backed by real data, reply/edit/delete according to actual permissions, Copy and native partial text selection, multi-select, voice notes and attachments where implemented, and a bottom composer that stays usable with the phone keyboard. The user's own messages and the other person's must be distinguishable without huge colored panels or noise.
3. **Contact Details navigation:** In conversation, tapping contact avatar/name opens a genuine detail panel with larger real picture, View Profile, implemented mute/block/notification actions; Back returns to the SAME conversation and restores draft/scroll, next Back returns to the SAME inbox search/filter/scroll. Avoid generic redirects or fake toggles.
4. **Phone and video must actually work:** obvious **Voice** and **Video** calls accessible on small phones and near contact header (not hidden in a Delete-only overflow). Actual caller ringback, recipient ringtone/notification when supported, audible remote two-way audio, actual video when allowed, speaker/mute/hang-up and privacy, proper missed-call status. The known P0 bug **#27** remains blocking until two real phones exchange actual audio. **Personal phone number verification #21** is a separate, real SMS/OTP experience (optional and private); internal paid DS alias is separate from personal phone numbers, no mandatory DS number for ordinary chat.
5. **Cleaner, less cookie-cutter DANZSTAK feel:** light mode, deliberate typography/spacing and alignment, restrained brand identity, minimal chrome and wasted white space, no giant Mute/Hang Up banners in idle chat, crowded menu labels or distracting dotted backgrounds. Useful controls should be discoverable without always visible toolbars; responsive touch targets, assistive tech and multilingual layout. Smooth message scrolling/new-message focus/keyboard handling and no janky page jumps. Familiar **behaviors** but original DANZSTAK appearance.
6. **Keep the ambitious feature roadmap:** optional manual and opt-in automatic translation, multi-select Copy/Translate, voicemail, missed-call records, in-network number/contact options and other owner-approved functions are retained and may be added in tested increments. **Clean UX does not mean fewer capabilities**; only surface them where contextually useful, and never present an unimplemented option as working.

**Required Codex execution:** audit production files `messages.html`, `assets/direct-messages.js`, `assets/chat.css`, `assets/chat.js` and real API/permissions before changes. Propose a mobile before/after plan and implement small reviewable PRs, prioritizing actual message send/receive/persistence, phone verification and failed voice/video call flow before cosmetic-only work; then integrate clean inbox and thread UI. Real two-account/two-phone Android PWA evidence at 320/360/375/390/414/430 CSS px, keyboard open/closed, search-to-thread-to-details-to-back, text Copy, message failure/retry, notifications, SMS OTP on real handset only after spend approval, audible call both directions, video/call interruption, screen recordings/screenshots and pass/fail counts. Provide staged preview, commit SHA, exact limitations and owner approval before merging/deploying.

**Acceptance:** a normal member can find a friend, message them, verify an optional personal number, and actually speak/video call from DANZSTAK without a confused UI or phantom success states. The module should *feel as familiar as Messenger and WhatsApp, but function more reliably and look unmistakably DANZSTAK*. Specs are not implementation proof.

## Final owner correction — ambitious Chat features, reliability at every step (2026-11-04)

Owner says: **"With AI building the chatbot all of those functionalities that we wish we had in the other chat bot we are going to have in DANZSTAK."** **Previous assistant interpretation of "fewer features" was incorrect.** The intention is **not** a pared-back messenger or a rule against adding capabilities. Codex/AI-assisted development should help implement **the complete desired DANZSTAK chat/communications feature set**, including features that were previously impractical in the older chatbot. Keep the platforms' code, data and account operations independent; do not modify SFScoop.

**Strategic direction:** ambitious functionality with simple, comfortable, non-cookie-cutter day-to-day interaction. The goal is for each feature to be truly usable and integrated, not a cluttered menu or decorative control. Scope includes reliable two-way messaging, replies, copy/multiselect, optional on-demand and opt-in automatic translation, attachments, real user photos/contact details, search/read states, push notifications, real personal phone number SMS verification, secure device registration, optional internal DS aliases, dependable voice/video calls/ringback/ringtone, missed calls and voicemail, and other already approved Chat/Phone capabilities. Retain current detailed requirements/tickets; do **not** remove features because another chat product omitted them.

**Delivery priority is not a feature cap:** P0 functional Chat, real phone SMS verification (#21) and genuinely working calling (#27) are the immediate urgent blockers. Codex may design and implement other planned capabilities in small, independently testable PRs without holding them indefinitely. Stage and integrate each feature only once real account/API/device tests pass; the same high reliability bar applies to advanced functionality. Review accessibility, privacy/permissions, vendor costs and owner approval for paid integrations and production.

**Acceptance:** demonstrate the core on two real phones while also tracking the full feature roadmap; show working controls and honest failures, not fake Verified/Connected labels. This directive **supersedes previous "avoid feature bloat" or "fewer features" wording when construed as a limitation of the DANZSTAK feature vision**. Distinguish AI as a coding aid from an embedded AI assistant: this comment is not an instruction to introduce an AI correspondent that reads private messages.


## Owner critical order — make Chat and Phone genuinely work, avoid feature bloat (2026-11-04)

**Owner priority:** "The chatbot is the biggest issue"; "Phone #: verification and functionality"; "What's the use of having a chatbot if it's just going to frustrate users? That's why we didn't add a lot of things to the SFScoop chatbot." DANZSTAK's existing Chat/Phone is **P0 #1**. **Do not add a new AI bot, overbuilt translation or optional paid complexity** before ordinary messaging and phone functions reliably work. This is an instruction about DANZSTAK only, not SFScoop.

**Release-gate minimum:** (1) account-to-account text messages truly send/receive/persist, Chat inbox, notification and contact navigation work, basic Copy/Reply is usable; (2) a member can optionally enter personal mobile number, receive **real 6-digit SMS**, submit valid OTP to backend, and see verified/private masked number with secure resend/change/remove; do not mark verified from mock/test UI; (3) actual DANZSTAK internet voice/video calls have visible controls, caller ringback, real recipient alert where device/OS permits, audible **two-way** audio/video, reliable hangup and error states; prove on **two real phones** and when the app reloads or backgrounded where supported.

**Do not conflate concepts:** personal number verification (#21) is private and *optional*, free Chat works with no phone number; internal **DS-prefixed paid account alias** is a separate DANZSTAK-only identifier that cannot receive external SMS or call PSTN; phone-app device registration (#29) distinct from personal OTP; caller/callee audio/ringing defects are independently P0 #27. No new SMS vendor, billed messages, DS Stripe products or deployment without owner-approved security/pricing/country coverage.

**UX:** simple Chats inbox and easy conversation first; readable bubbles, small useful controls, no false statuses or empty decorative panels. Only implement additional translation, voicemail, monetization, extra toggles after working basics. QA requires real personal test SMS on an approved handset/provider and real two-account two-device Chat/voice/video, exact failure reasons, security/permissions, Android PWA staging, code SHA and owner signoff. These are not currently verified live.

**Supersedes earlier "SMS verification later" ordering in this document.**

## Owner priority shift — Chat is DANZSTAK P0 number one (2026-11-04)

**Owner explicitly corrected the development ranking: "The chatbot is the biggest issue."** Treat this as **the existing DANZSTAK Chats/messaging experience**, not authorization to build an unrelated AI chatbot or a new provider. **P0 #1: make the core chat product comfortable AND actually reliable before polishing video feeds or progressing optional enhancements.**

**Execution priority within the Chat area:**
1. **Functional core:** prove with two real member accounts that direct chats reliably open, send, receive, persist, load prior history, respect authorization/privacy, show accurate unread/replies and remain usable through network errors, app background/foreground, page reload and keyboard-open mobile screens. Fix blocking failures, with reproducible root cause and a small PR.
2. **Calling blocker stays a separate P0 [#27](https://github.com/Danzstak/Danzstak-web/issues/27):** actual incoming ringtone/alerts (where PWA platform permits), caller ringback, *audible two-way remote voice*, discoverable Voice and Video actions and real two-phone testing. Chat must not be called ready while these user-reported failures remain. A CSS-only or caller-only ringback PR is insufficient.
3. **Comfortable interface [#39]:** original light-mode DANZSTAK identity; Messenger-familiar inbox with **real authorized member profile-photo row**, search and conversation previews; WhatsApp-familiar bubble threads with compact name/contact header, clear call controls, easy composer and natural spacing. Tap inbox avatar opens conversation; tap header avatar/name opens Contact Details, with Back restoring draft/scroll/search. Cut oversized call/action panels, fake states, dead whitespace and cookie-cutter blocks.
4. **Basic actual message actions:** native select/copy incoming/outgoing text (including partial text), sensible reply/edit/delete according to ownership, multi-select and copy; never break reactions. Real notifications/attachments where supported, without double alerts or unsafe permissions.
5. **After the reliable core is demonstrated:** optional translation/automatic language detection, phone-number verification [#21](https://github.com/Danzstak/Danzstak-web/issues/21), voicemail [#28](https://github.com/Danzstak/Danzstak-web/issues/28) and monetization enhancements. Do not let these delay working ordinary chat or genuine calls.

**Owner-specified order relative to other work:** Chat and the P0 calling repair come **before the new creator-content deletion UX (#40), account-exit/recovery UX (#32) and video polish (#8/#11)** in the development lineup. Preserve their recorded requirements, security/privacy safeguards and existing work; this reprioritization is not permission to remove anything or bypass active security obligations.

**Hard acceptance:** Two distinct real accounts on actual phone/PWA devices (Android first), 320/360/390/414/430px; message round-trip, persisted thread, copy/selection, notifications and failure recovery; incoming/outgoing calling with real two-way audio/video or a precisely disclosed unsupported platform; no silent audio failures or fake connected states; usability screenshots/video, exact SHA, tests pass/fail, reliable staging URL and owner review before deployment. Separate small PRs for messaging UX and media/calling repairs. **This issue records a priority, not completed code or a running Codex job.**


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


## Owner decision — batch-select, copy and translate several Chat messages (2026-11-04)

**Owner provided a mobile example of six messages selected simultaneously and asks to "translate the batch of text."** DANZSTAK must support both **native-style partial highlighting within one message** and **multi-select across multiple chat messages**. Treat this as a comfortable conversation workflow, not a request to copy another app's visual branding.

### Selection UX
1. **Select text:** touch/press within a message, drag selection handles to highlight one phrase, and use OS **Copy** where supported; offer accessible Select text action where long-press conflicts with reactions. Preserve ordinary touch text selection, links and message accessibility.
2. **Select messages:** long-press or open a message's action menu and choose **Select**. Tap other bubbles to add/remove them; display a clear count (for example **6 selected**) and a compact toolbar: **Copy selected**, **Translate selected**, **Cancel**. The actions apply only to selected messages in the currently authenticated thread. Do not accidentally select linked previews, delete conversations, drag/scroll erratically or send anything.
3. **Copy selected:** concatenate *original plain-text message bodies only* in **chronological chat order** (not selection-tap order). Preserve readable line breaks and brief **sender labels** if both participants' messages are selected, to retain conversational meaning. No email addresses, phone IDs, contact secrets, markup, reactions, media URLs or hidden data. For textless photo/video, either exclude and disclose skipped messages or show a locally generated, clearly labeled attachment placeholder; never copy a private media link. Confirm clipboard success; on failure show safe selectable fallback.
4. **Translate selected:** member explicitly chooses **English, Italian or another genuinely supported target language**, or uses their personal chat-language preference. Show a separate translated batch view preserving **each message's speaker, original position and dates if helpful**. Optionally render original and translated lines paired or provide an obvious **Show original / Show translation** control. Translate multilingual/mixed English–Italian selections intelligently without reversing speakers or overwriting stored originals. Do not post the translation as a new chat message or send it to the other person without another explicit user action.
5. **Copy translation:** one action copies the translated batch in original chronological order with brief speaker labels; never attach extra logs, prompts or hidden metadata. Preserve output for manual paste into a translator, message draft or other app if the member chooses.
6. No automatic translation of conversations, no translation provider calls while merely selecting, and no sharing private Chat data with a vendor without explicit informed consent. Prefer on-device translation when feasible; otherwise audit/provider privacy and costs and require owner approval prior to live third-party calls. The **Copy selected** feature must work entirely locally when translation is unavailable.
7. On network/API failure keep selection and originals intact, show reliable retry/cancel, never falsely mark translation complete. Bound batch size and characters to mitigate cost/latency; make limits clear before sending. Protect unauthorized access and cross-account message IDs, offline history and 15-language UI, ~44px targets, Android/iOS installed PWA keyboard/screen readers.

### Acceptance / release
- Real example: select **6 messages** (including Italian incoming and English outgoing, multiline and emoji) in a real two-account thread, check **6 selected**, tap **Copy selected** and paste exactly formatted original text into a translator. Repeat **Translate selected** to English, verify full six-message conversation order and sender labels, toggle originals and use **Copy translation**. Nothing should be sent to the chat by translation.
- Test 1/0/large selections, rapid deselect, older-history pagination, deleted/edited messages, copy permission failure, partial-word selection, touchscreen/keyboard, clipboard data privacy, provider refusal, translation timeouts, no duplicates across PWA refresh, mobile viewport 320–430px.
- Keep three independently verifiable milestones: **(A) single-message and partial-text Copy**, **(B) select multiple + Copy selected**, **(C) batch Translate selected + Copy translation**. Do not block (A/B) behind translation provider procurement. Isolated PRs, staging PWA, real tests, owner approval; no claim of implementation based solely on this specification.


## Owner update — always-on automatic incoming-message translation (opt-in) (2026-11-04)

**New owner direction:** "Could make it always translate as well any language to a language that they understand. The translators implemented it should recognize the language and translate to a language that they choose." A practical cross-language friendship use case is English ↔ Italian. This feature **supersedes the older blanket sentence "No automatic translation of conversations"** in the manual/batch-translation sections, *but only after an account holder explicitly turns it on*. There must be **no automatic processing or sharing of private message content by default**.

### Extremely simple member-facing controls

- Chat Settings: **Read messages in: [English ▾]** (select from verified translation-supported languages, distinct from DANZSTAK interface/localization language).
- **Auto-translate incoming messages: [Off / On]**. **Off by default**; a deliberate member action turns it on, and the preference persists across sessions and devices after consent requirements are met. Each person sets **their own** language independently; the other person's view and original message remain unchanged.
- After opt-in: automatically **detect the source language separately for each newly displayed incoming text message**, and show it in the member's selected language. Reuse the same setting when reloading a thread or fetching older visible messages, but do not run a hidden bulk sweep over an entire archive or translate messages when the member is not viewing them without additional approval.
- If a message already appears to be in the requested target language, **leave it alone**; handle mixed-language messages, emojis, URLs, names, code, short ambiguous texts and multilingual conversation without falsely labelling source language. If detection/translation is uncertain, preserve and show original with a clear **Translate manually / retry** option.
- Each translated bubble is visibly labeled **Translated** and has a one-tap **Show original / Show translation** toggle. The original server-stored message is immutable; do not silently rewrite a sender's words, message delivery/read receipts or the sent text.
- The member can **switch target language or turn Auto-translate off any time**. When off, existing chat displays originals (unless the member explicitly requests an individual/manual/batch translation). **Copy**, **Select text**, **Copy selected**, **Translate selected**, and **Copy translation** continue to work independently.
- Manual **Translate** and **Translate selected** remain alternatives for users who leave auto-translate off and for correcting language detection. Translations may be wrong for slang or idioms; keep originals easy to inspect.

### Privacy and cost are not optional

- **Prefer on-device translation when the browser/platform realistically supports it**. The existing \`window.danzstakTranslate\` helper in \`assets/direct-messages.js\` translates **UI labels**, not conversational content: **do not treat it as a ready-made chat translator or claim implementation based on that helper**.
- If server/third-party translation is required, **obtain informed consent when turning Auto-translate on**, explaining the exact vendor/service, message excerpts processed, retention, cross-border processing, privacy limits and how to revoke consent; obtain owner review of supplier contract, per-message/character pricing, GDPR implications, data minimization and secure authorization. On means consent only within the disclosed scope, not unrestricted training, ads, analytics or export of a member's complete chat history.
- Never send messages to a provider before consent, after disabling, or when access to a thread is revoked; do not include personal emails/phone numbers, thread IDs, media URLs, other members' messages or unrelated context unless demonstrably necessary and separately authorized. Prefer ephemeral, scoped local translation cache with minimal retention and no sensitive logs. Keep translation keys on server if needed, enforce budgets, character caps and rate limits, and do not add surprise paywalls to basic messaging.
- Be clear about supported languages/providers and current coverage; "any language" is a **discovery/coverage goal**, not a guarantee for unsupported languages. Fall back to readable original text when offline, unsupported or service unavailable. Never block sending, receiving or copying messages while translation is unavailable.

### Phased acceptance and evidence

1. **Release Copy / partial highlighting / multi-select Copy** without dependency on machine translation, as already specified.
2. Prove opt-in per-message **Translate** and selected-message batch translation with chosen target language and original preservation.
3. Implement **Auto-translate incoming messages** as a separate, privacy-reviewed PR: A chooses English and enables it; B chooses Italian and enables it; A writes English, B sees Italian; B writes Italian, A sees English. Include a third source language and one already-in-target-language message. Reload both devices and verify the opt-in remains set per account; turning off instantly reverts to originals. Test mixed language, slang, emoji, links, failures, consent declined/revoked, unauthorized access, async stale responses, 320–430px Android/iOS PWAs, accessibility and long threads. No automatic translation on the sender's own already-typed text unless expressly opted for in a future feature.
4. Supply precise vendor support/cost, test pass/fail counts, staging phone PWA URL, tested commit, actual provider vs mocked results, and **owner approval before production or enabling any paid vendor**. A written instruction or translated demo string is not a working translation service.

**Goal:** a member chooses their own language once; DANZSTAK makes each newly viewed incoming conversation easy to understand without making the sender change languages.


## Owner clarification — learning a language means originals first (2026-11-04)

**Owner's personal example:** "I don't use that feature on WhatsApp because sto ancora imparando l'italiano" — they are still learning Italian and **do not want all Italian text silently turned into English**. This is an explicit UX and user-choice requirement.

- **Default: original messages.** Automatic translation remains **OFF** unless the individual member explicitly chooses it. Do not infer auto-translate merely from the person's preferred app language or a manual translation request.
- A member learning Italian can read incoming Italian **as written**, highlight one word or sentence to copy, choose **Translate** only when needed, or select multiple bubbles and translate a batch on demand. They can toggle original/translation without losing the Italian.
- Members who want convenience can voluntarily enable **Auto-translate incoming** to their chosen language, with the privacy consent required by the existing translation specification. The other member's setting is independent.
- Never alter stored messages. An optional **Show original and translation together** view may help learners, but is never forced.
- Test: A uses an English UI and auto-translate OFF, sees authentic Italian, can manually translate one or a batch. B opts in and automatically sees translations. Turning it off returns original display; no provider call without consent.

**This overrides any suggestion that all users should auto-translate by default just because the feature exists.**


## Owner visual reference — Messenger-style inbox plus WhatsApp-style thread (2026-11-04)

**Owner direction:** “A mix of both others chatbots” with an Android **Messenger conversation-list screenshot** (large recognizable inbox, search, profile-photo rows, message previews, time and unread indicators) and an earlier **WhatsApp conversation screenshot** (compact person header, obvious voice/video actions, tightly organized bubbles, bottom message composer and keyboard-safe layout). These are *two reference apps, not DANZSTAK integration partners*. Build an original, familiar, comfortable DANZSTAK messaging UI using the practical strengths of both. **Do not clone their logos, trade dress, branded artwork, exact visual assets, Meta AI, Facebook authentication or proprietary APIs.**

### A. Chats home: familiar, scannable inbox (draw from Messenger)
- Clear DANZSTAK-branded **Chats** heading, prominent **Search chats** field, compact compose-new-chat action, and simple **All / Unread / Tribes** filters if those features actually exist.
- **Each conversation row** shows avatar, person's display name, latest message preview (privacy-aware), localized timestamp/day, and a high-contrast **unread dot/count** only when server-reconciled. Display when message sent by you vs contact; optionally show delivery/read state only if proven. Clear tap affordance, one-tap open, consistent row heights, no giant empty cards.
- A **required compact horizontal recent/favorite contacts strip** with circular member photos at the top of the Chats inbox, derived from real permitted relationships and recent conversations; see the explicit owner directive below. No forced Stories carousel, algorithms, Meta branding, advertising or professional upsells.
- One shared secure DANZSTAK account/session; match existing backend message persistence, unread counts and push notifications. Avoid duplicate navigations or a second chat implementation.

### B. Open conversation: relaxed, WhatsApp-familiar thread (draw from earlier screenshot)
- Compact back/avatar/name/real online/last-seen state with visible **Voice** and **Video** actions, and compact overflow. On constrained phone widths, consider a tidy **centered two-button row directly below the compact recipient header** per owner and P0 issue #27. Never hide Video, bury it under a Delete-only menu, or crowd contact identity.
- Readable left/right message bubbles, comfortable moderate width, neatly placed timestamp + substantiated read receipts, small unobtrusive reactions, clear replies/quoted context, visible date breaks when meaningful. **Light mode only** with DANZSTAK's blue/neutral branding and restrained colors; screenshot dark backgrounds are examples of interaction layout, **not** a request for dark mode.
- Calm full-height thread with message space maximized. Remove redundant “You can message X directly” ribbon from ordinary conversations unless it contains actionable status, and never show large Mute/Hang Up strips except in a compact, accurate **active-call** surface. P0 incoming ringback/speaker/remote audio issues remain separate, unsolved until real phones work.
- Pinned compact **composer above Android/iOS keyboard**: emoji access, writable text, attach/photo/camera, simple send. If a microphone button is proposed when empty, validate actual voice-note scope and privacy/backend/cost first; do not turn an icon into a fake function, silently record, or bypass the existing narrow voicemail/audio-hosting policy. Keep current working messaging actions until a tested replacement exists.
- Long press / select single word or several bubbles → **Copy / Copy selected / Translate / Translate selected** with text still selectable by the OS and original language visible by default. Auto-translate only after each member explicitly enables it; support language learners. Preserve all existing link/media safety and message authorization.

### Codex rollout and acceptance
1. Make **before/after mock/reference screenshots** for Chats list and active conversation at 320, 360, 390, 414, 430px and desktop; owner reviews a phone-accessible staging PWA before merge. Do not simply style a fixture; verify actual account data and message APIs.
2. Split small PRs: inbox density/readability; compact conversation/header/composer (without breaking text sending); selection/copy; translation with separate privacy approval. Keep **real two-way calls, ringtone, speakerphone, missing camera** under P0 #27 and its draft PR #36, and do not mark working from a visible icon.
3. Test conversation loading/persistence, accurate unread state, keyboard open/shut + safe areas, back navigation, no fake "last seen", 15-language text expansion, screen reader labels, 44px controls, no horizontal overflow, Android/iOS PWA refresh, session/account isolation, existing calls and attachments. Record exact pass/fail results and screenshots.
4. Brand principle: **“Messenger's browsable inbox + WhatsApp's comfortable conversation + DANZSTAK identity”** — *interaction inspiration only, not a clone or reliance on Meta*.

**Status:** design instructions only. Not an implemented redesign or a claim of tested device behavior.



## Owner final inbox choice — member avatars across the top (2026-11-04)

**Owner explicit direction:** “Put the users images across the top like a fb chatbot with the functionality of a WhatsApp.” The familiar visual reference is **Messenger's horizontal contact-avatar strip**, combined with **WhatsApp-style functional conversations and calls**. Keep DANZSTAK's own brand, light-mode design, data and servers. This instruction overrides the earlier suggestion that the avatar strip is optional: **a compact tappable top row is required in the Chats inbox**.

### Chats inbox design
- Directly below the compact **Chats header and search** (before the scrollable conversation list), display a **horizontal swipeable row of circular profile photos** from actual permitted contacts / friends or recent conversations, with short names and accurate online/availability indicators *only when backed by presence data*. Never populate with fake or promotional profiles. Preserve account/member privacy, block lists and consent; no public phone numbers.
- **Tap picture → opens that person's existing one-to-one conversation** under the current authenticated account. If permission to message does not exist, don't silently start an unauthorized chat. Place current conversation list below, with previews, time, unread badges and search. Use stable user order (recent/favorites or owner/user-controlled), not an engagement-maximizing or hidden feed algorithm.
- A missing avatar displays a tasteful initials fallback. Test avatars with long names, 0/1/many friends, muted/blocked/revoked contacts, inaccessible images, offline and long horizontal contact lists. Do not make a top row into mandatory Stories, Meta AI, ads, or a separate social graph.
- Make the strip comfortable: ~48–64px circular pictures, one row, sensible gutters, minimal vertical height, no excess top whitespace. Smooth horizontal scrolling without taking over vertical chat scroll; accessible names/touch targets, contrast and keyboard navigation, 320/360/390/414/430px mobile and wider screens.

### Opened chat: WhatsApp-level functionality
- Keep a compact header with avatar, contact name/status, and **both Voice and Video** actions discoverable; ordinary app messaging does not depend on a phone number. Support secure durable messages, read/unread status only where proven, reactions/reply, photo/video attachment, safe links, smooth scroll, keyboard-safe bottom composer, emoji, block/report, and permissioned notifications.
- **Copy a selected word, an entire message, or a batch of selected bubbles**; provide opt-in single/batch translation and independent per-user auto-translation (off by default), preserving the original language for learners.
- A missed call belongs in the same conversation with caller/time; voicemail and functional speakerphone are planned under issues #28 and #27. A voice/video button is **not** evidence the calls work: ringtone, bidirectional audio and actual video must pass two-device hardware tests. Don't introduce unsupported microphone recordings or pretend unsupported functionality is available.
- Never clone Meta/WhatsApp branding or reuse their APIs. The reference is only for user comprehension and flow. Do not introduce dark mode: DANZSTAK remains light mode with its own style.

### Codex acceptance
- Stage a real authenticated Chats inbox with the avatars in the top horizontal row and real conversation list below; tap avatars to open actual threads. Show before/after screenshots at 320, 360, 390, 414, 430px and desktop with verified phone-accessible PWA preview and exact commit SHA.
- Two-account tests: friends/avatar display, accurate presence, thread deep-link, permissions, blocks, unread changes, multi-select/copy, translation only where implemented, message persistence, alerts and responsive keyboard. Preserve existing API and core messaging data.
- Implement in an isolated PR with pass/fail evidence; physical Android/iOS review noted honestly. No merge or production deployment without owner approval. **This is a product spec, not an implemented or tested screen.**


## Final owner P1 — real SMS code for personal phone verification (2026-11-04)

Owner says: "User should add their phone number and then get a text message to verify it." **This must be an actually working optional personal-mobile-number feature**, not placeholder UI, fake local code validation or the paid $3 DANZSTAK in-app alias.

### User flow (one DANZSTAK account; no additional registration)
1. From the main Account Settings and an obvious **Phone & verification** entry in Chats, choose **Add my mobile number**. Select international country code and enter own number (support country-appropriate input, E.164 on backend). Clearly label **optional**, and **private by default**.
2. Tap **Send verification text**. Server sends a **real SMS** via an approved SMS provider to that number with a time-limited one-time **6-digit code**. Show partially masked destination and editable number, e.g., "Enter the six-digit code sent to •••• 1234". No SMS is claimed sent unless the provider acknowledges the attempt.
3. Member enters the code; backend validates the correct number, code, expiry, retry rate and already-used status; then show **Phone verified** and a masked number in both Account Settings and Chat phone settings. Verification means possession of the number at that time, not government ID/real-world identity.
4. Provide **Resend code** with cooldown, **Wrong/expired code** errors, **Change number** (fresh challenge required), and **Remove number**. Handle unsupported country, provider failure, SMS blocked/not delivered, duplicate number linked to another account, and account recovery without locking out members.
5. Do **not require a number for ordinary DANZSTAK signup, Friends or free Chat**, and never automatically create/buy the optional internal $3 DS alias. A DS alias is NOT a real carrier number and cannot receive this SMS. Never use verified numbers for contact discovery, ads, solicitation or share them with friends without a separate user opt-in.

### Security, privacy and implementation
- Inspect existing AWS Cognito, SES/SNS, other approved SMS provider options, production messaging account policy and actual current frontend/backend code; choose a reliable, international, low-cost real-SMS integration and estimate per-country send cost + abuse/fraud exposure before any payable provider activation. Obtain owner approval for SMS spend, provider terms and secrets handling first. DANZSTAK only, not SFScoop.
- Backend issues cryptographically random one-time codes, stores a salted/hashed or otherwise safely protected verifier with short expiry, bounded attempts, resend throttling, send limits, replay prevention, rate limits by account/IP/number, and anti-enumeration controls. Never log code/full number or expose them in browser storage, URL, exception logs, analytics, push or other user profiles. Verify exact E.164 number and authenticated account binding; handle concurrent retries/rebinding/revocation.
- Add account data export/deletion support for phone verification records, minimal required retention, encryption in transit/at rest, privacy disclosure and vendor processor compliance. Preserve existing Cognito sessions/account data and existing independent calling devices.
- No pretend success in Test Mode: distinguish mocked OTP tests from **owner-approved real handset SMS delivery**. No production rollout or new billable SMS provider until explicit owner review.

### Acceptance
- Test two authorized accounts, with a real Android handset receiving a *real* code after its owner enters an international phone number, and a second test for another supported country format when feasible. Correct code yields durable server-confirmed verified state; wrong/expired/reused codes fail; resend cooldown, changed/removed number, masked display, unauthorized-number probes, rate limits and recovery all pass.
- Verify fully functional navigation at 320/360/390/414/430px including actual installed phone PWA; free accounts can skip verification; no number appears on the public profile/chat or in another user's data. Provide exact SMS provider, sender eligibility/country restrictions, unit costs, test pass/fail, browser screenshot (masked numbers), phone-accessible staging PWA, SHA and owner approval before merge/deploy.
- This verifies a personal mobile number only. It **does not repair** the separate P0 no-ringtone/no-two-way-WebRTC-audio bug (#27), which requires actual call tests.


## DJ console visual reference — illuminated SYNC key (owner-supplied photos, 2026-11-04)

The owner supplied **two photographs of a real DJ transport/controller section**: a physical pale rectangular button labeled **SYNC** alongside **SHIFT** and **CUE**, and the same-style **SYNC pad brightly backlit green** in another shot. They say, "Every DJ console has one." This is the musical reference for the **DANZSTAK SYNC chat-launcher button**. The word is meaningful to DJs: keeping different tracks/players in time. On DANZSTAK, it serves as the familiar musical metaphor for bringing people into sync.

**Codex design direction:**
- Present **SYNC** in uppercase on the existing chat-launch button, using a simple tactile **rounded-rectangle pad** silhouette inspired by DJ gear, rather than just a generic speech bubble. On light-mode UI, an unlit neutral/resting button can contrast with a **restrained glowing-green/illuminated active state when the Chat view is actually open**, with text always legible. Make the neon accent tasteful rather than a giant game-like button. The owner photos are a **conceptual reference**, not licensed art to copy or rehost.
- The actual behavior stays unchanged: tap SYNC -> open existing DANZSTAK Chats and conversation list, keep full Messenger-like inbox / WhatsApp-like chat functionality. Don't create a separate AI conversation, music syncing action, external WhatsApp integration or new route. Preserve current direct link `messages.html` and `#messagesNav` event handling.
- **State semantics must be honest**: green illumination means the SYNC/Chat destination is visibly active/open only; **not** verified phone number, online presence, successfully delivered messages or a working call. Unread messages get a separate accurate small badge/indicator instead of blinking green to suggest connectivity. No auto-flashing or sound. Respect reduced motion, contrast, keyboard focus and accessible name "SYNC — open chats."
- Check real responsive locations including feed top/nav button, installed PWA bottom Chat entry and desktop menu: all should show/read **SYNC** without disappearing at 320–430px or consuming feed space. Preserve genuine notification count, Back/Close and call controls. Keep minimal mobile tap target and clean light-mode design.
- Visual and functional acceptance: compare resting vs active SYNC at 320/360/390/414/430px, accessible contrast in both states, click/touch opens Chats, Back restores feed, proper unread badge, no route regressions. Provide screenshot/video in staging and get owner approval before deployment. The photographs are explanatory only; don't attach them to public GitHub without owner's permission.

**Owner meaning:** SYNC is not an arbitrary software label; it comes from the button on a DJ console. It should feel like a DANZSTAK control.


## Owner meaning — SYNC is how members sync up with each other (2026-11-04)

Owner's words: **"This is how users will sync up."** SYNC is the one prominent DJ-console-inspired button that members use to **connect with one another** on DANZSTAK. Tap SYNC to open the actual member-to-member Chats and Phone experience: find a friend, send a message, have a real voice/video conversation, and—where independently implemented and accepted—make plans to meet in person. The DJ sync metaphor is about people getting connected, not a music-beat-matching tool, not a separate AI bot or another app. Preserve recognizable uppercase **SYNC** entry branding and clean Messenger/WhatsApp-familiar functionality, with DANZSTAK's distinctive simple UX. Prioritize reliable tested communications; do not mark unimplemented features as live.
