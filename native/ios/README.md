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
