# Reviews plan

Status: **PLAN ONLY — owner approval required before implementation**  
Owner decision: 2026-11-07  
Boundary: no code, deployment, AWS, Stripe, credential, or production-data changes are authorized by this plan.

## Outcome

Any member—fan, press, crew, or artist—can publish one review of a specific show or release. The review appears chronologically in **NEWS → Reviews** and **MIX**, links back to the artist's gig or release, notifies the artist, and can become an attributed Press quote in the artist's EPK only after the reviewer permits that use. Artists may reply and report, but cannot delete another member's review.

Music remains an HTTPS link or authorized embed. DanzStak never uploads or hosts audio. Release cover art must come from an artist-authorized upload or a source allowed by `instructions/00e-no-music-hosting.md`—never copied from search results or an unlicensed catalog.

## Existing work to build on

- `codex/issue-55-news-redesign` provides a responsive News workspace, topic tabs, translated controls, recovery states, and mobile/desktop browser checks. Reviews should add a first-party Reviews section beside **News for You**, not mix member reviews into third-party headline results.
- Current posts, comments/replies, reports, notifications, internal sharing, owner-scoped media, and chronological feed rendering should be reused where their access rules fit.
- Tour/Gigs and EPK releases remain the source of truth for review targets. Reviews must not create duplicate shows or releases.
- Creator deletion must follow the 2026-11-07 rule: **Remove from here** removes one placement; **Delete everywhere**, available only to the review author, removes the review and all of its DanzStak shares with no placeholder. External screenshots/downloads cannot be recalled.

Do not merge the News branch wholesale. Rebase or port its reviewed News workspace first, resolve its current base drift, and keep the Reviews work isolated.

## Data model and authorization

`Review`

- `reviewId`, `authorUserId`, `artistUserId`
- `targetType`: `show` or `release`
- `targetId`: canonical artist-owned gig/release ID
- `body`, optional rating only if the owner later approves ratings
- `media`: at most two image asset references and one video asset reference
- `createdAt`, `updatedAt`, moderation state, audience, deletion state
- uniqueness key: `(authorUserId, targetType, targetId)`; enforce with a conditional server-side write

`ReviewEpkQuote`

- `reviewId`, `artistUserId`, exact approved excerpt, reviewer credit, approval timestamp, revoke timestamp
- reviewer must explicitly approve the exact quote and attribution before it appears in Press
- editing or deleting the source review invalidates/revokes the quote until re-approved

`ReviewReply` can reuse the comment/reply model but may be written only by the reviewed artist/team and the review author. Ordinary discussion stays in comments. Reporting uses the existing moderation pipeline; payment, gifts, undisclosed compensation, review trading, bot/fake reviews, and reviewing one's own show/release are prohibited.

Server checks every target exists, belongs to the named artist, is visible to the reviewer, and has not already been reviewed by that member. Artists and moderators may hide a review only through ordinary report/moderation policy with an audit reason; artist ownership alone is not deletion authority.

## Media contract

Each review may contain **no more than one video and two images**.

- Video maximum: **5:00** actual duration. A 5:01 video is rejected with: “Review videos must be 5 minutes or shorter.”
- Validate count, MIME signature/container, decodable video track, absence of audio-only/disguised-audio content, duration, size, dimensions, and ownership on the server before committing the review.
- Do not trust filename, extension, browser MIME, or client-reported duration. Reuse the approved server-side probe/transcode boundary; fail closed if duration/type cannot be established.
- Apply existing rights affirmation, DMCA/repeat-infringer policy, download deterrence/default controls, signed-media access, malware checks, and storage quotas.
- Images receive the same ownership, type, dimension, metadata/privacy, derivative, and deletion controls as post images.
- Uploads remain staged until the review write succeeds; rejected/abandoned staging objects expire and are purged.

The composer prevents obvious over-limit selection for convenience, but server enforcement is authoritative.

## Surfaces

### NEWS

- Add a **Reviews** tab beside **News for You** using the News workspace patterns from `codex/issue-55-news-redesign`.
- Default is newest first. Filters: All, Shows, Releases, and artists the member follows. No ranking, trending score, paid placement, or hidden engagement ordering.
- Each card shows reviewer credit, artist, show date/venue or release title/date, excerpt, approved media, and a direct target link.

### MIX

- Render a review as a typed chronological post using the same canonical `reviewId`, not a copied snapshot.
- Like/comment/share may reuse post interactions, but share is a revocable reference. Delete everywhere removes every review/share placement completely.

### Tour/Gigs and releases

- The show/release page lists its reviews chronologically and offers **Write a review** when eligible.
- One review per person per target. Reopening the composer edits the existing review rather than creating another.

### EPK Press

- Notify the artist of a new review with privacy-safe copy.
- **Request quote permission** lets the artist select an excerpt; the reviewer sees the exact quote, credit, EPK destination, and Approve/Decline controls.
- Approval adds the quote to Press with reviewer name and review link. The artist cannot alter approved words. Revocation or Delete everywhere removes the EPK quote.

## Delivery phases

| Phase | Work | Likely files | Effort |
| --- | --- | --- | --- |
| 0 | Rebase/port News workspace and confirm first-party Reviews boundary | `feed.html`, News assets/tests from `codex/issue-55-news-redesign` | 1–2 days |
| 1 | Review model, target/uniqueness/auth APIs, report rules | `infrastructure/auth-api/index.mjs`, template/table definitions, focused API tests | 3–5 days |
| 2 | Review composer, show/release links, chronological NEWS and MIX cards | `assets/feed-enhancements.*`, Tour/EPK release UI, i18n, service-worker versions | 4–6 days |
| 3 | Server-verified media pipeline: 1 video/2 images, 5-minute limit | media probe/storage handlers, upload UI, media tests | 4–6 days |
| 4 | Artist notification, replies, quote permission, EPK Press linkage | notifications, EPK APIs/UI, moderation tests | 4–6 days |
| 5 | Accessibility, real-browser visual matrix, abuse/security regression | browser checks, review workflow tests, release evidence | 2–4 days |

Ship one phase per reviewed PR. No production deployment without the permanent functional, visual, integration, and post-deployment quality gates.

## Required tests

### Identity, target, and moderation

- fan, press, crew, and artist accounts can review a visible target; reviewer cannot impersonate another member
- show review resolves to the exact gig; release review resolves to the exact release/artist
- one review per member per show/release under concurrent requests; edit keeps the same ID
- artist can reply/report but cannot delete or alter another member's review
- reviewer can Remove from here and, as original creator, Delete everywhere; a resharer can remove only their own share
- Delete everywhere removes original, NEWS/MIX/target/EPK placements, shares, notifications, search, media URLs and caches with no placeholder
- report, moderation audit, blocks, privacy and two-account isolation

### Media

- one real video plus two real images is accepted
- a third image is rejected server-side
- a second video is rejected server-side
- exactly 5:00 is accepted; 5:01 is rejected with the clear duration message
- audio-only and disguised-audio files are rejected
- forged MIME/client duration, corrupt container, oversized file, abandoned staging upload, DMCA removal, signed URL expiry and Delete everywhere purge

### News, Mix, EPK, and accessibility

- newest-first chronological ordering with no engagement reranking
- same canonical review appears consistently in NEWS, MIX, target page and approved EPK quote
- quote requires exact reviewer approval/credit and disappears on revoke/edit/delete
- notifications are deduplicated and do not leak private review text on lock screens
- keyboard/screen-reader workflow, 44px targets, contrast, reduced motion, and no overflow at 320, 360, 390, 414, 430, 768 and 1366px
- sparse/text-only, two-image, video, long localized copy and provider-failure states

## Risks and decisions before code

1. Confirm whether reviews have star/numeric ratings; this plan defaults to prose only to avoid score gaming.
2. Approve exact video byte/dimension limits in addition to the fixed one-video, two-image, five-minute limits.
3. Define who may represent an artist/team when replying or requesting an EPK quote.
4. Obtain moderation/legal review for defamation, undisclosed compensation, conflicts of interest and takedown appeals.
5. Decide whether past shows without an existing canonical gig may be added by the artist first; reviewers must never invent target records.

