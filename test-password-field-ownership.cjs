const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const rootHtml = fs.readdirSync(".").filter(file => file.endsWith(".html"));
const assetFiles = fs.readdirSync("assets")
  .filter(file => /\.(?:html|js)$/.test(file))
  .map(file => path.join("assets", file));
const ownedFiles = [...rootHtml, ...assetFiles];

const passwordInputPattern = /<input\b[^>]*\btype\s*=\s*["']?password\b/gi;
const ownedPasswordFields = [];
for (const file of ownedFiles) {
  const source = fs.readFileSync(file, "utf8");
  if (passwordInputPattern.test(source)) ownedPasswordFields.push(file);
  passwordInputPattern.lastIndex = 0;
}

assert.deepEqual(
  ownedPasswordFields,
  [],
  "A repository-controlled password field was added. It requires the shared independent eye control, autocomplete semantics, localization, accessibility and route coverage from Issue #35."
);

const home = fs.readFileSync("index.html", "utf8");
assert.match(home, /https:\/\/api\.danzstak\.com\/auth\/login/);
assert.match(home, /data-signup-url="https:\/\/api\.danzstak\.com\/auth\/signup"/);

const authApi = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
assert.match(authApi, /path === "\/auth\/login"/);
assert.match(authApi, /return await startLogin\("login"\)/);
assert.match(authApi, /path === "\/auth\/signup"/);
assert.match(authApi, /return await startSignup\(event\)/);
assert.match(authApi, /mode === "signup" \? "\/signup" : "\/oauth2\/authorize"/);

const browserAudit = fs.readFileSync("browser-checks/cognito-password-visibility-audit.cjs", "utf8");
assert.match(browserAudit, /independentControls/);
assert.match(browserAudit, /controlMeets44pxTarget/);
assert.match(browserAudit, /process\.argv\.includes\("--strict"\)/);

console.log("Password ownership checks passed: password entry remains Cognito-hosted and the strict live acceptance audit is retained.");
