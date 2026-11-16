# Task 10 — Security hardening before doors

## Owner direction (2026-11-16)
"Security needs to be tight; most data breaches are from hacks." And: "Make sure there are zero tokens in the browser dev tools."

## Already in place (checked 2026-11-16)
- Sessions use `Secure; HttpOnly; SameSite=Lax` cookies (`secureCookie` in index.mjs). No auth, id, access or refresh tokens in localStorage or sessionStorage, and none in assets/*.js.
- Secrets live in AWS Secrets Manager. Phone numbers are hashed. API throttle is 20 rps / burst 40. HSTS is set in customHttp.yml.
- AWS root has MFA and no root access keys. CloudTrail trail `danzstak-audit` covers all regions, with log validation, into a private bucket with 1-year expiry. GuardDuty is on in us-west-1 and us-east-1. (Owner-approved, set up 2026-11-16.)

## Build
1. **Zero tokens in the browser (regression test)**: a browser check that signs in a test user, then asserts:
   - no JWT-shaped or secret-shaped strings (`eyJ…`, `sk_`, `rk_`, `whsec_`, 32+ hex/base64 runs) in localStorage, sessionStorage, IndexedDB, Cache Storage, `document.cookie`, the URL, page HTML or console output;
   - the session cookie is not readable from JS.
   Run it in CI on every PR.
2. **Security headers on every page** (customHttp.yml): Content-Security-Policy (script-src self and listed embeds only, no inline eval), X-Content-Type-Options, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic only where SYNC calls need them), frame-ancestors none.
3. **Abuse limits**: per-account and per-IP limits on login, OTP, signup, checkout, booking sends and report endpoints. Lockout and backoff after repeated failures. Alert on spikes.
4. **Sensitive data**: field-level encryption (KMS) for StakGuard identity fields, shipping addresses and attendee legal names. Keep the minimum and auto-delete after use (shipping: 90 days after delivery; tickets: 30 days after the event, except tax records).
5. **Admin actions log**: every owner/admin action (takedown, refund, payout hold, review-venue-reports) is written to an append-only log.
6. **Dependencies**: Dependabot config (`.github/dependabot.yml`) for npm in each package folder plus GitHub Actions; `npm audit` fails CI on high/critical.
7. **Monitoring**: CloudWatch alarms on the 5xx rate, Lambda errors, auth failures and GuardDuty findings (high severity), sent to the owner's email. AWS Budgets alarm.
8. **Breach plan** (`docs/BREACH-PLAN.md`): who does what in the first hour, how to rotate every secret, how to revoke sessions, and GDPR 72-hour notification steps and templates.
9. **security.txt** at `/.well-known/security.txt`, plus a responsible-disclosure page. Later, a bug bounty program (owner's choice of platform).
10. **External pen test** before doors.

## Owner to-dos (can't be done from here)
- GitHub → danzstak/danzstak-web → Settings → Code security: turn on **Secret scanning**, **Push protection**, **Dependabot alerts** and **Dependabot security updates** (all free on public repos).
- Turn on 2FA everywhere: GitHub, Stripe, Zoho, Amplify/AWS console users.
- IAM user `ses-smtp-user.20261109-020146` has an SMTP key, last used 2026-11-09 for SES SMTP. Confirm what uses it. If nothing does, delete it.

## Tests
The browser token check (1) passes on every PR; headers present on every HTML response; limits return 429 after N attempts; encrypted fields unreadable in a raw DynamoDB read.
