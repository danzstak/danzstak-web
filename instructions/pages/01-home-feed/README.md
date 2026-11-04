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


## Final retention policy — Mix and profile posts persist; Dailies expire (2026-11-04)

The owner explicitly wants **The Mix posts and normal member profile videos to remain available until users delete them**, just as clips published to **The Roll** do. Do not apply any 24-hour TTL to ordinary social posts, event posts, regular uploaded videos or profile video galleries. Respect explicit privacy changes, account deletion and legal/moderation takedowns.

**Dailies alone** have the exactly 24-hour, server-authoritative expiry counted from their publication timestamp. A user's video that is published both as a Daily and as a regular Mix/Roll/profile publication must survive in the regular location after the Daily expires, without a broken underlying media URL. Treat publication visibility and underlying asset lifecycle separately; enforce authorized deletion and correct crosspost references.

Test regular Mix post/profile video visibility after >24h and explicit owner delete, Daily API expiry at 24h, shared-media case, permissions and active player refresh. Preserve The Mix as the main feed; do not create another video product or implement Rough Cut. Staging tests and owner approval required before production changes.


## Owner deletion choice — remove from here or delete everywhere including shares (2026-11-04)

**User-approved deletion contract:** When the authenticated original owner removes their own video, present two clearly different actions:
- **Remove from here**: unpublish ONLY the current publication/location in The Mix, The Roll, the profile or a Daily. Keep all other existing authorized instances and members' reshares of the video working, even if they originally pointed at the now-unpublished post. Preserve the underlying original video asset.
- **Delete everywhere**: with explicit confirmation, revoke the original creator's video throughout **ALL DANZSTAK surfaces, including copies/posts reshared by other accounts**, as well as source placements, video previews, native/global/creator-only fullscreen playlists, authorized download/playback URLs and any later-loaded pages. This is about the *same original video referenced by those reshares*; do not claim that DANZSTAK can delete independent reuploads without provenance or copies saved outside the network.

A resharer can remove **their own share only**, never global-delete somebody else's video. If a reshare contains another person's independently authored caption/comment, remove its video/preview and retain their own text with a discreet "Original video deleted by creator" placeholder where policy permits; don't silently erase unrelated speech. For a video-only collection, the unavailable video entry disappears.

**Source reality:** In the current main frontend, assets/post-sharing.js creates shares using sharedPostId and currently warns that shares disappear if the source post is removed. Change the backend reference model as needed so **Remove from here** does not unintentionally kill surviving shares. Prefer a canonical, owner-bound video asset ID separate from per-destination publication IDs. Delete everywhere requires server-enforced authorization, idempotent cascade, durable revoked state, signed URL and client cache invalidation, and shared-asset storage-reference safety. Privacy/audience restrictions still apply.

Dailies auto-expire exactly 24h after publication; **expiration is not Delete everywhere** and must not erase persistent Roll/Mix/profile shares. All normal videos stay until the user explicitly deletes or otherwise changes privacy, account deletion or necessary moderation/legal removal. Show a truthful confirmation including affected DANZSTAK shares if counts are available. Full implementation/test plan: [Issue #40](https://github.com/Danzstak/Danzstak-web/issues/40). Physical mobile + two-account verification and owner approval required; instructions are not deployment evidence.


## Final platform-wide content ownership and share-withdrawal rule (2026-11-04)

**Owner directive:** Users retain ownership of their legitimately original DANZSTAK posts/content. They must be able to withdraw **any original content they posted**, not only uploaded videos, throughout the first-party service including members' reshares.

- Provide authenticated **Remove from here** (a single original publication/placement) and **Delete everywhere** (all first-party placements plus all reshares referencing that original content) for eligible **text posts, photos, videos, and other published original media/event posts**. If the user created a separate original comment, offer legitimate controls for that comment without deleting unrelated third-party thread content. Private chat "delete for everyone" needs its own explicit scope and cannot promise to erase already copied/read content.
- Original deletion must revoke text/image/video content and attached media/preview safely and persistently across The Mix, profile surfaces, The Roll, current Dailies, shares in other users' Mix/Tribes, notifications/deep links and accessible media endpoints. Prevent leaking original text in quotes/previews/caches. Preserve others' independently authored captions/comments when appropriate with a content-unavailable placeholder; don't delete other members' independent content without their consent/appropriate policy grounds.
- Use owner-authorized canonical source-content identity (plus independently owned share/comment IDs), explicit confirmation for platform-wide withdrawal, cache/signed URL revocation, persistence tests, crossposting/deletion reference accounting, auditability and honest limitations for external downloads/screenshots/reuploads. Resharers can remove their own share but not global-delete someone else's original.
- Dailies expire at 24 hours; regular Mix/Roll/profile items have no automatic lifetime. Automatic Daily expiry is **not** creator-requested Delete everywhere and must not revoke persistent copies of the same asset. Subject to law, abuse controls and ownership of underlying rights. Full tests: [Issue #40](https://github.com/Danzstak/Danzstak-web/issues/40).

**This supersedes earlier video-only scope language; implementation and genuine mobile/two-account testing are required.**


## Final reshare placeholder UX — deleted original leaves a small gap (2026-11-04)

When a creator chooses **Delete everywhere** for original text, photo or video, every other user's DANZSTAK reshare of that content **loses the original itself**, but the location of the reshare can remain as a **small original-removed placeholder** instead of silently erasing another person's independently written caption. Recommended neutral copy: **“Original content removed by its creator.”** This is the owner's intended *“hole where they shared content that wasn't theirs.”*

- Preserve separately authored text by resharers when permitted. **Never display the deleted original's words, image, video, poster frame, quoted preview, audio, metadata, or old playable link** inside the hole. No enormous empty player or broken thumbnail. The resharer may remove their own leftover shared card.
- The creator's global deletion must be enforced through API/share graph/media authorization/CDN/cache revocation, not only a local UI replacement. Media-only Roll/creator/Dailies playlists should drop the dead video instead of pausing on a gap.
- If the original is merely unavailable to one viewer (privacy, block, network, moderation), use an accurate privacy-safe **Content unavailable** placeholder without falsely announcing creator deletion.
- **Remove from here** by the creator leaves other shares authorized and working; the small original-removed placeholder is specifically for global deletion. The person sharing somebody else's work cannot use Delete everywhere on that work.
- This does not promise erasure of externally downloaded copies or separate independently reuploaded media. See [cross-content deletion Issue #40](https://github.com/Danzstak/Danzstak-web/issues/40).
