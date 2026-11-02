# Issue #1 validation

This change is intentionally **not deployed**. It must be reviewed before the established AWS deployment workflow is run.

## Automated checks

Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File .\test-regressions.ps1
```

Result on 2026-11-02: all regression checks passed, including the site smoke tests and the embedded infrastructure/Lambda syntax checks.

Focused checks:

```powershell
node test-record-stores.cjs
node test-booking-discovery.cjs
node test-epk-builder.cjs
node test-booking-contact-sheet.cjs
node test-message-media.cjs
```

All passed.

## Manual checks completed

- Desktop EPK editor: two-column edit/preview layout, private draft controls, file manager, and public-link controls render without visible overflow.
- Desktop Booking Agent: the natural-language club finder appears before the advanced route planner; advanced controls are collapsed by default.
- A fresh in-app browser pass at 390 × 844 verified Booking Agent, Record Stores, and EPK without horizontal overflow; primary actions remained readable and advanced booking controls remained collapsed. The repository's static viewport, touch-target, navigation, EPK, and booking tests also pass. A physical-device pass is still required before deployment.

## Live provider test

Run only with an authenticated AWS CLI session:

```powershell
node test-live-discovery.mjs
```

The venue matrix covers the required searches: Seattle punk/hardcore, San Francisco rock/alternative, Los Angeles live music, Bologna all live music, Berlin techno/punk/rock, Paris jazz/blues, and London independent venues. A separate worldwide record-store matrix covers Bologna, Berlin, London, Tokyo, Seattle, and Momo. The test rejects out-of-radius results, requires source attribution and coordinates, and fails when a requested search has no validated results. Actual post-fix counts must be recorded in the pull request after authentication; no counts are fabricated here.

The OpenStreetMap Overpass public endpoint was unavailable from the development machine during validation. The application reports provider status separately and continues with AWS Places when one provider is unavailable. This fallback still needs validation from the deployed Lambda network before production approval.

## Known limits

- Uploaded images are resized to a maximum 2400-pixel edge and JPEG-optimized in the browser. PDF files are not transformed.
- Files are owner-scoped, MIME/size checked against S3 metadata, quota-limited, private by default, and removed from S3 when deleted from a saved EPK. A malware-scanning service is not provisioned in this pull request.
- YouTube, Vimeo, and Spotify have constrained embeds. Other approved HTTPS media links remain safe external links.
- The public EPK uses the static-host-compatible `epk.html?id=<artist-slug>` URL rather than a server rewrite.
