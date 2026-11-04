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
