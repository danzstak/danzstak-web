# 15 — Import Facebook Data

## Owner requirement
The **last item** in the DANZSTAK navigation menu must be **Import Facebook Data**, on mobile and desktop. Keep it last even when menu items are reordered or additional features are added. Show a recognizable import/download icon, not Facebook's proprietary branding.

## User journey
1. Open menu and tap **Import Facebook Data**.
2. Explain how to request and download a personal Facebook information export using Meta's official tools.
3. User uploads their own export file (ZIP or supported JSON/HTML archive). Never request a Facebook password, session cookie, or scrape private accounts.
4. Inspect the archive safely and show a preview of importable categories and counts.
5. Allow explicit selection of supported categories, with clear notices for unsupported formats and items.
6. Require confirmation before writing anything to the DANZSTAK account. Provide progress, errors, retry and deduplication.
7. Show a completion summary, with an option to remove imported items where feasible.

## Data and privacy
- Import only data the user is authorized to upload, into their own account.
- Start with own profile details, posts and photos when the export actually contains usable data. Do not silently recreate Facebook friends as DANZSTAK accounts, or import third-party private messages without a separate privacy/security review.
- Preserve original dates where supported and clearly identify imported content.
- Treat archives as untrusted: validate file type/size, reject traversal paths and executable content, protect against decompression bombs, sanitize HTML, and avoid unsafe external URLs.
- Process uploads securely with limited retention and a deletion policy. Do not promise full compatibility with every Facebook export version.
- Keep this independent of SFScoop and avoid new hosting costs without review.

## Acceptance
- Import Facebook Data is visibly the bottom-most menu item on phone and desktop.
- Upload/preview/select/confirm/error/retry tested with representative user-owned exports or synthetic test fixtures.
- No writes occur before consent; duplicate imports do not duplicate content.
- Unauthorized imports and malicious archives rejected.
- Mobile 360/390px screenshots, PR, test evidence and PWA preview before owner approval.

## Owner update — two entry points and built-in instructions
- Provide **Import Facebook Data** in exactly two primary locations: (1) the **bottom-most item** of the main navigation menu and (2) a clearly labeled action within **Edit Profile**. Both must open the **same** import workflow; do not implement two divergent import systems.
- Show step-by-step, user-facing guidance before upload: open Facebook's settings/Accounts Center, find the **Download your information** flow, choose the Facebook profile and available data categories, request/download the export, then return to DANZSTAK to upload the downloaded archive. Meta's UI labels can change, so link to official current help rather than hard-coding a fragile click path as guaranteed.
- Include help for locating downloaded ZIP files on Android, iPhone and desktop, plus supported formats, size limits, privacy and processing explanation, and what will/won't import.
- Offer a clear **How to export from Facebook** guide, **Choose file**, **Preview**, and **Import selected** steps, with progress and errors.
- Verify both entry points at 360/390px mobile and desktop, plus navigation/back behavior and accessible labels.

## Owner update — selective import, batch privacy and rights-aware shared content
Context: Existing SFScoop posts imported from Facebook required tedious per-post privacy changes. Avoid that workflow for future users. Do **not** modify existing SFScoop posts or their visibility without separate approval.

### Preview and selection
- Parse the export into a **preview-only** staging state; do not publish or persist imported posts to the public feed before explicit confirmation.
- Show selectable posts with date, type, text/media thumbnail when available, and source/origin indicators. Provide individual checkboxes, select all eligible, deselect all, and date-range filters.
- Clearly distinguish user-authored originals, reshares/reposts, and uncertain ownership. Shared third-party content must not be automatically rehosted or presented as user-owned. Where lawful and technically supported, offer a link/reference to the original instead, or skip with explanation.
- Explain that a Facebook export may not include every post, media file or permission needed for re-publication.

### Privacy defaults and batch controls
- Before final import, offer a **batch visibility selector**: **Public**, **Friends**, **Only Me**. Apply the chosen visibility to all selected posts, with optional per-post overrides.
- For safety, start with **Only Me** selected until the user explicitly chooses otherwise. Make **Public** easy to select but never silently expose a whole archive.
- Provide a final confirmation showing selected item count, visibility choice and any skipped/linked-only items. Preserve a clear audit trail of the user's selection and consent.
- Avoid per-post privacy editing as the only way to make a batch public; users must be able to choose once for the batch.

### Testing
- Test mixed originals/reshares, bulk selection, date filters, privacy batch changes, per-post overrides, duplicate imports, empty selection, permission failures, and undo/delete where supported.
- Verify public/friends/private visibility through backend authorization, not just client-side labels.
- Ensure no imported posts appear publicly before user confirmation.

## Large Facebook archives — required scalability
- Design for archives containing **thousands to tens of thousands of posts** and substantial photo collections. Never render every record at once on mobile.
- Use server-side or worker-backed parsing where appropriate, paginated/virtualized previews, filters by year/date/type/original-versus-reshare, and selection across all matching results (not merely the visible page).
- Allow users to select all eligible originals, a date range, a category, or individual items. Show accurate selection counts and estimated storage impact before confirmation.
- Import in bounded, idempotent batches with persisted job status, retry/resume/cancel, partial-failure reporting, and safe rollback/removal of imported items. Avoid request timeouts and repeated uploads where feasible.
- Provide mobile-friendly progress showing processed/imported/skipped/failed counts; do not require the phone screen to remain open for the entire import.
- Enforce upload limits, archive validation, quotas and cost controls; explain unsupported media and link-only reshares.
- Verify privacy rules for every batch, with explicit user confirmation and safe Only Me initial selection. Never auto-publish on partial failure.
- Test with synthetic archives at 100, 1,000, 10,000 and 50,000 entries, including large media, malformed data, cancellation, resume and deduplication. Report real measured performance rather than invented throughput.

## Required upfront user notice — third-party shares and ownership
Before upload/confirmation, prominently explain in plain language: **“Your Facebook archive may include posts, photos or videos shared from other people. DANZSTAK will not automatically copy or rehost third-party images or videos. These items may be skipped or shown as links to the original source when available. Review what will transfer before importing.”**
- Do not imply that possession of an export proves copyright ownership. Classify likely originals, reshares and uncertain-origin content conservatively; provide review when uncertain.
- In the preview and completion summary show **Eligible originals**, **Link-only shares**, **Skipped third-party content**, and **Uncertain / needs review** counts with reasons.
- Require acknowledgement of this notice before final import; no silent copying of third-party media.
- Users can import their own authored text where appropriate; apply copyright and privacy rules to embedded media separately.
- Verify the notice on Android/iPhone and desktop, including large archives and JSON/HTML exports.

## Strict default for repost-heavy accounts
- Do **not** import Facebook reshares/reposts of other people's images or videos as DANZSTAK-hosted posts/media by default. This includes memes and third-party content even if included in the export archive.
- Do not equate archive inclusion or past Facebook visibility with ownership or permission to republish. Metadata is imperfect: when provenance is uncertain, mark **Needs review** and exclude from automatic import rather than guessing ownership.
- Show a pre-import summary with **total entries**, **eligible original posts**, **third-party shares excluded**, **link-only items available**, and **items needing review**. Example counts in UX mockups must be labeled illustrative, never treated as real user data.
- If a user has mostly shared third-party content, clearly explain why their imported DANZSTAK feed may contain substantially fewer posts.
- Allow an original-source link/reference only when supported and permitted, without copying third-party media; otherwise skip it. Do not imply all reposts are categorically illegal—rights and permissions can vary—but maintain conservative default import behavior.
- Never silently import an excluded third-party item, and never count it as successfully imported.

## Facebook JSON reality — captions and share references are not media files
- Do not assume that Facebook JSON exports include the image/video associated with a reshared post. Exports may contain the account holder's **own accompanying words**, timestamps, URLs or references without the third-party media bytes.
- Inspect the actual supported Facebook JSON/HTML export structures and bundled media paths before writing import logic. Support format variation gracefully and document tested versions.
- Preserve user-authored commentary where present and permitted, even if the original shared media is absent; label it as **Imported commentary on a Facebook share** when appropriate.
- Do not fabricate media, scrape it from Facebook, generate broken players, or assume a share reference grants republishing rights.
- When a valid original-source URL is present, offer a clearly labeled source link if permitted; otherwise show text only or skip an empty record.
- Preview counts must distinguish **commentary-only imports**, **original media included in archive**, **external references**, and **skipped missing/third-party media**.
- Test fixtures must cover: commentary plus absent shared video, commentary plus URL, pure share with no commentary, own original media with included file, and malformed references.

## Mandatory incomplete-post review and user decision
- During preview, detect when an exported Facebook post references a photo, video, attachment or metadata that is **not available in the archive or not safely importable**. Do not infer missing content solely because a post lacks media; only flag a missing asset when evidence indicates it was expected.
- Show a clear **Incomplete post** indicator and list the missing elements (e.g. “Video unavailable”, “Image missing”, “Original link unavailable”, “Date or attribution missing”). Distinguish unavailable data from unverified metadata.
- For each incomplete item, ask: **“This post is missing a video/image/other information. Do you want to import the available content anyway?”**
- Offer **Import text only**, **Skip this post**, and **Review details** where applicable. Do not create broken media placeholders or empty cards.
- For large archives, support a bulk policy for incomplete posts: **Skip all incomplete**, **Import available text only**, or **Review individually**. Default to **Review individually** or hold incomplete posts out of final import until an explicit decision; never silently publish them.
- Preview and final confirmation must show counts for complete posts, incomplete posts accepted, skipped posts, and missing media/metadata. Apply the chosen privacy setting to imported text-only posts.
- Preserve available user-authored captions and valid source links where permitted. Never fabricate missing files or download third-party content without permission.
- Test missing image, missing video, missing attribution/date, missing link, pure share with no usable content, and mixed large-archive cases, including mobile usability.

## Owner requirement — faithful visual migration preview and missing-attachment decisions
The importer's central promise is **no surprises after import**. Users accustomed to their Facebook profile must see how each exported item will actually render on DANZSTAK, including any lost media, article previews, external embeds or metadata.

### Two-sided preview
- Where the archive contains sufficient source information, show **Facebook export contents** versus **DANZSTAK result preview**. Clearly label the left/source view as a reconstruction from the export, **not a live screenshot or complete original Facebook post**.
- If source material is insufficient to reconstruct the original, show a structured list of known fields and missing references instead of inventing an original image/card.
- Render the actual DANZSTAK post card on the right, using the same rendering logic as the feed, with no fabricated media.
- On mobile, use stacked views or an accessible toggle instead of cramped side-by-side columns.

### Missing content categories
- Missing **video**: ask whether to import the caption/text without video.
- Missing **photo/image**: ask whether to import text without photo.
- Missing **news article/link preview**: explain whether the source URL exists, whether a link-only post is possible, and whether preview metadata (headline, thumbnail, excerpt) is absent. Do not scrape or synthesize missing article content as if originally present.
- Missing **other attachment, event metadata, attribution or timestamp**: identify the specific missing field when verifiable; avoid claiming it is missing if it was never present in the source.
- For an empty reshare with no user-authored text or usable link, recommend **Skip** rather than creating a blank post.

### Decision controls
For each flagged item: **Import available content**, **Skip post**, **Review details**. If a valid source URL is available, optionally **Import as link**. Show exactly which parts will appear on DANZSTAK.
For large archives offer bulk policies by missing-content category (e.g. import text-only captions, skip missing-video shares, review missing-article posts). No silent import of incomplete posts.

### Acceptance
Test export fixtures with video references but no video file, shared images absent, news article URL without preview metadata, unavailable source URL, missing attribution, and complete originals. Confirm post preview visually matches the resulting feed card and that counts/selection/privacy remain correct after refresh and resume.

## Critical product goal — avoid disappointing post-import profiles
Before any imported posts are published, provide a **Preview My DANZSTAK Profile** step using the actual selected/importable data and the real DANZSTAK profile/feed renderer. Do not use a fabricated Facebook-like preview that hides missing media.
- Show clear counts: **Complete posts**, **Text-only/incomplete posts**, **Link-only posts**, **Skipped posts**, and **Missing media/previews**. Explain in plain language that a Facebook export may omit shared images, videos and news previews.
- Let users switch between **Show all selected**, **Show complete posts only**, **Review incomplete posts**, and **Keep incomplete posts private**. The preview must update as choices change.
- Provide a visible comparison of the expected new profile appearance with the current existing DANZSTAK profile, without altering any existing posts.
- Offer **Back to selection**, **Change privacy**, and **Confirm import**. No public publishing without explicit final confirmation.
- On large archives, use paginated/virtualized previews and an accurate representative sample; do not falsely claim to have visually rendered all thousands of posts at once.
- Ensure no empty media placeholders or broken article cards remain in the resulting profile; show source links only when valid and permitted.
- Test that the final imported profile visually matches the preview, including missing-media handling, privacy, chronological order and partial failures.

## Owner requirement — large-scale batch cleanup and deletion
Users may have tens of thousands of posts from decades of Facebook use. Many reshares can become meaningless caption-only entries such as “WTF” when source media or article previews are unavailable. Never force one-by-one deletion.

### Before import
- Add **Bulk Cleanup** to import preview: filter **Missing image**, **Missing video**, **Missing article/link preview**, **Commentary-only reshares**, **Short captions with missing context**, **Empty/unusable**, and date ranges.
- Allow **Select all matching** across all pages of results (not just currently visible rows), with an accurate count and exclusions. Offer **Exclude selected from import**; this must not delete the user's Facebook originals or other DANZSTAK posts.
- Provide a safe suggested filter for low-context captions, but do not automatically discard meaningful short posts solely due to word count. Let users review examples before bulk exclusion.

### After import — own posts only
- Provide **Manage Posts → Bulk Cleanup** in the user's DANZSTAK profile management.
- Support the same filters, bulk selection, select-all-matching, preview and **Delete selected** with explicit confirmation showing the number of posts and irreversible/retention implications.
- Require server-side ownership authorization for every affected record; no ability to delete another user's content, existing SFScoop posts, or unrelated real accounts.
- Prefer a recoverable trash/undo window where technically feasible, with an explicit retention policy and permanent-delete option. Avoid false promises of recovery.
- Process large deletes as resumable, auditable background jobs with progress, partial-failure reporting, rate limits and idempotency; preserve unaffected posts, attachments and interactions.
- Ensure selected counts remain correct when filters change or new posts arrive; avoid accidentally selecting newly created posts outside the reviewed set.

### Acceptance
- Synthetic tests at 100, 1,000, 10,000 and 50,000 posts; filter and delete only targeted items.
- Verify zero unauthorized deletions, no deletion of SFScoop/existing unrelated content, correct counts, interruption/retry behavior and mobile UI.
- Before/after PWA screenshots, test report and owner approval before production deployment.
