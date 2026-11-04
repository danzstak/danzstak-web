# SYNC calling-device registration

Status: **Implemented on draft PR #47; local/fixture tested; not deployed.**

SYNC device registration authorizes one browser/PWA installation to participate in DanzStak account-to-account voice or video signaling. It does not verify a handset subscriber, activate a carrier number, enable PSTN/SMS/emergency calling, or gate ordinary Chat, Friends, profiles, or signup.

## Register → call → one device answers → revoke

```mermaid
sequenceDiagram
    participant P as Member PWA
    participant API as DanzStak API
    participant D as CallingDevices table
    participant C as CallSignals table
    participant A as Callee device A
    participant B as Callee device B

    P->>API: POST /calls/devices/challenge (authenticated session)
    API->>D: Store SHA-256(challenge), 5-minute TTL
    API-->>P: One-time challenge
    P->>API: POST /calls/devices/register (challenge + device name)
    API->>D: Atomic consume challenge + create hashed device credential
    API-->>P: Device ID + one-time device token

    P->>API: POST /calls/signal (offer + registered-device headers)
    API->>C: Store expiring offer
    API-->>A: Push/poll offer for active registered device
    API-->>B: Push/poll offer for active registered device
    A->>API: POST answer bound to exact offer event
    B->>API: POST answer bound to same offer event
    API->>C: Atomic claim + consume offer + deliver one answer
    API-->>A: 202 accepted (winner)
    API-->>B: 409 CALL_ALREADY_ANSWERED (loser)
    B->>B: Stop local ring/media state

    P->>API: DELETE /calls/devices?deviceId=…
    API->>D: Mark revoked, disable calls, remove credential hash
    API->>API: Delete linked push subscriptions
    API-->>P: Revoked
```

## API contract

| Method and route | Purpose | Important controls |
|---|---|---|
| `POST /calls/devices/challenge` | Begin enrollment | Authenticated session, trusted mutation origin, random 32-byte challenge, digest stored for five minutes |
| `POST /calls/devices/register` | Register one installation | Challenge digest timing-safe comparison; atomic challenge consumption; maximum ten active installations; token returned once |
| `GET /calls/devices` | List the member's devices | Account partition only; returns name, status, registration time, last use and current-device hint; never returns token hashes |
| `PATCH /calls/devices` | Rename or allow/disable calls | Account-scoped conditional update; revoked devices cannot be re-enabled |
| `DELETE /calls/devices` | Revoke a device | Removes token hash, disables calls and deletes linked push endpoints |
| `POST /calls/signal` | Offer, answer or hang up | Phone/video requires registered-device headers; contact authorization remains enforced |
| `GET /calls/inbox` | Foreground call polling | Registered active device required; internal answer-claim records are excluded |
| `POST /calls/ack` | Consume handled signals | Registered active device required; account partition only |

## Data model

`DANZSTAK-CallingDevices` uses `userEmail` as its partition key and `deviceId` as its sort key.

- Challenge record: `CHALLENGE#<UUID>`, challenge digest, creation time and TTL.
- Registered record: random UUID, editable name, SHA-256 device-token digest, `allowCalls`, registration time, last-use time and optional revocation time.
- The browser keeps the returned device ID and token in origin-scoped IndexedDB. They are sent only as request headers to DanzStak call/push endpoints and never in URLs.
- The table is encrypted, retained across stack updates, protected by point-in-time recovery, and uses TTL only for short-lived challenge cleanup.

`DANZSTAK-CallSignals` remains the short-lived signaling table. A successful answer adds `CLAIM#<callId>` and removes the exact offer in the same DynamoDB transaction that writes the answer for the caller. The claim expires with the call window.

Push subscriptions remain separate records. A subscription is call-eligible only when it is linked to an active registered device with `allowCalls=true`. Denying push permission does not prevent foreground call polling.

## Security and operating risk

- The installation secret is a high-entropy bearer credential, not a hardware identity and not guaranteed to be non-exportable or hardware-backed.
- Stolen browser storage plus a valid account session remains a risk; account session checks, account-scoped lookup and immediate revocation limit it. A future reviewed design may add a non-exportable WebCrypto possession key without claiming hardware attestation.
- Device activity writes are throttled to roughly once per minute so two-second foreground polling does not create a DynamoDB write on every request.
- Call records and answer claims expire automatically. Calling devices are durable security records and must be explicitly revoked.
- Ten active devices is an abuse/safety cap, not a paid entitlement.
- Other ringing devices currently stop on their next inbox reconciliation or receive the explicit conflict if they answer concurrently. A dedicated answer-cancel push is a future latency improvement, not evidence that multiple answers can commit.
- Production release requires an isolated AWS review stack, two accounts, at least two real receiving installations, push-denied foreground coverage, real two-way audio/video, revoke/reinstall tests, and owner approval.

