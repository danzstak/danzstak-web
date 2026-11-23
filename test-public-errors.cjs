"use strict";
// Directive L1 (owner 2026-11-19): a raw AWS error reached a member's SYNC registration screen, with the account
// number and the role name in it. Every Auth API error now goes through one mapper (public-errors.mjs).
const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  Object.assign(process.env, { MEDIA_BUCKET:"example-private-media", AWS_REGION:"us-west-1", AWS_ACCESS_KEY_ID:"AKIAEXAMPLE", AWS_SECRET_ACCESS_KEY:"test-secret", AWS_SESSION_TOKEN:"test-token" });
  const { leaksInternals, publicError, sanitizeErrorResponse } = await import("./infrastructure/auth-api/public-errors.mjs");
  const { createPersonalPhoneService } = await import("./infrastructure/auth-api/personal-phone-service.mjs");

  // The exact shape of the 2026-11-19 failure (account number made up).
  const awsMessage = "User: arn:aws:sts::111122223333:assumed-role/DANZSTAK-Auth-API-role/DANZSTAK-Auth-API is not authorized to perform: dynamodb:ConditionCheckItem on resource: arn:aws:dynamodb:us-west-1:111122223333:table/DANZSTAK-PhoneVerifications because no identity-based policy allows the dynamodb:ConditionCheckItem action";
  const awsError = Object.assign(new Error(awsMessage), { name:"AccessDeniedException", $fault:"client", $metadata:{ httpStatusCode:400 } });
  const banned = text => /arn:|is not authorized|\d{12}|\n\s+at |AccessDenied/.test(text);

  assert.ok(leaksInternals(awsMessage));
  assert.ok(leaksInternals("TypeError: x\n    at handler (file:///var/task/index.mjs:12:5)"), "stack traces are internal");
  assert.ok(leaksInternals("Account 111122223333"), "an account number is internal");
  for (const ok of ["That code is incorrect. Request a new code.", "You can resend once. Try again in 10 minutes.", "Price 12.50", "Ticket 1763500000000"]) assert.equal(leaksInternals(ok), false, ok);

  // The phone service with a database that refuses (missing IAM) must not hand the raw message to the route.
  let thrown;
  const service = createPersonalPhoneService({
    adapter:{ getByUser: async () => null, linkCapacity: async () => true, reserveChallenge: async () => { throw awsError; }, cancelChallenge: async () => null },
    verifier:{ start: async () => ({ verificationSid:"VE00000000000000000000000000000000" }) }, secret:"s".repeat(32), enabled:true
  });
  try { await service.send({ userId:"u1", countryCode:"+39", localNumber:"3331234567", purpose:"account_trust" }); } catch (error) { thrown = error; }
  assert.ok(thrown, "the refusal reaches the route");
  const mapped = publicError(thrown, { fallback:"Couldn't send the code right now. Try again in a minute.", code:"send_try_again" });
  assert.equal(mapped.error, "Couldn't send the code right now. Try again in a minute.");
  assert.equal(mapped.code, "send_try_again");
  assert.ok(mapped.statusCode >= 500, "our side failed, so it is a 5xx (and does not count against the member)");
  assert.equal(banned(JSON.stringify(mapped)), false);

  // Our own 4xx messages still reach the member with their code.
  const own = Object.assign(new Error("You can resend once. Try again in 10 minutes."), { statusCode:429, code:"resend_window" });
  assert.deepEqual(publicError(own), { statusCode:429, error:own.message, code:"resend_window" });
  // Our own 5xx lines (texts unavailable, provider failed) keep their code so the app shows the translated reason.
  const unavailable = Object.assign(new Error("SYNC verification texts aren't available yet. No text was sent."), { statusCode:503, code:"provider_unavailable", expose:true });
  assert.deepEqual(publicError(unavailable), { statusCode:503, error:unavailable.message, code:"provider_unavailable" });
  let disabled;
  try { await createPersonalPhoneService({ adapter:{ getByUser: async () => null }, verifier:{}, secret:"s".repeat(32), enabled:false }).send({ userId:"u1", countryCode:"+1", localNumber:"4155550100" }); } catch (error) { disabled = error; }
  assert.equal(publicError(disabled).code, "provider_unavailable", "the real reason reaches the SYNC screen (directive L1: show the real reason)");
  // A 4xx carrying internals is still held back.
  assert.equal(publicError(Object.assign(new Error(awsMessage), { statusCode:400 })).code, "try_again");
  // An SDK error with a 4xx-looking status is never "ours".
  assert.equal(publicError(Object.assign(new Error("Requested resource not found"), { statusCode:404, $metadata:{} })).code, "try_again");

  // Last line of defence on every route.
  const leaked = { statusCode:503, headers:{ "access-control-allow-origin":"https://danzstak.com" }, body:JSON.stringify({ error:awsMessage }) };
  const logged = [];
  const safe = sanitizeErrorResponse(leaked, { route:"POST /phone-verification/send", log:(...args) => logged.push(args) });
  assert.equal(safe.statusCode, 503);
  assert.equal(safe.headers["access-control-allow-origin"], "https://danzstak.com", "CORS headers stay so the app can read the reply");
  assert.equal(banned(safe.body), false);
  assert.equal(JSON.parse(safe.body).code, "try_again");
  assert.equal(logged.length, 1);
  assert.equal(banned(JSON.stringify(logged)), false, "the log line names the route only; CloudWatch keeps the original elsewhere");
  const okReply = { statusCode:200, body:JSON.stringify({ text:"my post about arn:aws and 111122223333" }) };
  assert.equal(sanitizeErrorResponse(okReply), okReply, "member content in a successful reply is never touched");

  // The Lambda entry point runs every reply through the mapper.
  const index = fs.readFileSync("infrastructure/auth-api/index.mjs", "utf8");
  assert.match(index, /export const handler = async event => sanitizeErrorResponse\(await routeRequest\(event\)/);
  const { handler } = await import("./infrastructure/auth-api/index.mjs");
  const notFound = await handler({ rawPath:"/no-such-route", requestContext:{ http:{ method:"GET" } }, headers:{} });
  assert.equal(notFound.statusCode, 404);

  // No Auth API module sends a caught error's message back with a 5xx default (the pattern that leaked).
  for (const file of fs.readdirSync("infrastructure/auth-api").filter(name => name.endsWith(".mjs"))) {
    const source = fs.readFileSync(`infrastructure/auth-api/${file}`, "utf8");
    assert.doesNotMatch(source, /statusCode:\s*Number\(error\.statusCode\s*\|\|\s*5\d\d\)[^\n]*error:\s*error\.message/, `${file} returns a raw error message with a 5xx default; use publicError()`);
  }
  console.log("Public error mapper checks passed.");
})().catch(error => { console.error(error); process.exitCode = 1; });
