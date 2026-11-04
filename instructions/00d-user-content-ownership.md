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
