import assert from "node:assert/strict";
import {
  geocodeTourPlace,
  multiSourceDiscovery,
  isRecordStore,
  isBookableClub,
  deduplicateVenues
} from "./infrastructure/auth-api/index.mjs";

const venueCases = [
  ["Seattle, Washington, USA", ["punk", "hardcore"]],
  ["San Francisco, California, USA", ["rock", "alternative"]],
  ["Los Angeles, California, USA", ["live music"]],
  ["Bologna, Italy", [""]],
  ["Berlin, Germany", ["techno", "punk", "rock"]],
  ["Paris, France", ["jazz", "blues"]],
  ["London, United Kingdom", ["indie"]]
];

const recordStoreCases = [
  "Bologna, Italy",
  "Berlin, Germany",
  "London, United Kingdom",
  "Tokyo, Japan",
  "Seattle, Washington, USA",
  "Momo, Piedmont, Italy"
];

const report = [];
const milesBetween = (left, right) => {
  const meanLatitude = (Number(left[1]) + Number(right[1])) / 2 * Math.PI / 180;
  return Math.hypot((Number(left[0]) - Number(right[0])) * 69 * Math.max(0.2, Math.cos(meanLatitude)), (Number(left[1]) - Number(right[1])) * 69);
};
for (const [location, genres] of venueCases) {
  const point = await geocodeTourPlace(location);
  for (const genre of genres) {
    const venueDiscovery = await multiSourceDiscovery(point, "venue", { genre, radiusMiles: 25 });
    const venues = deduplicateVenues(venueDiscovery.places.filter(place => milesBetween(point.position, place.position) <= 25).filter(place => isBookableClub(place, genre)));
    assert.ok(venueDiscovery.providers.some(provider => provider.ok), `${location} (${genre || "all live music"}): every venue provider failed`);
    assert.ok(venues.every(place => place.position.length === 2 && place.sources?.length), `${location} (${genre || "all live music"}): venue coordinates or attribution missing`);
    assert.ok(venues.length > 0, `${location} (${genre || "all live music"}): no geographically relevant venue survived validation`);
    report.push({ product: "venue", location, genre: genre || "all live music", results: venues.length, providers: venueDiscovery.providers });
  }
}

for (const location of recordStoreCases) {
  const point = await geocodeTourPlace(location);
  const storeDiscovery = await multiSourceDiscovery(point, "record-store", { radiusMiles: 30 });
  const stores = deduplicateVenues(storeDiscovery.places.filter(place => milesBetween(point.position, place.position) <= 30).filter(isRecordStore));
  assert.ok(storeDiscovery.providers.some(provider => provider.ok), `${location}: every record-store provider failed`);
  assert.ok(stores.every(place => place.position.length === 2 && place.sources?.length), `${location}: store coordinates or attribution missing`);
  assert.ok(stores.length > 0, `${location}: no geographically relevant record store survived validation`);
  report.push({ product: "record-store", location, results: stores.length, providers: storeDiscovery.providers });
}

console.log(JSON.stringify({ testedAt: new Date().toISOString(), report }, null, 2));
