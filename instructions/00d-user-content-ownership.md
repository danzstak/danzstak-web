# 00D — User content ownership and control (platform-wide principle)

## Product commitment
**Users retain ownership of the original content they create and control how their DANZSTAK content is published, shared, exported and deleted.** Do not claim ownership of third-party material simply because a user shared or imported it. Any hosting license required for operating the service must be transparent and appropriately limited; legal terms require review.

## Functional requirements
1. Users can create, edit and delete their own posts, photos, comments and supported content.
2. Privacy settings: Public, Friends, Only Me, with server-enforced permissions and sensible defaults.
3. Users can bulk-manage and delete their own content, including imported posts, with preview, accurate counts and confirmation.
4. Provide user-controlled data export in a portable, documented format, with original uploads where permitted and available.
5. Import flows require user selection and preview, including missing-content warnings and rights-aware treatment of third-party shares.
6. Feed preferences and visibility controls must be understandable and not silently overridden.
7. Distinguish deletion from public visibility removal; explain backup retention, legal holds, shared copies, and other legitimate technical limits rather than promising impossible instant universal erasure.
8. Enforce authorization on the server; never let one user edit, export or delete another user's private content.
9. Keep demo content separate from genuine user-owned data and statistics.
10. Avoid silent repurposing of user content for advertising or third-party licensing; any optional use must be clearly disclosed and appropriately authorized.

## Verification
Test create/edit/privacy/delete/export/import flows on mobile and desktop; verify unauthorized access is denied, bulk operations do not touch unrelated users or SFScoop content, and exports accurately represent stored user content. Submit PR, screenshots, tests, PWA preview and owner review before production deployment.

## Owner-approved per-content Do Not Share control
- Add a **Do Not Share** switch to the post composer and Edit Post for user-created text posts, photographs, externally embedded videos and other supported creator content. It is independent of visibility (Public/Friends/Only Me).
- When enabled, authorized viewers may still view the content on the creator's profile/feed according to its visibility, but other DANZSTAK users must not be able to use built-in **Share**, **Repost**, **Embed** or forwarding actions to redistribute that post. Hide/disable those controls with an explanatory label; enforce the restriction in backend APIs, not just the UI.
- Preserve this setting on imported posts where applicable and through edits; respect it in all feed, profile, search, notification and sharing entry points. Never allow an API bypass to create a repost of a restricted item.
- Provide a clear author-facing indicator and accessible explanation. Authors may change the setting later; changing it cannot recall copies legitimately shared before the restriction was enabled, so disclose that limit.
- Avoid claiming screenshots, screen recording, manual copying or external-site sharing can be fully prevented. Do not promise technical DRM that is not implemented.
- Verify Public + Do Not Share, Friends + Do Not Share, private content, author edits, direct-link access, API rejection and mobile UI. Do not block the author from editing or deleting their own content.

## Latest owner requirement — Protected Content: no sharing, downloading or search indexing
- Extend **Do Not Share** to a clearly named **Protected Content** mode for creator-owned posts, photos and supported externally embedded videos. Offer distinct controls for **Allow sharing**, **Allow downloading** (where DANZSTAK controls the media), and **Allow search engine indexing**; the protected preset disables all three.
- When protected, hide/disable DANZSTAK share, repost, embed, save and download actions for viewers and enforce authorization and no-download behavior on first-party backend endpoints. Authors retain editing, deletion and authorized export/download of their own content.
- For first-party media, do not expose a publicly reusable original-file URL or unrestricted download endpoint. Use authenticated, access-controlled delivery and short-lived URLs where practical; apply appropriate cache and indexing restrictions. Review CDN and cache exposure. A viewable asset cannot be made technically impossible to capture or copy, so avoid false DRM guarantees.
- Set noindex/nosnippet and appropriate robots directives for protected post pages and media where applicable, omit protected URLs from sitemaps, and avoid public indexing metadata. Search engines may have cached earlier public content; directives are requests, not guaranteed immediate removal. For private/friends-only content, require authentication and enforce server-side visibility rather than relying on robots directives.
- For externally hosted videos, DANZSTAK cannot revoke downloads, sharing or indexing allowed by YouTube/Facebook/etc.; explain this limitation in the UI and link to provider controls. Do not promise protection that DANZSTAK cannot enforce.
- Test viewer/owner permissions, share/repost API rejection, download endpoints, signed URLs, indexing metadata, direct links, browser/mobile UI and content already cached before protection was enabled.

## Owner requirement — persistent original-creator attribution on permitted shares
- For any DANZSTAK-native post/photo/video shared through the platform with creator permission, display a prominent but unobtrusive **“Shared from [Original Creator]”** attribution above the shared content. The name links to the original creator profile or original post when audience permissions allow.
- Preserve original creator ID and original post ID as immutable provenance fields in the share/repost data model. Never derive ownership from the most recent sharer or allow client-supplied display text to override provenance.
- On multi-hop shares, always credit the **original creator**, not just the immediately preceding sharer. The current sharer can be shown separately (e.g. “Alex shared this · Shared from Joe Schmo”).
- For image/video cards, optionally add a subtle on-screen attribution tag/watermark on rendered display copies; do not modify the original creator's stored master media. Do not imply that a CSS overlay survives screenshots or external downloads.
- Respect the original creator's **Do Not Share / Protected Content** controls at the time of sharing; deny unauthorized repost requests server-side. Re-evaluate visibility and deletion on reads so shared wrappers do not expose restricted or removed originals.
- For imported third-party media or external embeds, do not falsely assert that the DANZSTAK user who shared a link is the original copyright owner; use accurate source attribution where known.
- Test original shares, re-shares of shares, renamed profiles, deleted originals, privacy changes, protected content, and unauthorized API attempts on mobile/desktop.
