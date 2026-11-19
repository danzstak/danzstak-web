# Worldwide venue discovery

## Design

Venue discovery no longer depends on the curated West Coast fallback directory. The directory remains useful evidence, but every search starts from a geocoded locality and queries live providers at request time.

The provider pipeline is:

1. Amazon Location Service Places, using geographically bounded text queries.
2. OpenStreetMap Overpass, using public venue, club, live-music and music tags.
3. Google Places Text Search (New), when `GOOGLE_PLACES_API_KEY` is configured.
4. Brave Web Search, when `BRAVE_SEARCH_API_KEY` is configured. These results are shown separately as research leads, never as verified venues.
5. The moderator-reviewed DanzStak venue directory as supplemental evidence.

Provider credentials are read only by the Lambda. They must never be placed in browser JavaScript, HTML, the repository or a mobile build.

Discovery and booking suitability are separate. A plausible current venue remains visible when its genre, room type or booking contact is uncertain. The API marks it `needs-research` and states why. It is not presented as confirmed availability.

## Configuration

Neither optional provider is required for the Lambda to start. When a key is absent, provider status says `Not configured`, and AWS Places plus OpenStreetMap continue to work.

Set optional keys on the existing Lambda environment through the normal secret-management workflow:

- `GOOGLE_PLACES_API_KEY`: enable Places API (New), restrict the key to that API and to the production workload where supported.
- `BRAVE_SEARCH_API_KEY`: enable the Brave Web Search API and keep the subscription token server-side.
- `OSM_OVERPASS_ENDPOINTS`: optional comma-separated HTTPS Overpass mirrors.

The Google request uses a field mask and at most two pages for each of five query shapes. Google documents a maximum of 20 results per page and up to 60 across pages. Website and phone fields trigger the Text Search Enterprise SKU, while the other requested fields are Pro fields. Consult the live [Google Places billing documentation](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing/) and [pricing list](https://developers.google.com/maps/billing-and-pricing/pricing) before enabling it. At the time of implementation, the global list showed 1,000 free monthly Enterprise calls followed by $35 per 1,000 at the first paid tier; pricing can change. A cold DanzStak search can make up to ten billable Google requests, approximately $0.35 at that first paid tier, while an identical cached search makes none.

Brave Web Search is limited here to two queries with ten results each. Its [official pricing page](https://api-dashboard.search.brave.com/documentation/pricing) listed $5 per 1,000 requests with monthly free credits at implementation time, so a cold two-query search is approximately $0.01 beyond the free credit. DanzStak does not crawl the returned pages. It displays the source link and snippet as an unverified research lead.

## Reliability and coverage

- Discovery responses cache identical searches for 15 minutes.
- AWS SDK clients retry transient failures.
- Google, Brave and Overpass requests have abort timeouts.
- Google pagination is bounded.
- Provider status and partial coverage are returned to the user.
- A zero-result response says that no relevant public leads were found in the searched radius; it does not claim that no venue exists.
- Searches under five candidates expand once, while the user can continue to a maximum radius of 150 miles.
- Results include actual locality and distance when available.
- Permanent closures reported by a provider are not returned as booking leads.

This is worldwide by design, not a claim that every venue worldwide is indexed. Public listings can be incomplete or stale, and every booking contact and calendar must be confirmed.

## Reproducible benchmark

Run the read-only AWS benchmark with authenticated AWS credentials:

```powershell
node scripts/benchmark-worldwide-venues.mjs
```

The benchmark covers Novara, Eindhoven, the small town of Momo, Japanese non-Latin input and ambiguous `Springfield` geocoding. It records locality alternatives and live provider results without inserting benchmark venue names into production code.

On 2026-11-03, the existing AWS-only provider demonstrated the gap this change addresses:

- Novara local-language searches returned only sparse results, although current official sites show Ryan's, Celebrita, Phenomenon and Gilda operating in the wider Novara area.
- Eindhoven returned Dynamo but missed several current rooms; Eindhoven's official city guide lists POPEI, Effenaar, Altstadt and Dynamo, while official sites confirm LAB-1 and De Club.
- Japanese text geocoded and returned a live-house result.
- `Springfield` returned several materially different locality alternatives instead of being treated as unambiguous.

The optional licensed Places and web-search providers are the implementation path for closing those live coverage gaps. Their presence must be tested with project-owned keys before enabling production traffic.

## Source verification used for the benchmark

- [Ryan's official site](https://www.ryans.it/)
- [Phenomenon official site](https://www.phenomenon.it/chi-siamo)
- [Celebrita official site](https://www.discotecacelebrita.com/)
- [Gilda official site](https://discotecagilda.com/)
- [Eindhoven official city guide to live music venues](https://www.thisiseindhoven.com/en/see-and-do/nightlife/music-venues-for-live-music)
- [Altstadt official site](https://www.altstadt.nl/live-music/)
- [LAB-1 official site](https://www.lab-1.nl/en/about-lab-1/)
- [De Club official site](https://www.declubeindhoven.nl/)

