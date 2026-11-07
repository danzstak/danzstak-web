# SYNC and EPK hardening plan

Status: **PLAN ONLY — OWNER APPROVAL REQUIRED BEFORE IMPLEMENTATION**  
Scope: SYNC chat/calls and the EPK Builder. No deployment or infrastructure change is authorized by this document.

## Guardrails and baseline

- Preserve the current authenticated-session, origin, input-length, HTTPS-link, owner-prefix, signed-download, hashed-share-token, and constant-time token-comparison protections.
- Users cannot upload music or audio. Music and video remain links to the artist's provider; DanzStak will not host audio or provide a stored-file music player.
- SYNC attachments remain visual media only: JPEG, PNG, WebP, and GIF images (maximum 10 MB), plus MP4, WebM, and MOV video (maximum 25 MB and two minutes). Validate MIME type, file signature, size, duration, owner prefix, and post-upload object metadata server-side; reject and delete invalid objects. Block every audio MIME, extension, and disguised audio file.
- Keep all 50 current message/chat/call tests green throughout. Ship each phase as a separate reviewable pull request.

## Part A — SYNC

### A1. Separate the client without behavior change — 2–3 engineer-days

Split `assets/direct-messages.js` into a small entry point and four focused modules: transport/session, conversation list, thread view, and composer/attachments. Preserve current DOM contracts, localization, drafts, receipts, mobile history, and offline behavior before changing transport.

**Future files:** `assets/direct-messages.js`, new files under `assets/sync/`, `messages.html`, `service-worker.js`, existing SYNC tests.  
**Risks:** script-order regressions and duplicated event listeners.  
**Gate:** all 50 existing SYNC tests plus page-script, CSP, PWA-cache, keyboard, mobile-history, and accessibility checks.

### A2. Idempotent delivery, offline recovery, and safety — 4–6 engineer-days

- Require a UUID client message ID; conditionally write it once and return the stored result on retries. Assign a server sequence per conversation and reconcile optimistic messages by client ID.
- Use bounded exponential backoff with jitter. Keep an encrypted-at-rest browser queue only after the user enables offline access; send in order on reconnect, retain uncertain deliveries for review, and never duplicate a send.
- Make `sending`, `sent`, `delivered`, and `read` explicit persisted states with monotonic transitions.
- Apply the blocked-pair guard to every message, conversation, presence, call-signal, call-inbox, acknowledgement, attachment-ticket, read-receipt, reaction, edit, and plan route. Recheck immediately before writes, not only during discovery.
- Add account-scoped rate limits: 30 messages/minute with a 300/hour burst ceiling, 10 call starts/10 minutes, and 60 attachment tickets/hour. Return `429` with a retry time. Keep text at 2,000 characters and enforce the attachment policy above on both client and server.
- Add mute and report controls inside each conversation. Mute suppresses alerts without weakening delivery; reports store bounded evidence and never expose another account's private data.

**Future files:** `infrastructure/call-signaling/template.yaml`, SYNC client modules, `assets/offline.js`, `messages.html`, `chat.css`, new idempotency/rate-limit records and tests.  
**Risks:** ordering across devices, retry races, browser storage loss, and false-positive throttling.  
**Tests:** reconnect, ordered replay, uncertain send, duplicate client ID, concurrent devices, blocked users on every route, rate-limit windows, invalid/oversize/disguised audio, mute/report authorization, and cleanup after failed uploads.

**End-to-end encryption:** not in this hardening release. WebRTC calls already use encrypted transport, including through TURN, but stored messages are not application-level E2EE. Adding E2EE now would conflict with multi-device recovery, server-side delivery/read state, abuse reports, and offline replay unless DanzStak first designs device identity, key verification, backup/recovery, and lost-device revocation. Treat that as a separately reviewed security project; do not label current messaging E2EE.

### A3. Push transport with quiet fallback — 4–6 engineer-days

Use an authenticated API Gateway WebSocket connection as the primary transport. Store connection IDs with account ownership and TTL, fan out only authorized message/call/presence events, acknowledge event IDs, and reconnect with backoff and resume cursors. Use the existing HTTP APIs for durable writes and history. When WebSocket delivery is unavailable, poll messages/conversations/calls every 45 seconds; stop all fallback polling while the document is hidden and refresh once after visibility or network recovery. SSE remains the fallback architecture only if WebSocket authorization or bidirectional call signaling proves unsuitable.

**Future files/infrastructure:** version-controlled call-signaling template, WebSocket handlers/routes/connection table permissions, SYNC transport module, `chat.js`, `incoming-calls.js`, feed presence code, deployment scripts, tests.  
**Risks:** stale connections, fanout retries, reconnect storms, out-of-order push events, and account-isolation errors.  
**Tests:** connect/auth rejection, resume after disconnect, duplicate/out-of-order events, expired connections, hidden-tab suspension, slow-poll fallback, multi-tab/device fanout, and forced provider failure.

**Request estimate per visible active SYNC tab:** today, the 3-second message poll (1,200/hour), 2-second call inbox (1,800/hour), 15-second conversation poll (240/hour), and 30-second directory/presence/friends refresh (about 360/hour) total roughly **3,600 HTTP requests/hour** before other presence activity; overlapping global presence/call watchers can raise that toward **4,800–6,600/hour**. With WebSocket push, normal idle traffic becomes one connection plus keepalives and event-driven writes—approximately **12–60 transport operations/hour**, depending on keepalive interval. A dropped push connection uses at most **80 fallback HTTP requests/hour** for the four 45-second polls until recovery. Measure actual API Gateway/Lambda/DynamoDB use before and after release rather than treating these estimates as billing guarantees.

### A4. DanzStak-controlled call relay — 3–5 engineer-days plus network testing

Run monitored coturn on DanzStak-controlled infrastructure and DNS, serving TURN over UDP/TCP and TLS. Issue short-lived HMAC credentials only to authenticated, authorized call participants; rotate the shared secret in a secret store and never expose it in Git. Return time-bounded ICE configuration from the API, remove Google STUN, prefer direct peer-to-peer paths, and fall back to TURN when NAT traversal fails. TURN relays encrypted WebRTC packets and must not log media content.

**Future files/infrastructure:** coturn configuration/IaC, credential endpoint and IAM policy, `assets/chat.js`, network/health/deployment documentation and tests.  
**Risks:** relay bandwidth cost, regional latency, abuse, credential replay, port/firewall errors, and single-region outage. Start with explicit concurrency/egress alarms and quotas; rough fixed compute is $15–40/month before bandwidth, while relayed media egress is the dominant variable cost.  
**Tests:** direct path, forced TURN UDP/TCP/TLS, strict mobile/corporate NAT, expired/tampered credentials, blocked callers, relay outage, reconnect, one-answer-wins, audio/video cleanup, and Android/iPhone/desktop calls.

## Part B — EPK Builder

### B1. Thirty-second public EPK and link cards — 4–6 engineer-days

Build a phone-first public hierarchy: hero photo/logo, artist and one-line pitch, primary Listen/Watch links, next confirmed shows, short biography, selected press, and booking contact. Render music/video as clean external-provider link cards; never upload or proxy music/video. Provide server-rendered title, description, canonical URL, and approved hero metadata so email/chat link previews work without executing JavaScript. Keep private fields and non-public files out of public responses and metadata.

**Future files:** `epk.html`, `assets/epk.js`, `assets/epk.css`, public EPK route/renderer in the Auth API or a narrowly scoped public renderer, Booking/Tour read model, CSP/service-worker references, tests.  
**Risks:** crawler metadata leakage, stale previews, provider embed privacy, and poor empty states.  
**Tests:** publish/unpublish, public/private field filtering, link-card safety, metadata without authentication, 320–430px/desktop visual checks, keyboard/screen-reader use, performance, and no audio-upload controls.

### B2. Press PDFs and professional production package — 5–8 engineer-days

- Provide deterministic one-page and full press layouts with print-safe typography, URLs, page breaks, and accessible source HTML.
- Add a grid-based stage-plot builder with named/numbered performers, microphones, DIs, monitors/IEMs, backline, power, risers, and notes. Derive an editable input list with channel, source, mic/DI, stand, phantom power, patch, and monitor mix; pair it with technical and hospitality rider sections.
- Export stage plot, input list, tech rider, and full EPK as professional PDFs after validating print output against representative small-club and production workflows. Preserve current image/PDF upload limits; no audio/video files.

**Future files:** EPK editor/view/style modules, new stage-plot/input-list domain helpers, backend validation fields, PDF/print templates, tests and fixtures.  
**Risks:** unreadable scaling, unsafe free text, inconsistent PDF engines, and production documents too vague for crews. Require owner/production review before calling templates professional.  
**Tests:** one-page/full PDF snapshots, page size/margins, long names, empty/large input lists, stage-plot positioning, saved/reloaded revisions, safe filenames, and PDF accessibility/manual print inspection.

### B3. Privacy-safe stats and share controls — 3–5 engineer-days

- Record only aggregate total and per-day EPK open counts plus last-opened time. Do not store viewer identity, IP, user agent, referrer, or cross-site identifiers; document bot/cache limitations.
- Keep public publishing explicit. Extend private links with owner-selected expiry, server-side expiry enforcement/TTL cleanup, replacement, and immediate revoke. Continue storing only a hash of each token and comparing safely.
- Make download permission explicit per press image/PDF. Generate signed download URLs only for authorized files and views; deny direct retrieval after expiry/revoke.

**Future files:** Auth API EPK routes/model, table/IAM declarations, EPK UI, privacy copy, tests.  
**Risks:** counting bots/previews as opens, cache skew, expired signed URLs, and accidental private-file exposure.  
**Tests:** public count aggregation, no identifying fields, private link expiry/revoke/replacement, constant-time token check, owner isolation, public/private download matrix, expired signed URLs, and concurrent updates.

### B4. Booking/Tour handoff — 2–3 engineer-days

Add one **Attach EPK** action to a saved venue pitch. It stores the selected authorized public or time-limited private EPK URL and revision reference in the draft, shows exactly what the booker can access, and requires artist approval before outreach. It never copies EPK files into messages and never implies that a venue opened or accepted the pitch.

**Future files:** Booking pitch/workspace UI, Booking API validation, EPK share service, Tour Manager tests.  
**Risks:** revoked links in unsent drafts, attaching unpublished content, stale revisions, and contact-permission leaks.  
**Tests:** public/private attachment, expiry warning, revoke before send, owner/account isolation, missing EPK, saved-draft reload, approved-send handoff, and no duplicate files.

## Delivery order and approval gates

Implement A1 → A2 → A3 → A4 and B1 → B2 → B3 → B4 as small pull requests; A and B may proceed independently after owner approval. Each PR runs `test-regressions.ps1`, its new focused tests, browser/accessibility checks where UI changes, and review checks. Infrastructure phases require a separate cost/security review and explicit deployment approval. Estimated total for one engineer is **27–42 engineer-days**, excluding owner device testing, production review, and deployment. Stop a phase when privacy, authorization, data integrity, call connectivity, or document-quality evidence is incomplete.
