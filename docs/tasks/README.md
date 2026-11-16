# Task specs for Claude Code

Shawn's setup (2026-11-16): the claude.ai session does the thinking and writes specs here; Claude Code on Shawn's computer does the coding.

How to run one: in `danzstak-web`, start `claude` and say: **"Do docs/tasks/<file>. Follow CLAUDE.md. Small PR, tests green, stop and ask me before anything risky."**

Rules for every task:
- Read CLAUDE.md and docs/SESSION-HANDOFF.md first.
- Sandbox Stripe only. Never move real money. Never print or commit secrets.
- Bump `danzstak-shell-vNNN` and asset `?v=` when frontend files change; update version pins in tests, test-site.ps1 and browser-checks.
- Run every `node test-*.cjs`; only the 5 known dependency failures (epk-domain, epk-outreach-shares, epk-production, epk-qr, reviews-domain) may fail locally.
- Open a PR with a short Why / What / Room faxed. Don't merge if any CI check fails; read the browser-call-media log, it is not just flaky.
- Backend changes need a deploy (zip infrastructure/auth-api → both Lambdas DANZSTAK-Auth-API and DANZSTAK-TourManager-Stripe-Test, us-west-1) plus API Gateway routes + Lambda permissions. If you have no AWS access, stop after the PR and say "needs deploy".
- When done, update docs/SESSION-HANDOFF.md.
