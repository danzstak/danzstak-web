# danzstak-web
Official DanzStak social networking and music platform website.

## Product boundary

DanzStak is an installable, responsive Progressive Web App for social
networking. It does not include blockchain, cryptocurrency, wallets, tokens,
or Web3 transactions. Those capabilities belong to the separate SFSCOOP
product and must not be introduced into DanzStak.
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
