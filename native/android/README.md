# DanzStak Android

This is the native Android client, not a WebView wrapper. The first release implements device-bound browser authentication, Android Keystore session storage, a native feed, text publishing, and logout.

Open this directory in Android Studio. Install Android SDK 36 when prompted. Debug builds use `./gradlew assembleDebug`; signed website-distribution builds require the owner-controlled Datappaloosa signing key and must never commit that key or its passwords.

Native media, messaging, notifications, and call UI will build on the same authenticated API client. The public website must not advertise an APK until a signed build passes physical-device testing.
