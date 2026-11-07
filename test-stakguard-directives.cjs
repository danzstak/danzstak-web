"use strict";

const assert = require("node:assert");
const fs = require("node:fs");

const read = file => fs.readFileSync(file, "utf8");
const claude = read("CLAUDE.md");
const owner = read("docs/OWNER-DIRECTIVES.md");
const product = read("instructions/pages/17-privacy-shield/README.md");
const instructions = read("instructions/README.md");
const design = read("instructions/00c-design-direction-80-20.md");
const standing = [claude, owner, product, instructions, design].join("\n");

assert.match(claude, /## StakGuard \(planned\)/);
assert.match(owner, /StakGuard monitoring \| \$4 a month, no auto-renewal/);
assert.match(product, /# DANZSTAK StakGuard/);
assert.match(product, /always \$4 per month/i);
assert.match(product, /12 months\/\$48/);
assert.match(product, /No StakGuard monitoring purchase needed/);
assert.match(standing, /no vendors, Stripe products or charging without owner approval/i);
assert.match(standing, /Moving Day.*cleanup-and-selection step/is);
assert.match(standing, /separate from creator-content provenance/i);
assert.doesNotMatch(standing, /Data Watch/);
assert.doesNotMatch(standing, /Privacy Shield/);

console.log("StakGuard name, $4 prepaid-month pricing, product boundary and Pivot/Moving Day terminology passed.");
