import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { GeoPlacesClient, GeocodeCommand, SearchTextCommand } = require("../infrastructure/auth-api/node_modules/@aws-sdk/client-geo-places");

const client = new GeoPlacesClient({ region: process.env.AWS_REGION || "us-west-2", maxAttempts: 3 });
const benchmarks = [
  { location: "Novara, Italy", queries: ["locale musica dal vivo", "club musicale", "discoteca techno"] },
  { location: "Eindhoven, Netherlands", queries: ["poppodium", "muziekpodium", "live muziek"] },
  { location: "Momo, Italy", queries: ["locale musica dal vivo"] },
  { location: "東根市, 日本", queries: ["ライブハウス"] },
  { location: "Springfield", queries: [] }
];

for (const benchmark of benchmarks) {
  const geocode = await client.send(new GeocodeCommand({ QueryText: benchmark.location, MaxResults: 5 }));
  const place = geocode.ResultItems?.[0];
  const report = {
    location: benchmark.location,
    resolved: place?.Title || "",
    alternatives: (geocode.ResultItems || []).slice(1).map(item => item.Title),
    country: place?.Address?.Country?.Code2 || "",
    queries: []
  };
  if (place?.Position) {
    for (const query of benchmark.queries) {
      const response = await client.send(new SearchTextCommand({
        QueryText: query,
        Filter: { Circle: { Center: place.Position, Radius: 60000 } },
        MaxResults: 50,
        AdditionalFeatures: ["Contact"]
      }));
      report.queries.push({ query, names: (response.ResultItems || []).map(item => item.Title).filter(Boolean) });
    }
  }
  console.log(JSON.stringify(report));
}
