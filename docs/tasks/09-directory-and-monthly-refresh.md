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
