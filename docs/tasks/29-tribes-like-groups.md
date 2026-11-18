# 29: Tribes work like Facebook Groups (owner, 2026-11-18)

The owner wants Tribes to work like Facebook Groups and shared a "Facebook Groups module" brief from Google's AI. **Use its business rules, not its stack.** The brief assumes Express + Socket.io + a SQL/Mongo backend. DanzStak runs on AWS Lambda behind API Gateway with DynamoDB, and the Tribes backend already exists in the `DANZSTAK-Call-Signaling` stack (`GROUPS_TABLE`, `POST /groups/membership`) and `assets/feed-enhancements.js` (Tribe directory and Tribe page). Extend what exists; do not add Express or a socket server.

Names: Group = **Tribe**, ADMIN = **Elder**, MODERATOR = **Moderator**, approved members = **The Crew**.

Read first: `CLAUDE.md` ("Plan (Claude, 2026-11-18 night)" step 8), `infrastructure/call-signaling/template.yaml` (Tribes code and tables), `assets/feed-enhancements.js` (`renderGroups`, `openTribe`), `assets/tribes-polish.css`, `docs/tasks/18-fix-it.md`.

## Rules (from the owner's brief, adapted)
- **Privacy:** a Tribe is `public` (anyone signed in can read its posts) or `private` (only approved members can read posts; others see the cover, name, About, rules and member count).
- **Membership states:** not a member → `pending` (private Tribes, waiting for an Elder or Moderator) → `approved`, or `banned`. Joining a public Tribe approves at once.
- **Roles:**
  - **Elder:** settings, rules, cover, roles.
  - **Moderator:** approves or rejects join requests and pending posts, pins posts, deletes posts, mutes or bans.
  - **Member:** posts, comments, reacts, votes in polls.
  - The creator becomes Elder automatically.
- **Feed:** pinned/featured posts first, then **newest first**. No algorithmic ranking, finite pages, and it ends with "You're caught up" (CLAUDE.md rule).
- **Post approval:** optional per Tribe (`requirePostApproval`). When it's on, a regular member's post waits as `pending` until a Moderator or Elder approves it.
- **Anonymous posts:** optional per Tribe (Elder setting, off by default). The real author is stored for moderation, and the API shows "Anonymous member" with no avatar to everyone except Elders and Moderators.
- **Posts:** text, photos and video (DanzStak rules: never audio files; music is links or embeds only). Polls with up to 6 options, one vote per member, and the vote can be changed.
- **Reactions:** reuse DanzStak's existing reaction set and component (one reaction per member per post; tap the same one again to remove it).
- **Comments:** 2 levels (comment + replies), with the existing comment component (2 shown, "+N" folds the rest).
- **Live updates:** no Socket.io. While a Tribe is open, poll it lightly (the same pattern as SYNC and notifications, paused when the tab is hidden) so new posts, reactions, votes and comments appear without a reload. A WebSocket upgrade is a later, owner-approved infrastructure change.

## Data (DynamoDB, in the existing Tribes tables or new tables in the same stack)
- **Tribe:** id, name, description, coverImage, privacy, requirePostApproval, allowAnonymous, rules [{title, description}], createdById, createdAt.
- **TribeMember:** tribeId, userId, role (elder | moderator | member), status (pending | approved | banned), joinedAt.
- **TribePost:** tribeId, postId, authorId, content, mediaKeys[], isPinned, isAnonymous, status (published | pending), poll {question, options[{id, text}]}, createdAt. Store votes as their own items (one per member) so counts stay correct.
- **Reactions and comments:** reuse the existing post reaction and comment storage when possible; otherwise add item types keyed by postId with parentCommentId for replies.

## API (under the existing API Gateway; follow the current route style)
- `POST /groups` creates a Tribe (creator = Elder, approved). `GET /groups/{id}` returns the Tribe, its rules, the Crew count and my status and role.
- `POST /groups/membership` already exists for join and leave. Extend it: joining a private Tribe creates a pending request.
- `GET /groups/{id}/members` lists approved members. Elders and Moderators also see pending requests.
- `PATCH /groups/{id}/members/{userId}` approves, rejects, promotes or demotes a Moderator, bans or unbans (Elders and Moderators; only Elders change roles).
- `GET /groups/{id}/posts` returns published posts: pinned first, then newest, paginated, with reaction counts, my reaction, 2-level comments and anonymous masking.
- `POST /groups/{id}/posts`, `PATCH …/posts/{postId}/pin`, `PATCH …/posts/{postId}/approve`, `DELETE …/posts/{postId}` (author, Moderator or Elder; **Delete everywhere** rules apply).
- `POST …/posts/{postId}/vote` and comment/reaction routes (reuse the existing ones where they fit).
- Every route checks access on the server: read needs a public Tribe or approved membership; writing needs approved membership; moderation needs the Moderator or Elder role. Banned members can't read private Tribes or post anywhere.

## Screens (phone first, 320–430px, familiar Facebook Groups layout, DanzStak look)
- **Directory:** cards with the Tribe picture (or centred initial), name, "Public · N in The Crew" with small member photos, and Join / Joined / Requested.
- **Tribe page:**
  - full-width cover (Elders: change cover), name, Public/Private · N members, row of small member photos;
  - **Join / Invite / ⋮**;
  - tabs **Discussion · Featured · Members · Events · Media · About**.
- **Discussion:** "Write something…" composer (photo/video, poll, anonymous toggle when allowed), pinned posts with a pin label, then the chronological feed using the standard post component and the full-screen viewer (5a1).
- **Members:** Elders and Moderators first, then The Crew. For Elders and Moderators: a pending requests row with Approve / Decline and a ⋮ per member (make Moderator, remove, ban).
- **Events:** the Tribe's shows, in-stores and listening parties.
- **Media:** a grid that opens the 5a1 viewer.
- **About:** description, privacy, rules, created date, Elders.
- **Pending posts** queue for Moderators when post approval is on.

## Build order (one PR each; the backend is deployed by the owner's session)
1. Frontend: Tribe page layout and tabs on the existing data, with the Members tab built on current membership.
2. Backend: privacy, pending/approved/banned, roles, member management routes.
3. Feed: pinned first, post approval, anonymous posts, polls.
4. Live polling and the Media/Events tabs.

## Tests
- Server-side permission tests for every route (public vs private, pending, banned, member vs Moderator vs Elder).
- Anonymous masking for members, real author for Moderators.
- Pinned-first ordering, one vote per member, one reaction per member.
- Browser checks at 320/360/390/430px with screenshots.
