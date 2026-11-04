# Home Feed — Mobile-first page contract

**Status:** Specification scaffold; not implemented, tested, or approved by this document.

## Required functions
Composer, post cards, reactions, threaded comments, external embeds, video controls.

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


## Owner terminology: The Mix / Add to Mix (2026-11-04)

- **The Mix** is the existing main feed, containing posts, music, photos, videos, events and ordinary life. It is not an additional destination.
- Replace the user-facing English **"Create Post"** composer/action label with the short branded call to action **"Add to Mix"**. Preserve familiar behavior and accessibility/translation; review other inconsistent composer labels in actual templates and JavaScript without indiscriminately replacing unrelated words such as “create event” or “post” used technically. Ensure 15 supported languages receive intelligible labels that retain "Mix" as a branded anchor where appropriate.
- **Add Event** creates a structured event; once published with its flyer and/or promo video, **one linked event card appears in The Mix**. The publish action may be labeled **"Add to Mix"**. Do not make a second feed. Preserve owner-selected audience/privacy.
- Keep both ordinary text posts and event cards easy to create, distinguish at a glance, and read on phones. No popups or autoplay with sound. This is part of the "comfortable UX" / one signup experience.
- See [Events specification](../08-events/README.md) and GitHub issue tracking for media types, persistence, moderation, real tests and launch gates. These instructions are not a deployment.
