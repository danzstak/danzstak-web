const fs = require('fs');
const assert = require('assert');

const source = fs.readFileSync('test-site.ps1', 'utf8');

assert.match(source, /foreach \(\$sourceDirectory in @\('assets', 'infrastructure', 'native'\)\)/,
  'deprecated-route scan should be limited to deployable source directories');
assert.match(source, /\$sourceExtensions = @\('\.html', '\.css', '\.js', '\.mjs', '\.json', '\.webmanifest', '\.yml', '\.yaml'\)/,
  'deprecated-route scan should inspect text source files only');
assert.doesNotMatch(source, /\$deprecated = Get-ChildItem -LiteralPath \$root -Recurse/,
  'review captures and other workspace artifacts must not affect production release checks');

console.log('Site scan-scope checks passed: production validation ignores review captures and other non-deployable workspace artifacts.');
