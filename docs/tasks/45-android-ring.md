# 45. Android app so SYNC calls ring (owner 2026-11-24: "Build it now"; then "i am not paying google" → "No Google at all")

## Why
With SYNC closed, Android lets a web app show a call notification with the notification sound only (and Android 15+ quiets repeats). A phone-style ring (ringtone at call volume, full-screen Answer/Decline over the lock screen) needs a native Android piece. The owner chose to build it before doors open. This is the only native work allowed: it wraps the PWA, it does not replace it.

## What (owner 2026-11-24: no Google Play, no Firebase, no Google account)
- **Downloaded from danzstak.com**, never the Play Store: a signed APK at `danzstak.com/app/` with a short "how to install" page (Android asks once to allow installs from the browser). The app checks danzstak.com for its own updates and offers them.
- **The app opens danzstak.com** in an Android WebView/TWA-style shell: same pages, same sign-in. No second UI.
- **No Firebase or Google push.** A foreground service keeps one small connection to call-signaling open (WebSocket, heartbeat ~ every 4-5 min to save battery, reconnects on network change/boot) and shows the permanent notification "SYNC ready for calls" that Android requires. Members can turn the service off in the app (then calls ring as today's notification).
- **Ring**: on an incoming-call message the service shows a `CallStyle` notification with a full-screen intent (ringtone on the ringer stream, the F15e files, vibration, Answer/Decline on the lock screen). Answer opens SYNC on that call; Decline calls `/calls/decline`; "cancelled" stops it.
- **Server (call-signaling)**: a WebSocket route (API Gateway WebSocket API) where a registered calling device connects with its device proof; `notifyCall` and cancel also send to that device's open connection. Connection ids stored like push subscriptions (linked to the registered device, TTL), never logged in full.
- **Battery and phones that kill apps**: the app asks to be excluded from battery optimisation (once, translated, with the reason) and says plainly when the phone maker's settings may still close it (Samsung, Xiaomi, Huawei). Never silent: if the connection is down, SYNC says so with a one-tap fix.
- **Permissions**: notifications, full-screen notifications (Android 14+), battery exclusion, asked once in the member's language.

## Owner steps (when Code's PR says so)
1. Approve the call-signaling deploy run (adds the WebSocket API).
2. Install the test app from danzstak.com/app/ on two phones and try a call with the app closed and the phone locked.
No Google account, no fees. The app signing key lives only in GitHub secrets (never the repo).

## Steps for Code (one PR each)
- **RING-1** `android/` app shell (WebView/TWA-style, scope = danzstak.com), built and signed in GitHub Actions, APK published to `/app/` with its install page; self-update check; test that no keystore or key is committed.
- **RING-2** call-signaling WebSocket API + device-proof connect + `notifyCall`/cancel fan-out; `test-native-call-socket.cjs` (a registered device's connection gets the call; an unregistered or revoked one doesn't; nothing logged in full).
- **RING-3** the foreground service, CallStyle ring, Answer/Decline/cancel, battery prompt, translations.
- **RING-4** two-phone test (owner): app closed, phone locked → it rings, Answer connects, caller hang-up stops it; also overnight battery use noted.

## Checks
- Server test above; workflow test that no key or keystore is committed and no Google/Firebase library is in the app; an Android instrumented test (emulator in Actions) that a call message over the socket shows a full-screen CallStyle notification with Answer/Decline.
- Not claimed until RING-4 passes on two real phones.
