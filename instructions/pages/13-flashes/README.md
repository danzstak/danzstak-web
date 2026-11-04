# 13 — DANZSTAK Dailies (24-hour stories)

## Owner requirement
Add a horizontal **Dailies** strip at the top of the mobile-first Home Feed, above the regular post composer and feed. These are ephemeral story-style posts that disappear from public viewing exactly 24 hours after creation.

## UX
- First tile: **Create Daily**; subsequent tiles: friends' available Dailies with avatars/previews and unseen indicators.
- Horizontal scroll on mobile; tap opens immersive vertical story viewer with progress bars, close button, tap-to-next/back and pause/resume.
- Support text, photos, and short externally hosted videos (no new video hosting infrastructure).
- Mute video by default; only the currently viewed Daily may play; prevent all overlapping audio with the feed and other Dailies.
- Viewer exits cleanly and restores feed position; accessible touch targets and screen-reader labels.
- Show remaining time if helpful; do not make expired Dailies accessible through direct links.

## Backend and expiry
- Store `created_at` and `expires_at = created_at + 24h` server-side in UTC.
- Enforce expiry on all reads and APIs, not just UI hiding or delayed database TTL cleanup.
- Cleanup can be asynchronous but expired content must not be publicly visible.
- Author may delete early; respect privacy/visibility and existing block rules.
- Do not notify real users from sample/demo Dailies; clearly label demo content.
- Prevent expired media embeds from continuing playback.
- No unapproved upload/storage service or new external-media licensing assumptions.

## Acceptance
- Daily appears after creation, remains visible before expiry, disappears at 24h (boundary tested with clock-controlled tests).
- No expired Daily can be fetched through API or direct URL.
- At most one Daily/feed video plays at a time, with no overlapping audio.
- Mobile 360/390px and desktop layouts verified; screenshots and PWA preview link supplied.
- Creator deletion and permission checks verified.
- Implement in separate PR and require owner review before production deployment.

## Terminology update
The public UI name is **Dailies**, never Flashes. Existing internal identifiers may be migrated safely; do not break existing data. The separate **Rough Cut** video rail appears after four regular feed posts.

## Create Daily tile — owner-approved visual requirement
- First tile in the Dailies strip must show the **signed-in user's actual profile picture** prominently, not a generic placeholder when an avatar exists.
- Overlay a small **clapperboard / film slate icon** with a visible plus indicator, anchored at the lower-right of the avatar/tile to communicate **Add to Dailies**.
- Tile label: **Create Daily** (or **Add to Dailies** if the user already has an active Daily); the icon and full tile must be tappable and keyboard-accessible.
- Keep the profile photo unobscured; provide high-contrast icon backing, minimum comfortable touch target, and fallback initials/avatar when no photo exists.
- Tapping opens the Daily composer, never immediately posts. Confirm before publishing.
- Mobile-first at 360/390px, with screenshots showing both avatar-present and avatar-missing cases.

## Real date on Create Daily clapperboard
- Show the **actual current date** on the clapperboard/slate overlay, not hard-coded sample text.
- Use the viewer's local calendar date and locale for display, updating when the local date changes (including an open PWA crossing midnight). Format compactly to fit mobile; e.g. `NOV 04` or `04 NOV`, with a full accessible date label.
- The date is a visual cue only. **Daily expiration remains exactly 24 hours from server-side creation timestamp**, not at local midnight.
- Handle timezone changes and daylight-saving transitions; never rely on a fixed timezone or device clock for authoritative expiry.
- Verify date rollover, timezone formatting, and mobile legibility in tests/screenshots.
