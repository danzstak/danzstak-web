# DanzStak iOS

This is a native SwiftUI client, not a website wrapper. It includes device-bound browser authentication, Keychain session storage, a native feed, text publishing, and logout.

On a Mac, install Xcode and XcodeGen, run `xcodegen generate` in this directory, open `DanzStak.xcodeproj`, select the owner-controlled Datappaloosa development team, and build on a physical iPhone. Apple signing credentials and profiles must never be committed.

The website must continue offering the PWA until the native build is signed and tested. Direct website distribution of an iPhone app depends on Apple entitlement and regional eligibility and must not be advertised before Apple confirms it.

API regression checks can run on macOS with Command Line Tools, without Xcode or a live account. From this directory:

```sh
swiftc -swift-version 5 DanzStak/APIClient.swift DanzStak/SessionStore.swift Tests/APIClientChecks.swift -o /tmp/danzstak-api-checks
/tmp/danzstak-api-checks
```

These checks exercise mocked HTTP responses and transport errors. They do not replace an iOS simulator build or interactive login, Keychain, and device-signing validation in full Xcode.

To compile the simulator app with Xcode 26.3, even before a simulator runtime is installed, run from this directory:

```sh
xcodegen generate
xcodebuild -project DanzStak.xcodeproj -target DanzStak -configuration Debug -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO build
```

The project uses Swift 5 language mode (not a Swift compiler version such as 5.10). Xcode installer archives under the source directory are excluded from the app bundle. To launch and exercise the app, also install an iOS simulator runtime in Xcode's Components settings, choose an iPhone simulator, and run the DanzStak scheme. A successful SDK build alone does not validate interactive authentication or signing on an iPhone.

## Native social interface

The app now provides Home, People, Create, Alerts, and Profile tabs. Home includes searchable loaded posts, HTTPS image/video media, reactions, comments, native sharing, pull-to-refresh, and error recovery. The composer saves drafts when closed or when publishing fails and requires content-permission confirmation. People shows authors from the loaded feed, not a fabricated friends list. Profile shows the current user's loaded posts; Groups lists the community directory. Notifications support opening loaded posts and marking activity as read.

Existing authenticated endpoints power these screens. Native friend requests, direct messages, profile editing, group membership actions, media uploads, and push notifications are not implemented by this interface. Website functionality remains available separately.

Use **Explore the demo** on the login screen to inspect sample content without an account. The banner identifies demo mode, and its posts, comments, and reactions remain in memory; no API writes occur. Demo composer drafts use separate local storage from real posts. Production login continues to use the device-bound system authentication flow and Keychain session.

After generating the project, run the simulator UI tests with an installed iPhone destination:

```sh
xcodebuild -project DanzStak.xcodeproj -scheme DanzStak -destination 'platform=iOS Simulator,name=iPhone 17 Pro' CODE_SIGNING_ALLOWED=NO test
```

The UI tests exercise demo navigation, draft preservation, posting, liking, commenting, notifications, profile, and logout. API checks use mocked responses. Neither substitutes for an authenticated production-account test or physical-device testing before release. The app icon reuses the repository's existing DanzStak brand artwork.
