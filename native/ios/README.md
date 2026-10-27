# DanzStak iOS

This is a native SwiftUI client, not a website wrapper. It includes device-bound browser authentication, Keychain session storage, a native feed, text publishing, and logout.

On a Mac, install Xcode and XcodeGen, run `xcodegen generate` in this directory, open `DanzStak.xcodeproj`, select the owner-controlled Datappaloosa development team, and build on a physical iPhone. Apple signing credentials and profiles must never be committed.

The website must continue offering the PWA until the native build is signed and tested. Direct website distribution of an iPhone app depends on Apple entitlement and regional eligibility and must not be advertised before Apple confirms it.
