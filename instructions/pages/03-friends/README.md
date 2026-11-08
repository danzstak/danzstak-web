# Friends — Mobile-first page contract

**Status:** Specification scaffold; not implemented, tested, or approved by this document.

## Required functions
Requests, accept/decline, friend search, privacy.

## Visual design
Follow `instructions/00c-design-direction-80-20.md`: familiar social-network interaction patterns, distinct DANZSTAK branding, light mode only. Produce mobile mockup first, then tablet and desktop. Link actual screenshots and approved visual assets here before final implementation signoff.

## Acceptance gate
- Inspect existing implementation and preserve working behavior.
- Test at 360px and 390px mobile and at desktop; no horizontal overflow, inaccessible controls or keyboard overlap.
- Verify each listed function, authentication and permissions, persistence and error states as relevant.
- Submit implementation PR, changed files, screenshots, test matrix, deployment SHA and phone-accessible PWA preview URL.
- Owner approves preview before production release; never claim completed from build success alone.

## Tracking
- Design: pending review
- Codex implementation: not verified
- Functional testing: not verified
- PWA preview: not verified
- Owner approval: pending


## Owner feature — invite friends who aren't DANZSTAK members yet (2026-11-04)

- Show **Invite to DANZSTAK** in Friends; **Invite by Text** should use the member's own phone SMS composer to share a localized invitation with `https://danzstak.com/`. The sender chooses the recipient and confirms Send. Use OS Share and Copy Link fallbacks. Do not require contact-list upload or a paid DS alias.
- Keep this distinct from existing in-app friend requests (which target DANZSTAK accounts). An SMS composer launch does not prove delivery or grant friendship automatically. See [Issue #30](https://github.com/Danzstak/Danzstak-web/issues/30) for full requirements and staging/owner approval gates.
