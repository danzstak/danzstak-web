# Issue #24 — Make Plans MVP review evidence

**Branch:** `codex/issue-24-release`
**Status:** RELEASE CANDIDATE — implementation, full local regression testing and responsive browser verification pass. The owner subsequently authorized merge and deployment; production verification is recorded in the central development report.

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
- PWA shell includes the new assets under cache `danzstak-shell-v676`.

## Tests run

- PASS — `node test-make-plans.cjs`
- PASS — `node test-static-link-integrity.cjs`
- PASS — `node test-mobile-design-system.cjs`
- PASS — `node test-chat-viewport.cjs`
- PASS — `node test-exclusive-mobile-screens.cjs`
- PASS — `./test-infrastructure.ps1` (embedded Lambda syntax and infrastructure controls)
- PASS — `node scripts/verify-mobile-ui.cjs` at 320, 360, 375, 390, 414, 430, 768, 1024 and 1366px. The first run found a 768px Chat-name collision; the header breakpoint was corrected and the complete matrix then passed.

Phone screenshots: [320px](screenshots/issue-24-make-plans/make-plans-320.png), [360px](screenshots/issue-24-make-plans/make-plans-360.png), [390px](screenshots/issue-24-make-plans/make-plans-390.png), [414px](screenshots/issue-24-make-plans/make-plans-414.png).

## Release gate

The owner explicitly approved merge and deployment after the original staging request. Automated authorization, privacy, idempotency, optimistic-revision, infrastructure, PWA and responsive-browser gates pass. A controlled two-account production interaction remains the final human acceptance check after deployment; this document does not claim that a real recipient device has completed it.
