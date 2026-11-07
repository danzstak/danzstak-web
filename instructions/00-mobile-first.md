# 00 — Mandatory mobile-first design system

**This requirement applies to ALL DANZSTAK features and overrides any desktop-first assumptions in other instructions.** Build phone layouts first, then progressively enhance for tablet and desktop.

## Mobile baseline
- Design and test first at 360px and 390px viewport widths, then 320px, 428px, 768px, 1024px and 1440px.
- Light mode only. DANZSTAK identity; familiar social-network patterns without copying Facebook assets.
- Compact sticky header with brand, search and notifications. Bottom navigation with 4–5 primary destinations and accessible labels; additional destinations in a menu.
- Feed is one column, nearly full width with comfortable spacing. Avoid desktop sidebars and horizontal overflow on mobile.
- Minimum 44x44 CSS pixel touch targets where practical, visible focus indicators, accessible contrast, and semantic labels.
- Composer, media cards, comment/reply actions, reactions, and share controls must work with touch and on-screen keyboards.
- Embedded videos must never create overlapping audio; provide a visible mute control and respect browser autoplay restrictions.
- Chat should use mobile-first conversation list and full-screen thread, with safe keyboard handling.
- Discovery: list/map toggle, useful location and contact details, mobile filters.
- EPK, Tour Manager, Events, Profiles, Friends, Marketplace and Settings must each have phone-specific flows.
- Responsive desktop adaptation may add sidebars and multi-column layout but must preserve all mobile capabilities.

## Demo community
The 25 removable demo accounts and 75–100 sample posts specified in section 06 must render convincingly on mobile first. Demo labels must remain visible and sample activity excluded from genuine-user counts.

## Codex implementation process
Inspect actual existing frontend stack before changes. Do not assume React or any particular framework. Implement shared responsive tokens/components where possible, avoiding broad unrelated rewrites. Capture real mobile screenshots and test at listed widths. Check for horizontal scrolling, clipped content, accidental double navigation, tap targets, keyboard overlap, and media layout shift. Report exact test devices/browsers and any unverified areas.

Do not merge or deploy without approval.
