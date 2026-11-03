# Issue #1 validation

This change is intentionally **not deployed**. It must be reviewed before the established AWS deployment workflow is run.

## Automated checks

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-regressions.ps1
```

Result on 2026-11-02: all regression checks passed, including the site smoke tests and the embedded infrastructure/Lambda syntax checks.

Focused checks:

```powershell
node test-record-stores.cjs
node test-booking-discovery.cjs
node test-epk-builder.cjs
node test-booking-contact-sheet.cjs
node test-message-media.cjs
```

All passed.

Production dependency audit from `infrastructure/auth-api`:

```powershell
npm audit --omit=dev --audit-level=moderate
```

Result on 2026-11-02: `found 0 vulnerabilities`.

## Manual checks completed

- Desktop EPK editor: two-column edit/preview layout, private draft controls, file manager, and public-link controls render without visible overflow.
- Desktop Booking Agent: the natural-language club finder appears before the advanced route planner; advanced controls are collapsed by default.
- A fresh in-app browser pass at 390 × 844 verified Booking Agent, Record Stores, and EPK without horizontal overflow; primary actions remained readable and advanced booking controls remained collapsed. The repository's static viewport, touch-target, navigation, EPK, and booking tests also pass. A physical-device pass is still required before deployment.
- A signed-in narrow-viewport live pass verified that saved chats open into a full-width conversation, message history and read receipts load, photo/video and camera actions remain beside the composer, phone/video actions remain in the header, and the icon-only destructive action has an accessible `Delete chat` name.
- The same live pass verified the notification drawer's focusable close control, actor profile link, timestamp, and post destination; Friends resolved from loading into distinct online/empty/offline states; accepted offline friends remained available to message.
- Mobile navigation was scrolled end to end. Booking Agent, Record Stores, EPK Builder, Saved, Settings, Support, legal links, stacked Android/Apple app links, and Logout remained reachable without exposing the background workspace to focus.
- Settings recovered from its loading state and enabled presence privacy, tagging, device preferences, language, alerts, activity, data export, legal links, and logout. Global search completed with separate post and member result states rather than leaving an indefinite loader.

## Live provider test

Run only with an authenticated AWS CLI session:

```powershell
node test-live-discovery.mjs
```

The venue matrix covers the required searches: Seattle punk/hardcore, San Francisco rock/alternative, Los Angeles live music, Bologna all live music, Berlin techno/punk/rock, Paris jazz/blues, and London independent venues. A separate worldwide record-store matrix covers Bologna, Berlin, London, Tokyo, Seattle, and Momo. The test rejects out-of-radius results, requires source attribution and coordinates, and fails when a requested search has no validated results.

Authenticated live result counts rechecked on 2026-11-03 (validated results after geographic and type filtering):

- Seattle: punk 3, hardcore 1
- San Francisco: rock 2, alternative 4
- Los Angeles: live music 8
- Bologna: all live music 28
- Berlin: techno 2, punk 1, rock 1
- Paris: jazz 4, blues 1
- London: independent 4
- Record stores: Bologna 6, Berlin 52, London 51, Tokyo 3, Seattle 41, Momo 6

These are test-run observations, not guaranteed inventory counts. Listings can change and the product tells artists to verify current calendars and booking contacts.

All three current global OpenStreetMap Overpass mirrors were unavailable from the development machine during validation. The application races a bounded operator-configurable mirror set, reports provider status separately, and continues with AWS Places when the open-data provider is unavailable. A five-minute in-process circuit breaker now prevents every later city in the same warm runtime from waiting on mirrors that have already failed; the full 18-case live matrix dropped from roughly 106 seconds to 32 seconds while preserving the same validated counts. AWS Places alone passed every city and store assertion above. The Overpass path still needs validation from the deployed Lambda network before production approval.

## Feed recovery browser check

- A local mobile-width browser pass on 2026-11-03 reproduced a raw `Failed to fetch` post status and a `feedTranslate is not defined` exception in The Roll's failure path.
- Post failures now render a compact localized connection message with a real **Try again** action instead of browser or provider text.
- The Roll translator is module-scoped so its retry state can render even when notification UI has never initialized.
- The browser console no longer reports the translator exception, and the full local regression, site, CSP, PWA-cache, and infrastructure suites pass.
- A follow-up Messages pass verified that the notification-permission card is hidden while the chat drawer is open and returns after the drawer closes. When all contact sources are unavailable, the drawer now replaces the indefinite passive status with a localized **Try loading messages again** control while retaining background polling.
- News, Online Users, and Friends now use the same compact, localized recovery pattern: failures are announced, members can retry immediately, and the existing background presence refresh remains active. The updated inline feed script passes the strict CSP hash check.
- The notification drawer now applies the selected language to its dialog and region names, close control, loading message, empty state, network failure, and Retry action. Reopening the drawer also refreshes its accessible labels after a language change. Targeted notification tests plus the complete local regression, smoke, PWA-cache, CSP, and infrastructure suites pass.
- Notification actions now follow the selected language too: Open Tribe, View post, Open chat, Accept, and Decline retain member-specific accessible names without exposing account email addresses.
- Accepting or declining a friend request now updates the notification badge and final empty state immediately after server confirmation, even if the follow-up count refresh is offline. Failures are announced as alerts, confirmed actions give localized feedback, and Friends/presence still refresh in the background.
- A cloud settings outage no longer disables device-only choices. Dark mode, reduced motion, data saver, language, and notification-badge visibility remain usable; presence and tagging stay protected until account settings load. Notification-badge changes persist and refresh immediately without waiting for a cloud save.
- Active phone and video calls now tolerate a short mobile-network interruption, cancel stale recovery timers when the connection returns, and fully release camera, microphone, and call controls when the peer connection is lost. Reconnect and lost-call states are localized across all 15 supported languages; focused call tests and the complete regression suite pass.
- Call-role controls are now explicit: outgoing callers keep the primary accessible Hang Up action without a duplicate floating button, while recipients retain the dedicated touch-friendly receiver Hang Up control requested for mobile calls.
- Permanent EPK deletion now uses DanzStak's accessible modal confirmation instead of a blocking browser prompt. Escape and the safe default keep the EPK, keyboard focus returns to the Delete EPK opener, and the destructive choice is visually distinct.
- EPKs now persist and publish artist-controlled social links. YouTube, Vimeo, and Spotify retain constrained provider embeds; SoundCloud, Bandcamp, TikTok, Instagram, and Facebook receive named, safe external preview cards without copying or rehosting third-party media. Published booking email, phone, and website details are actionable only when the artist supplies them.
- New EPKs keep booking email, booking phone, technical rider, and hospitality rider private unless the artist explicitly opts each item into the public kit. Public API responses remove every unapproved field server-side; existing published kits retain their prior behavior until their owner saves the new visibility choices.
- Published EPKs now expose public-only actions to copy the stable kit link and print or save the professional layout as a PDF. The action bar is keyboard accessible, adapts to mobile width, and is excluded from printed output.
- Artists can create, replace, and revoke a private review link for a booker or manager without publishing the EPK. The 256-bit secret stays in the browser URL fragment, is sent only in a no-store API request body, and is stored server-side only as a SHA-256 hash. Private reviewers receive all EPK files and booking details but not owner publication settings; deleting the EPK also removes the private share atomically.

## Known limits

- Uploaded images are resized to a maximum 2400-pixel edge and JPEG-optimized in the browser. PDF files are not transformed.
- Files are owner-scoped, MIME/size checked against S3 metadata, quota-limited, private by default, and removed from S3 when deleted from a saved EPK. A malware-scanning service is not provisioned in this pull request.
- YouTube, Vimeo, and Spotify have constrained embeds. Other approved HTTPS media links remain safe external links.
- The public EPK uses the static-host-compatible `epk.html?id=<artist-slug>` URL rather than a server rewrite.
