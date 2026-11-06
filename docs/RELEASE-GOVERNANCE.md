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

## Repository settings the owner must apply

GitHub account administration cannot be truthfully replaced by repository files. In **Settings → Rules → Rulesets**, create an active branch ruleset targeting `main`:

- Require a pull request before merging.
- Require 1 approval and require review from Code Owners when an independent reviewer is listed.
- Dismiss stale approvals and require approval of the most recent reviewable push.
- Require conversation resolution.
- Require status checks `regression`, `responsive-accessibility-security`, and `release-evidence`, with the branch required to be current.
- Block force pushes and deletions.
- Do not permit repository administrators or automation accounts to bypass the ruleset for ordinary releases.

In **Settings → Environments**, create `production`, add the owner/independent reviewer as required reviewers, prevent self-review where available, restrict deployment branches to `main`, and apply a short wait timer if desired. Production deployment credentials must be scoped to that environment. Staging uses a separate environment and hostname and must not mutate production data.

In AWS Amplify, disable any path that deploys an unreviewed branch to the production domain. The production branch may build only after the protected `main` update and environment approval. Keep the access-controlled preview branch separate.

## Required evidence

Every PR uses `.github/pull_request_template.md`. The source SHA, staging URL, functional tests, 320/360/390/430px and desktop captures, accessibility results, security/privacy review, UX review, deployment state, and rollback plan must be current. A reviewer records `PASS`, `CHANGES REQUESTED`, or `UNVERIFIED`; only the owner records the production decision.

## Post-release record

The development report records the merge SHA, deployment initiator, job/run URL, UTC timestamps, cache version, live verification results, known limitations, and rollback target. Physical-device or two-account testing is never inferred from browser automation.
