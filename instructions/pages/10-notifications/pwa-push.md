# Notifications — in-app Buzz and phone PWA push

## Owner requirement
A real in-app notification (e.g., a message from Mary) should also alert the recipient's phone when the user has installed/enabled the DANZSTAK PWA and granted notification permission. Do not silently assume delivery or ask for permission on initial page load.

## User experience
- In-app notification center with unread count, sender, type, time, mark-read, and tap-through to the correct message/post.
- Opt-in push setup from a user action, with clear explanation and browser/OS-specific guidance.
- Support direct-message alerts, friend requests, replies, mentions, and other meaningful events with user-configurable preferences. Avoid notifying for one's own actions.
- Push content must respect privacy; avoid exposing sensitive message text on lock screens by default. Provide a preview setting.
- When tapping a notification, open the correct authenticated conversation or post; if no longer accessible, show a safe fallback.
- Keep badges and read/unread state synchronized across devices.

## Engineering requirements
- Inspect existing chat, notifications, service worker, Cognito/auth and AWS infrastructure before changing anything.
- Implement Web Push using standards-compliant subscriptions and VAPID or approved push provider, with secure server-side keys and per-device subscription lifecycle.
- Handle Android Chrome and eligible iOS installed PWAs, including OS permission settings, background delivery, expired subscriptions and PWA service-worker updates. Browser/OS restrictions mean delivery cannot be guaranteed.
- Avoid duplicate push alerts when the user is actively viewing the same conversation; deduplicate events, apply reasonable rate limits, and allow quiet/mute preferences.
- Log push attempts and provider outcomes without storing unnecessary message content or secrets. Never commit credentials.
- Preserve existing in-app notification behavior and actual messages, including Mary's notification.

## Acceptance
- Real test account A sends a message to test account B: B sees in-app notification and, when opted in and supported, receives phone push while PWA is backgrounded/closed.
- Tapping alert opens correct chat; mark-read updates badge; no duplicate alerts; notification preferences and permission denial work.
- Test Android installed PWA and iOS installed PWA where available. Document real device/OS/browser and whether delivery was verified or unavailable.
- Provide PR, screenshots, test results, verified staging PWA URL and deployed SHA; owner approval before production release.


## Call and voicemail notification types — 2026-11-04
- Use **separate, accurate event types** for incoming call alert, missed incoming call, new voicemail and ordinary new message; a message push is not a substitute for call alert. An Android notification screenshot displaying "New DanzStak message" does not prove the call rang.
- Only a server-authoritative, genuinely missed incoming call creates **"Missed call from [display name]"** in Buzz and the private chat history, with time and Call back. See [voicemail/missed-call Issue #28](https://github.com/Danzstak/Danzstak-web/issues/28). Deduplicate by call ID, handle cancel/decline/failed media distinct from a missed call, and preserve chat records across refresh/offline.
- On opted-in supported mobile PWAs, send appropriate privacy-safe push; tappable notification opens the correct authenticated chat. Separate audio/ringing expectations from push delivery and respect Android notification categories/importance, silent/Do Not Disturb, lockscreen privacy and quiet hours. Never claim OS-level ringtone in unsupported browsers.
- Short, manually recorded voicemail from an unanswered call is its **own** message bubble and can trigger a distinct "New voice message" notification; no recording without user action. Both features remain pending implementation and device tests.
