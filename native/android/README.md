# DanzStak Android

This is the native Android client, not a WebView wrapper. The first release implements device-bound browser authentication, Android Keystore session storage, a native feed, text publishing, and logout.

Open this directory in Android Studio. Install Android SDK 36 when prompted. Debug builds use `./gradlew assembleDebug`; signed website-distribution builds require the owner-controlled Datappaloosa signing key and must never commit that key or its passwords.

For a website release, keep the keystore outside this repository and set `DANZSTAK_ANDROID_KEYSTORE`, `DANZSTAK_ANDROID_STORE_PASSWORD`, `DANZSTAK_ANDROID_KEY_ALIAS`, and `DANZSTAK_ANDROID_KEY_PASSWORD` in the release machine's private environment. Run `build-website-release.ps1` to lint and create the signed APK. After physical-device verification, `publish-website-release.ps1 -Bucket <website-bucket> -DistributionId <distribution-id>` publishes the stable `https://danzstak.com/downloads/danzstak-android.apk` URL. The publisher never uploads an unsigned or debug APK.

Native media, messaging, notifications, and call UI will build on the same authenticated API client. The public website must not advertise an APK until a signed build passes physical-device testing.
