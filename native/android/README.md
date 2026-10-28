# DanzStak Android

Native Kotlin Android app, using the iOS app as its layout reference. It is not a website wrapper.

## Build and test

Install JDK 17, Android SDK 36, SDK Build Tools 35.0.0 and Platform Tools. Set `JAVA_HOME` and `ANDROID_HOME`, or create a local `local.properties` with `sdk.dir`. The checked-in Gradle 8.13 wrapper verifies its distribution checksum.

```sh
./gradlew assembleDebug testDebugUnitTest lintDebug
./gradlew connectedDebugAndroidTest
```

The second command needs a running Android emulator or connected phone. Debug APK output: `app/build/outputs/apk/debug/app-debug.apk`. Debug builds allow a clearly labeled in-memory preview via the launch intent extra `preview=true`. Preview data never writes to the API.

## Native interface

The compact black branded header has Import Facebook data, Search and Messages controls. The footer uses Home, People, Create, Alerts and Menu. Your Mix includes a tight composer, Flashes, post cards and The Roll after four posts. Native full-screen media supports vertical paging and active-page video playback; playback stops on backgrounding, navigation and dismissal. External provider pages use an explicit browser link. Reaction/count controls, responder lists, comments, Tribes, profile, tag/location editing and tag-removal menus use the same names and organization as iOS. Some presentation details retain platform-native dialogs and controls.

The native messenger provides conversations, display names/avatars, unread badges, text bubbles, saved drafts, sending, message reactions, and loading earlier messages. The service is authenticated HTTPS messaging; this does not claim end-to-end encryption. It polls while the app is active. Message notification sounds use an Android channel with user-controlled settings and permission. Native closed-app push and native voice/video calling are not implemented. The website PWA has a separate Web Push and browser calling implementation and is maintained on the PC.

Post reactions/comments, chats and account preferences use existing authenticated endpoints. Flashes/The Roll response activity is clearly labeled local preview state, not community-wide engagement. Shares launch Android's share sheet; completion/delivery and community share counts are not claimed. Media uploads, native friend requests, push delivery, calls and full profile editing remain future work.

People/location tags are supported on posts containing text, images or videos. Only accepted friends may be selected, and the server enforces tagging consent. Remove my tag is available by long-pressing a tagged photo/video or through Post options. Menu → My Profile → Edit Profile includes Allow people to tag me, preserving the other account preferences. Demo consent and activity stay in memory.

## Authentication and distribution

The system browser uses the device-bound challenge flow and exact `danzstak://android/auth` callback. Opaque DanzStak sessions and login verifiers are encrypted with Android Keystore; API requests forbid redirects and cleartext. Cognito tokens are not handled by the app. Session expiration clears local authentication; transport errors preserve drafts. App data is excluded from cloud backup and device transfer.

No paid store enrollment or store submission is authorized. A release APK for direct website distribution still requires an owner-controlled signing key and physical-device testing. Never commit keys, passwords, credentials or generated signing files, and never advertise the debug APK as a production release. Android Studio is optional for command-line builds; it is not installed on this Mac.


## Messenger update 0.1.1

The menu follows the website/PWA's vertical menu and order; native app naming retains Your Mix and Tribes. Header size controls were removed, preserving the approved compact 6% header. The launcher icon uses only the original orange/silver D mark. The Android post-video preview retrieves its first frame instead of stretching a play glyph.

Chats use a dark charcoal background. A microphone opens the installed system speech input service and inserts recognized words into an editable draft; users must press Send themselves. Availability, language and possible network processing follow the phone's speech service. No paid recognition service is introduced. The emulator image has no speech provider, so real recognition must be verified on a phone.

Long-press messages for reactions, Copy, Share, Forward and deletion. Senders can edit their own message in place and choose Delete for me or Delete for everyone. Recipients can only delete for themselves. Forwarding fills a draft and does not automatically send. HTTPS links have clickable domain/URL cards, without fetching third-party preview metadata automatically. Server edit/delete requests use the shared backend's POST /messages actions. The PC's current backend remains authoritative; its media/read-receipt features were preserved. Message snapshots reconcile deletions and locally deleted messages cannot be revived by an older in-flight refresh.

Images have a separate executor from API actions, preventing stalled image loads from occupying the message-send queue. Successful requests clear stale busy labels; successful sends show Sent. A failed send preserves its draft and warns that delivery is unconfirmed, with no automatic resend. Recent server timing checks showed no Lambda timeouts; device network behavior still needs retesting on the updated APK.
