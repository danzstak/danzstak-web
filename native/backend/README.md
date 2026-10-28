# Native chat backend changes

`chat-options.patch` is a scoped patch against the live signaling function retrieved during this build. It adds authenticated chat settings, mute-aware delivery, expiration filtering and sender-owned attachment deletion. It was deployed with a Lambda revision guard, preserving other backend changes. Do not redeploy an older complete template over it. Merge these functions into the current signaling infrastructure source on the PC before future deployment, preserving subsequent work.

Settings reuse POST `/messages` with `action: settings`, `contactEmail`, optional `muted`, and optional `disappearingSeconds` (0, 86400, 604800 or 7776000). Mute belongs to the current account; message timers are shared by the two participants and apply only to newly sent messages. Expired text and previews are excluded by the API; stored expired attachments are deleted on the next conversation read. No new scheduler or AWS service was created.

POST `/messages/delete?contact=...` with `removeSentMedia: true` clears the actor's chat and deletes only that actor's sent attachment objects for both participants. Receiver-owned objects are preserved. This cannot delete copies exported outside DanzStak.

Run `node native/backend/check-chat-options.cjs /path/to/merged/index.js` before deploying. The fixture verifies timer validation, mirrored preferences, sender ownership, media deletion and expiration cleanup without touching any real message or media.
