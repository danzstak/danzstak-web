"use strict";
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { createHash } = require("node:crypto");
const run = promisify(execFile);
const source = fs.readFileSync(path.join(__dirname, "../infrastructure/auth-api/index.mjs"), "utf8");
const baselinePath = process.env.RECORD_STORE_BASELINE;
function classifier(code) {
  const context = vm.createContext({ createHash, now: () => Date.now() / 1000, osmAttribution: "© OpenStreetMap contributors" });
  vm.runInContext(code.slice(code.indexOf("function publicPlace("), code.indexOf("function isBookableClub(")), context);
  vm.runInContext(code.slice(code.indexOf("function isRecordStore("), code.indexOf("const osmAttribution")), context);
  return items => items.map(context.publicPlace).filter(context.isRecordStore);
}
const classify = classifier(source), baseline = baselinePath ? classifier(fs.readFileSync(baselinePath, "utf8")) : null;
async function aws(command, args) {
  const { stdout } = await run("aws", ["geo-places", command, ...args, "--region", "us-west-2", "--output", "json", "--no-cli-pager"], { maxBuffer: 8 * 1024 * 1024, timeout: 30000 });
  return JSON.parse(stdout);
}
const cities = process.argv.slice(2);
const cases = cities.length ? cities : ["Eindhoven Netherlands", "Bologna Italy", "Seattle USA", "Berlin Germany", "Tokyo Japan", "London UK", "Momo Italy", "Bradford UK", "Brighton UK", "Cape Town South Africa", "Melbourne Australia", "Sao Paulo Brazil"];
(async () => {
  for (const city of cases) {
    const started = Date.now();
    try {
      const point = (await aws("geocode", ["--query-text", city, "--max-results", "1"])).ResultItems?.[0];
      if (!point?.Position) throw new Error("Geocoder returned no coordinates");
      const [lon, lat] = point.Position, dy = 30 / 69, dx = dy / Math.max(.2, Math.cos(lat * Math.PI / 180));
      const filter = JSON.stringify({ BoundingBox: [lon - dx, lat - dy, lon + dx, lat + dy] });
      const results = await Promise.all(["record store", "vinyl record shop"].map(query => aws("search-text", ["--query-text", query, "--filter", filter, "--max-results", "50", "--additional-features", "Contact"])));
      const raw = results.flatMap(result => result.ResultItems || []);
      const unique = items => [...new Map(items.map(item => [item.venueKey, item])).values()];
      const stores = unique(classify(raw)).filter(item => {
        const p = item.position;
        return Math.hypot((p[0] - lon) * 69 * Math.max(.2, Math.cos(lat * Math.PI / 180)), (p[1] - lat) * 69) <= 30;
      });
      console.log(JSON.stringify({ city, resolved: point.Title, raw: raw.length, before: baseline ? unique(baseline(raw)).length : null, stores: stores.length, names: stores.map(s => s.name), withWebsite: stores.filter(s => s.websites.length).length, withPhone: stores.filter(s => s.phones.length).length, withEmail: stores.filter(s => s.emails.length).length, durationMs: Date.now() - started, provider: "AWS Places", requests: 3 }));
    } catch (error) { console.log(JSON.stringify({ city, error: error.message, durationMs: Date.now() - started })); process.exitCode = 1; }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
