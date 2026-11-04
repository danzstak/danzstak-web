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
