# MILESTONE 02 — Populate and polish after Home Feed + navigation

## Owner-approved sequence
**Do not begin this milestone until the signed-in Home Feed, featured external music experience, and main navigation have passed their tests and have a working mobile PWA preview.** Owner review of the preceding milestone is required before the final production release; avoid blocking safe staging work unnecessarily.

1. Preserve the existing public landing page without changes.
2. Preserve all existing SFScoop posts and genuine user content.
3. Add **24 fictional, clearly labeled, removable demo accounts** with varied, natural content. Do not fabricate a new SFScoop account. Verify the existing SFScoop presence before claiming a total of 25.
4. Distribute posts across ordinary users, bands, DJs, collectors, venues and record-store demos, including normal nonmusic daily-life posts. Seed only in staging until owner approves production.
5. Populate profile pages, feed cards, friends, comments and appropriate demo-only events; never send demo outreach or notifications to real users.
6. Polish the mobile-first visual presentation: 80% familiar social UX, 20% DANZSTAK branding, light mode only. Refine spacing, typography, profile avatars, card alignment, navigation affordances, media framing and loading/empty states.
7. Preserve Dailies (Scene 1 / Take N, real date, profile photo, 24h expiry), four posts followed by horizontal Rough Cuts, creator attribution tags, and video audio isolation.
8. The featured music is an authorized external embed/player only; DANZSTAK never hosts audio-only music files.

## Completion requirements
- Use a separate implementation branch and PR. Do not modify `codex-instructions`.
- Provide screenshots at 360px, 390px and desktop, test results, and verified staging PWA URL/commit SHA.
- Seed scripts must be idempotent and removable, with demo data excluded from real-user metrics.
- Verify no regressions in auth, feed persistence, navigation, videos or existing SFScoop posts.
- Owner reviews on phone before production publication. Never claim a page finished solely because code compiles.

Related specifications: `instructions/06-starter-community.md`, `instructions/00-mobile-first.md`, `instructions/00c-design-direction-80-20.md`, `instructions/milestones/01-mobile-home-feed.md`.
