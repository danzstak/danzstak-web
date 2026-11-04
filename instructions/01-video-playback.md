# 01 — Video playback, audio isolation and player framing

![Video feed reference](visuals/video-feed.svg)

## Reported defects (verify in current app)
- YouTube video may play as soon as the app opens, including when not visible.
- Audio from multiple videos may overlap.
- A visible audio mute/unmute control is missing or inadequate.
- Dark/black lines appear around embedded video players.

## Required behavior
1. **Autoplay is required for eligible in-view videos, muted by default.** When the feed opens, the first sufficiently visible video should autoplay silently where browser/provider policies allow. Never autoplay an offscreen player or start audio without a user action.
2. As the user scrolls, automatically play the most-visible eligible video (muted by default) and pause all others. At most one video may be playing at a time; offscreen players must pause, not merely mute. Use intersection visibility thresholds and robust lifecycle cleanup.
3. Provide a clearly visible, accessible mute/unmute button on each playable video; initial state must be muted. Unmuting requires a user action.
4. Respect browser autoplay policies. If an external provider blocks programmatic control, show a click-to-play state rather than falsely claiming playback control.
5. Prevent playback from persisting after route changes, tab changes, modal close, or component unmount.
6. Normalize player container aspect ratio and background, eliminate unintended borders/stripes, and avoid cropping important content.
7. Support YouTube and other existing supported external embeds without downloading/rehosting media.
8. Do not modify unrelated feeds or authentication.

## Acceptance tests
- Initial page load: the first visible eligible video autoplays silently, where permitted; zero audible videos.
- Scroll through 5+ video posts: the visible video autoplays silently; previous players pause; never two simultaneous audio streams.
- Unmute a visible video, then scroll it offscreen: it pauses.
- Navigate away from feed: all players stop.
- Test on Android Chrome, desktop Chrome, and any available Safari environment.
- Confirm player edges have no unintended black border; distinguish provider letterboxing from CSS defects.
- Record exact automated tests, manual test environments, and any unverified providers.

## Codex deliverables
Root-cause analysis, changed file paths, PR, test results, before/after screenshots, known provider limitations.


## Final owner directive — The Roll fullscreen sound and 50% swipe handoff (2026-11-04)

**Owner Android screenshot:** The Roll fullscreen shows a large "The Roll / Externally hosted videos" header, expand and close buttons, portrait video with unused surrounding space, and a distinct black metadata footer. Owner calls the appearance cookie-cutter and wants sound to play **on opening fullscreen**, then automatically carry to each new video, with **50% visibility handoff**. These are specific to The Roll, not permission for unsolicited sound in the ordinary feed.

### Immersive, original DANZSTAK Roll UX
1. **Tap Open The Roll** (explicit gesture) -> an immersive full-viewport vertical player with minimal Back/Close, caption/creator overlays and a compact side action rail where real like/comment/share/save features exist. Remove oversized black heading/footer, wasted framing, duplicate fullscreen buttons and generic panels without hiding source attribution or critical controls.
2. Vertical swipe up/down -> one **video per viewport**, comfortable scroll-snap, no large gaps or janky transitions. Fill the available screen sensibly while preserving 9:16 or source aspect ratio; do not stretch/crop important content, and distinguish provider letterboxing from CSS defects. Respect Android system bars and safe areas.
3. **At 50% out-of-view:** measure each card's visible pixel intersection ratio against the Roll scroll viewport. When the old video has **50% or less visible (<=0.50)**, pause it and stop its audio. When the next card is predominant and **>=0.50 visible**, start it automatically. Use a **single authoritative active video** and deterministic tie-breaking/hysteresis near exactly 50/50 to avoid rapid switching; always stop outgoing audio before enabling the incoming video's audio. Do not switch while actively operating its progress slider or comment sheet.
4. **Sound when opening fullscreen:** on the member's deliberate Open Roll tap, attempt an allowed audio unlock so the first eligible video starts with sound. Carry the member's **unmuted or muted choice for the rest of that Roll session**, so advancing clips never requires another sound-button tap. One visible and accessible Speaker/Mute control can change it for all subsequent clips. On Android/iOS/provider restrictions, do not fake success: a **one-time Tap to enable sound** action may be necessary. Do not bypass browser autoplay policies, OS/device silence or provider limits.
5. **Outside The Roll:** Your Mix feed remains **muted by default**. Never automatically play offscreen audio on app load. Closing Roll, leaving tab, opening a call, browser background, or navigating away pauses/unloads and silences every Roll player immediately. Preserve user control and optional data saver.
6. **External video reality:** existing Roll uses HTML5 videos plus cross-origin iframe players. The current reelPlaybackObserver in assets/feed-enhancements.js only pauses HTML5 video when below 60% visible; it does not reliably start the next, and iframe controls differ. Extend a centralized media coordinator to manage active playback/mute of HTML5 and provider-specific embeds **only where provider API allows it**. For iframe content that cannot be paused/unmuted reliably, unload/suspend offscreen to avoid audio bleed and show an honest click-to-play fallback; do not claim Instagram-like control where the provider blocks it. DANZSTAK remains independent from Meta/Instagram login, code and terms for its own content.
7. Preload current and at most one adjacent video while respecting data saver and network cost. Graceful buffering/retry/unsupported player states. Preserve author/profile/link/comments where supported, screen reader access, reduced motion and mobile keyboard/pointer behavior.

### Acceptance test and owner gate
- Audit actual assets/feed-enhancements.js functions setRollFullscreen, reelPlaybackObserver, renderPlayableReels, the CSS .roll-fullscreen/.reels-list rules, and global media visibility coordinator before coding; explain measured defects rather than creating another separate video feed.
- On **two or more real test clips** in an **installed Android phone PWA**, tap Open Roll and hear sound where browser/user gesture allows; swipe A->B->C without pressing sound again; verify video A pauses at <=50% visible, B starts once predominant >=50% visible, never two audible streams, mute persists, swipe backwards, video errors handled, closing stops sound immediately. Distinguish browser-policy failures from implementation bugs.
- Test precise 50/50 ties, fast swipe/reverse, buffering/network loss, pause while scrolling controls, external YouTube embed vs direct video, tab background, video call audio focus, PWA history/back, 320/360/375/390/414/430px and desktop. Record supported/uncontrollable providers honestly. Include mobile screenshots and actual sound playback evidence, not only CSS/layout static tests.
- Codex: independent small PR, reproducible pass/fail evidence, SHA, verified **phone-accessible staging PWA**, exact provider limitations and **owner approval before merge/deploy**. This specification does not establish a completed feature.

**User promise:** Open the Roll and hear the active video, swipe, hear the next, never overlapping videos, no need to press sound on each video.


## Owner clarification — Keep existing Roll, polish like Instagram (2026-11-04)

**Exact final intent:** The public name stays **The Roll** and it remains the same **existing DANZSTAK video product/content destination**. Do not rename it, replace it, move its videos into a separate product or revive Rough Cut. The owner wants a **better feeling, smoother, more polished Instagram-Reels-familiar user experience**, NOT a copied Instagram UI or an account/API integration.

- Retain existing accounts, creator identities, uploaded videos, external embeds, share/source links, rights checks, privacy, engagement records and route/Back behavior. Improve the existing Roll player in-place, not a new feed or migration.
- Improve mobile touch UX: natural full-height vertical swipes, one clear video per viewport, fluid snap and no jitter, clipping, huge black gaps or generic cards. Fit video to device aspect without distorting/cropping key content; subtle overlay creator name/caption and unobtrusive real actions. Keep a small discoverable Close/Back and accessible mute button.
- Maintain previously approved **50%-out-of-view pause / >=50%-visible next play** handoff, with exactly one active media owner and tie stability. Entering fullscreen is a deliberate gesture: play audio when allowed; **keep the session-level audio preference while swiping** so a person doesn't unmute each clip. Only request a further gesture when browser/provider restrictions require it, and be truthful about limitations.
- The Mix remains an independent scrollable social feed (muted by default); Dailies remains a separate 24-hour feature. Do not install Instagram SDK, require Meta login, replicate proprietary visuals or rehost videos that were supplied as external embeds.
- Quality bar is perceived smoothness on **real Android PWA**, not just a static mockup: test repeated swipes, rapid reversals, load/transition times, mixed native and supported embed sources, audio bleed, tap targets, accessibility and background/call interruptions. Compare real before/after staging recordings/screenshots. If a provider cannot be controlled, give a graceful fallback rather than fake smooth autoplay.
- Codex implementation on its development branch, isolated PR, real device tests, staging preview and explicit owner approval before production deployment.

**Design sentence:** "The Roll keeps its name and content; only the viewing experience becomes more fluid, immersive and comfortable."
