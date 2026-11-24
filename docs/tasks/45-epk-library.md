# 45 — EPK library: several EPKs, several per artist, every published version kept

Owner 2026-11-24: "need a way to see my previous published epk", "users may have a bunch of epk", "and also several per
artist". Asked "several EPKs, version history, or both?": **both**.

This replaces the 2026-11-23 decision "several acts use several accounts" (closed #175): one account now holds several
EPKs, several of them can be for the same artist, and each keeps its published versions.

## What's wrong today (found in the code, 2026-11-24)
- **One EPK per account.** `epkWorkspace` (`infrastructure/auth-api/index.mjs`) keeps one record, `tourId =
  epk-workspace-v1`, and one public copy (`epk-public / <publicId>`).
- **"Save draft" takes the published EPK offline.** `save(false)` (`assets/epk.js`) is used by both Save draft and
  Unpublish, and the server deletes the public copy on every `publish: false` save. An artist who publishes, then edits
  and saves a draft (for example after an AI build), has no published EPK any more, and the link venues hold stops
  working.
- **No history.** Publishing overwrites the public copy; nothing earlier is kept. Media a newer save no longer uses is
  deleted from S3.
- **Venue links send the draft.** `outreachEpkShare` copies the account's draft `plan` into the venue's link, not the
  published EPK, so unsaved work can reach a venue.

## What members get
### My EPKs
- The EPK builder opens on the EPK last worked on, with its name in the header: **"Eroticon · Live set ▾"**.
- Tapping it opens **My EPKs**, grouped by artist. Each row shows the label, Published / Draft, and the date it was
  last published. Actions:
  - **+ New EPK**: start blank, or start from a copy of this one (same artist, new label).
  - **Rename** the label.
  - **Delete this EPK**, with the Delete everywhere rules: its link, review link, venue links, share card, versions and
    files go.
- An EPK has an **artist** (the act name already in the EPK) and a short **label** that tells same-artist EPKs apart
  ("Live set", "DJ set", "Festival", "Italia").
- **At most 5 EPKs per artist** (owner, 2026-11-24: "an artist should have a limit of 5 epk per artist"). The 6th
  is refused with a translated line, and the server enforces it.
  - An account that manages several artists also has an overall cap of 20 EPKs. That number is a default against
    abuse, not an owner rule, and can change.
- Each EPK has **its own link** (`danzstak.com/e/<id>`), review link, share card and publish switch.

### Versions
- **Save draft never takes the published EPK offline.** Venues keep seeing the last published version until the artist
  publishes again or taps **Unpublish**, which is confirmed first.
- Under Publish: "Venues see the version you published on 24 Nov. Your changes are a draft." When nothing changed:
  "Published 24 Nov."
- **Published versions** opens the list (newest first, the last **20** per EPK):
  - **View** shows that version exactly as venues saw it (owner only).
  - **Bring back** loads it into the builder as a draft; publishing makes it live again.

### Booking and AI
- Owner, 2026-11-24: "artist might send a different to different venues or festivals". Every pitch picks **which EPK**
  goes with it ("Send with: Eroticon · DJ set"), for example a club EPK to clubs and a festival EPK to festivals.
  - The default for a venue is the EPK sent to it last time; otherwise the EPK last sent to that kind of place (club,
    festival, record shop, radio); otherwise the only published one.
  - The booking pipeline shows which EPK each venue got.
  - A follow-up sends the same EPK as the first pitch unless the artist changes it.
- Venue links carry that EPK's **published** version, never a draft.
- An AI EPK build asks which EPK to fill: an existing one, or a new one for that artist. One credit is still one build.

## How it's stored (DANZSTAK-Tours, partition = member id)
- EPK: `tourId = epk#<epkId>` with the draft `plan`, `label`, `publicId`, `published`, `publishedAt`, `createdAt` and
  `updatedAt`.
  - The existing `epk-workspace-v1` record stays where it is and is EPK `main`. Nothing is migrated.
- Public copy: `epk-public / <publicId>`, unchanged, plus `epkId`. It is written only on publish and deleted only on
  Unpublish or Delete.
- Version: `tourId = epkv#<epkId>#<publishedAt>` with the published `plan`. Publishing the 21st version drops the oldest.
- Files: a file is deleted only when no EPK draft, public copy or kept version of the account still uses it. Each save
  queries the account's EPK and version records to check.
- Routes: the existing `/epk` route, with `?epk=<id>`, `?list=1`, `?versions=1` and `?version=<publishedAt>`. POST
  bodies carry `epkId` and `action` (`draft` | `publish` | `unpublish` | `create` | `duplicate` | `rename`). No new API
  Gateway routes.
  - Old pages that send `{ kit, publish }` keep working: they mean EPK `main`, and `publish: false` now saves a draft.

## Build order (one release train each, browser checks at 320–430 px, it/fr/es)
1. **Train A: fix + versions.** Draft save keeps the published EPK online; explicit Unpublish; a version on every
   publish; the Published versions list (View / Bring back); venue links use the published version.
   - Checks: publish → save draft → the public link still shows the published version; Unpublish → 404; 21 publishes
     keep 20; Bring back → publish → live; a venue link never carries a draft; no file used by a kept version is
     deleted.
2. **Train B: several EPKs.** My EPKs (group by artist, new / copy / rename / delete), per-EPK link, review link and
   card; booking's "Send with" picker; AI build picks the EPK; Music HQ counts across EPKs.
   - Checks: two EPKs for one artist publish to two links; deleting one leaves the other untouched; a pitch sends the
     chosen EPK; a 6th EPK for one artist is refused (server and screen).
3. Restyle on the UI kit with the rest of week 2.

## Can the owner's earlier published EPK come back?
- If it was replaced or taken offline before Train A ships, the server holds no copy. It can only come back from the
  table's point-in-time backup, if DANZSTAK-Tours has point-in-time recovery turned on.
- Read-only check, in **CloudShell**:
  `aws dynamodb describe-continuous-backups --region us-west-1 --table-name DANZSTAK-Tours`
- If it's on, the owner's record can be read from a restore taken at a time before the change, into a new table, and
  put back as a version.
