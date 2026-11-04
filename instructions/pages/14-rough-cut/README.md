# 14 — Rough Cut video rail

## Placement
Insert **Rough Cut** immediately after the fourth ordinary Home Feed post. Dailies appear at the top, then the composer and four regular posts, then the Rough Cut rail, then the normal feed resumes. Do not count Dailies, ads or skeleton placeholders as regular posts. If fewer than four posts are loaded, defer the rail until four are rendered. Do not repeatedly inject it on pagination.

## UX
- Title: **Rough Cut** with a restrained clapperboard icon and a **See all** entry.
- Mobile-first horizontal row of short-video previews; tapping opens a dedicated, accessible video viewer.
- Use externally hosted supported videos, no rehosting. Preserve source attribution and link out when embedding is restricted.
- Visible mute/unmute control, muted autoplay for the in-view eligible video, strict single active player shared with the rest of the feed and Dailies.
- Light-mode DANZSTAK branding, familiar social UI patterns; responsive desktop adaptation.

## Acceptance
- Placement after exactly four loaded regular posts; remains stable on refresh, pagination and navigation.
- No audio overlap with feed or Dailies.
- Mobile 360/390px tests, accessible controls, screenshots, PWA preview, owner review.
- Do not claim deployed until verified; no production deployment without approval.
