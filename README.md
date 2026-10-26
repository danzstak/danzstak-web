# danzstak-web
Official DanzStak social networking and music platform website.

## Product boundary

DanzStak is an installable, responsive Progressive Web App for social
networking. It does not include blockchain, cryptocurrency, wallets, tokens,
or Web3 transactions. Those capabilities belong to the separate SFSCOOP
product and must not be introduced into DanzStak.
## Migration objective

The owner wants DanzStak to help users leave billionaire-owned social platforms. Data portability is a core product goal: users should be able to copy their own Facebook profile and content into DanzStak while keeping Facebook, or migrate and then close Facebook after verifying their imported data. Account closure must remain a separate user-controlled action on Facebook. The importer should preview supported content, preserve original dates where available, default imported material to private, and prevent duplicate imports. Facebook connections, likes, and comments must not be represented as actions taken by real DanzStak members.

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
2. An email notification service and email delivery workflows. The owner requires public ingress to be limited to HTTPS 443 and HTTP 80 for HTTPS redirects. Send notifications through an HTTPS provider API on outbound 443 (for example Amazon SES); do not expose SMTP listeners on the DanzStak service. The provider handles downstream email delivery. This requirement applies to the future email deployment; no standalone mail server has been deployed yet.
3. A geo-based tour-booking agent/module for bands to locate clubs and contact them about booking their act. The planned flow includes optional location permission or manual city entry, distance filters, venue profiles, multi-stop tour planning, proposed dates, travel distances, and per-venue booking-request status. Email delivery can support booking notifications after the email phase is complete.
4. An admin dashboard for site monitoring and management, including review of post and group reports.
5. Native Android Studio/Kotlin and Xcode/Swift apps as the final phase. The website is the requested distribution hub; direct Android APK distribution and Apple-eligible distribution routes must be evaluated before implementation. Native call integration belongs here, including reliable incoming voice/video ringing from push.

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

The owner confirmed DanzStak LLC is a California registered LLC, with the public mailing address 2063 Main St. #237, Oakley, CA 94561, USA. Site notices identify the company while preserving creators' ownership of user content. The owner selected support@danzstak.com as the future support mailbox. Create it and verify incoming/outgoing delivery during the email phase. Policy contacts currently use postal mail; do not advertise unverified @danzstak.com mailboxes before the email service is configured and tested. The signup policy version is 2026-10-26. The policies describe the actual website and are not a certification of legal compliance.

The owner has Android/Apple developer accounts under Datappaloosa. Use native projects, not web wrappers. Final app download/install buttons belong on DanzStak after the website modules are complete. The owner prohibits Google Play, Apple App Store, and external social-platform publishing; use the developer accounts only for permitted signing/notarization and website distribution. Apple Web Distribution has eligibility and regional restrictions, so native iPhone website-only installation must not be promised globally. The existing website-installable PWA remains available.

## Current interaction audit

The owner explicitly paused import until every existing page, link, button, and layout has been checked again. Facebook import files are local work in progress and are not loaded by the site. Its backend patch is preserved separately at the task's temporary `danzstak-facebook-import-backend.patch`; do not deploy it before the interaction audit is complete.

Requested UI behavior: icon-only Like/Comment/Share, with a right-facing share arrow and tap-again to unlike; Story label without 24h and no creator/title overlays on Story thumbnails; creator credit rather than platform name on internal Reels; a compact sidebar/content mobile grid matching the supplied tablet-style reference; consistent 4/8-pixel spacing; plain Public/Friends/Only me dropdown; Terms of Service directly below Logout. Manage must open working app/device controls.

Implemented and locally regression-tested for release v213: off-screen video pause; text-field long press emoji picker without visible Emoji buttons; persistent sessions without idle sign-out; 15 UI languages including Korean, Japanese, Filipino/Tagalog, and both Chinese scripts. Home restores the menu alongside the feed; left-menu destinations open full page. Live visual verification remains required. Untranslated interface strings fall back to English; personal content is not translated.

