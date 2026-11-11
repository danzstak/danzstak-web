const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");

const readTree = relative => {
  const target = path.join(root, relative);
  if (!fs.existsSync(target)) return "";
  const entries = fs.statSync(target).isDirectory()
    ? fs.readdirSync(target, { withFileTypes: true }).flatMap(entry => {
        if (entry.name === "node_modules") return [];
        const child = path.join(relative, entry.name);
        return entry.isDirectory() ? [readTree(child)] : [read(child)];
      })
    : [read(relative)];
  return entries.join("\n");
};

const runtime = [
  ...fs.readdirSync(root).filter(name => /\.html$/i.test(name)).map(read),
  readTree("assets"),
  readTree("infrastructure")
].join("\n");

assert.doesNotMatch(runtime, /sfscoop/i, "runtime code and product pages must not integrate or advertise SFScoop");

const readme = read("README.md");
assert.match(readme, /only permitted token feature is an optional checkout method/i);
assert.match(readme, /pay DanzStak with SFS Token through Phantom/i);
assert.match(readme, /does not award, earn,\s*hold, custody or exchange SFS Token/i);

const directives = `${read("CLAUDE.md")}\n${read("docs/OWNER-DIRECTIVES.md")}`;
assert.match(directives, /Payments are Stripe or verified SFS Token through Phantom only/i);
assert.match(directives, /Payments are limited to Stripe or SFS Token through Phantom/i);
assert.match(directives, /does not award[^\n]+earn[^\n]+hold[^\n]+custody[^\n]+exchange/i);

const architecture = read("docs/DUAL-PAYMENT-ARCHITECTURE.md");
assert.match(architecture, /Stripe and SFS Token via Phantom are the only approved payment methods/i);
assert.match(architecture, /SFS is payment only/i);
assert.match(architecture, /does not require or integrate another platform account/i);
assert.doesNotMatch(`${readme}\n${directives}\n${architecture}`, /sfscoop/i, "active product boundaries must not reference or depend on another platform");
assert.match(architecture, /No Phantom dependency, wallet button, token quote endpoint, receiving address or SFS transaction verifier is present/i);

console.log("DanzStak payment boundary checks passed.");
