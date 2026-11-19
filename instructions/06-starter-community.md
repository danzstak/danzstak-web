# 06 — Removable starter community (25 demo accounts)

## Product goal
Avoid blank pages during development and early demonstrations. Populate the social experience with a diverse, believable *sample* community while transparently distinguishing sample content from real users. Do not fabricate real membership, engagement metrics, testimonials or booking contacts.

## Seed dataset
Create exactly **25 fictional demo accounts**:
- 10 everyday users (travel, art, pets, photography, daily life, local culture)
- 5 musicians/bands (varied genres)
- 4 DJs/producers (varied genres)
- 3 collectors/music fans
- 3 venue/record-store demonstration profiles

Use invented names, original/licensed imagery or neutral avatars, unique bios, interests and cover images. Do not impersonate real people, businesses or verified organizations. No fake blue verification badges.

Create **75–100 varied sample posts** across accounts, including photo posts, ordinary text updates, externally hosted media links, record discussions and sample events. Include a modest number of contextual comments and replies, not uniform engagement counts. Never imply sample interactions were performed by real users. All external links must be valid and safe or clearly non-clickable sample placeholders.

## Visibility and transparency
- All seeded profiles and posts must be visibly marked **Demo** or **Sample**.
- Keep demo account counts and activity separate from actual registered users and real engagement analytics.
- Demo accounts must not send real messages, email, SMS, friend requests or booking outreach to real users.
- Do not expose fabricated booking contact details as real leads.
- Demo content must not be indexed as genuine user-generated content.

## Technical requirements
- Inspect the current auth, data model, feeds and permissions before implementation.
- Use an idempotent, auditable seed script; avoid embedding demo content as permanent production defaults.
- Add a single admin-only removal mechanism that deletes demo profiles and their dependent sample content without touching real user data.
- Tag all demo records with an immutable, explicit demo marker and seed batch identifier; prevent regular user edits from turning them into unmarked real accounts.
- Use development/staging first. Do not seed production without explicit owner approval.
- Preserve external-video hosting architecture.
- Do not create 25 real billable phone numbers or external identities.

## Acceptance
- Exactly 25 tagged demo profiles, 75–100 tagged posts, mixed comments/replies.
- Home Feed, profiles, search, friends and events render representative content without blank states.
- Responsive mobile and desktop screenshots; sample badges visible.
- Rerunning seed does not duplicate records.
- Admin removal deletes only demo batch content and does not affect real data.
- Tests document seed, visibility, analytics exclusion, and rollback behavior.

## Deliverables
Implementation PR, changed files, screenshots, test results, costs, staging proof and explicit production approval request.

## Latest owner direction — preserve SFScoop and seed 24 accounts (supersedes earlier 25-demo-account target)
- **Preserve all existing SFScoop posts** in DANZSTAK. Do not delete, rewrite, hide, or relabel them as fictional demo content without explicit owner approval.
- Add **exactly 24 new fictional, removable demo accounts**, each with representative posts and profiles. The owner's intended total is 25 presences **counting the existing SFScoop presence as one**; verify that such a presence actually exists before reporting the total as 25.
- Do not create an additional fake SFScoop account or duplicate existing SFScoop content. Do not require SFScoop authentication or API dependencies.
- Adjust the sample post count to be natural for 24 accounts; do not overwrite real posts to meet a numeric target.
- Clearly distinguish fictional demo accounts from genuine accounts. Preserve all real engagement and real-user statistics; demo metrics must be excluded.
- Seed and removal scripts must target **only the 24 newly created demo accounts and their tagged content**, never SFScoop or other existing content.
- Inspect the actual database before implementation and report what SFScoop records already exist. Stage first; request owner approval before seeding production.
