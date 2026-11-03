# DANZSTAK Phone configuration and release

## Product boundary

The one-time USD $3 payment activates a unique internal `DS-` number. Calls and messages remain inside DANZSTAK. There is no rented PSTN number, carrier SMS, external telephone calling, or emergency service. Existing friend/shared-Tribe contact permissions remain enforced. Number activation does not replace existing unnumbered chat calls or charge for them retroactively.

This implementation adds a Phone panel in Messages and a feed navigation link, Stripe Checkout activation, signed webhooks, atomic number allocation, authenticated Cloudflare TURN credentials, backend blocking for calls and messages, house advertising during calls, and approximate outgoing numbered-call history. House ads earn no external ad-network revenue. There is no advertiser billing or revenue dashboard in this change. Client-reported call diagnostics must never be represented as audited usage or billable advertising evidence.

## Accounts

1. Reuse the owner's existing Stripe business account. An account ID alone does not authorize API requests. Use a Stripe sandbox and its secret API key first. No Stripe Connect account or platform account onboarding is required for collecting DANZSTAK's own activation fee.
2. Create/reuse a Cloudflare account. In Cloudflare Realtime TURN, create a TURN key and retain its key ID and API token. Keep long-lived keys server-side; issue temporary credentials to authenticated activated users.
3. Use the existing DANZSTAK AWS account, Auth API Lambda, Cognito session system, and API Gateway. Do not migrate domain DNS or replace hosting to add TURN.

References:
- https://developers.cloudflare.com/realtime/turn/generate-credentials/
- https://developers.cloudflare.com/realtime/turn/faq/
- https://docs.stripe.com/checkout/quickstart
- https://docs.stripe.com/webhooks/signature
- https://docs.stripe.com/testing

## AWS configuration

The existing production deployment deploys the social CloudFormation stack before the Auth API. The new `PhoneTable` in `infrastructure/call-signaling/template.yaml` supplies encrypted, retained, on-demand DynamoDB storage with point-in-time recovery. Its TTL applies only to rows explicitly given an expiry; paid number reservations do not expire.

`aws-deploy-auth-api.ps1` packages `phone.mjs`, grants access only to the named phone table, creates the new routes, and grants API Gateway invocation permission. The script preserves existing Lambda environment settings and adds `PHONE_TABLE`. Do not deploy only the frontend or only `index.mjs`.

Configure these settings on `DANZSTAK-Auth-API`, preserving all existing environment variables. Use the approved AWS secret-management workflow and never commit credentials, put them in frontend code, or print them in chat/logs.

| Variable | Value |
| --- | --- |
| `PHONE_TABLE` | `DANZSTAK-Phone` (deployment sets this) |
| `PHONE_ENABLED` | `true` for the test pilot; omit or set `false` to disable the Phone API |
| `PHONE_TEST_USER_IDS` | Comma-separated Cognito user sub IDs allowed into sandbox Phone testing; required with a test Stripe key. Other members cannot activate using test cards. |
| `CLOUDFLARE_TURN_KEY_ID` | TURN key ID |
| `CLOUDFLARE_TURN_API_TOKEN` | TURN API token; backend secret |
| `STRIPE_SECRET_KEY` | Sandbox/test secret API key initially |
| `STRIPE_PHONE_WEBHOOK_SECRET` | Signing secret for this specific webhook endpoint and Stripe environment |
| `PHONE_LIVE_PAYMENTS` | Omit or set `false` during testing. Set `true` only for the approved live launch. |

The service fails closed for activation if its relay/payment configuration is incomplete. A live Stripe key alone cannot enable live activation. Avoid using a real account deletion or real external messages as a test.

## Stripe webhook

After the backend routes are deployed, create a sandbox webhook endpoint:

`https://api.danzstak.com/phone/webhook`

Subscribe to `checkout.session.completed`. Store that endpoint's signing secret in `STRIPE_PHONE_WEBHOOK_SECRET`. The webhook must accept Stripe HTTPS requests without an application cookie or browser Origin header. It verifies the signature over the exact request body, checks its timestamp, checks sandbox/live mode, and validates the product, expected Checkout session, USD currency, and paid $3 amount before assigning a number. Do not add a user-session authorizer to this webhook route or parse/rewrite its body in API Gateway.

The remaining Phone routes require the existing authenticated session. Mutating browser requests require the existing DANZSTAK site Origin. Never activate a number from the Checkout success URL; it is display-only.

Create no recurring Stripe subscription. Checkout creates a one-time $3 line item server-side. Review tax treatment and applicable payment fees before real sales; the implementation does not calculate tax automatically. Configure refunds/disputes handling before a paid launch; automatic entitlement revocation on refunds is not implemented.

## Test and verification

1. Run `npm ci --ignore-scripts` in `infrastructure/auth-api`, then the repository's `./test-regressions.ps1` on a supported PowerShell environment. This includes `test-phone-service.cjs` plus existing calling, session, release, site, and infrastructure checks.
2. Deploy the backend and frontend through the existing release workflow with live payments disabled.
3. Activate two consenting test accounts through Stripe sandbox Checkout. Confirm only verified successful payments allocate numbers, retries preserve the number, and an activated account cannot start another Checkout.
4. Dial an allowed test contact's `DS-` number. Confirm microphone permission, ringing, answer, two-way audio, mute, hangup, and recent outgoing call history. Exchange a chat message through the existing conversation.
5. Test Wi-Fi to mobile data and different carriers. In a test browser only, force `iceTransportPolicy: 'relay'` in the RTCPeerConnection configuration and verify `getStats()` reports a relay candidate. Restore the default policy afterward. Never ship relay-only mode accidentally.
6. Block a test number and confirm both calls and messages are rejected server-side, in both directions, even with a shared Tribe. Unblock and retest.
7. Confirm the house ad appears during a connected call and disappears afterward. No conversation recording, transcription, or ad targeting from audio is performed. Real ad-network integration is a separate setup.
8. Verify mobile browser/PWA foreground, background, and locked-screen behavior on physical devices. Existing closed-PWA ringing limitations remain open; no claim of native-phone reliability is supported until verified. One-hour TURN credentials also require long-call/reconnection validation before offering unrestricted call lengths.

No live provider/payment/device test is implied by passing unit tests. Running a sandbox Checkout still requires real Cloudflare configuration for relay tests.

## Costs and monitoring

There is no monthly number-rental charge. Monitor AWS Lambda/API Gateway requests, DynamoDB reads/writes, and Cloudflare TURN bandwidth. Existing two-second inbox polling can dominate idle request volume; measure active tabs and do not extrapolate bandwidth alone to total operating cost. An optional CloudWatch log metric `PhoneActivation` records successful $3 activations without account identifiers or payment secrets.

The earlier $25–$100/month small-pilot allowance is a planning estimate, not a quote or measured bill. Model costs from actual monthly active callers, participant-minutes (count each call participant once), relay proportion, bitrate including transport overhead, concurrent tabs, and provider free tiers. Keep one-time activation revenue separate from recurring ad revenue. Development, maintenance, support, refunds, payment fees, and taxes are additional.

The Cloudflare FAQ currently lists a 1,000 GB free tier and a $0.05/GB TURN usage rate after it; verify applicable account terms at setup. No external ad revenue is assumed for house ads.

## Rollback

Disable `PHONE_ENABLED` and hide the Phone entry while investigating. Preserve the retained Phone table and number/payment reservations. Disabling sales must not delete paid entitlements or silently reassign numbers. Existing calls without a numbered entitlement continue to use their existing STUN configuration; paid numbered calling depends on the configured relay service.
