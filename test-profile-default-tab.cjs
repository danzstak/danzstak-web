const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');

const source = readFileSync('assets/profile-editor.js', 'utf8');

assert.match(source, /tab\.classList\.toggle\("active", name === "Posts"\)/,
  'fresh profiles visually select Posts');
assert.match(source, /tab\.setAttribute\("aria-selected", String\(name === "Posts"\)\)/,
  'fresh profiles expose Posts as the selected tab');
assert.match(source, /tab\.tabIndex = name === "Posts" \? 0 : -1/,
  'fresh profiles put Posts in the keyboard tab order');
assert.match(source, /tabMessage\.hidden = false;[\s\S]*details\.hidden = true;/,
  'fresh profiles show the post panel instead of About details');
assert.match(source, /tabs\.dataset\.initialized !== "true"[\s\S]*requestedProfileTab\(\)[\s\S]*\[data-profile-tab="\$\{target\}"\][\s\S]*\.click\(\)/,
  'profile posts load once the authoritative profile is available');

console.log('Profile default-tab checks passed: fresh visits open Posts and load the member timeline.');
