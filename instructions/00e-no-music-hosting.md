# Non-negotiable architecture — DANZSTAK never hosts music

## Owner directive
**DANZSTAK will NEVER host music.** This is a platform-wide rule, not merely a launch-phase preference.

- Do not build audio-file upload, music-file storage, first-party audio streaming, transcoding, music CDN, distribution or music catalog hosting.
- Music discovery and listening experiences may use **authorized external embeds and links** (Spotify, SoundCloud, YouTube and other supported services), respecting provider terms and playback restrictions.
- A DANZSTAK-styled player must control an authorized third-party embed/API where supported; never imply audio is served by DANZSTAK or invent playback capabilities unavailable from the provider.
- No uploading copyrighted recordings or album art to DANZSTAK. Artist pages, posts, profiles, EPK, featured-music modules and Tour Manager may store metadata/links and permitted imagery, not music audio files.
- Preserve the independent DANZSTAK application; no SFScoop infrastructure dependency.
- Ensure at most one active audible source across external players, feed videos, Dailies and Rough Cuts; respect browser autoplay policies.
- Any previous instruction or visual mockup suggesting first-party music hosting is superseded by this rule.
- Codex must audit new features for violations and document which external service actually provides playback.

## Acceptance
Verify no music upload route, audio object storage or first-party streaming path is introduced. Test external playback, provider fallback, pause on navigation and audio isolation. Report any conflicting requirements rather than implementing hosting.

## Video posting and DMCA compliance — owner confirmation
- Users may post videos, including videos with embedded sound/music, subject to applicable rights and moderation rules. **Audio-only uploads remain prohibited** (FLAC, MP3, WAV, AIFF, AAC, OGG and equivalent).
- Establish a DMCA notice-and-takedown process, designated-agent/contact requirements where applicable, repeat-infringer policy, user notification, counter-notification handling, recordkeeping and timely action on sufficiently valid notices. Refer legal details for qualified review; do not automatically treat an allegation as adjudicated infringement.
- Do not assume the owner's confirmation authorizes new first-party video storage or upload infrastructure. Preserve the existing external-video embed/link approach until the owner explicitly approves a hosting change.
- Codex should document current video posting behavior and propose any needed changes separately, with costs and copyright/security implications, before implementation.

## Latest owner decision — DANZSTAK hosts user-uploaded videos
- **Direct first-party video uploads are approved as a product requirement**, including recordings from phones (concerts, festivals, clubs, travel, daily life) and other user-owned video sources. This supersedes earlier external-embed-only assumptions for video, **not** the permanent ban on audio-only music files.
- Permit supported video containers such as MP4/MOV with embedded audio, subject to security validation, format and size limits, content rights and moderation. Do not allow disguised audio-only files; verify actual media streams server-side.
- Preserve support for externally embedded videos alongside native uploads.
- Plan mobile-first resumable uploads, upload progress, private staging/quarantine, malware/format validation, transcoding to streaming-friendly variants, thumbnails, access controls, moderation/fingerprinting review, CDN delivery, safe deletion and storage lifecycle.
- Integrate proposed audio/video fingerprinting with a documented rights-review process; matches are not conclusive infringement and no-match is not proof of permission. A user filming a concert does not automatically own the music or performance rights.
- Estimate AWS storage, processing, bandwidth, CDN and fingerprint vendor costs before enabling public uploads. Do not provision paid services, deploy hosting infrastructure or expose uploads in production without explicit owner approval of costs and implementation plan.
- Require a legal-reviewable DMCA policy and agent-registration process; do not claim safe harbor automatically.
