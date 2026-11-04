# MILESTONE 01 — Mobile Home Feed, first owner preview

## Objective
Produce the first phone-accessible DANZSTAK PWA preview implementing the approved Home Feed design. Preserve existing functionality and SFScoop posts. Do not seed demo accounts in this milestone.

## Design order (mobile first)
1. Light-mode DANZSTAK header, familiar Facebook-like navigation, one-column feed and usable composer.
2. **Dailies** horizontal strip above composer. Creator tile: dated film clapperboard at top, real signed-in user's profile photo visibly beneath, plus affordance, **SCENE 1 · TAKE N** with N = active unexpired Dailies. Dailies expire server-side 24h after creation.
3. Four ordinary feed posts, then **Rough Cuts** horizontally swipeable video carousel, then resume normal vertical feed. Stable on pagination.
4. Feed videos autoplay **muted** when eligible and visible, with a clear mute button. Exactly one player active; no overlapping audio across feed, Dailies and Rough Cuts. Respect browser/provider autoplay limitations.
5. Permitted shares show small clickable **Shared from [Original Creator]** tag, like a friend/location tag, not a watermark. Respect Do Not Share/Protected Content.
6. Existing SFScoop posts and current user data are preserved; do not alter their privacy settings.

## Required Codex procedure
- Read `instructions/00-mobile-first.md`, `00b-pwa-release-review.md`, `00c-design-direction-80-20.md`, `00d-user-content-ownership.md`, `01-video-playback.md`, `pages/13-flashes/README.md` (public name Dailies), `pages/14-rough-cut/README.md`, and `pages/01-home-feed/README.md` from **codex-instructions**.
- Audit actual frontend/backend stack before modifying files. Do not assume React.
- Work on a separate implementation branch and open a PR linked to the milestone issue.
- Test at 360px, 390px and desktop; test expiration boundary, carousel position, autoplay/audio isolation, provenance and permissions. Provide screenshots and exact results.
- Deploy a verified phone-accessible **preview/staging PWA** only through the existing authorized pipeline. Include URL and deployed commit SHA; do not deploy to production without owner approval.
- Report blockers rather than claiming success.

## Owner acceptance
Owner opens preview on phone and approves or requests changes. Passing a build is not sufficient.
