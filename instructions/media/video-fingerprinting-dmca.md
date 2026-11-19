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

## Owner direction — quarantine reported videos and posts
- When a credible copyright complaint is received, immediately restrict the reported item from public feeds, profiles, search, Dailies, Rough Cuts, shares, embeds and public URLs while it is triaged. Do not treat an unverified report as a final infringement finding.
- For preliminary review, keep the item visible in the uploader's **private content-management dashboard**, with a clear status, complaint details as legally appropriate, and appeal/review controls. Playback may be allowed only where legally appropriate and access-controlled; do not promise the uploader continued playback in every case.
- For a legally sufficient DMCA takedown notice, promptly remove or disable access to the allegedly infringing material in accordance with applicable law. An uploader-only playable copy is **not automatically sufficient**. The uploader may retain a nonplayable record/metadata and appropriate counter-notification path.
- Implement server-side restrictions on original and derived media, signed URLs, CDN caches, thumbnails and API endpoints; hiding a UI card alone is inadequate.
- Notify uploader, record audit trail and decisions, support counter-notice and lawful restoration procedures, and apply repeat-infringer policy. Prevent arbitrary third-party reports from permanently removing content without review.
- Test all states: public -> reported/private review -> valid notice/disabled -> restored or removed, including direct URLs, mobile clients, cached video and unauthorized viewers.

## Owner concern — malicious and retaliatory reports
- Separate **community reports** (spam, harassment, impersonation, etc.) from **formal copyright/DMCA notices**. A community report must not be presented as a valid copyright takedown request.
- Do not automatically remove ordinary reported content based solely on report count or coordinated mass reporting. Use evidence-based triage, rate limits, duplicate-report aggregation, reviewer audit logs, proportional interventions and appeal mechanisms.
- For copyright claims, validate required notice elements and route legally sufficient notices for prompt statutory handling. Never delay a sufficient DMCA notice solely because a complainant has low reputation or previously made poor reports.
- Use anti-abuse controls for repeated demonstrably bad-faith community reports; avoid punishing good-faith reporters or chilling legitimate complaints. Escalate suspected fraudulent DMCA submissions for appropriate review, noting 17 U.S.C. §512(f) misrepresentation provisions.
- Protect privacy: do not disclose reporter identities unnecessarily; explain to uploaders the category of action, applicable policy and review/appeal options.
- Add tests for coordinated false reports, duplicate reports, malicious rivals, legitimate high-volume reports, formal notices and counter-notifications. Ensure report count alone cannot trigger a copyright strike.
