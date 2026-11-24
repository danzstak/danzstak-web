# 45. Android app so SYNC calls ring (owner 2026-11-24: "Build it now")

## Why
With SYNC closed, Android lets a web app show a call notification with the notification sound only (and Android 15+ quiets repeats). A phone-style ring (ringtone at call volume, full-screen Answer/Decline over the lock screen) needs a native Android piece. The owner chose to build it before doors open. This is the only native work allowed: it wraps the PWA, it does not replace it.

## What
- **One small Android app, "DanzStak"**: a Trusted Web Activity that opens danzstak.com full screen (same pages, same sign-in, same service worker; Digital Asset Links in `/.well-known/assetlinks.json`). No second UI to maintain.
- **Native call ring only**: a messaging service receives a high-priority "incoming call" message and shows an Android `CallStyle` notification with a full-screen intent (ringtone on the call/ringer stream, vibration, Answer/Decline on the lock screen). Answer opens SYNC on that call in the app; Decline calls `/calls/decline`. A "call cancelled" message stops the ring.
- **Server (call-signaling)**: devices registered from the Android app also save their native push token (linked to the registered calling device, like web push today). `notifyCall` sends to native tokens first, web push as before for everyone else. Tokens are never shown, logged in full or shared.
- **Ringtones**: the same louder files (F15e), bundled in the app.
- **Permissions**: notifications and "full-screen notifications" (Android 14+) asked once, in the member's language, with the reason.
- **Never silent**: if the app can't ring (permission off), SYNC says so once with a one-tap fix (L4 rule).

## Owner steps (numbered, when Code's PR says so)
1. Google Play Console developer account ($25 one-time) under DanzStak.
2. Create the app's push project (Firebase Cloud Messaging is what Android uses to wake an app; Android web push already goes through it). Code's PR lists the clicks; the server key goes into AWS Secrets Manager `danzstak/android/fcm`, never the repo.
3. Approve the call-signaling deploy run.
4. Upload the signed app (internal testing track first) and install it on two phones for the ring test.

## Steps for Code (one PR each)
- **RING-1** `android/` project (Bubblewrap/TWA), assetlinks, build in GitHub Actions (signing key only in GitHub secrets / Play App Signing), checks that the manifest scope and start URL match the PWA.
- **RING-2** native call service: CallStyle + full-screen intent, ringtone stream, Answer/Decline/cancel, translations.
- **RING-3** call-signaling: native token save (registered device proof required), `notifyCall` + cancel to native tokens, `test-native-call-push.cjs` (a token saved after registration is a call target; an unlinked token is not; nothing logged in full).
- **RING-4** two-phone test (owner): app closed, phone locked → it rings, Answer connects, caller hang-up stops the ring.

## Checks
- Server test above; workflow test that no key or keystore is committed; an Android instrumented test (emulator in Actions) that a call message shows a full-screen CallStyle notification with Answer/Decline.
- Not claimed until RING-4 passes on two real phones.
