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
