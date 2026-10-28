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

People/location tags are supported on posts containing text, images or videos. Only accepted friends may be selected, and the server enforces tagging consent. Remove my tag is available by long-pressing a tagged photo/video or through Post options. Menu → Your profile → Edit Profile includes Allow people to tag me, preserving the other account preferences. Demo consent and activity stay in memory.

## Authentication and distribution

The system browser uses the device-bound challenge flow and exact `danzstak://android/auth` callback. Opaque DanzStak sessions and login verifiers are encrypted with Android Keystore; API requests forbid redirects and cleartext. Cognito tokens are not handled by the app. Session expiration clears local authentication; transport errors preserve drafts. App data is excluded from cloud backup and device transfer.

No paid store enrollment or store submission is authorized. A release APK for direct website distribution still requires an owner-controlled signing key and physical-device testing. Never commit keys, passwords, credentials or generated signing files, and never advertise the debug APK as a production release. Android Studio is optional for command-line builds; it is not installed on this Mac.
