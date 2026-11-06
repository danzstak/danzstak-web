# Production release reconciliation — 2026-11-04/05

Status: **AUDITED FROM GIT HISTORY AND THE EXISTING DEVELOPMENT REPORT; AMPLIFY INITIATOR FIELDS REQUIRE OWNER/AWS CONSOLE EXPORT**.

This table reconciles the production jobs named in GitHub Issue #50. It does not retroactively represent unreviewed releases as approved.

| Amplify job | Feature | Deployed commit | Recorded deployment window (Europe/Berlin) | Initiator evidence | Review / approval evidence | Current main | Rollback feasibility |
|---|---|---|---|---|---|---|---|
| 896 | Calling-device registration | `7ad984f9c6a816b8aa3ec1e29d1f56d14a74a77d` | 2026-11-04 22:28:37–22:29:34 | Not independently retrievable with the expired local AWS session; owner must export the Amplify job detail | PR #47 was merged while draft; no independent approval is established by this audit | Ancestor of current `main` | Static assets can be reverted by a reviewed inverse commit; backend/data rollback needs a separate migration assessment |
| 904 | Compact Chat contact shortcuts | `6b785ae49734ae4f96530e9f88bfb079a5fd6e54` | 2026-11-05 00:09:50–00:10:45 | Same owner action required | PR #45 remained draft/open while equivalent code was reported deployed; approval not established | Ancestor of current `main` | Reviewed inverse commit feasible; preserve conversations and user data |
| 906 | SYNC remote audio output | `ab0df0160e389b609b71a34c572e9f2228cbfbd2` | 2026-11-05 00:29:14–00:30:09 | Same owner action required | PR #46 remained draft/open; physical two-device acceptance was explicitly outstanding | Ancestor of current `main` | Reviewed inverse commit feasible; do not remove call records or device registrations without assessment |
| 908 | Make Plans initial release | `32926a1bbe0dcfd1920c4053e40ec59e6f81934a` | Exact job timestamps not present in the repository report | Same owner action required | PR #26 remained draft/open and stated production was unchanged | Ancestor of current `main` | Reviewed inverse commit feasible; preserve existing plans and messages |
| 909 | Make Plans tablet controls | `70d83ac923c3fc5a48cfde86aa7e584e3fb09647` | Exact job timestamps not present in the repository report | Same owner action required | No independently verified approval/status link is recorded | Ancestor of current `main` | Reviewed inverse commit feasible; preserve existing plans and messages |
| 911 | Make Plans localization | `296ec9ece9dabe716a2a99c3c3a304b650aa8400` | 2026-11-05 01:20:58–01:21:48 | Same owner action required | No independently verified approval/status link is recorded | Ancestor of current `main` | Reviewed inverse commit feasible; preserve existing plans and messages |

## Current protection audit

Read-only GitHub API inspection on 2026-11-06 returned no repository rulesets. The repository exposed only the `github-pages` Environment; it allowed administrator bypass and did not constitute a protected production release environment. The unauthenticated branch-protection endpoint correctly refused to disclose settings, so this audit does not claim more than the available evidence proves.

Until the owner completes the settings in `docs/RELEASE-GOVERNANCE.md` and provides screenshots/API evidence, the independent verdict remains **UNVERIFIED** and no further production release is approved under Issue #50.
