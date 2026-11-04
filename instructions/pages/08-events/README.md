# Events — Mobile-first page contract

**Status:** Specification scaffold; not implemented, tested, or approved by this document.

## Required functions
Event listing, details, RSVP, location and sharing.

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


## Owner directive: Add Event with media, publish to The Mix (2026-11-04)

**The Mix is the existing DANZSTAK main social feed** (see \`feed.html\`, titled "Your Mix"). The owner requires a seamless one-account flow:

1. Member taps **Add Event**. Open a comfortable mobile-first event composer: event title, start date/time and IANA timezone, city/public venue or place, description, audience/privacy settings, and flyer/video input.
2. Member may **upload a flyer** (JPG, PNG or WEBP) and/or **upload a short promotional video**. A supported external video link can be an additional option, **not a silent replacement for the requested upload capability**. Include thumbnail/preview, replace, remove, size/type warnings, retries and upload progress. Never post a failed/pending upload as successful.
3. Member reviews and taps **Add to Mix** (publish event). Create a durable event object and **one linked event-type post in The Mix**, visible only to its intended audience. Do not create duplicate feed posts on retries. The event must also be accessible through Events where permissions allow. Use server-side authorization, ownership, idempotency and consistent transactional semantics; design for failure recovery.
4. The Mix card shows the flyer or a click-to-play video thumbnail, event title, local-time-aware date/time, public venue/city and a clear event-detail link. Reuse existing like/comment/share UI; RSVP/Make Plans integration only where implemented and validated. No fabricated responses or attendee counts.
5. The event creator can edit, update media or cancel/delete; feed card and event detail stay in sync, with revoked/removed media removed from public storage. Access respects event visibility and account blocks. Public promotion is opt-in, not an unavoidable publication of private events.
6. Video/audio playback **never auto-starts with sound**. For direct uploads, research explicit short duration/byte limit, transcoding, storage/CDN lifecycle, malware/mime checks, content moderation, privacy/access control, bandwidth and costs. If native video upload is not yet feasible, ship **flyer upload + an honest external-video-link option** first, and keep a separate owner-gated follow-on for direct upload rather than pretending it works.
7. Standard event creation and posting are **free**. Do not put paid promotion, featured placement, Stripe or separate account signup in the basic publish flow.

**Implementation gates:** Audit existing actual Events/feed backend and client code before coding; instruction scaffold is not a live feature. Isolated implementation PR with real API persistence and integration, end-to-end two-user tests for create/view/edit/cancel, private audience authorization, upload failure/retry, safe video/audio, timezones, mobile 320–430px, PWA cache, full social regressions, 15 languages, before/after screenshots, phone-accessible staging URL and owner approval before deployment. Do not report done from a spec or screenshot.


## Owner requirement: event posted-by attribution (2026-11-04)

**Every event published into The Mix must clearly show who posted it, as a normal social post does.**

- In **The Mix event card header** show the authenticated publisher's profile avatar (if provided), their chosen DANZSTAK **display name**, a safe link to their profile when the audience can view it, and an accurate **"Posted by [display name] · [relative or localized publishing time]"** context. Avoid duplicating the name clumsily; e.g. render a normal post header like "**Alex Rivera** · Posted 2 hours ago". Do not display private legal names, emails, phone numbers or authentication identifiers.
- Also show **"Posted by [display name]"** on the event detail page, with publish timestamp if useful. If **organizer/venue differs from the person who submitted the listing**, label them separately (e.g. **"Organizer: Club…"** vs **"Posted by: Alex…"**) and **do not falsely imply the poster is the organizer or verified representative**.
- Attribution is **derived from the server-authenticated account**, not supplied as an arbitrary author ID from the client. Protect against spoofing/impersonation, unauthorized edits and viewing blocked/private profiles. Resolve display-name changes consistently and support closed/deleted account fallbacks without leaking historical PII.
- Store \`createdByUserId\`, \`createdAt\` and \`updatedAt\` (or reuse existing canonical fields) for both the event and linked feed post; these are distinct from **event start date/time**. If edited, show optional "Edited" metadata without changing who originally posted the event.
- Respect event audience visibility and profile privacy. Never expose private invitation participants through the byline. Ensure accessible text, translation, safe truncation, mobile wrapping at 320–430px and real two-user testing for attribution, edits, profile links and deleted accounts.

**Acceptance:** After member A publishes a flyer/video event, account B sees an event card in **The Mix** identifying **A as the poster and when it was published**, and the event detail displays the same accurate attribution. No unverified identities may be forged through direct API requests.
