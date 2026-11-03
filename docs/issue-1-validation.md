# Issue #1 validation

Validated from branch `codex/issue-1-core-products` on 2026-11-03. Production was not changed.

## Reproduce

```powershell
node test-live-discovery.mjs
powershell -ExecutionPolicy Bypass -File .\test-regressions.ps1
```

The live check geocodes each place, queries the configured authorized providers, rejects results outside the requested radius, applies the same venue/store qualification used by the API, verifies coordinates and source attribution, and fails if every provider fails or no qualified result remains.

## Live discovery results

| Product | Location | Music style | Qualified results |
| --- | --- | --- | ---: |
| Venues | Seattle, USA | punk | 3 |
| Venues | Seattle, USA | hardcore | 1 |
| Venues | San Francisco, USA | rock | 2 |
| Venues | San Francisco, USA | alternative | 4 |
| Venues | Los Angeles, USA | live music | 8 |
| Venues | Bologna, Italy | all live music | 28 |
| Venues | Berlin, Germany | techno | 2 |
| Venues | Berlin, Germany | punk | 1 |
| Venues | Berlin, Germany | rock | 1 |
| Venues | Paris, France | jazz | 4 |
| Venues | Paris, France | blues | 1 |
| Venues | London, UK | indie | 4 |
| Record stores | Bologna, Italy | — | 6 |
| Record stores | Berlin, Germany | — | 52 |
| Record stores | London, UK | — | 51 |
| Record stores | Tokyo, Japan | — | 3 |
| Record stores | Seattle, USA | — | 41 |
| Record stores | Momo, Italy | — | 6 |

These are discovery leads, not claims of availability or confirmed booking contacts. DanzStak displays source attribution and tells artists to verify the current calendar, submission policy, and booking contact before outreach.

## Provider state during the run

- AWS Places returned data for every case above.
- The configured public OpenStreetMap Overpass mirrors timed out from the test environment. The API retained the healthy AWS results and reported OpenStreetMap as `Provider temporarily unavailable`; it did not turn the outage into a false empty result.
- Because discovery results and provider availability change, counts are evidence for this run rather than permanent expected totals.

## Automated acceptance coverage

- `test-booking-discovery.cjs`: natural-language venue search, paging, radius expansion, attribution, errors, and safe UI rendering.
- `test-booking-route-markets.cjs`: intermediate route markets, round trips, date planning, and market-failure isolation.
- `test-booking-map-drawing.cjs`: visible-area search, freehand route search, selection, and map/list consistency.
- `test-booking-venue-quality.cjs`: venue qualification, genre/type filters, contact evidence, deduplication, and false-positive rejection.
- `test-record-stores.cjs`: worldwide search, paging, wider-area search, attribution, placement workspace, and route integration.
- `test-discovery-error-diagnostics.cjs` and `test-discovery-provider-backoff.cjs`: provider failures remain visible and healthy providers continue.
- `test-epk-builder.cjs`, `test-epk-domain.cjs`, and `test-epk-network-recovery.cjs`: authenticated photo/logo/PDF upload tickets, validation, quota, private storage, replace/delete, public/private sharing, safe rendering, and stalled-request recovery.
- `test-infrastructure.ps1`: the deployment template and embedded Lambda syntax validate.

The complete local regression suite passed after this live run. GitHub Actions independently runs the same repository regression gate for the pull request head.

## Remaining external risk

Public Overpass instances are community infrastructure and may be slow or unavailable. DanzStak does not hide that outage and does not depend on it as the sole source. A production-operated or contracted secondary place provider would reduce this availability risk further; adding one requires an approved provider account and licensing terms.
