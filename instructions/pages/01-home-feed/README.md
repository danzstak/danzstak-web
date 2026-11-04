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


## Owner directive: independence from Facebook terms (2026-11-04)

- **The Mix and Add to Mix are DANZSTAK-native products.** Publish original posts, event flyers and authorized promo videos on DANZSTAK's own infrastructure and under DANZSTAK's own Terms, Privacy Policy and moderation rules — **not Facebook's feed or posting policies**. Use Facebook-familiar UX patterns only; never copy its proprietary branding, artwork, source code or controlled assets.
- **No mandatory Facebook login, approval, SDK, API, account connection, posting permission or dependency** for Add to Mix, Add Event, discovery, comments, sharing, or normal use. Own content and uploaded event media must remain available if Facebook stops working or changes its rules. Do not cross-post to Facebook unless user explicitly chooses and an approved integration independently permits it.
- Optional embeds from Facebook/Instagram or user-imported Meta-origin content are **not exempt** from the applicable third-party service rules, copyrights, creator permissions, and technical limits; support them as optional links/embeds with graceful fallback, never as a core dependency.
- Independence does not eliminate relevant laws, safety obligations or DANZSTAK's own community standards; maintain protections for unlawful content, harassment, abuse, impersonation, privacy and unauthorized copyrighted media.
- Codex must verify genuine independent content posting and event publishing with Facebook connections absent/blocked, and test upload, persistence and playback using DANZSTAK-controlled assets. Owner approval still required before launch.


## Cinematic public naming — final owner choice (2026-11-04)

- **The Mix** is the main social feed; ordinary post composer is **Add to Mix**.
- **Dailies** is the 24-hour stories row formerly shown as **Flashes** in the current live `feed.html`. Replace public labels, notifications, accessibility text, translations and composer options consistently, but don't rename internal APIs/storage without a compatibility migration.
- Far-left Dailies tile always shows the **current signed-in member's genuine profile photo** with a small upper clapperboard overlay showing **SCENE 1 · TAKE N** (number of distinct videos that member has actually uploaded to DANZSTAK across modules, counted once per successful video asset; NOT active Dailies) and the real dynamically updating local date/time. Include a plus-to-create affordance. Underlying authentic photo remains visible. See [Dailies instructions](../13-flashes/README.md).
- **The Roll** remains the existing separate immersive swipe-up/swipe-down video experience; no **Rough Cut / Rough Cuts** rail after four posts, no renamed Roll product, no second video feed. See [The Roll spec](../../01-video-playback.md) and [retired older rail instructions](../14-rough-cut/README.md).
- These are UI/copy/design changes; no changes to existing user relationships, content persistence, privacy, share URLs, 24h expiry, or media audio isolation. Require actual code PR, mobile staging and owner approval before live deploy.
