# Video copyright fingerprinting and DMCA compliance — design proposal

## Owner request
Investigate screening **user-uploaded video files** with audio/video digital fingerprinting before publication, to detect potential copyrighted reference matches and support a responsible DMCA compliance program. Audio-only music uploads remain prohibited.

## Legal constraints
- Fingerprinting is **not** a prerequisite for, or guarantee of, 17 U.S.C. § 512 safe-harbor eligibility. Do not write Terms claiming automatic immunity.
- Legal review required for DMCA agent registration, notice-and-takedown, counter-notification, repeat-infringer policy, standard technical measures and other applicable § 512 conditions.
- A fingerprint match is **not proof of infringement**; non-match is not proof of authorization. Accommodate licenses, original performances, and lawful uses including fair use.
- DMCA compliance applies to actual user-hosted material; externally embedded media and links require a distinct provider-specific handling approach.

## Engineering discovery before implementation
1. Audit existing video architecture. Do not silently introduce first-party video hosting/storage.
2. Compare feasible fingerprint vendors/APIs: reference catalog coverage, audio-in-video recognition, visual matching, rights-holder metadata, appeal support, false positives, latency, retention, regional coverage, cost and contractual limitations.
3. Propose upload pipeline: authenticated upload -> private quarantine -> file validation/malware scan -> fingerprinting -> no-match / possible-match review / restricted -> publish only when cleared under documented policy.
4. Define rights-claim and human-review workflow, user notification, appeal, repeat-infringer tracking, retention/deletion, privacy and audit logs.
5. Specify failure behavior for scanner outage and reference database gaps; never claim complete coverage.
6. Estimate storage, bandwidth, scanning and moderation costs, with a safe rollback plan.
7. Draft **legal-review checklist**, not final Terms of Service legal conclusions.

## Release gate
This is a **research/design task only** until the owner approves first-party video upload architecture, vendor, cost and policy. No production deployment, billing, or user-media upload change without approval.
