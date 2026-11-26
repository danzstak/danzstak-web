"use strict";
// Owner 2026-11-26: two phones said "Live translation isn't available right now". The deploy script had created the
// /call-translate routes, but no Lambda permission let API Gateway invoke the Auth API for those paths, so API Gateway
// answered 500 before any code ran. A route must never ship without its invoke permission:
//   - every route aws-deploy-auth-api.ps1 creates is covered by an execute-api permission the same script grants;
//   - the API-wide permission is there (so a new route family can't be forgotten again);
//   - the post-deploy smoke check asks one signed-out route of each family only this script creates.
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const script = readFileSync(join(__dirname, "aws-deploy-auth-api.ps1"), "utf8");
const smoke = readFileSync(join(__dirname, "scripts", "deploy-smoke.cjs"), "utf8");

const routes = [...new Set([...script.matchAll(/"((?:GET|POST|PUT|PATCH|DELETE) \/[^"]*)"/g)].map(match => match[1]))];
assert.ok(routes.length > 80, `the script's route list was found (${routes.length})`);
for (const needed of ["GET /call-translate", "POST /call-translate/stream", "POST /call-translate/text", "GET /profile/ai", "GET /shop/ai", "GET /share/epk/{publicId}"]) assert.ok(routes.includes(needed), `${needed} is a route the script creates`);

// Each add-permission: its statement id and the part of the source ARN after the API id.
const grants = [...script.matchAll(/add-permission[^\n]*--statement-id (\S+)[^\n]*--principal apigateway\.amazonaws\.com[^\n]*--source-arn "arn:aws:execute-api:[^"]*\$\{ApiId\}\/([^"]*)"/g)].map(match => ({ id: match[1], pattern: match[2] }));
assert.ok(grants.length >= 10, `the script's API Gateway permissions were found (${grants.length})`);
const asRegex = pattern => new RegExp("^" + pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
// An HTTP API route "GET /a/{b}" invokes with the source ARN <api>/<stage>/GET/a/{b}.
const covers = (grant, route) => { const [method, path] = route.split(" "); return asRegex(grant.pattern).test(`$default/${method}${path}`); };
const uncovered = (list, route) => !list.some(grant => covers(grant, route));

const wide = grants.find(grant => grant.id === "AllowAuthApiRoutesFromApiGateway");
assert.ok(wide, "the API-wide invoke permission is granted");
assert.equal(wide.pattern, "*", "it covers every stage, method and path of this one API (and no other API: the ARN names ${ApiId})");
assert.match(script, /if \(\$permission -notmatch "AllowAuthApiRoutesFromApiGateway"\) \{ Invoke-Change /, "it is added once, through Invoke-Change (a dry run prints it)");
assert.doesNotMatch(script.match(/--statement-id AllowAuthApiRoutesFromApiGateway[^\n]*/)[0], /\d{12}/, "the new permission takes the account from the signed-in identity");

assert.deepEqual(routes.filter(route => uncovered(grants, route)), [], "every route the script creates has an invoke permission");
// What broke: without the API-wide permission these had none.
const before = grants.filter(grant => grant !== wide);
for (const route of ["GET /call-translate", "POST /call-translate/stream", "POST /call-translate/minute", "POST /call-translate/text"]) assert.ok(uncovered(before, route), `${route} had no permission before the fix (the check would have caught it)`);

for (const path of ["/call-translate", "/profile/ai", "/shop/ai", "/albums"]) assert.ok(smoke.includes(`"${path}"`), `the post-deploy smoke check asks ${path}`);
assert.match(smoke, /code !== 404/, "a missing route (API Gateway's 404) fails the smoke check");
assert.match(smoke, /code < 500/, "API Gateway's 500 (no permission) fails the smoke check");
console.log(`Auth API route permission checks passed: ${routes.length} routes, each covered by an invoke permission; the API-wide permission is granted through Invoke-Change; the smoke check asks one route per family.`);
