// L1 (owner 2026-11-19): the Auth HTTP API keeps access logs, so the next "profiles don't load" report shows each
// request's status. A tester in Washington got 4xx on every signed-in route while /auth/refresh succeeded, and nothing
// recorded which status came back. The log line holds only what that question needs, never anything that identifies a
// person: no IP address (the owner allowed at most a /24, which API Gateway can't log, so none), no user agent, no real
// path (it can hold a username or a member id; the route template is logged instead), no query string, cookie, token,
// sign-in claim or email.
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");

const script = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");

// 1. The format is one JSON object of API Gateway $context variables.
const formatLine = script.match(/^\s*\$accessLogFormat\s*=\s*'([^']+)'\s*$/m);
assert.ok(formatLine, "aws-deploy-auth-api.ps1 sets $accessLogFormat as one single-quoted line");
const format = JSON.parse(formatLine[1]);
const variables = Object.values(format);
assert.ok(variables.every(value => /^\$context\.[A-Za-z.]+$/.test(value)), "every field is a single $context variable");
assert.equal(format.requestId, "$context.requestId", "API Gateway's random request id (AWS requires it)");
assert.equal(format.route, "$context.routeKey", "the route template, e.g. GET /profiles");
assert.equal(format.status, "$context.status", "the status the member's browser got");
assert.equal(format.latencyMs, "$context.responseLatency", "how long the request took");

// 2. Nothing that identifies a person or carries a secret.
const forbidden = [/sourceIp/i, /identity\./i, /userAgent/i, /^\$context\.path$/, /authorizer/i, /cookie/i, /query/i, /requestOverride/i, /header/i, /customDomain/i, /domainPrefix/i, /accountId/i, /caller/i, /user$/i];
for (const value of variables) {
  for (const pattern of forbidden) assert.doesNotMatch(value, pattern, `the access log must not record ${value}`);
}

// 3. Kept 30 days in its own log group, on the Auth API's own stage.
assert.match(script, /\$accessLogGroup = "\/aws\/apigateway\/DANZSTAK-Auth-HTTP-API"/, "one log group named after the API");
assert.match(script, /put-retention-policy --region \$Region --log-group-name \$accessLogGroup --retention-in-days 30\b/, "kept 30 days");
assert.match(script, /update-stage --region \$Region --api-id \$ApiId --stage-name '\$default' --access-log-settings "file:\/\/\$AccessLogSettingsFile"/, "set on the $default stage from a file (the format holds quotes)");
assert.match(script, /Remove-Item -LiteralPath \$AccessLogSettingsFile/, "the settings file is cleaned up");

// 4. A run where logging is already on only reads the stage (apigateway:GET, which the GitHub deploy role has).
//    Every CloudWatch Logs call and the stage update sit inside the Invoke-Change, so a dry run changes nothing and a
//    GitHub run never needs logs permissions the deploy role's boundary doesn't give it.
const read = script.indexOf("aws apigatewayv2 get-stage");
const change = script.indexOf('Invoke-Change "Turn on Auth API access logs');
const after = script.indexOf("$permission = aws lambda get-policy");
assert.ok(read > 0 && change > read && after > change, "the stage is read first, then changed only through Invoke-Change");
for (const call of script.matchAll(/aws logs [a-z-]+|aws apigatewayv2 update-stage/g)) {
  assert.ok(call.index > change && call.index < after, `${call[0]} only runs inside the access-log Invoke-Change`);
}
const compare = script.slice(read, change);
assert.match(compare, /AccessLogSettings\.DestinationArn -ne \$accessLogDestination/, "compares the destination");
assert.match(compare, /AccessLogSettings\.Format -ne \$accessLogFormat/, "and the format, so a changed format is applied");

// 5. The GitHub deploy role may read the stage (and nothing in its boundary allows logs:*).
const bootstrap = fs.readFileSync("infrastructure/github-deploy/bootstrap.yaml", "utf8");
assert.match(bootstrap, /Action: \['apigateway:GET'[^\]]*\]\s+Resource:\s+- !Sub 'arn:aws:apigateway:\$\{AWS::Region\}::\/apis\/0872gqal4m'\s+- !Sub 'arn:aws:apigateway:\$\{AWS::Region\}::\/apis\/0872gqal4m\/\*'/, "the deploy role can read the Auth API's stage");
assert.doesNotMatch(bootstrap, /'logs:\*'/, "the deploy boundary still has no logs:*");

console.log(`Auth API access log checks passed: ${variables.length} fields (status, route template, latency, request id …), no IP, user agent, path, cookie, token or email; 30 days; changed only inside Invoke-Change.`);
