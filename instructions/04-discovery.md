# 04 — Worldwide record-store and live-venue discovery

Record-store and music-venue discovery must work worldwide, not just in a limited list of cities. Support natural-language queries (e.g. “record stores Eindhoven Netherlands” and “punk clubs Seattle”), location disambiguation, map pins, and useful grounded contact/booking details where available. Cover multiple genres including techno, punk, rock and live music.

Inspect current search providers, API quotas, geocoding, ranking, pagination, and error paths. **Never treat provider failure as proof there are no businesses.** Clearly distinguish zero matches from upstream errors. Do not fabricate addresses, booking emails, or ratings.

**Acceptance:** run representative searches across several continents; compare results to the provider responses; verify map pins and links; report coverage gaps and costs.
