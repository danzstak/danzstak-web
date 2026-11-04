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
