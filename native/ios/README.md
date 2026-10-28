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

The app now provides Home, People, Create, Alerts, and Menu tabs. The footer Menu opens profile, post creation, groups, header sizing, policy links, and logout. Your Mix (Home) includes searchable loaded posts, HTTPS image/video media, reactions, comments, native sharing, pull-to-refresh, and error recovery. The composer saves drafts when closed or when publishing fails and requires content-permission confirmation. People shows authors from the loaded feed, not a fabricated friends list. Profile shows the current user's loaded posts; Tribes lists the community directory. Notifications support opening loaded posts and marking activity as read.

Existing authenticated endpoints power these screens. Native friend requests, direct messages, profile editing, group membership actions, media uploads, and push notifications are not implemented by this interface. Website functionality remains available separately.

Home places a compact post composer directly below the branded header, with a horizontal Flashes rail (served by the existing `/stories` API) beneath it. Flashes open a native image/video/caption viewer. The Roll rail appears after the fourth feed post (and is omitted from filtered search results). The `/stories` response supplies stories and optional reel links; HTTPS reel links open their source. Demo reels explicitly identify themselves as previews without attached videos. Story/reel publishing is not implemented, and optional media-service failures leave the main feed usable.

Flashes and The Roll use a full-screen vertical pager: swipe up for the next item and close with the top-right button. Native videos autoplay only while active and at least 65% visible; one shared coordinator pauses the previous player, releases audio when a video leaves view, and stops playback on dismissal/backgrounding. Direct HTTPS MP4/MOV/M4V/HLS reel URLs play natively. Provider webpage URLs show an explicit **Watch original video** link; autoplay and audio in an external browser are controlled by that provider, not this app.

The header places **Import Facebook data** to the left of Search and **Messages** at the far right. Import opens a numbered guide to exporting JSON from Facebook and using DanzStak's existing web importer, with audience review before uploading. Messages opens the existing DanzStak messages website. Neither shortcut exposes the native session token or uploads data automatically.

Playback-coordinator regression checks can also run without a simulator:

```sh
swiftc -swift-version 5 DanzStak/NativePlayback.swift Tests/PlaybackChecks.swift -o /tmp/danzstak-playback-checks
/tmp/danzstak-playback-checks
```

These checks validate exclusive-player ownership and stop/cleanup behavior, not physical-device sound output or third-party provider playback.

The full-screen media viewer shows a vertical Like / Reply / Share icon rail with counts, the poster's name at bottom left, and a comment field at the bottom. Long-pressing media opens an emoji picker. Response icons open vertical name/avatar lists; **Menu → Response lists** switches between a full-screen list and a left drawer over the feed. Full screen is the default so long names have room to wrap; the optional drawer occupies 30% of the screen. Current Flashes/The Roll response activity starts at zero and is local preview state, explicitly labeled in the lists: repeated likes toggle rather than accumulating, submitted comments add one, and shares add one only after the native share flow reports completion. This is not a community-wide responder backend. No other users or totals are fabricated. Activity resets with the app session. Native post reactions/comments continue using their existing API.

Post and media controls show icons with their numbers beside them, without visible action words or duplicated counters inside the post body. Long-pressing an action icon/count opens responder details; long-pressing the media itself retains the emoji picker. Post comment identities come from existing comment responses; reactor names/photos are displayed if supplied by the optional `reactors` response field. The current API does not supply a full post reactor list, and the UI says so rather than inventing identities. Share counts/identities track completed shares on this device only. In chat we may use familiar Facebook terms; the app retains Your Mix, Flashes, The Roll, and Tribes.

Use **Explore the demo** on the login screen to inspect sample content without an account. The banner identifies demo mode, and its posts, comments, and reactions remain in memory; no API writes occur. Demo composer drafts use separate local storage from real posts. Production login continues to use the device-bound system authentication flow and Keychain session.

After generating the project, run the simulator UI tests with an installed iPhone destination:

```sh
xcodebuild -project DanzStak.xcodeproj -scheme DanzStak -destination 'platform=iOS Simulator,name=iPhone 17 Pro' CODE_SIGNING_ALLOWED=NO test
```

The UI tests exercise demo navigation, draft preservation, posting, liking, commenting, notifications, profile, and logout. API checks use mocked responses. Neither substitutes for an authenticated production-account test or physical-device testing before release. The app icon reuses the repository's existing DanzStak brand artwork.
