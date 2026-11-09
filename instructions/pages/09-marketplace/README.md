# Marketplace — Mobile-first page contract

**Status:** Shop and Bazaar catalog foundation implemented and tested on review branches; checkout, seller payout and production approval remain incomplete.

## Required functions
Fixed-price physical merchandise listings (no bidding), product image galleries and item specifics, DanzStak Official Store, a DanzStak Bazaar that mixes available member-shop listings while linking to their canonical shops, and a safe checkout/payout plan. The seller sets shipping separately; DanzStak's 5% applies only to the item price, with server-side rejection of disproportionate shipping.

## Visual design
Follow `instructions/00c-design-direction-80-20.md`: familiar social-network interaction patterns, distinct DANZSTAK branding, light mode only. Produce mobile mockup first, then tablet and desktop. Link actual screenshots and approved visual assets here before final implementation signoff.

## Acceptance gate
- Inspect existing implementation and preserve working behavior.
- Test at 360px and 390px mobile and at desktop; no horizontal overflow, inaccessible controls or keyboard overlap.
- Verify each listed function, authentication and permissions, persistence and error states as relevant.
- Submit implementation PR, changed files, screenshots, test matrix, deployment SHA and phone-accessible PWA preview URL.
- Owner approves preview before production release; never claim completed from build success alone.

## Tracking
- Design: pending review
- Codex implementation: catalog and Bazaar verified; commerce incomplete
- Functional testing: catalog, item detail and fee-avoidance validation verified; commerce incomplete
- PWA preview: not verified
- Owner approval: pending
