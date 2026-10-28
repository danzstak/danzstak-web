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

The app now provides Home, People, Create, Alerts, and Menu tabs. The footer Menu mirrors the website menu, with profile, friends, Tribes, media, settings, policy links and logout. Your Mix (Home) includes searchable loaded posts, HTTPS image/video media, reactions, comments, native sharing, pull-to-refresh, and error recovery. The composer saves drafts when closed or when publishing fails and requires content-permission confirmation. People shows authors from the loaded feed, not a fabricated friends list. Profile shows the current user's loaded posts; Tribes lists the community directory. Notifications support opening loaded posts and marking activity as read.

Existing authenticated endpoints power these screens. Native friend requests, general profile editing, group membership actions and media uploads are not implemented by this interface. Native text messaging is described below. Website functionality remains available separately.

Home places a compact post composer directly below the branded header, with a horizontal Flashes rail (served by the existing `/stories` API) beneath it. Flashes open a native image/video/caption viewer. The Roll rail appears after the fourth feed post (and is omitted from filtered search results). The `/stories` response supplies stories and optional reel links; HTTPS reel links open their source. Demo reels explicitly identify themselves as previews without attached videos. Story/reel publishing is not implemented, and optional media-service failures leave the main feed usable.

Flashes and The Roll use a full-screen vertical pager: swipe up for the next item and close with the top-right button. Native videos autoplay only while active and at least 65% visible; one shared coordinator pauses the previous player, releases audio when a video leaves view, and stops playback on dismissal/backgrounding. Direct HTTPS MP4/MOV/M4V/HLS reel URLs play natively. Provider webpage URLs show an explicit **Watch original video** link; autoplay and audio in an external browser are controlled by that provider, not this app.

The header places **Import Facebook data** to the left of Search and **Messages** at the far right. Import opens a numbered guide to exporting JSON from Facebook and using DanzStak's existing web importer, with audience review before uploading. Messages opens the native Chats interface. Neither shortcut exposes the native session token or uploads data automatically.

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


### People tags, locations and consent

The composer offers friend tags and an optional manually entered place (120 characters; no GPS permission). Post cards show tagged names and location. Owners can change these from Post options → Tags & location. A tagged member can long-press a post photo/video or use Post options → Remove my tag. The server records declined tags to prevent the owner silently restoring them.

Profile → Edit Profile includes Allow people to tag me. It loads the existing account settings before saving and preserves the other preferences. Disabling tagging blocks new tags, while existing tags remain until individually removed. Only accepted friends can tag others, and the server checks friendship and consent atomically. Demo edits are in memory only.

Text-post people tagging was enabled in the existing production auth Lambda on October 28, 2026. The deployment patched only the media-only restriction and notification wording in the current live package, preserving newer profile and tour features. Lambda reported a successful update and the deployed package hash matched the verified package. Tag privacy tests passed against the patched live source; unauthenticated feed, removal and settings requests returned 401. Signed-in end-to-end tagging remains to be exercised with a real app session. Creation saves the post first, then applies people tags. If the second request fails, the app reports that the post was published and offers retry through its tag editor, avoiding duplicate posts. Photo/video uploads and tagging for the separate Flashes/The Roll API are not implemented here. These controls apply to posts containing text, images or videos. Production account behavior has not been exercised by the local preview tests.


### Native messenger and current delivery scope

The header Messages control now opens native Chats: searchable conversations, display names/photos, unread badges, a new-chat contact picker, conversation bubbles, per-chat draft preservation, text sending, reactions and earlier-message loading. Existing authenticated `/conversations`, `/messages` and `/calls/directory` endpoints power these screens. Contact availability is restricted by friendship/shared-Tribe rules. This service does not claim end-to-end encryption. Demo conversations are clearly labeled and never send to the server.

Enable message sounds requests iOS notification permission. Foreground polling produces a system notification for newly observed unread activity after establishing an initial baseline. Silent mode, Focus and user notification settings remain in control. Native remote push, native voice/video calling and closed-app ringing are not implemented or claimed. The website's separate PWA Web Push/browser calling work is maintained on the PC.

On this Mac, simulator builds and all 15 UI tests passed after the messenger was added. A generic device-signing build was attempted after Xcode acquired a team and signing identity; Apple reported that the team has no registered device and no development provisioning profile. No device build or physical-device validation passed. The owner declined paid Apple/Google developer-program enrollment and store submissions. Continue native iOS simulator development, native Android work on the Mac, and website/PWA work on the PC. Do not overwrite Xcode's local team selection when regenerating the project; team/profile settings and generated projects remain local.


### Messenger controls and menu update

The native menu now follows the PWA's vertical list and order, retaining DanzStak's Your Mix and Tribes naming. Native Photos/Videos filter loaded posts; Events, Booking, Saved, Support and policy links open their existing website destinations. Appearance options are under Settings, and Header size controls are removed. The approved 6% default remains fixed. The launcher icon uses only the original D mark.

The messenger is dark. The microphone uses the system Speech framework to turn audio into editable text; Send remains a separate user action. Microphone/speech permissions, recognition availability and language support are controlled by iOS. Recording stops on dismissal/backgrounding. Real recognition and sound output still require device testing.

Long-press a message for emoji reactions, Copy/Share/Forward and deletion; the sender also gets an editor and Save. Senders may delete for themselves or everyone, while recipients may delete only for themselves. The shared backend performs authorization. The PC's current edit/delete API and media/read-receipt changes were preserved. Forwarding prepares a draft without sending. Clickable HTTPS domain/URL cards do not automatically fetch external preview metadata. Refreshes reconcile server-side removals, including messages hidden on another device.

### PWA layout alignment and message edit repair

Profiles load the selected member's saved cover and avatar from `/profiles`, using the PWA's centered overlapping photo layout. Flashes remain immediately below the post composer; The Roll remains after post four. Message reactions appear directly below their message, with dark action panels and visible edit failures. Android's Done/New chat controls share a row. Full-screen videos fit the viewer without cropping; Android caches previews and selects an early visible frame when the opening frame is black. Video Like taps toggle the count; responder lists use long press. Community-wide Flashes/Roll reaction persistence remains unconnected; post reactions use the existing API.

The live message-edit error was traced to the signaling role missing `dynamodb:UpdateItem` on the Messages table. A table-scoped inline policy was added and IAM simulation returned allowed. The infrastructure template includes the matching permission for future deployments. No backend code was replaced and no real user messages were edited during agent verification.

Empty Flashes and The Roll rails retain three labeled placeholder cards, below the composer and after post four respectively. Video playback starts muted in the feed, pauses offscreen or in the background, and fits its original proportions. Post media uses the PWA's full width and 560-point/dp height cap; viewer controls overlay a full-page video area. Chat headers use the approved orange D mark. Composer and message editor input stops at the server's 2,000 UTF-16-unit limit without a numeric range prompt.
