const assert = require("node:assert/strict");

(async () => {
  const { emailSyntaxOk, suppressionBlock, createMailDomainCheck, checkBookingContact, CONTACT_MESSAGES, BOUNCE_WINDOW_DAYS } = await import("./infrastructure/auth-api/booking-contact-check.mjs");
  assert.equal(BOUNCE_WINDOW_DAYS, 365);
  for (const good of ["booking@club.com", "b.o+o_k@bar-house.co.uk", "x@xn--bcher-kva.de"]) assert.equal(emailSyntaxOk(good), true, good);
  for (const bad of ["", "nobody", "a@b", "a@b.c", "a..b@club.com", ".a@club.com", "a@-club.com", "a@club..com", "a b@club.com", "a@club.c0m", `${"a".repeat(65)}@club.com`]) assert.equal(emailSyntaxOk(bad), false, bad);

  const now = Date.parse("2026-11-16T12:00:00Z"), daysAgo = days => ({ S: new Date(now - days * 86400000).toISOString() });
  assert.equal(suppressionBlock(undefined, now), "");
  assert.equal(suppressionBlock({ reason: { S: "recipient_opt_out" }, optedOutAt: daysAgo(900) }, now), "opted_out", "Opt-outs never expire");
  assert.equal(suppressionBlock({ reason: { S: "provider_complaint" }, optedOutAt: daysAgo(900) }, now), "opted_out", "Complaints never expire");
  assert.equal(suppressionBlock({ reason: { S: "permanent_bounce" }, optedOutAt: daysAgo(364) }, now), "bounced");
  assert.equal(suppressionBlock({ reason: { S: "permanent_bounce" }, optedOutAt: daysAgo(366) }, now), "", "A bounce older than 12 months no longer blocks");
  assert.equal(suppressionBlock({ reason: { S: "permanent_bounce" } }, now), "bounced", "A bounce with no date blocks (fail closed)");

  let calls = 0;
  const answers = { "club.com": [{ exchange: "mx.club.com", priority: 10 }], "nullmx.com": [{ exchange: "", priority: 0 }], "dotmx.com": [{ exchange: ".", priority: 0 }] };
  const check = createMailDomainCheck({ clock: () => now, timeoutMs: 50, resolveMx: async domain => {
    calls += 1;
    if (domain === "slow.com") return new Promise(() => {});
    if (domain === "servfail.com") throw Object.assign(new Error("fail"), { code: "ESERVFAIL" });
    if (!answers[domain]) throw Object.assign(new Error("none"), { code: domain === "nodata.com" ? "ENODATA" : "ENOTFOUND" });
    return answers[domain];
  } });
  assert.equal(await check("club.com"), "");
  assert.equal(await check("CLUB.com"), ""); assert.equal(calls, 1, "MX answers are cached per domain");
  assert.equal(await check("nullmx.com"), "no_mail", "A null MX refuses mail (RFC 7505)");
  assert.equal(await check("dotmx.com"), "no_mail");
  assert.equal(await check("gone-club.com"), "no_mail", "A dead domain refuses mail");
  assert.equal(await check("nodata.com"), "no_mail", "A domain without MX records refuses mail");
  assert.equal(await check("servfail.com"), "dns_unavailable");
  assert.equal(await check("slow.com"), "dns_unavailable", "A DNS timeout fails closed");
  const before = calls; await check("servfail.com"); assert.equal(calls, before + 1, "An unanswered lookup is not cached");

  const ok = await checkBookingContact({ to: "booking@club.com", suppressionItem: undefined, mailDomainProblem: check, nowMs: now });
  assert.deepEqual(ok, { ok: true, reason: "", message: "" });
  const bounced = await checkBookingContact({ to: "booking@club.com", suppressionItem: { reason: { S: "permanent_bounce" }, optedOutAt: daysAgo(10) }, mailDomainProblem: check, nowMs: now });
  assert.equal(bounced.message, "This address bounced — find a newer contact.");
  assert.equal((await checkBookingContact({ to: "booking@club", mailDomainProblem: check, nowMs: now })).reason, "syntax");
  assert.equal((await checkBookingContact({ to: "booking@gone-club.com", mailDomainProblem: check, nowMs: now })).message, CONTACT_MESSAGES.no_mail);
  console.log("Booking contact checks passed: strict syntax, null/missing MX, DNS failures fail closed, MX cache, opt-outs permanent, bounces block for 12 months.");
})().catch(error => { console.error(error); process.exit(1); });

// The deploy package must carry every module index.mjs imports (task 07 adds booking-contact-check.mjs).
{
  const fs = require("node:fs"), deploy = fs.readFileSync("aws-deploy-auth-api.ps1", "utf8");
  if (!/Get-ChildItem -LiteralPath \(Split-Path -Parent \$Source\) -Filter "\*\.mjs"/.test(deploy)) { console.error("aws-deploy-auth-api.ps1 must package every infrastructure/auth-api/*.mjs module"); process.exit(1); }
}
