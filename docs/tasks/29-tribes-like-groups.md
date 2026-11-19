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

### Members create Tribes; the category is picked inside "create" (owner 2026-11-18, correction)
"Users need to create a Tribe first and name it what they want … when users start to make a group they can select a category for their group, not the other way around."
- **Remove the built-in category Tribes** (Bands, DJs & Producers, Events, Fans, Industry…) from the directory. They are categories, not Tribes.
- **+ Create Tribe** flow, one screen:
  1. **name** (required, the member's own words);
  2. **category** picker (Bands, DJs & Producers, Promoters & Events, Fans, Industry & Crew, Record shops, Radio, Local scene…);
  3. city (optional);
  4. Public / Private;
  5. cover picture (optional);
  6. description and rules (optional);
  7. **Create**.
  The creator becomes the Elder.
- Categories are only a **filter in Discover** and a label on each Tribe card. A category never appears as a Tribe of its own.
- With no Tribes yet, the empty state is one line ("No Tribes yet. Start one for your scene.") and **+ Create Tribe**.

### Creating a Tribe, step by step (owner 2026-11-18, modelled on Facebook's group creation)
**1. Core setup (one screen, from + in the Tribes top bar or "+ Create Tribe")**
- **Name** (required). A live preview card of the Tribe (cover, name, privacy, category) updates as the member types; on phones the preview sits above the form.
- **Category** (Bands, DJs & Producers, Promoters & Events, Fans, Industry & Crew, Record shops, Radio, Local scene…) and **city** (optional).
- **Privacy:** **Public** (anyone can see members and posts) or **Private** (only members can see members and posts).
- **Private only — visibility:** **Visible** (anyone can find it in search and ask to join) or **Hidden** (only members and invited people can find it).
- Privacy can go from Public to Private any time. Going from Private to Public is locked, to protect members' trust: Elders see "Private Tribes can't become public".
- **Invite friends** (optional): pick from your friends before creating.
- **Create.**

**2. Provisioning.** The server creates the Tribe, makes the creator its **Elder** (approved), sends the invites, and opens the new Tribe's Discussion tab.

**3. "Finish setting up your Tribe" checklist** (Elders only, at the top of Discussion, with a progress bar; each card disappears when done; the whole list can be dismissed):
- **Invite people:** friends, or copy and share an invite link or QR. These use the share sheet; phone numbers are never used.
- **Add a cover:** upload a photo, or pick one of DanzStak's genre covers (punk, metal, electronic, house). These are DanzStak's own art, never stock or third-party images.
- **Add a description:** what the Tribe is for.
- **Write a welcome post:** opens the composer with a prompt, so the first visitors don't land on an empty feed.

**4. Elder tools (Tribe ⋮ → Settings)**
- **Rules:** pick from templates ("Be kind and courteous", "No hate speech or bullying", "No spam or self-promotion without asking", "Respect the scene and the crews", "No selling bootlegs or copied music") or write your own; up to 10 rules.
- **Join questions:** up to 3 (multiple choice, checkboxes or written), shown to people asking to join a private Tribe. Answers are visible to Elders and Moderators only and are deleted when the request is decided.
- **Elder assist (optional, off by default):** simple rules, such as auto-approving join requests from friends of members or from accounts older than N days, or holding posts with links from new members for approval. These are plain rules the Elder sets; there is no algorithmic scoring.
- **Post approval**, anonymous posts on/off, and roles (Moderators) as above.

### Tribes home (owner 2026-11-18 screenshot of Facebook Groups: "Groups should look like this")
- **Top bar:** ← back, title **Tribes**, then three icons: **+** (create a Tribe), **search**, and **⋮** (with an unread badge for Tribe activity).
- **Tabs (pills):** **For you · Your Tribes · Your activity · Discover**.
- **For you:**
  - section **"Your Tribes"** with **See all**: rows of a rounded-square Tribe picture (or its centred initial), the Tribe name, and a second line:
    - "Elder · 203 members" when you run it, or
    - "25+ new posts ●" when there are unread posts (orange dot);
  - a **pin** icon on each row (pinned Tribes stay on top; you pin them yourself; no ranking).
  - Below that, **"Latest from your Tribes"**: a **chronological** feed of posts from the Tribes you joined. Each post shows the Tribe picture with the author's small photo overlapping it, the Tribe name, role badges (Elder / Moderator), "author · 4d · audience", ⋯ and ✕ (hide this post), then the standard post body and full-width media. **No "Recommended" algorithm** (CLAUDE.md rule): Discover lists Tribes by city/genre and newest, never ranked.
- **Your Tribes:** all joined Tribes (pinned first, then by name), with the same rows.
- **Your activity:** your posts and comments in Tribes, and your pending join requests.
- **Discover:** search plus filters by city and genre (punk, metal, electronic first), and cards with Join.

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
