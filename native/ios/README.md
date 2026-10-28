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

Profiles load the selected member's saved cover and avatar from `/profiles`, using the PWA's centered overlapping photo layout. Flashes follow the first feed post; The Roll remains after post four. Message reactions appear directly below their message, with dark action panels and visible edit failures. Android's Done/New chat controls share a row. Full-screen videos fit the viewer without cropping; Android caches previews and selects an early visible frame when the opening frame is black. Video Like taps toggle the count; responder lists use long press. Community-wide Flashes/Roll reaction persistence remains unconnected; post reactions use the existing API.

The live message-edit error was traced to the signaling role missing `dynamodb:UpdateItem` on the Messages table. A table-scoped inline policy was added and IAM simulation returned allowed. The infrastructure template includes the matching permission for future deployments. No backend code was replaced and no real user messages were edited during agent verification.

Empty Flashes and The Roll rails retain three labeled placeholder cards, after the first and fourth feed posts respectively. Video playback starts muted in the feed, pauses offscreen or in the background, and fits its original proportions. Post media uses the full width at its natural portrait or landscape aspect ratio, without added borders or a fixed height cap. Compact playback controls provide a small central play/pause button and bottom progress bar; tapping toggles them. Chat headers use the approved orange D mark. Composer and message editor input stops at the server's 2,000 UTF-16-unit limit without a numeric range prompt.

### Tribes parity with the PWA

Tribes renders the PWA's ten built-in categories even if `/groups` returns no custom groups. Category labels and legacy `default-0` through `default-9` identities match the website. The native screen includes creation with explicit Community Standards agreement, category cards, join/leave state, reporting, owner-only delete controls and refresh/error feedback. Requests use the same `/groups`, POST `/groups/membership` (`action: list` for loading), and `/reports` contracts. Membership buttons wait for initial cloud membership loading so a delayed list cannot overwrite a confirmed join. Demo changes stay local; agent checks do not create real groups or send reports.

### Chat attachments and feed placement

Chat's input includes attachment and camera controls. A system media picker selects photos/videos; the camera can capture either. Selection is an unsent draft until Send is pressed. Attachments up to 100 MB use POST `/stories` with `purpose: message`, an HTTPS storage PUT without the DanzStak session header or redirects, then POST `/messages` with the returned `mediaKey`/`mediaType`. Incoming media renders in native image/video views. Camera and actual file delivery need phone verification; automated checks use mock storage and do not contact other users.

Flashes now follows the first feed post, and The Roll follows the fourth. Empty feeds retain both rails; if fewer than four posts are loaded, The Roll appears after those available posts. Placeholders remain visible when media arrays are empty. Install Android 0.1.4 over the existing app to see these changes; 0.1.2 predates the placeholder fix.

### Chat menu and copying

Chat options include View contact, Search (loaded messages), Media (loaded attachments), Mute/Unmute, Disappearing messages, Select messages and Delete chat. Multiple selected messages copy as chronological plain text separated by blank lines, suitable for pasting into a translator. No translation provider receives data automatically. Delete confirmation explicitly removes the actor's sent media for both participants while preserving the other's uploads. Message expiration applies to new messages; server visibility stops at the deadline, with physical attachment cleanup on the next conversation read. Preserve the scoped patch under `native/backend` in future backend deployments.


### Native media update 0.1.6

Posts show their first two comments inline, with the remaining comments in the comment view. Opening a post video builds a vertical sequence of the available videos from that same profile, starting at the selected video; changing pages stops the previous player. New chat video uploads export to an aspect-preserving 720p MP4 before upload. Existing server originals are unchanged. Chat captions follow attachments. Android keeps unchanged attachment views during polling, uses a separate image download queue with visible loading/retry, and plays chat videos inside the app. Cached feed data is private to the signed-in session and expires after 15 minutes.

Validation: Android 0.1.6 assembles successfully, passes lint, 10 API unit tests and all 15 emulator UI checks. The optional private fixture checks were run with read-only copies of the already-sent photo/video: photo decoding, in-app video playback, H.264 export within 720p bounds, and same-profile paging passed. Three rotation cycles and activity reopening retain the visible feed post. iOS simulator build and targeted native chat/menu UI tests pass; API mocks and root native/auth checks pass. No messages were sent, edited or deleted by the fixture checks. Temporary signed URLs and copied private media are removed after verification. These emulator checks do not replace testing the new APK on a physical phone.

Feed video audio: a persistent speaker button in the top-right corner toggles sound independently of opening the full-screen viewer. Feed playback starts muted and resets to muted after leaving view/backgrounding. Android APK version 0.1.7 includes this control.

Profile covers start at the top of the profile viewport without a duplicate name/title row. Android retains Back as a small overlay on the cover; the member name stays below their avatar. Post video sound controls are shared by Your Mix and profiles.


### Native navigation and website handoff (0.1.9)

Events uses the same `📅 Event:` post convention as the PWA, rendered with native post cards. Saved uses a private, current-sign-in collection on this device; it is not synchronized with browser storage or other devices. Post options adds Save/Unsave. Both sections stay native. DanzStak feed, Events, Saved, Booking and chat links route to the native screens; Android outside links use an explicitly selected browser Custom Tab/provider instead of allowing the installed PWA to claim the initial link. External provider pages still contain their own website navigation. No website assets or backend deployments were changed.

Live Booking planning/saving is on hold for the PC handoff. The native Booking screen states this clearly and makes no production tour requests. The demo planner and API transport mocks are preparatory only. Local source includes `/tour/route` and `/tours` handlers, and unauthenticated live probes returned 401; these checks do not establish authenticated planning, permissions, or persistence. Record Store Locator and artist EPK remain PC-owned, pending stable interfaces before native integration.
