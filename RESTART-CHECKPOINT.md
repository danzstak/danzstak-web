# Restart checkpoint — October 26, 2026

User is restarting Codex. Keep the right pane closed; do not reopen embedded browser/terminal panels. User wants AWS credentials through regular Microsoft Edge and the CLI authorization-code flow, as before. No USB security key requested. Do not change the credential workflow.

Production: v230, commit 5a53931, verified Amplify and live security checks. Media tags, consent preference, self-removal, profile previews, and friend reactor summaries deployed. Full local regressions passed for v230.

Local next release v231: Featured profile posts (owner-only toggle, audience unchanged) and private anniversary Memories. New profile-collections.js and tests. Not deployed and not pushed: backend must deploy before frontend. Resume full regression verification and mobile tab layout review. Activity history and data download/deletion controls remain unfinished. Never erase the real account for testing.

AWS CLI credentials expired. Root console sign-in is separate from CLI credentials. A remote aws login was awaiting a fresh code, but its process/link should be considered stale after restart. Check STS before starting another login. Do not save authorization codes or credentials in this checkpoint.

Browser control was denied for AWS page observation; shell launch of Edge was blocked by policy; native control of ChatGPT was denied. Do not bypass these gates. User can open Edge and close the right pane manually. No ability to guarantee the right pane's state at restart.

Facebook import browser file-preview remains unverified due to declined file-upload gate. Physical Android Enter keyboard and continuous closed-PWA call ringing remain unverified/unresolved. Account activity, full export/erasure, Featured/Memories live verification remain before email, booking, admin, native apps.

User asks if idle 07:22–09:55: exact interval is not verified. Be candid: work did not run continuously between replies; AWS login exchanges paused development. Do not claim continuous background work.

Leave the existing untracked push/call PNG files alone.

Save-time checks: all JavaScript regression files passed; full runner then caught a feed CSP hash mismatch after line-ending changes. Hash corrected and site smoke checks rerun. Full final regression suite and live v231 verification are still required before deployment.
