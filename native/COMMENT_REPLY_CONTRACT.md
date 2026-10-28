# Native discussion replies: proposed PC/native contract

The PC owns website/backend integration; this change does not deploy backend code. The native client must not silently submit a reply as a top-level comment.

- `GET /engagement?postId=…` returns `commentRepliesSupported: true` only after replies are supported and persisted by POST and returned by GET. Missing/false keeps native reply submission disabled while top-level comments continue working.
- Each comment keeps the existing `commentId`, `authorName`, `authorPicture`, `content`, and `createdAt`. Replies additionally return `parentCommentId`; `replyToName` may be returned as a fallback when a parent is unavailable.
- `POST /comments` keeps `{postId, content}` for a new top-level comment. A reply adds `parentCommentId` and does not trust a client-supplied recipient name/email. Validate that the parent belongs to the same accessible post, exists, and is eligible for replies. Preserve existing comment-policy and authorization checks.
- The POST response's `comment` acknowledges the stored `parentCommentId`. Keep parent relationships immutable, and reject unsupported or invalid parents rather than treating them as new comments.
- Replies to replies use the immediate parent ID. The native UI caps visual indentation, not the stored relationship. A removed/missing parent must not attach its replies to an unrelated comment; return a tombstone or keep enough context to label an unavailable parent.
- Existing comments remain valid root comments. All comment bodies retain the current 1–1000 UTF-16-unit limit. Reply notification behavior should respect existing privacy, mute settings, and self-notification rules.

This is a proposed boundary pending the PC's final implementation. If the PC chooses another schema, update the native models/tests to that contract before enabling live replies. Demo replies are local fixtures only.
