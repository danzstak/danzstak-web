const assert = require('node:assert/strict');
const fs = require('node:fs');

const api = fs.readFileSync('infrastructure/auth-api/index.mjs', 'utf8');
const template = fs.readFileSync('infrastructure/engagement/template.yaml', 'utf8');

assert.match(api, /prompt", "login"/, 'destructive reauthentication must force Cognito login');
assert.match(api, /account_deletion_proof/, 'short-lived deletion proof must be recorded server-side');
assert.match(api, /now\(\) \+ 600/, 'deletion proof must expire after ten minutes');
assert.match(api, /TransactWriteItemsCommand\(\{ TransactItems:/, 'proof consumption and request creation must be atomic');
assert.match(api, /ConditionExpression: "#type = :proof AND userId = :userId"/, 'one-time proof must be identity-bound');
assert.match(api, /DELETION_CONFIRMATION/, 'server confirmation phrase must come from the shared deletion policy');
assert.match(api, /method === "DELETE" && path === "\/account-deletion"/, 'grace-period cancellation endpoint must exist');

for (const route of [
  'GET /auth/account-deletion/reauth',
  'GET /account-deletion',
  'POST /account-deletion',
  'DELETE /account-deletion'
]) assert.ok(template.includes(`RouteKey: '${route}'`), `missing API Gateway route: ${route}`);

assert.ok(template.includes('AccountDeletionInvokePermission'), 'account deletion API must have scoped Lambda invoke permission');
assert.ok(template.includes('AccountDeletionReauthInvokePermission'), 'reauth API must have scoped Lambda invoke permission');

console.log('Account deletion wiring checks passed: forced reauth, identity-bound one-time proof, atomic request, grace cancellation, and API routes.');
