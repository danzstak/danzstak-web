"use strict";
// Owner 2026-11-18: saving a shop (PUT /marketplace/shop) failed in every browser because the API's CORS list had no PUT.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const cors = JSON.parse(fs.readFileSync("infrastructure/auth-api/api-cors.json", "utf8"));
const api = fs.readFileSync("infrastructure/auth-api/marketplace.mjs", "utf8");
for (const method of new Set([...api.matchAll(/method === "(GET|POST|PUT|PATCH|DELETE)"/g)].map(m => m[1]))) {
  assert.ok(cors.AllowMethods.includes(method), `CORS allows ${method}, which the marketplace API uses`);
}
console.log("API CORS allows every method the marketplace routes use.");
