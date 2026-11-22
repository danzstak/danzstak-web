# Task 09 — Starter directory + monthly refresh (radio, record stores, press)

## Owner direction (2026-11-16)
The Booking Agent needs real lists of radio stations, record stores and zines/press. "It should update monthly or every 2 months — things change."

## The seed
`data/directory/west-coast-seed.json` holds 50 entries researched 2026-11-16: 15 radio, 23 record stores, 12 press. They cover Sacramento/Davis, SF Bay Area, LA, Portland, Seattle/Olympia, plus national metal press.
- Public organization info only: name, city, genres, website, public notes, sources. No personal emails.
- Radio entries say `ads: yes | underwriting | no | unknown`. KXLU, for example, takes no ads or underwriting, only on-air and rotation. Drafts must use the right wording (task 04).
- `status: seed` means found in public sources on `checkedAt`. `status: unverified` means it needs a check before it is shown.

## Build
1. **Import** the JSON into DynamoDB as `DIRECTORY#<type>/<id>`, with genres, city, lat/lng (AWS Location geocode of city/address) and status. The import is idempotent and can be re-run.
2. **Use it**: the Town plan (task 03), Radio (task 04) and Press (00 plan) suggest entries near a confirmed show (default within 50 mi), filtered by genre. Entries with `ads: no` never offer an ad request. Unverified entries show "Unverified — check before contacting".
3. **Monthly refresh job** (EventBridge schedule, 1st of each month, 03:00 UTC, one Lambda, small batches):
   - Website reachable: HTTPS HEAD/GET with timeouts and the SSRF guard, and record the status code. Two failed months in a row mark the entry `stale`; a domain that no longer resolves marks it `closed?`.
   - Mail domain has MX (reuse `booking-contact-check.mjs`) when a contact email exists.
   - Member signals (task 07 style): replies, in-stores booked, on-air done, bounces, and "closed / changed contact" reports all update `lastActivityAt`.
   - Write `checkedAt` and a short `refreshLog`. Never delete anything automatically; `closed?` and `stale` go to the owner review list (same script pattern as `review-venue-reports.ps1`).
4. **Every 2 months, research new entries**: a scheduled research run (outside the app) proposes additions and closures as a PR to `data/directory/`. The owner merges it, and the import picks it up.
5. **Members can suggest** a station, store or zine (name, city, website). The owner approves it into the directory.

## Tests
- Import is idempotent; `ads: no` entries never get an ad draft; unverified entries are labeled.
- The refresh job marks stale after 2 failed checks, never deletes, respects timeouts and the SSRF guard, and doesn't touch private networks.
- The geo filter returns entries within the radius of a show, matching genre.

## Build plan for Claude Code (Claude, planning session, 2026-11-22)
Owner 2026-11-22: "Claude plans and Code codes." Claude researches the data and writes this plan; **Claude Code builds it**. The planning session never pushes code.

**When:** week 3 (4–10 Dec), **before F15g town plan and F15i scene news**, which both read this directory. Not before: THE DIRECTIVE's "no new features until the fix list is done" still applies. Queue row `DIR` in `docs/tasks/QUEUE.md`.

**Data today:** `data/directory/west-coast-seed.json` has 59 entries (radio, record stores, press) once the owner merges the refresh in PR #654. The monthly research routine keeps adding to it through PRs on `data/directory/` only. Statuses in use: `seed`, `unverified`, `closed?` (later `stale` from the job below). Keep the JSON schema as it is. Code must not edit entries by hand; data changes come from the research PRs.

One PR per step, in this order. Every step gets the tests listed, and its UI gets browser checks at 320/360/390/430px with centre taps.

### DIR-1. Import (Auth API, owner deploys)
- New module `infrastructure/auth-api/directory.mjs`, following the pattern of `club-directory.mjs`: `directoryItemFromSeed(entry)` validates each entry (https-only websites, text limits, known `type`/`status`/`ads`/`inStores` values, no email fields at all) and produces `PK=DIRECTORY#<type>`, `SK=<id>`, plus `city`, `region`, `genres`, `status`, `ads`, `inStores`, `website`, `sources`, `checkedAt`.
- Script `infrastructure/auth-api/import-directory.mjs`: dry run by default (counts of new / changed / unchanged / `closed?`), `--apply` writes. **Idempotent**: re-running it with the same JSON changes nothing. It never deletes an item that's no longer in the JSON. Geocode the city once per city (AWS Location, the place index the Booking search already uses) and cache lat/lng on the item.
- Least-privilege IAM: one managed policy `DanzStakDirectory` (Get/Put/Update/Query on the directory key prefix only), added to `aws-deploy-auth-api.ps1` (create if missing, attach).
- Owner-session box line: CloudShell command for the dry run and then `--apply`.
- Tests: `test-directory-import.cjs` (idempotent; rejects http links, emails and unknown statuses; `closed?` entries import but are flagged).

### DIR-2. Use it: Radio stations page + nearby suggestions
- `GET /directory?type=radio|record_store|press&near=<lat,lng>&radiusMi=50&genre=` (signed-in), newest-checked first, `closed?` and `stale` hidden from members.
- This builds queue row **T2i** (Radio stations page) on real data instead of an empty state: a list of name, city, genre chips, website, and "On-air · Rotation · Underwriting" chips from the fields. **"Unverified: check before contacting"** label on `unverified` entries. Record shops get the same list on `record-stores.html`. UI kit / F8 look, i18n for every string.
- **Rules:** an entry with `ads: no` never offers an ad request; `underwriting` uses the underwriting wording (task 04), never "ad". There are no personal emails in the data, so contact always goes to the public website or submission page.
- Hand-off: F15g (town plan) calls the same route with the gig's city and genre.
- Tests: `test-directory-route.cjs` (radius and genre filter, hidden statuses, `ads: no` gives no ad action); browser check `browser-checks/radio-directory.cjs`.

### DIR-3. Monthly website check (owner deploys)
- One Lambda on an EventBridge schedule (1st of the month, 03:00 UTC), small batches. HTTPS HEAD, then GET, with a 5 s timeout. **SSRF guard:** resolve first and refuse private, loopback, link-local and metadata addresses; https only; at most 3 redirects, each re-checked.
- It writes `lastCheck` (status code, date) and a short `refreshLog`. Two failed months in a row → `stale`. A domain that no longer resolves → `closed?`. It **never deletes**.
- `review-directory.ps1` (same pattern as `review-venue-reports.ps1`) lists `stale` / `closed?` entries for the owner.
- Tests: `test-directory-refresh.cjs` (stale after 2 failures, never deletes, timeouts, private-address refusal, redirect re-check).

### DIR-4. Members suggest an entry
- "Suggest a station / shop / zine" (name, city, https website) from the DIR-2 pages. It's stored as `DIRECTORY#SUGGESTION`, rate-limited (5/day per account), and goes into the owner's review list. Nothing shows to members until the owner approves it. The approved entry also goes into the next research PR, so the JSON stays the source of truth.
- Tests: rate limit, https-only, a suggestion never appears in `GET /directory` before approval.

### Done means
A tester in a covered city opens Radio stations or Record shops and sees real, labelled entries near them. A confirmed gig's town plan (F15g) offers that town's shops and stations. Nothing unverified looks verified, and nothing offers an ad to a station that takes none.
