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
