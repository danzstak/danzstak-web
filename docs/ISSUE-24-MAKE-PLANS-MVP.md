# Issue #24 — Make Plans MVP review evidence

**Branch:** `codex/issue-24`  
**Status:** IN PROGRESS — implementation and local browser verification complete; isolated AWS staging and real-account end-to-end verification pending.

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

## Required staging gate

The AWS CLI session expired before an isolated staging target could be inspected or deployed. No URL is invented and no production resource is modified. After `aws login` completes, the remaining work is:

1. verify or create an isolated preview Amplify branch and isolated plan API/table (never the production API/table);
2. deploy the exact tested commit;
3. use two controlled accounts to create/accept/maybe/decline/edit/cancel across sessions;
4. deny an unrelated third account and a no-longer-friend account by direct API;
5. verify DST cases, `.ics`, offline/reconnect, deep links, stale PWA update and supported phone browsers;
6. open a draft PR and supply the verified staging URL for owner approval.

Production deployment and merge remain prohibited until explicit owner approval.
