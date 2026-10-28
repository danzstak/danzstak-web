# danzstak-web
Official DanzStak social networking and music platform website.

## Product boundary

DanzStak is an installable, responsive Progressive Web App for social
networking. It does not include blockchain, cryptocurrency, wallets, tokens,
or Web3 transactions. Those capabilities belong to the separate SFSCOOP
product and must not be introduced into DanzStak.
## Migration objective

The owner wants DanzStak to help users leave billionaire-owned social platforms. Data portability is a core product goal: users should be able to copy their own Facebook profile and content into DanzStak while keeping Facebook, or migrate and then close Facebook after verifying their imported data. Account closure must remain a separate user-controlled action on Facebook. The importer should preview supported content, preserve original dates where available, let the user batch-select an audience with Public as the initial choice, and prevent duplicate imports. Facebook connections, likes, and comments must not be represented as actions taken by real DanzStak members.

## Independence and sustainable operation

DanzStak answers to its users. Product and monetization work must preserve these operating constraints:

- never sell personal information or use it for cross-context behavioral advertising;
- do not pursue funding rounds that give outside investors control over the platform;
- keep ordinary social participation, friendship, and direct communication available without an attention-based paywall;
- earn revenue from optional tools that create direct value, such as professional EPK features, tour-management workflows, verified venue or record-store tools, supporter memberships, and clearly disclosed fees on transactions DanzStak actually facilitates;
- make pricing, notification controls, privacy controls, and cancellation understandable to ordinary users; and
- design storage, media delivery, lifecycle cleanup, abuse controls, and rate limits so infrastructure cost grows responsibly with legitimate use.

Growth must come from useful artist and community tools, not manipulative engagement loops. DanzStak should be rewarding to use while preserving user choice, quiet hours, chronological or user-controlled views, and the ability to leave.

### Platform independence

No core DanzStak feature may require a privileged API from a dominant social, streaming, mobile, or advertising platform. Accounts, profiles, posts, media, friends, Tribes, messages, calls, bookings, EPKs, moderation records, and user exports must remain operational if any external platform changes policy or withdraws access. External platforms may appear as optional HTTPS links or user-chosen export destinations, but their SDKs, identity graphs, recommendation feeds, and restricted catalog APIs must not become sources of truth. Prefer open web standards, user-provided links, documented portable formats, and DanzStak-controlled storage.

## Production runtime configuration

Run `./aws-configure-production.ps1` from an authenticated AWS shell to reapply the production-safe runtime settings used by the site:

- optional software-token MFA for existing users;
- credentialed CORS restricted to `https://danzstak.com`;
- GET, POST, PATCH, DELETE, and OPTIONS support;
- API throttling and detailed CloudWatch metrics.

Run `./aws-harden-cloudfront.ps1` from the same authenticated shell to harden the `danzstak.com` distribution. The script discovers the distribution by alias, preserves its current configuration, caps edge caching at five minutes so releases propagate reliably, invalidates the previous release, enforces TLS 1.2 as the compatibility floor, enables HTTP/2 and HTTP/3, and attaches AWS's managed `SecurityHeadersPolicy` for HSTS, `nosniff`, frame protection, and a strict referrer policy.

Run `./aws-publish-site.ps1` to verify the static application release. Production currently uses AWS Amplify Hosting and builds the `main` branch after a GitHub push. The publisher waits for the build matching the current Git commit and confirms the expected live service-worker version. It also supports a customer-managed CloudFront distribution with an owned S3 origin when one is configured; that path verifies ownership before uploading, applies bounded cache metadata, and invalidates CloudFront.

Run `./aws-deploy-production.ps1` for the complete production workflow. It verifies the active AWS identity, validates and deploys the `DANZSTAK-Call-Signaling` and `DANZSTAK-Engagement` stacks in `us-west-1`, deploys the version-controlled Auth API with least-privilege permissions, reapplies API CORS/throttling/MFA settings, hardens CloudFront, and publishes the static application.

The browser receives only the opaque `__Host-danzstak_session` cookie. Cognito tokens remain server-side and must not be added to local storage, session storage, URLs, or browser-readable cookies.

## Local verification

Run `./test-regressions.ps1` for the complete local regression check: the JavaScript behavior tests, release-verification tests, site checks, and infrastructure checks. It stops on the first failure. This command does not publish content or call live user accounts.

Run `node ./test-messaging-races.cjs` to check that delayed requests cannot mix conversations, erase another chat's draft, or re-enable its composer.

Run `powershell -ExecutionPolicy Bypass -File ./test-site.ps1` before publishing. It checks local page references, duplicate IDs, JavaScript syntax, removal of the retired test feed, and that the feed's inline application script is covered by its exact Content Security Policy hash.

Run `powershell -ExecutionPolicy Bypass -File ./test-infrastructure.ps1` before deploying the backend. It enforces the S3-backed CloudFormation template size limit, validates the embedded Lambda's JavaScript syntax, and checks messaging privacy, cross-device Reel safeguards, and required least-privilege DynamoDB actions.

After deployment, run `powershell -ExecutionPolicy Bypass -File ./test-live-security.ps1 -ExpectGroups -ExpectProfileVideo`. This verifies the public website security headers, the delivered feed script against its CSP hash, favicon and social-share assets, unauthenticated API rejection, the deployed Groups and profile-video routes, TLS 1.2 support, and rejection of TLS 1.1 or older.

## Media lifetime

Upload tickets from `POST /stories` accept `purpose: "post"` or `purpose: "profile"` for permanent `users/` storage. Omitting the purpose preserves the temporary `stories/` path and its expiration policy. Post and profile saves verify the authenticated owner's prefix. Story discard requests cannot delete permanent uploads.

Profile saves retain newly uploaded files when the save response is lost, since the database may already have committed them. Failure to delete an old profile image or video is logged without reporting the committed profile save as failed.

## Delivery phases

The current priority is stabilizing the existing DanzStak site: feed, profiles, friends, groups, privacy, media, and mobile use. Android background call ringing remains unverified. The duplicate-notification code path is fixed, with physical-phone confirmation parked until the owner resumes testing.

The owner confirmed this next-feature order after the current site stabilization pass:

1. A Facebook data import tool, launched from a button in Edit Profile. Start with the owner's Facebook data export: preview supported content, choose what to import, and detect duplicates before publishing anything to DanzStak. Existing DanzStak ownership, audience, and original-content requirements still apply. Importing a friend list must not create accepted DanzStak friendships automatically.
2. Email notification and mailbox delivery workflows. DanzStak now runs a dedicated Stalwart mailbox host at `inbox.danzstak.com`, with public SMTP delivery on 25, authenticated TLS submission on 465, IMAP over TLS on 993, and HTTPS account access on 443. There is no public SSH or plaintext client-authentication port. Amazon SES remains the restricted outbound relay. Keep mailbox administration on the existing protected path and never broaden the server role or relay permissions beyond verified DanzStak senders.
3. A geo-based tour-booking agent/module for bands to locate clubs and contact them about booking their act. The planned flow includes optional location permission or manual city entry, distance filters, venue profiles, multi-stop tour planning, proposed dates, travel distances, and per-venue booking-request status. Email delivery can support booking notifications after the email phase is complete.
4. An admin dashboard for site monitoring and management, including review of post and group reports.
5. Native Android Studio/Kotlin and Xcode/Swift apps as the final phase. The website is the requested distribution hub; direct Android APK distribution and Apple-eligible distribution routes must be evaluated before implementation. Native call integration belongs here, including reliable incoming voice/video ringing from push.

## Artist growth products

Two additional products are planned after the core social and Booking Agent
work is stable. They must share DanzStak's account, accessibility, privacy, and
security standards, but remain distinct experiences with their own data
boundaries.

### DanzStak EPK Builder

Artists will be able to create an electronic press kit from their DanzStak
profile without retyping public profile information. A kit must support an
artist photo and logo, short pitch, biography, hometown, genres, lineup,
notable shows, press quotes with sources, music and video links, stage and
technical information, booking contact, downloadable/printable output, and a
stable public link. Drafts remain private until the owner explicitly publishes
them. Owners can unpublish, update, or permanently delete a kit, and public
pages must never expose the account email unless the owner deliberately uses
it as the booking contact.

### recordstores.love

`recordstores.love` will be a worldwide map and directory of active physical
record shops. Discovery must support map-area search, city and distance search,
genres and store specialties, current-activity evidence, public website and
contact links, source attribution, deduplication, and store-submitted
corrections. The directory must distinguish record shops from general retail,
music venues, rehearsal rooms, and online-only sellers. Listings are
periodically re-verified and stale or closed shops are removed only with
evidence. The existing production domain must not be replaced until its new
implementation has passed functional, mobile, accessibility, security, and
data-quality verification.

## Database recovery protection

Durable DynamoDB tables in the social and engagement stacks enable point-in-time recovery. Call signals and online presence are intentionally excluded because they expire and must not be restored as current activity. The existing Posts table is managed outside those stacks; `./aws-configure-data-recovery.ps1` enables and verifies its recovery protection in the configured production account. The complete production deployment runs this step automatically. Enabling recovery does not restore or replace a table; any actual restore requires a separate recovery workflow.

Run `./test-live-data-recovery.ps1` after backend deployments to verify recovery is enabled for every durable DanzStak table. This check is read-only and does not perform a restore drill.

## Site readiness evidence and open checks

The October 26, 2026 stabilization pass covers the local regression suite, real RSA token-verification tests, session and signup-consent gates, group ownership/origin checks, delayed-response races, blocked/full browser storage, both infrastructure templates, and live API authentication/CORS/TLS checks. AWS guard checks cover database encryption and recovery, private media storage, encrypted objects, and HTTPS-only media access.

Browser smoke checks covered Friends, Groups, Photos, Videos, Events, Saved, Settings, profile posts, and profile media. The profile and Settings layout were checked at a 390-pixel phone viewport, and saving the existing account preferences was confirmed against the live API. Live search checks covered a known match, no results, and clearing the filter. The save/open/unsave workflow also passed, with the original bookmark state restored. A viewport test is not a physical Android device test.

A Posts recovery drill also passed: a point-in-time copy was restored into an isolated temporary table, the known saved post and all its attributes matched the source snapshot, and the temporary table was removed after verification. This is evidence for the Posts restore path, not a claim that every table has been restored together.

Signup now tolerates blocked/full browser storage after confirmed consent. Call polling no longer creates a second system notification, and expired or answered calls dismiss their stale popup. Answer handoffs carry a call identifier so an unrelated pending call cannot be auto-answered. The Messages screen clears ended and expired pending offers so they cannot block later calls.

Still open: the parked Android background-call ringing and duplicate-notification confirmation tests, and a fresh-account signup walkthrough. These must remain explicit rather than being counted as completed by mocked tests or by checking that recovery is enabled. The latest agreed next-feature order is Facebook import, email server, geo-based tour booking, then the admin dashboard.

Notification email architecture reference: [Amazon SES HTTPS security](https://docs.aws.amazon.com/ses/latest/dg/security-protocols.html) and [SES API endpoint port 443](https://docs.aws.amazon.com/ses/latest/dg/send-email-set-up-vpc-endpoints.html).

## October 26 UI and capacity follow-up

Rendered review found and corrected phone Edit Profile padding, Events form spacing, messaging composer placement, long contact-name overlap, app prompts inside embedded chats, and dark-mode navigation, group consent, post menus, and drawer controls. All seven feed workspaces fit the measured desktop grid without horizontal overflow. The browser viewport override initially stopped applying new dimensions; resetting the testing connection recovered it. The final phone pass verified all seven feed workspaces without horizontal overflow, corrected Edit Profile padding, embedded chat controls, and both legal page layouts. Tablet inspection identified overflowing top navigation and crowded Settings labels at 768 pixels; a two-row tablet header and container-based Settings rows address those findings. Settings now waits for account preferences before enabling edits and ignores stale responses after navigation.

One authorized physical Android call retry delivered a notification but did not ring, as confirmed by the owner. This remains unresolved. Do not mark continuous background ringing as passed.

Live API checking observed an intermittent 503; a direct retry returned the expected 401. CloudWatch showed zero Lambda execution errors but throttled invocations, and the regional account concurrency limit was only 10. AWS rejected an increase to 100 because its API requires a value above the standard 1,000 baseline. A request for 1,001 was submitted (request ID `03b40f639c3149e7a0844d27f00453d2zupH4jm0`), with status PENDING at submission. That is a requested limit, not applied capacity or provisioned/paid idle instances. Hidden pages now pause idle call/contact polling, and conversation-list refreshes cannot overlap. Recheck live security and throttling after AWS applies the quota.

The owner requires text pushes to produce one brief alert, with voice/video pushes ringing as calls. Web notifications explicitly request sound and use a short single vibration for texts versus a call vibration pattern and Answer/Dismiss actions for calls. Sound still follows Android/browser notification settings. `requireInteraction` keeps a notification present; it does not create a looping ringtone. Continuous closed-app ringing requires Android-native call integration rather than repeated web pushes. References: [Web notification options](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification), [Android CallStyle](https://developer.android.com/develop/ui/compose/notifications/call-style).

## Operator and distribution requirements

The owner confirmed DanzStak LLC is a California registered LLC, with the public mailing address 2063 Main St. #237, Oakley, CA 94561, USA. Site notices identify the company while preserving creators' ownership of user content. The independent DanzStak mail service and support@danzstak.com mailbox were configured and inbound/outbound delivery was confirmed by the owner. The support page, Privacy Policy, and Terms now publish that verified contact. The signup policy version is 2026-10-26. The policies describe the actual website and are not a certification of legal compliance.

The owner has Android/Apple developer accounts under Datappaloosa. Use native projects, not web wrappers. Final app download/install buttons belong on DanzStak after the website modules are complete. The owner prohibits Google Play, Apple App Store, and external social-platform publishing; use the developer accounts only for permitted signing/notarization and website distribution. Apple Web Distribution has eligibility and regional restrictions, so native iPhone website-only installation must not be promised globally. The existing website-installable PWA remains available.

## Current interaction audit

After the interaction pass and 49 regression checks, the owner explicitly requested the Facebook import button at the bottom of Edit Profile. The import flow reads JSON/ZIP locally, previews user-selected content, imports posts privately with original dates, and uses owner-scoped duplicate keys. Profile fields are optional and require selection. Full real-account export compatibility is still being verified; unsupported content is skipped with feedback.

Requested UI behavior: icon-only Like/Comment/Share, with a right-facing share arrow and tap-again to unlike; Story label without 24h and no creator/title overlays on Story thumbnails; creator credit rather than platform name on internal Reels; a compact sidebar/content mobile grid matching the supplied tablet-style reference; consistent 4/8-pixel spacing; plain Public/Friends/Only me dropdown; Terms of Service directly below Logout. Manage must open working app/device controls.

Implemented and locally regression-tested for release v213: off-screen video pause; text-field long press emoji picker without visible Emoji buttons; persistent sessions without idle sign-out; 15 UI languages including Korean, Japanese, Filipino/Tagalog, and both Chinese scripts. Home restores the menu alongside the feed; left-menu destinations open full page. Live visual verification remains required. Untranslated interface strings fall back to English; personal content is not translated.


### Verified interaction pass — October 26, 2026

Release v216: all 47 JavaScript regression checks, six-page static smoke checks, release verification checks, and infrastructure validation passed. Production v213 passed live security checks (HTTPS redirect, security headers, delivered inline-script CSP, assets, API authentication, and TLS policy). Repeat live security verification after the final sharing release.

Live browser checks confirmed Home restores menu + feed; Feed and all seven sidebar workspaces open without the sidebar; no horizontal overflow at 320, 390, 768, or 1280 viewport widths. Korean, Japanese, and Filipino/Tagalog switch interface labels; English was restored afterward. Edit Profile saves successfully; Posts, Friends, and Media load. Like/unlike, comments expansion, Story viewer/close, save/view/unsave, notification empty state, message conversation/minimize, Manage, update check, and Apply Update were exercised. Save and reaction tests restored their original state. No new calls or messages were sent in this pass.

The audit caught a Facebook share fallback and replaced it with native sharing or a copied/manual post link. Clipboard failures and stalled clipboard requests retain a visible link. Native share cancellation is respected. Translation covers core interface labels with English fallback, not every error or legal paragraph. Fresh signup with real email verification, physical-device notification sound, and native call ringing remain unverified or unresolved. AWS Lambda quota request remains CASE_OPENED. Facebook import remains paused; this record does not certify every destructive production action as tested.


### Current requested work — October 26

Live through v228: mobile Return hints and Enter-to-send chat; no visible chat Send button; enlarged logo without extra wordmark; search covers visible post authors and accessible contacts alongside posts; chat All/Unread/Groups stay on one row and Communities is removed; category order is Visual Artist, Bands, DJs & Producers, Fans, Venues, Scenes, Industry, Events, Politics, Religion (original membership IDs preserved). Profile photo/cover/video controls are menus inside Edit Profile, optional post location supports creation and removal through Edit Post, and profile photos sit above cover photos.

Also deployed: Facebook import at the bottom of Edit Profile; Share Profile via opaque member ID with existing friends/shared-group authorization; Invite People via signup link. The import dialog opens, and parser/backend tests pass, but the browser approval gate rejected selecting the synthetic ZIP. Do not bypass that upload gate. Browser file-preview verification remains incomplete. No account deletion or external invitation was performed.

Post/comment reactions are deployed: thumbs-up/down, long press for emoji, comments beneath author names, top two comments by total reactions with expansion, and named reactors with friends first. Backend/DOM regression checks pass; post reaction toggling and the picker were exercised live. Real comment reaction rendering has not been exercised against a production comment fixture.

Current v229 work: internal Share to DanzStak feed with source author/reference and source privacy enforced; authenticated non-owner view counts deduplicated per post per UTC day, with one-second visible dwell. The view table/route/policy stack and Auth API are deployed; frontend release verification is in progress. The endpoint correctly rejects unauthenticated writes. View deduplication records expire after 90 days and do not store IP addresses. The new view table has encryption, PITR, and Retain policies.

Deployed account tools now include photo/video tags with opt-in/out and self-removal, Featured Posts, private anniversary Memories, a Settings activity view for recent owner posts and comments, and a self-service JSON download covering account/profile settings, owned social activity, friends, groups, Stories/Reels metadata, conversations/messages, notifications, and saved tours. The export explicitly identifies unavailable sources and does not claim to contain uploaded media binaries or support correspondence. Still unfinished and authorized: separate Delete profile and Delete account controls, Delete my data, explicit final erasure confirmation, and a working erasure backend. Profile deletion meaning (hide reversibly versus clear details/photos) remains an unanswered clarification. No destructive production account deletion is authorized as a test. Do not ship inert controls or claim data erasure that has not run.

AWS Lambda capacity request remains pending (CASE_OPENED when last checked). Closed-PWA continuous call ringing remains unresolved and belongs to the native-app phase. Roadmap after current site work: email service, tour booking, admin dashboard, then native Android/iOS with website distribution constraints already documented.

### Release v230 — media tags
Photo/video tagging now supports accepted friends, an account tagging preference, self-removal, and protection against silently restoring removed tags. Consent and friendship are checked transactionally when new tags are committed. Profile posts render tags and credited shared-post previews. Shared links to one's own profile retain editing controls. Comment reactor summaries show friend names for all reaction types.
All 55 JavaScript regression files and release/site/infrastructure checks passed. CloudFormation lint and all six security Guard checks passed. Auth API deployed; social changeset modifies only function/integration without replacement. Browser tagging interactions still require live verification; no real media uploads or tags were created during this pass.
Release v229 internal sharing and view counts are live. A real comment displayed its text below the author and its named friend reactor. A non-owner video view was recorded. Facebook browser file-preview verification remains blocked by the declined upload gate; do not bypass it.
