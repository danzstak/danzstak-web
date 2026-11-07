# Make Plans — real-world connections MVP

**Owner direction (2026-11-04):** DANZSTAK is a professional, familiar social network for everyone, with music in its DNA and an independent punk-rock philosophy. Electronics and AI should make it easier for people to connect **outside the app**, not just produce more scrolling, impressions or stream counts.

**Status:** Product specification / Codex assignment only. Not an implementation, test result, deployment or owner approval.

## Product promise

In fewer than a few taps, members who already know each other on DANZSTAK can turn a Chat conversation into a private plan to meet, see a show, rehearse, visit a public venue, or do something together. Everyday use is **free**; no DANZSTAK phone number, Stripe entitlement, paid tier, or musical profile is required.

The user experience must be familiar to people migrating from mainstream social networks. Adopt `instructions/00c-design-direction-80-20.md`: familiar light-mode social UX with restrained DANZSTAK brand identity. Avoid feature clutter and intrusive attention mechanics.

## Phase 0: implementation audit (required before coding)

- Read this document, `instructions/pages/03-friends/README.md`, `instructions/pages/04-chat/README.md`, `instructions/pages/08-events/README.md`, `instructions/pages/10-notifications/pwa-push.md`, and mobile/PWA release guidance.
- Inspect actual current frontend, backend routes, relationship authorization, notification/push architecture, time storage and any existing Events persistence. The Events page scaffold is **not** proof that Events are implemented.
- List reusable components/API routes, unknowns, cost/security considerations and the smallest feasible isolated implementation plan. Do not duplicate existing event/invitation models or break live messaging.

## Phase 1: one narrow shippable MVP

1. **Entry point:** a visible, accessible `Make plans` action from an active one-to-one Chat (plus Friends if it fits existing layout), without displacing ordinary Chat, calls, profiles or navigation. Keep the action intelligible at 320/360/390/414px.
2. **Invite composer:** title or short purpose, proposed local date/time with timezone, optional public meeting place and optional note. Store canonical time and IANA timezone; show recipient-local time correctly, especially daylight-saving boundaries. Never request GPS by default.
3. **Recipients:** choose one or a small bounded number of *existing, mutually accepted* friends; server must verify each relationship and respect blocks/account privacy. Do not enable unsolicited invitations from strangers, mass sends, automatic messages or external-contact imports.
4. **Invitation state:** server-owned pending / going / maybe / declined / cancelled / changed states. Inviter can edit or cancel; invitee can respond; all parties see accurate updated state from Chat/invitation detail. Show clear loading, retry, duplicate and offline states. Keep an audit-friendly state transition design, revision checks, and idempotent creation/responses.
5. **Notifications:** in-app Buzz and, only where existing opted-in push is verified functional, an optional PWA alert/deep link. Do not promise or display push delivery status without provider evidence. Respect mute/quiet hours, permission denial and blocked contacts.
6. **Calendar portability:** after accepting, offer a downloadable `.ics` invitation (or equivalent standards-based calendar add). Do not silently create third-party calendar events or require a connector. Sanitize ICS text and verify timezone/date handling.
7. **Privacy and safety:** invitations private by default, visible only to validated participants. No public home/work addresses, exact location discovery, live location sharing, attendance tracking, social graph harvesting, or auto-posting plans to the feed. Offer cancel/decline/block/report routes, bounded invites/rate limits and abuse handling. Design for minors/age-dependent safety constraints before introducing any public nearby-person matching.
8. **Keep it free:** no paywall, tokens, Stripe, AI-generated invitations or external phone identity required. No production data migration without a recovery plan.
9. **No false success:** an RSVP is **not evidence that people met**; do not market unverified IRL outcomes as measured conversions.

## Next phase (NOT in MVP)

- Opt-in **public** Events pages, venue / event discovery, trusted local meetups, invitations from event detail screens, group activities and reusable interest discovery; requires separate privacy/moderation design.
- Musicians: convert venue search into a booking inquiry, convert *confirmed* shows into public events with band/venue permission, optionally invite friends, and discover nearby record stores along a tour. No inferred booking confirmation or automatic outreach.
- Consider AI to draft friendly plans or summarize logistics only after core workflow works; no algorithmic matchmaking or private-message analysis by default.

## Acceptance and QA matrix

- Two distinct test accounts A/B: A creates -> B receives -> B accepts/maybes/declines -> both reload and see durable accurate state; A edits/cancels, recipient state updates.
- Unauthorized C cannot read, enumerate, create-for or modify A/B invites by direct APIs; blocked users and unfriended recipients cannot receive new invitations. Test ownership, scope, ID guessing, XSS, CSRF as relevant, malformed input, rate limits, retries, concurrent edits and duplicate posts.
- Test local times across Europe/Rome and US timezones; daylight-saving changes and all-day/late-night edge cases. ICS must represent correct meeting time without leaking private attendees.
- Test offline/reconnect, background/resume, push opt-in/out, deep link, permission denial, revoked or blocked friendship, cancelled event and stale PWA caches.
- Full regression suite: feed persistence, Friends, Chat, notifications, calls, booking, EPK, media/audio isolation, privacy, PWA, Stripe existing Test Mode flows (must not regress).
- Visual/accessibility: phone widths 320, 360, 390, 414 and tablet/desktop; readable inputs, no keyboard occlusion, >=44px touch targets where applicable, localization across existing language system, screen-reader and keyboard support.
- Provide tested isolated PR, exact passed/failed test names, mobile screenshots, **verified phone-accessible staging PWA URL** with tested commit/version, known blockers and manual Android/iOS verification status. No merge/production deploy until owner approves.

## Measuring whether the product helps people connect

Instrument only privacy-respecting aggregate counts: invitations created, accepted, declined, cancelled and repeat voluntary usage. Don't track GPS or infer actual physical attendance. Optionally ask participants for voluntary post-event feedback in a later phase. Avoid reward systems designed to maximize in-app minutes.

## Codex deliverable

First produce an honest audit and minimal PR plan, then build Phase 1 in a separate implementation branch. Update `docs/DANZSTAK-DEVELOPMENT-REPORT.md` with implementation vs scaffolding clearly distinguished. Provide owner review evidence and link the PR to the GitHub issue. Never claim it works just because this instruction exists.
