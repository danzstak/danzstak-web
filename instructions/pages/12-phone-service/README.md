# Phone Service — Mobile-first page contract

**Status:** Specification scaffold; not implemented, tested, or approved by this document.

## Required functions
DANZSTAK-only numbers, billing eligibility, calls and consent; no unapproved provisioning.

## DS number scope

- A DS number is a **DanzStak SYNC-only identity**, formatted `DS-123-1234`.
- It works only inside SYNC on DanzStak and can be shared by the member's registered devices.
- It is not a mobile, landline or carrier telephone number. It cannot make or receive regular telephone calls, SMS/MMS or emergency calls.
- Present this limitation before purchase, during assignment and in the confirmation sent to the member's SYNC chat. Never label a DS number as general phone service.

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
- Codex implementation: not verified
- Functional testing: not verified
- PWA preview: not verified
- Owner approval: pending
