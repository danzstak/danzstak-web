"use strict";
// UI kit tokens (docs/tasks/39-modern-look.md section 1): every text colour reads at 4.5:1 on every surface it sits
// on, in Day and Night; the accent (active tab, unread dot, focus ring) reaches 3:1 on surfaces (non-text).
// Scoped to .ds so pages that haven't moved keep their look.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const css = fs.readFileSync(require("node:path").join(__dirname, "assets/ds-tokens.css"), "utf8");

function block(selectorPattern) {
  const at = css.search(selectorPattern);
  assert.ok(at >= 0, `ds-tokens.css has ${selectorPattern}`);
  const open = css.indexOf("{", at), close = css.indexOf("}", open);
  const out = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--ds-[a-z0-9-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}
const day = block(/^\.ds\{/m);
const nightMedia = block(/:root:not\(\[data-theme="light"\]\) \.ds\{/);
const nightForced = block(/:root\[data-theme="dark"\] \.ds\{/);
assert.deepEqual(nightMedia, nightForced, "Night is the same from the phone setting and from the Settings switch");
const night = { ...day, ...nightMedia };

const hex = v => { const m = /^#([0-9a-f]{6})$/i.exec(v); assert.ok(m, `solid hex colour, got ${v}`); return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255); };
const lum = v => { const [r, g, b] = hex(v).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

const textPairs = [];
for (const ink of ["--ds-ink", "--ds-ink-soft", "--ds-muted"])
  for (const ground of ["--ds-surface", "--ds-canvas", "--ds-surface-subtle"]) textPairs.push([ink, ground]);
// Unread rows (Notifications) sit on accent-soft: their sentence, sub-line and time must read there too.
textPairs.push(["--ds-ink", "--ds-accent-soft"], ["--ds-ink-soft", "--ds-accent-soft"], ["--ds-muted", "--ds-accent-soft"], ["--ds-btn-go-ink", "--ds-btn-go"], ["--ds-danger-ink", "--ds-danger"]);

const failures = [];
for (const [name, set] of [["Day", day], ["Night", night]]) {
  for (const [fg, bg] of textPairs) {
    const r = ratio(set[fg], set[bg]);
    if (r < 4.5) failures.push(`${name}: ${fg} ${set[fg]} on ${bg} ${set[bg]} is ${r.toFixed(2)}:1 (needs 4.5)`);
  }
  const r = ratio(set["--ds-accent"], set["--ds-surface"]);
  if (r < 3) failures.push(`${name}: accent on surface is ${r.toFixed(2)}:1 (needs 3)`);
}
assert.deepEqual(failures, [], failures.join("\n"));

// Tokens only reach screens that opted in: nothing on :root or body without .ds.
assert.doesNotMatch(css, /(^|\})\s*(:root|html|body)\s*\{/m, "no kit tokens outside .ds");
assert.match(css, /prefers-reduced-motion:reduce\)\{\s*\.ds\{--ds-motion-press:0ms/, "motion off under reduced motion");
console.log(`ds-tokens: ${textPairs.length * 2 + 2} colour pairs pass in Day and Night`);
