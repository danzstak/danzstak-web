# Issue #24 — Make Plans MVP review evidence

**Branch:** `codex/issue-24`
**Status:** IN PROGRESS — implementation, isolated AWS staging, real A/B/C API verification and responsive browser review complete; owner review and physical-device evidence pending.

## Audit

- The repository uses static HTML/CSS/browser JavaScript with Node.js Lambda backends, not React.
- One-to-one Chat is implemented by `messages.html`, `assets/direct-messages.js` and the `DANZSTAK-Call-Signaling` Lambda in `infrastructure/call-signaling/template.yaml`.
- Accepted friendship records, account sessions, in-app notifications, opted-in Web Push and private Chat persistence are reusable.
- The Events documents are a specification scaffold. No durable private invitation/event model existed before this branch.
- No general block model or report endpoint currently exists in the Chat stack. The MVP therefore prevents new invitations unless the server confirms an accepted friendship; existing participants retain access to their own invitation history after an unfriend.

## Implemented MVP

- Accessible **Make plans** action in an active one-to-one Chat.
- Private two-person invitations with title, future date/time, IANA timezone, optional public meeting place and optional note.
- Dedicated encrypted/PITR DynamoDB plan records, duplicated only for the two validated participants and indexed by participant.
- Server authorization for every read or mutation, accepted-friend verification for create/edit, 20-invites/day limit, deterministic idempotency key, optimistic revisions and transactional two-participant updates.
- Pending, Going, Maybe, Declined and Cancelled states; inviter edit/cancel; invitee response; changed plans reset to Pending.
- In-app Buzz records for new/changed/cancelled invitations. Push is deliberately not claimed or enabled for this MVP until staging provider/device delivery is verified.
- User-triggered `.ics` export after Going. No third-party calendar write, GPS, paywall, phone number, automatic message or public address request.
- Offline/error feedback remains in the dialog and preserves the form for retry.
- PWA shell includes the new assets under isolated preview cache `danzstak-shell-v668-issue24-preview`.

## Tests run

- PASS — `node test-make-plans.cjs`
- PASS — `node test-static-link-integrity.cjs`
- PASS — `node test-mobile-design-system.cjs`
- PASS — `node test-chat-viewport.cjs`
- PASS — `node test-exclusive-mobile-screens.cjs`
- PASS — `./test-infrastructure.ps1` (embedded Lambda syntax and infrastructure controls)
- PASS — `node scripts/verify-mobile-ui.cjs` at 320, 360, 375, 390, 414, 430, 768, 1024 and 1366px. The first run found a 768px Chat-name collision; the header breakpoint was corrected and the complete matrix then passed.

Phone screenshots: [320px](screenshots/issue-24-make-plans/make-plans-320.png), [360px](screenshots/issue-24-make-plans/make-plans-360.png), [390px](screenshots/issue-24-make-plans/make-plans-390.png), [414px](screenshots/issue-24-make-plans/make-plans-414.png).

## Staging review

AWS Amplify DEVELOPMENT branch job `2` deployed commit `60d232ba645edc3b7c676a7c961aa337e6ba07dd` and serves the tested PWA shell at:

`https://codex-issue-24.d31oovi2mos5iz.amplifyapp.com`

The hosted `messages.html` and Make Plans assets were independently fetched with HTTP 200. A clean browser verified that the worker activated, controlled the page and contained only `danzstak-shell-v668-issue24-preview`. Production `main` and `https://danzstak.com` were not changed. Draft review PR: `https://github.com/danzstak/danzstak-web/pull/26`.

The original preview correctly could not use production cookies or API CORS. A separate staging target now removes that review blocker without weakening production:

- CloudFormation stack `danzstak-make-plans-preview` in `us-west-1` provisions an isolated Cognito user pool, exact-origin JWT-authorized HTTP API, Lambda and encrypted/PITR DynamoDB store.
- Staging API: `https://dr3dwdkzqb.execute-api.us-west-1.amazonaws.com` (JWT required; unauthenticated requests are rejected by API Gateway).
- Review entry point: `/plans-review.html`. It collects username/password only, keeps the ID token in session storage, and cannot read production accounts, friends, Chats, plans or notifications.
- A controlled three-account run passed: A/B friend request and acceptance, A invitation, B Going response, C empty plan list, C mutation rejection, stale-revision rejection, inviter cancellation and two private Buzz notices.
- A separate retry run passed deterministic idempotency: the same key returned the same plan with `replayed: true`, left one stored invitation, and rejected an invalid IANA timezone.
- `node test-make-plans-preview.cjs` passed the review UI at 320, 360, 390 and 414px with no horizontal/dialog overflow and 44px action targets. Evidence: [320px](screenshots/issue-24-make-plans/staging-review-320.png), [360px](screenshots/issue-24-make-plans/staging-review-360.png), [390px](screenshots/issue-24-make-plans/staging-review-390.png), [414px](screenshots/issue-24-make-plans/staging-review-414.png).
- Amplify DEVELOPMENT job `8` deployed commit `2c24f312cc3e20187f8583461fb0a9e03d7a44fe`. `node scripts/verify-make-plans-staging.cjs` then passed the actual hosted UI across three fresh browser accounts: create A/B/C, accepted friendship, 1:1 Chat entry, create and edit, edit resets invitee to Pending, Maybe/Going/Declined, New York DST-boundary storage, user-triggered `.ics` content, offline draft preservation, authenticated `?plan=` deep link, history retained after unfriend, new invite blocked after unfriend, and zero plans for C. [Hosted 390px evidence](screenshots/issue-24-make-plans/staging-live-390.png).
- A clean hosted-browser check found the service worker activated and controlling the page with the sole cache `danzstak-shell-v668-issue24-preview`.

The isolated preview is real persistent staging, not a static demonstration. Remaining work is:

1. complete owner and physical Android/iPhone review;
2. merge only after owner approval, then deploy the already-integrated production implementation through the normal release gates.

CloudFormation service validation and the repository infrastructure gate passed, and both staging stacks reached `CREATE_COMPLETE`/`UPDATE_COMPLETE`. `cfn-lint` and `cfn-guard` are not installed in this workstation, so those optional local/compliance layers were not run; AWS service validation and successful stack deployment are not represented as substitutes for them.

Production deployment and merge remain prohibited until explicit owner approval.
