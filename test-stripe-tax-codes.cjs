// AI-1 (2026-11-23): the DANZSTAK Stripe account runs Managed Payments, which refuses a Checkout session
// whose inline product has no tax code. Every inline price_data product in the Auth API must carry one.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const dir = path.join(__dirname, "infrastructure", "auth-api");
let checked = 0;
for (const name of fs.readdirSync(dir).filter(file => file.endsWith(".mjs"))) {
  const source = fs.readFileSync(path.join(dir, name), "utf8");
  // Form style: line_items[N][price_data][product_data][name] needs line_items[N][price_data][product_data][tax_code].
  for (const match of source.matchAll(/line_items\[(\d+|\$\{[^}]+\})\]\[price_data\]\[product_data\]\[name\]/g)) {
    checked += 1;
    assert.ok(source.includes(`line_items[${match[1]}][price_data][product_data][tax_code]`), `${name}: line_items[${match[1]}] has no tax_code`);
  }
  // Object style: product_data: { name: … } must include tax_code in the same object.
  for (const match of source.matchAll(/product_data:\s*\{/g)) {
    checked += 1;
    const body = source.slice(match.index, match.index + 400).split(/\}\s*\}/)[0];
    assert.match(body, /tax_code/, `${name}: product_data without tax_code`);
  }
}
assert.ok(checked >= 3, `expected to find the inline Stripe products, found ${checked}`);
console.log(`Stripe tax codes: ${checked} inline products all carry a tax code.`);
