# DANZSTAK protected release governance

Status: **REQUIRED FOR EVERY PRODUCTION RELEASE**.

## Authority model

Codex may implement, test, publish a review branch, and deploy an isolated staging preview. Codex test output is evidence, not independent approval. Production requires all of the following:

1. A non-draft pull request whose head has not changed since the recorded evidence.
2. Required GitHub checks: `regression`, `responsive-accessibility-security`, and `release-evidence`.
3. At least one approving review from an authorized human other than the change author; stale approvals are dismissed when the head changes.
4. An inspectable staging URL and rendered phone/desktop evidence.
5. Explicit owner go/no-go after the independent reviewer verdict.
6. Approval of the protected `production` GitHub Environment before deployment.
7. Post-deployment verification of the deployed SHA, PWA cache, public assets, critical workflows, and rollback readiness.

No direct pushes, force pushes, fast-forwards, or administrator bypasses to `main` are permitted for ordinary releases. Emergency hotfixes still require explicit owner authorization and a retrospective PR and incident record.

## Repository protection state

Active GitHub ruleset `Protect production main` (ID `26689955`) now targets the default branch with no bypass actors. The GitHub API was read back after creation and verified these enforced properties:

- Require a pull request before merging.
- Require 1 approval.
- Dismiss stale approvals and require approval of the most recent reviewable push.
- Require conversation resolution.
- Require status checks `regression`, `responsive-accessibility-security`, and `release-evidence`, with the branch required to be current.
- Block force pushes and deletions.
- No repository administrator or automation bypass actor is configured.

The remaining account-level requirement is a protected deployment environment. In **Settings → Environments**, create `production`, add the independent reviewer as a required reviewer, prevent self-review where available, restrict deployment branches to `main`, and apply a short wait timer if desired. Production deployment credentials must be scoped to that environment. Staging uses a separate environment and hostname and must not mutate production data.

In AWS Amplify, disable any path that deploys an unreviewed branch to the production domain. The production branch may build only after the protected `main` update and environment approval. Keep the access-controlled preview branch separate.

## Required evidence

Every PR uses `.github/pull_request_template.md`. The source SHA, staging URL, functional tests, 320/360/390/430px and desktop captures, accessibility results, security/privacy review, UX review, deployment state, and rollback plan must be current. A reviewer records `PASS`, `CHANGES REQUESTED`, or `UNVERIFIED`; only the owner records the production decision.

## Post-release record

The development report records the merge SHA, deployment initiator, job/run URL, UTC timestamps, cache version, live verification results, known limitations, and rollback target. Physical-device or two-account testing is never inferred from browser automation.
