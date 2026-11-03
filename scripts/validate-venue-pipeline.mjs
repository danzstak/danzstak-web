// Read-only: no Lambda invocation, database writes, outreach or deployment.
import { writeFile } from "node:fs/promises";
import { geocodeTourPlace, multiSourceDiscovery, isBookableClub } from "../infrastructure/auth-api/index.mjs";

const locations = process.argv.slice(2).length ? process.argv.slice(2) : [
  "Novara, Italy", "Eindhoven, Netherlands", "Momo, Italy", "東根市, 日本",
  "São Paulo, Brazil", "Nairobi, Kenya", "Wānaka, New Zealand", "Springfield"
];
const reports = [];
for (const location of locations) {
  try {
    const point = await geocodeTourPlace(location, { requireDisambiguation: true });
    const result = await multiSourceDiscovery(point, "venue", { radiusMiles: 25 });
    const radians = Math.PI / 180;
    const miles = position => {
      const a = Math.sin((position[1] - point.position[1]) * radians / 2) ** 2
        + Math.cos(position[1] * radians) * Math.cos(point.position[1] * radians)
        * Math.sin((position[0] - point.position[0]) * radians / 2) ** 2;
      return 7917.5226 * Math.asin(Math.sqrt(Math.min(1, a)));
    };
    const venues = result.places.filter(place => isBookableClub(place) && place.businessStatus !== "CLOSED_PERMANENTLY" && miles(place.position) <= 25);
    const report = { location, resolved: point, providers: result.providers, rawCount: result.places.length,
      venues: venues.map(({ name, locality, address, websites, sources, position, websiteResearch, programmingEvidence }) => ({ name, locality, address, websites, sources, position, websiteResearch, programmingEvidence })),
      researchLeads: result.researchLeads, testedAt: new Date().toISOString() };
    reports.push(report); console.log(JSON.stringify(report));
  } catch (error) {
    const report = { location, error: error.message, statusCode: error.statusCode, locationChoices: error.locationChoices, providers: error.providerStatuses };
    reports.push(report); console.log(JSON.stringify(report));
  }
}
await writeFile("docs/venue-pipeline-live-results.json", JSON.stringify(reports, null, 2) + "\n");
