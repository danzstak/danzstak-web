# Venue discovery validation — 2026-11-03

This PR extends the worldwide discovery foundation already in the target branch. No production deployment was run. It does not claim that every venue has been indexed or accepts bookings.

## Reproduction and observed coverage

`node scripts/benchmark-worldwide-venues.mjs` reproduces the earlier sparse, local-language AWS query benchmark. `node scripts/validate-venue-pipeline.mjs` runs the updated pipeline, records provider health, sources and website evidence, and writes `docs/venue-pipeline-live-results.json`. Both are read-only. Use AWS credentials in the usual SDK credential chain; set optional Google and Brave keys only in the local process or server environment.

The live updated run used AWS Places, 25-mile radius, bounded pagination, broad and regional queries, and website research. OpenStreetMap mirrors failed and the Google/Brave keys were absent. Consequently these are **partial coverage results**, not full-provider acceptance results. Counts include uncertain map leads and require editorial review; they are not counts of confirmed music venues.

| Location | Earlier limited AWS queries | Updated pipeline within 25 miles |
| --- | --- | --- |
| Novara, Italy | Of the four requested benchmarks, only Gilda appeared | Ryan's, Celebrità, Phenomenon and Gilda all returned; actual towns retained |
| Eindhoven, Netherlands | Dynamo returned; other requested names absent | Dynamo and De Club returned; Altstadt, Effenaar, LAB-1 and POPEI still missing without the optional providers |
| Momo, Italy | One generic music listing | Regional leads including the four Novara benchmarks; no claim they are in Momo itself |
| 東根市, Japan | One live-house result in the broader baseline area | Non-Latin locality resolved and local venue candidates returned; source quality needs review |
| São Paulo, Brazil | No earlier baseline run | Accented locality resolved; multiple venue candidates returned |
| Nairobi, Kenya | No earlier baseline run | Locality resolved; multiple venue candidates returned |
| Wānaka, New Zealand | No earlier baseline run | Locality resolved; zero classified leads in this run, with incomplete coverage |
| Springfield | Multiple geographic matches | HTTP-style 409 disambiguation with five alternatives, rather than silently choosing Illinois |

The new query terms contain no benchmark venue names. The raw JSON includes timestamps and sources, and can be compared with later configured-provider runs. Provider results can change.

## Benchmark source checks and suitability

| Venue | Actual locality and public evidence | Interpretation |
| --- | --- | --- |
| [Ryan's](https://www.ryans.it/) | Novara; official site advertises club nights, DJs and live music | Active public website; no specific Tekno or punk booking proof |
| [Celebrità](https://www.discotecacelebrita.com/) | Trecate; official nightclub site and event listings | Regional dance lead; genre and artist submissions need checking |
| [Phenomenon](https://www.phenomenon.it/shary-band-20261113) | Fontaneto d'Agogna; dated November 2026 band show followed by DJs | Current mixed programming; [hard-rock tribute calendar](https://www.phenomenon.it/ac-di-best-ac-dc-tribute-band-in-europe-20261120) supports live-band relevance, not every genre |
| [Gilda](https://discotecagilda.com/) | Castelletto Sopra Ticino; official rooms, DJs and event listings | Regional nightclub, not Novara municipality; current dates/availability need confirmation |
| [Altstadt](https://www.altstadt.nl/faq/) | Eindhoven; official FAQ describes live music and DJs | Mixed programming; local artist preference and booking process require checking |
| [Dynamo](https://www.dynamo-eindhoven.nl/stroming/heavy/) | Eindhoven; dated heavy music programme | [Tekno/electronic hardcore](https://www.dynamo-eindhoven.nl/evenement/zinloos-geluid-3/?_stroming_id=840) and [hardcore punk](https://www.dynamo-eindhoven.nl/evenement/koortsdruk-2-0/) have distinct event evidence; the former is a past event, not availability |
| [Effenaar](https://www.effenaar.nl/) | Eindhoven; November 2026 calendar includes postpunk, live crossover and house | Mixed live/electronic programme; still missed by this AWS-only run |
| [LAB-1](https://www.lab-1.nl/en/about-lab-1/) | Eindhoven; cinema, club and event space | Do not reject because cinema is a primary category; music suitability needs event evidence |
| [POPEI](https://www.popei.nl/nld) | Eindhoven; November 2026 showcase/concert calendar and performer information | Real performance lead despite rehearsal and training functions |
| [De Club](https://www.declubeindhoven.nl/) | Eindhoven, Dommelstraat 7; venue website describes DJs and live acts | Website reachable but agenda returned no data; present-day event activity is uncertain |

## Implementation and remaining limitations

- Website research reads up to six provider-listed HTTPS sites, in batches of three, with request timeouts, response-size caps, public IPv4 DNS checks and pinned DNS. It extracts visible programming text and explicit mailto links, retaining source URLs. It does not infer contacts or availability. JavaScript-only pages, IPv6-only sites, anti-bot pages and large HTML pages may yield no evidence. It does not traverse entire calendars.
- Brave searches can discover official websites, calendars and local directories outside the maps databases. Results remain explicit research leads, including in the tour drawer, rather than inventing a venue identity from an article title. Google/Brave live recall remains untested until project-owned keys are supplied. Provider request shape, pagination, local-language priority and rate-limit failures have deterministic fixture coverage.
- AWS pages are capped at two per query and successful queries survive other query failures. Provider health identifies partial AWS responses. AWS SDK transient retries remain enabled; other provider failures surface as partial coverage. There is no durable job queue or cross-instance cache, and large tour fan-out can still encounter provider quotas.
- Discovery cache lasts 15 minutes per Lambda instance and keys include locality, language, genre and radius. Missing optional providers now make coverage partial. Source data may be stale, and the classifier can still include false positives; public contacts are never represented as booking confirmation.
- Local-language templates cover multiple regions, with English fallback elsewhere; this is not full linguistic coverage. World locality resolution depends on the geocoder's data and restrictions. No country or city list gates acceptance.
- Saved tours preserve custom genre text (including Tekno) rather than silently replacing it with DIY Punk. Existing act types, saved tours and outreach records retain their formats.

## Configuration and cost

See [worldwide configuration](worldwide-venue-discovery.md). `GOOGLE_PLACES_API_KEY` and `BRAVE_SEARCH_API_KEY` stay server-side. Website research uses no paid extraction API; it adds outbound requests and Lambda runtime/network usage. The deployment packaging script now includes `venue-research.mjs`; it was edited and validated, not executed.

Google makes up to ten Enterprise Text Search requests per radius, about $0.35 beyond free usage at the currently listed first paid tier. Brave makes two requests per radius, about $0.01 at [$5 per 1,000 requests](https://api-dashboard.search.brave.com/documentation/pricing). Automatic expansion can double these request counts; tour markets multiply them. AWS Places requests, Lambda and network costs are additional. Recheck [Google pricing](https://developers.google.com/maps/billing-and-pricing/pricing) and account-specific quotas before enabling.

## Validation

New behavioral regression tests exercise local-language query priority, Google pagination, deduplication, 429 handling, safe public addresses, source text extraction, explicit contacts, non-Latin venue identity and date-line distance. Live results test eight localities across Europe, Asia, South America, Africa and Oceania, including an ambiguous name and small-town inputs. This is tested sample coverage, not universal proof.
