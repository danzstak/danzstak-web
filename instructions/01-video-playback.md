# 01 — Video playback, audio isolation and player framing

![Video feed reference](visuals/video-feed.svg)

## Reported defects (verify in current app)
- YouTube video may play as soon as the app opens, including when not visible.
- Audio from multiple videos may overlap.
- A visible audio mute/unmute control is missing or inadequate.
- Dark/black lines appear around embedded video players.

## Required behavior
1. **No audible autoplay on app launch.** An offscreen player must never start playing audibly.
2. When scrolling, at most one video may play at a time. Pause videos leaving the visible region; do not rely solely on muting them.
3. Provide a clearly visible, accessible mute/unmute button on each playable video; initial state must be muted. Unmuting requires a user action.
4. Respect browser autoplay policies. If an external provider blocks programmatic control, show a click-to-play state rather than falsely claiming playback control.
5. Prevent playback from persisting after route changes, tab changes, modal close, or component unmount.
6. Normalize player container aspect ratio and background, eliminate unintended borders/stripes, and avoid cropping important content.
7. Support YouTube and other existing supported external embeds without downloading/rehosting media.
8. Do not modify unrelated feeds or authentication.

## Acceptance tests
- Initial page load: zero audible videos.
- Scroll through 5+ video posts: never two simultaneous audio streams.
- Unmute a visible video, then scroll it offscreen: it pauses.
- Navigate away from feed: all players stop.
- Test on Android Chrome, desktop Chrome, and any available Safari environment.
- Confirm player edges have no unintended black border; distinguish provider letterboxing from CSS defects.
- Record exact automated tests, manual test environments, and any unverified providers.

## Codex deliverables
Root-cause analysis, changed file paths, PR, test results, before/after screenshots, known provider limitations.
