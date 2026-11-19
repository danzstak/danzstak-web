# 00B — PWA publish-and-review workflow

## Owner requirement
DANZSTAK is mobile-first. After each page passes its checks, publish it to a phone-accessible PWA review environment so the owner can inspect the real implementation on a phone. **Do not silently push unapproved changes to production.**

## Required sequence per page
1. Read latest instructions from `codex-instructions`, inspect existing app and deployment pipeline.
2. Implement in a separate branch and open a PR referencing the page specification and issue.
3. Run unit/integration tests, build, and browser/mobile checks. Fix failures before presenting.
4. Deploy the tested commit to an existing **staging/preview PWA** URL where possible, and share its exact URL and commit SHA. If no preview environment exists, propose a safe preview deployment configuration first; do not invent URLs or assume a successful deployment.
5. Verify on a real phone or mobile browser that installability, navigation, touch controls, media, authentication and PWA cache updates work. If real-device verification is unavailable, disclose it.
6. Present screenshots, a concise changelog, known defects, and the preview URL for owner review.
7. Wait for the owner's explicit design approval. Revise and redeploy preview as needed.
8. Only after approval and successful production checks, deploy through the existing authorized production workflow to `https://danzstak.com` if that remains the verified production URL. Do not change domains, DNS, infrastructure or billing without authorization.
9. Verify production deployment, rollback path, and that PWA service workers/caches serve the new build; report deployed commit and URL.

## Release gates
- Never claim “published” unless the deployment job and live URL have been verified.
- Keep working production features intact; support rollback.
- No fake demo accounts or seeded sample posts in production without explicit owner approval; label any demo content clearly.
- Publish page-by-page rather than bundling unreviewed redesigns.
