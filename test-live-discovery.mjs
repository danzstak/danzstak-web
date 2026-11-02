import assert from "node:assert/strict";
import {
  geocodeTourPlace,
  multiSourceDiscovery,
  isRecordStore,
  isBookableClub,
  deduplicateVenues
} from "./infrastructure/auth-api/index.mjs";

const cases = [
  ["Bologna, Italy", "techno"],
  ["Berlin, Germany", "punk"],
  ["London, United Kingdom", "live music"],
  ["Tokyo, Japan", "rock"],
  ["Seattle, Washington, USA", "punk"],
  ["Momo, Piedmont, Italy", "rock"]
];

const report = [];
const milesBetween = (left, right) => {
  const meanLatitude = (Number(left[1]) + Number(right[1])) / 2 * Math.PI / 180;
  return Math.hypot((Number(left[0]) - Number(right[0])) * 69 * Math.max(0.2, Math.cos(meanLatitude)), (Number(left[1]) - Number(right[1])) * 69);
};
for (const [location, genre] of cases) {
  const point = await geocodeTourPlace(location);
  const [venueDiscovery, storeDiscovery] = await Promise.all([
    multiSourceDiscovery(point, "venue", { genre, radiusMiles: 25 }),
    multiSourceDiscovery(point, "record-store", { radiusMiles: 30 })
  ]);
  const venues = deduplicateVenues(venueDiscovery.places.filter(place => milesBetween(point.position, place.position) <= 25).filter(place => isBookableClub(place, genre)));
  const stores = deduplicateVenues(storeDiscovery.places.filter(place => milesBetween(point.position, place.position) <= 30).filter(isRecordStore));
  assert.ok(venueDiscovery.providers.some(provider => provider.ok), `${location}: every venue provider failed`);
  assert.ok(storeDiscovery.providers.some(provider => provider.ok), `${location}: every record-store provider failed`);
  assert.ok(venues.every(place => place.position.length === 2 && place.sources?.length), `${location}: venue coordinates or attribution missing`);
  assert.ok(stores.every(place => place.position.length === 2 && place.sources?.length), `${location}: store coordinates or attribution missing`);
  assert.ok(venues.length > 0, `${location}: no geographically relevant venue survived validation`);
  assert.ok(stores.length > 0, `${location}: no geographically relevant record store survived validation`);
  report.push({ location, genre, venues: venues.length, stores: stores.length, venueProviders: venueDiscovery.providers, storeProviders: storeDiscovery.providers });
}

console.log(JSON.stringify({ testedAt: new Date().toISOString(), report }, null, 2));
