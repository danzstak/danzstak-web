# 13 — DANZSTAK Dailies (24-hour stories)

## Owner requirement
Add a horizontal **Dailies** strip at the top of the mobile-first Home Feed, above the regular post composer and feed. These are ephemeral story-style posts that disappear from public viewing exactly 24 hours after creation.

## UX
- First tile: the signed-in member's real photo with a dated clapperboard showing **SCENE 1 · TAKE N**, where N is the lifetime count of distinct successfully uploaded DanzStak videos (including Dailies, each asset counted once). Daily expiry never lowers N. Subsequent tiles are friends' available Dailies with avatars/previews and unseen indicators.
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
The public UI name is **Dailies**, never Flashes. Existing internal identifiers may be migrated safely; do not break existing data. **The Roll** launcher row appears after four regular Mix posts and opens the existing fullscreen swipe video player; it is not a separate player or product.

## Take 1 tile — owner-approved visual requirement
- First tile in the Dailies strip must show the **signed-in user's actual profile picture** prominently, not a generic placeholder when an avatar exists.
- Overlay a small **clapperboard / film slate icon** with a visible plus indicator, anchored at the lower-right of the avatar/tile to communicate **Take 1**.
- Tile label: **Take 1** (or **Take 1** if the user already has an active Daily); the icon and full tile must be tappable and keyboard-accessible.
- Keep the profile photo unobscured; provide high-contrast icon backing, minimum comfortable touch target, and fallback initials/avatar when no photo exists.
- Tapping opens the Daily composer, never immediately posts. Confirm before publishing.
- Mobile-first at 360/390px, with screenshots showing both avatar-present and avatar-missing cases.

## Real date on Take 1 clapperboard
- Show the **actual current date** on the clapperboard/slate overlay, not hard-coded sample text.
- Use the viewer's local calendar date and locale for display, updating when the local date changes (including an open PWA crossing midnight). Format compactly to fit mobile; e.g. `NOV 04` or `04 NOV`, with a full accessible date label.
- The date is a visual cue only. **Daily expiration remains exactly 24 hours from server-side creation timestamp**, not at local midnight.
- Handle timezone changes and daylight-saving transitions; never rely on a fixed timezone or device clock for authoritative expiry.
- Verify date rollover, timezone formatting, and mobile legibility in tests/screenshots.

## Final visual stacking clarification (owner approved)
The **dated clapperboard sits above the user's profile picture** within the Take 1 tile: the user's real profile photo must remain visible **underneath** the slate overlay, not replaced by an icon or generic illustration. Put the compact date on the slate; position the slate toward the top portion of the tile, with the avatar/photo clearly visible below it. Maintain the plus affordance and Take 1 label. Provide a neutral initials fallback only when no profile photo exists. Test both states and screenshot the final mobile layout.

## Final UI copy
The action tile must be labeled **Take 1**, never **Create**. Keep the dated clapperboard above the signed-in user's profile picture. The accessible label should explain: 'Take 1 — add a Daily that disappears after 24 hours.' This is only a label change; the user still reviews content before publishing.

## Final owner naming and movie-slate requirement (2026-11-04)

**Owner's exact naming decision:**
- **Dailies** is the 24-hour story-strip public product name. **Flashes** is retired as display text. Existing old internal IDs can be maintained as migration aliases so stored stories and user state are not lost.
- **The Roll** remains the single swipeable, fullscreen video destination. **Rough Cut / Rough Cuts is retired**, not a second video feed, rail, or label. After four regular Mix posts, show a compact The Roll launcher row that opens this existing player; do not create another player or feature.
- **The Mix** remains the central social feed.

**Far-left Dailies creator tile — a nod to film crews:**
- **Pin the signed-in member's own creator tile at the far left** of the horizontal Dailies row, ahead of friends' Dailies. It is always visible with the member's **actual, account-authorized profile photo** (initials fallback only when absent). Never substitute a fake profile photo.
- Layer a **compact black-and-white film clapperboard / slate over the top of their photo**, leaving their face/profile image visibly recognizable underneath. Overlay today's real **local date** and **SCENE 1 · TAKE N**, where N is the server-authoritative lifetime count of distinct successfully uploaded DanzStak video assets, including uploaded Daily videos once each. Expiry does not lower the count. Include a small plus affordance. Movie terminology is a visual wink, not a complex production workflow.
- Update the displayed **local clock/time** during an open PWA as minutes and day boundaries change; respond to locale/timezone changes. Never hard-code date/time or depend on a static screenshot. The label must not imply a Daily was *published* at the current time: this is the **slate's current local timestamp**, distinct from the actual server-recorded createdAt/expiresAt of each Daily. Real Daily metadata, if shown, uses its actual creation time.
- Tapping the entire own-photo/slate tile opens the authenticated **Add Daily** composer, without publishing automatically. Provide a labeled 44px+ touch target and a meaningful accessible name with member name, uploaded-video count, "Add Daily" and date; don't make the slate/text tiny or visually overpower the photo.
- Friends' tiles follow horizontally as real authorized avatar/story previews with unseen markers; preserve tap/pause/expiry/privacy, no forced auto-sound, no duplicate horizontal rows or excessive wasted vertical space.

**Codex tests:** at 320, 360, 390, 414, 430px and desktop prove leftmost identity, authentic avatar vs fallback, slate layered over photo, accurate local date and midnight/timezone changes, correct server-derived TAKE N (0/1/multiple, duplicate publications counted once, Daily expiry does not decrement), real 24h expiration, composer open but no accidental publish, original feed/nav intact, one active audio owner. Real phone-accessible staging PWA and before/after snapshots; owner approval before merge/deployment.

**This section overrides all conflicting earlier mentions of the Rough Cut rail and any Flashes public label.** Specification only, not proof the live interface changed.


## Latest owner correction — TAKE N is total user-uploaded videos (2026-11-04)

**Final and authoritative:** In the far-left Dailies creator tile, display **SCENE 1 · TAKE N**, where **N is the number of actual videos the signed-in user has uploaded to DANZSTAK**. This **replaces the previous interpretation based on active/unexpired Dailies**. Examples: 0 uploaded videos → SCENE 1 · TAKE 0; 12 uploaded videos → SCENE 1 · TAKE 12. Keep the user's real profile picture under the clapperboard, plus affordance and live local date/time.

- Derive the count from authoritative server-side user-owned video-upload records **across DANZSTAK** (The Roll, video posts in The Mix and video Dailies when actually uploaded), **not** text posts, photos, imported external YouTube/Instagram links, uncompleted uploads, or all-time Daily post count.
- Each distinct successfully uploaded video asset contributes once even if the user publishes it in Dailies, The Mix and The Roll. A Daily's 24-hour expiry does not lower the count. Use reliable aggregate metadata rather than resurrecting or exposing expired media.
- Update the label after confirmed uploads and refresh. Never fabricate a number or pull it from the number of visible Dailies. If backend counting is not yet supported, implement/test the authoritative count first or show a clearly honest pending state.
- Preserve server-enforced **24-hour Dailies expiry** independently; the slate's TAKE number does not control expiry or signify Daily post count.
- Test 0, 1, 12 uploaded videos, repeated publications, pasted external links, expired Dailies, failed uploads and cross-device updates. Expiry must not decrement TAKE N. Mobile PWA screenshots and owner-approved deployment required.

**Overrides all earlier statements in this file that define TAKE N as the number of currently active Dailies, including the previous "Latest visual naming" section.**



## Fullscreen Dailies — vertical back-to-back viewing, same fluid playback as The Roll (owner confirmation, 2026-11-04)

**Owner says "Same thing on dailies"** immediately after instructing that The Roll must open fullscreen and play all videos back-to-back, not require horizontal scrolling of video cards. Thus Dailies must feel equally fluid in fullscreen **without changing the 24-hour story concept**.

### Behavior
1. The **horizontal Dailies avatar/photo strip at the top of The Mix stays as the entry selector**. The leftmost creator tile remains the signed-in member's real photo with the dated SCENE 1 / TAKE N clapperboard; N is total **actual uploaded video assets**, NOT active Dailies. Other members' avatar tiles follow.
2. **Tap a member's Daily** -> launch a **full-screen vertical sequence** of that **member's own currently unexpired, viewer-authorized Dailies**, beginning at the tapped Daily. Auto-advance video-to-video **when each video ends** where player APIs allow, and allow swipe **UP/DOWN** to navigate next/previous Daily without returning to profile, feed or horizontal carousel. Use 50% video-pixels-out-of-viewport threshold on manual swipe to stop the outgoing video/audio and start the next predominant video. Only one active source/audio at a time.
3. **Dailies can also be photos and text**, not just videos: display these as readable fullscreen story slides and auto-advance after an accessible, reasonable reading interval; pause progression for hold-to-pause, accessibility focus or opened comments. Do not omit photo/text Dailies from the person's Daily story sequence. Next content is displayed smoothly without unnecessary blank gaps.
4. On entering full-screen via deliberate user gesture, attempt to play first eligible video with audio where browser/provider allows. Carry sound on/off to subsequent clips in the Daily viewing session so members do not have to unmute every clip. If user mutes, later videos stay muted. Outside the viewer, feed videos remain muted until an allowed explicit unmute; never play sound on app launch or while offscreen.
5. Opening a broad Dailies experience can sequence all **viewer-permitted active Dailies**, clearly grouped by creator. Tapping a specific person's avatar should stay with **that person's Dailies** first; at their end, present a clear End / Next creator / Close choice, not silently jump into a random stranger's videos. **No horizontal scrolling within fullscreen**, though the external top-level avatar strip stays horizontal.
6. The queue must come from authoritative Dailies data scoped by creator ID, view permissions, block/friend restrictions and **exact 24-hour expiry enforced by backend on every fetch**. Never play or reveal expired, deleted or unauthorized Dailies, even if a user's PWA keeps an old viewer open past expiry. Existing server-side privacy, create/edit/delete, account IDs, and media ownership stay intact.
7. Keep restrained DANZSTAK-branded visual treatment: video/image filling available space without distortion, one minimal Back/Close, creator name, progress/time indicator, concise caption and real actions. Avoid generic oversized status bars, repetitive cards or heavy black framing; preserve safe areas and support keyboard/screen reader and reduced motion. Do not call Dailies The Roll or create Rough Cut.
8. End/video event control may be unavailable for third-party iframe embeds, so use supported APIs only, stop/unload offscreen providers, and give honest tap-to-continue behavior where necessary. No fake playback status or audio overlap with The Roll or Chat calls.

### Acceptance
Using two test accounts and three video Dailies plus a photo and text Daily, tap a member avatar from The Mix. Viewer opens fullscreen at the selected item; plays that member's clips back-to-back on natural completion, with vertical swipes next/previous, no horizontal card browsing; photo/text slides display correctly and auto-advance at readable pace. Verify active audio follows the sound toggle, pause/next at 50% out-of-frame, no simultaneous audio, repeat swipe, 24-hour expiry while player open, block/privacy, empty/one/many items, returning to the same Mix scroll position and cross-player audio shutdown. Run real-phone Android PWA tests and explain any provider autoplay limitations; stage tested implementation and seek owner approval. **This specification alone is not implementation.**


## Dailies-only viewing queue — final owner clarification (2026-11-04)

Owner's rule is **"If the user opens Dailies, it plays just the Dailies."** Dailies is a standalone collection of 24-hour photo/video/text story items, not a route into The Roll or ordinary member video library.

- Tapping the Dailies feature/category opens a vertically navigable fullscreen **Dailies-only** queue of current accessible unexpired Dailies. Tapping a person's Daily avatar/photo opens the selected Daily first, with that person's active Dailies grouped together if available. Navigating after this creator's items may show other Dailies only via a clear Next creator progression; **never show Roll or normal Mix video posts**.
- Preserve the horizontal *avatar entry strip* in The Mix, but **no horizontal gallery traversal in fullscreen**. Photos and text are legitimate Dailies and advance at a readable interval; videos advance at natural end where possible and use 50% offscreen visible-pixel handoff during manual vertical swipe.
- At Daily expiry or deletion, remove from the current queue on next authorized refresh/transition and never stream expired content. Account privacy and blocking enforced server-side.
- The separate **The Roll** category plays only content actually in The Roll. A user's ordinary video library plays only their own standard video posts across DANZSTAK, excluding Daily-only ephemeral media unless separately published as a standard video. The same fullscreen player implementation may be reused, but the queues cannot merge or silently switch.
- Leftmost Dailies entry remains member's real photo with timestamped clapperboard SCENE 1 · TAKE N; **N is their distinct uploaded video asset count**, not current Daily count. This visual label does not change playback scope.

**Acceptance:** open Dailies with 2 creators' Dailies and separate Roll/Mix videos; next/previous/fullscreen/end-of-list never shows a non-Daily. Expired or unauthorized Dailies cannot leak. Validate Android PWA swipe, sound, readable photo/text slides, Back/Close and 24-hour expiry, then request owner approval before deployment.


## Final owner navigation — multi-creator Dailies advance by vertical swipe (2026-11-04)

**Owner confirms Dailies and The Roll are both collections containing content from different people.** This supersedes older instructions to restrict Dailies fullscreen playback to just the selected person's Dailies or to require a separate "Next creator" button.

- The **horizontal row** of member photographs/available Dailies at the top of The Mix remains the **entry-point selector**. Tap a Daily -> open **that exact Daily fullscreen**. **Swipe UP/DOWN** advances to next/previous currently authorized, unexpired **Daily, including a Daily by another member**, in stable ordering. An individual member's multiple Dailies may be grouped but crossing member boundaries is part of ordinary vertical navigation, with no modal or forced confirmation.
- **Dailies-only category always stays Dailies-only**. The fullscreen sequence can include supported Daily video, photo and text entries (24-hour ephemeral content); it never pulls in ordinary Roll clips or Mix videos. Video advances after natural end where possible, other Daily types after a readable/pausable interval; manual swipe obeys 50% visible-video-pixel handoff with one active audio source.
- In contrast, tapping the horizontal **The Roll** preview carousel opens the multi-creator **Roll-only** fullscreen queue. Tapping video in The Mix or on a person's profile opens **creator-only regular videos**. Never conflate these three scopes. See [Roll playback source of truth](../../01-video-playback.md).
- Preserve member photo and timestamped clapperboard on far-left creator tile; SCENE 1 · TAKE N counts unique user-uploaded video assets, **not** active Dailies. Preserve 24h server expiry, secure permissions, error/expired-media fallback and Back returning to the origin.

**Acceptance:** Tap an eligible Daily from member A; UP reaches a Daily from member B (once any A Dailies ahead in the defined sequence are exhausted) without leaving fullscreen or needing to tap "Next creator". No ordinary video ever appears. Test multiple authors, mixed media, boundaries, expiry, blocks and Android PWA audio and navigation with owner approval before deployment.


## Final owner polish — less cookie-cutter Dailies viewing (2026-11-04)

Use the same lightweight, stable fullscreen vertical transitions as The Roll, **without a generic card carousel or excess framing**. Dailies is a multi-user 24-hour photo/video/text collection entered from the existing horizontal avatar strip. Start on the tapped Daily, then swipe UP/DOWN through all viewer-permitted active Dailies (including other creators); never mix in standard videos. Preload the next accessible item modestly, use readable pauseable image/text timing, pause the outgoing video at the 50%-offscreen pixel threshold, preserve session sound settings where allowed and enforce expiry while the viewer is open. One media owner only. Keep the far-left authentic-profile-photo/clapperboard creator tile, but the slate is a small film-set nod rather than cluttering the viewer. Verify smooth Android PWA transitions, permissions, Back/Close, audio and real before/after screenshots; no production deployment without owner signoff.


## Final owner retention — Dailies expire after one day, regular content does not (2026-11-04)

**Owner's exact rule:** "Dailies stay for a day. The Roll stays until users delete. Same The Mix, same as their profile videos stay until users delete them."

- **Only Dailies auto-expire.** Every Daily (photo, text, or video) expires **exactly 24 hours after its server-authoritative publication timestamp**, NOT at local midnight, after 24 hours of watching, or at the time a viewer opens it. The backend must stop including expired Dailies in any public/friend/user feed, story count, notification deep link or fullscreen queue and reject access through its Dailies API after expiry. If a viewer is watching when a Daily expires, retire it from the active playlist and navigate safely to the next authorized Daily or show end of collection.
- **The Roll and normal videos/posts in The Mix or profiles have no time-based auto-expiration.** They remain visible under their chosen access/privacy settings until their owner deletes or changes visibility, account deletion applies, or a required moderation/legal action occurs. This remains true for videos opened in creator-only fullscreen playlists: do not quietly remove them because 24 hours passed.
- **Sharing across destinations:** Uploading the same source asset to Dailies and separately publishing it to The Roll or The Mix MUST NOT cause the regular publication to expire with the Daily. Daily expiry removes only the ephemeral Daily reference/visibility. Conversely, the member's explicitly deleting their video/post should remove the intended publication(s), not an unrelated surviving share. Use owner-authorized per-publication IDs and asset reference tracking, not indiscriminate storage-object deletion.
- **Blob lifecycle:** On expiry, delete private orphaned Daily media through an auditable retention/garbage-collection process appropriate for security/compliance while preserving any still-authorized non-expiring publication referencing that media. Do not falsely guarantee forever hosting; maintain account deletion, abuse, moderation and legal compliance.
- The Dailies clapperboard **TAKE N** continues to count distinct genuine user-uploaded video assets per its separately defined policy; do not confuse Daily expiry with a blanket deletion of every uploaded video.
- Tests: Daily at 23h59 still accessible, at 24h0000 unavailable even through direct URL/API and active fullscreen; concurrently shared Roll/Mix item remains playable after Daily expiry; regular videos remain after days/months until authorized deletion; deleting one publication preserves other intended shares. Test UTC/local-midnight/DST, blocking, privacy, storage lifecycle and Android PWA. No production deployment before owner review.

**Supersedes any accidental interpretation that The Roll, The Mix or member profile videos expire after one day.**

## Deleting a Daily versus the original video everywhere (2026-11-04)

**A Daily has a 24-hour lifecycle, but it may reference an original video also published in The Roll or The Mix and reshared by other accounts.** Auto-expiration or the creator selecting **Remove from here** on the Daily must unpublish only the Daily reference: do NOT erase persistent video instances, authorized reshares, or other creators' original commentary.

When the **original video owner** explicitly chooses **Delete everywhere** and confirms, that owner's original video becomes unavailable in every DANZSTAK publication—including Dailies and all reshares/crossposts by others, plus active fullscreen playback queues and media URLs. Do not allow resharing users to invoke creator-level global deletion; they can remove their own reshare. Preserve independent resharer captions if policy permits with an unavailable-video placeholder. No promise of removing downloaded/off-network copies. This needs durable server ownership IDs, parent-video references and safe storage lifecycle; see [Issue #40](https://github.com/Danzstak/Danzstak-web/issues/40).

Test crossposting V to Daily + Roll + Mix, third-party reshares, both deletion choices, 24h Daily expiration, browser reload/expired media while viewer open and correct creator permissions. Owner review and tested PR required before production.
