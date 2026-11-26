"use strict";
// LANG part 4d (owner 2026-11-25: "Italian has to be Italian the whole thing"): the emails DanzStak sends a member
// (new sign-in alert, ticket email) come in the member's language, and Cognito's sign-in pages get the browser's
// language. Runs the real sendTicketEmail from index.mjs with stand-ins for SES and DynamoDB.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

(async () => {
  const mod = await import(path.join(__dirname, "infrastructure/auth-api/member-emails.mjs"));
  const index = fs.readFileSync(path.join(__dirname, "infrastructure/auth-api/index.mjs"), "utf8");
  const orders = fs.readFileSync(path.join(__dirname, "infrastructure/auth-api/ticket-orders.mjs"), "utf8");

  // Language choice: saved setting first, then the browser, then English.
  assert.equal(mod.memberLanguage({ saved: "it", acceptLanguage: "fr-FR" }), "it");
  assert.equal(mod.memberLanguage({ saved: "", acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.5" }), "fr");
  assert.equal(mod.memberLanguage({ saved: "ja", acceptLanguage: "en;q=0.2,es-ES;q=0.9" }), "es");
  assert.equal(mod.memberLanguage({ saved: "zh-Hans", acceptLanguage: "" }), "en");
  assert.equal(mod.memberLanguage({}), "en");
  assert.equal(mod.languageFromHeader("pt-BR,pt;q=0.9"), "pt");
  assert.equal(mod.cognitoLanguage("it-IT,it;q=0.9,en;q=0.8"), "it");
  assert.equal(mod.cognitoLanguage("pt-PT"), "pt-BR");
  assert.equal(mod.cognitoLanguage("zh-TW,zh;q=0.9"), "zh-TW");
  assert.equal(mod.cognitoLanguage("nl-NL"), "");

  // Sign-in alert: every language has its own words, device label included.
  const english = mod.signInAlertEmail("en", "Chrome on Android");
  assert.equal(english.subject, "New DanzStak sign-in");
  assert.match(english.text, /using Chrome on Android\./);
  const expected = { it: ["Nuovo accesso a DanzStak", "Chrome su Android"], fr: ["Nouvelle connexion à DanzStak", "Chrome sur Android"], es: ["Nuevo inicio de sesión en DanzStak", "Chrome en Android"], de: ["Neue Anmeldung bei DanzStak", "Chrome auf Android"], pt: ["Novo acesso ao DanzStak", "Chrome no Android"] };
  for (const [lang, [subject, device]] of Object.entries(expected)) {
    const alert = mod.signInAlertEmail(lang, "Chrome on Android");
    assert.equal(alert.subject, subject, lang);
    assert.ok(alert.text.includes(device), `${lang} device label`);
    assert.doesNotMatch(alert.text, /\b(sign-in|signed-in|Settings|never asks|change your)\b/, `${lang} sign-in alert has English words`);
  }
  assert.match(mod.signInAlertEmail("it", "Browser on device").text, /da browser su dispositivo\./);
  assert.match(mod.signInAlertEmail("fr", "Safari on iPhone or iPad").text, /Safari sur iPhone ou iPad/);

  // index.mjs uses the module, never the old English-only lines.
  assert.ok(!index.includes('Data: "New DanzStak sign-in"'), "sign-in alert subject is still hard-coded English");
  assert.ok(!index.includes("Your tickets for ${event.title}"), "ticket email is still hard-coded English");
  assert.match(index, /signInAlertEmail\(memberLanguage\(\{ saved: await savedLanguage\(accountEmail\), acceptLanguage: requestLanguage\(event\) \}\), deviceLabel\)/);
  for (const call of ['startLogin("signup", acceptanceId, event.queryStringParameters?.next, requestLanguage(event))', 'startLogin("login", "", event.queryStringParameters?.next, requestLanguage(event))', 'startLogin("reset", "", "", requestLanguage(event))', 'startLogin("reauth", "", "", requestLanguage(event))']) assert.ok(index.includes(call), `missing: ${call}`);
  assert.match(index, /url\.searchParams\.set\("lang", pageLanguage\)/);
  assert.match(orders, /buyerLanguage: S\(String\(event\?\.headers\?\.\["accept-language"\]/);
  assert.match(orders, /language: order\.buyerLanguage\?\.S \|\| ""/);

  // Run the real sendTicketEmail with stand-ins.
  const start = index.indexOf("async function savedLanguage(");
  const end = index.indexOf("\nconst ticketOrders = createTicketOrders", start);
  assert.ok(start > 0 && end > start, "sendTicketEmail not found");
  const source = index.slice(start, end);
  const sent = [];
  const saved = { "it@example.com": "it", "fr@example.com": "fr" };
  const build = new Function("db", "GetItemCommand", "settingsTable", "ses", "SendEmailCommand", "randomUUID", "mimeSafe", "memberLanguage", "ticketEmailWords", "ticketWhen", "Buffer",
    `${source}\nreturn sendTicketEmail;`);
  const db = { send: async command => ({ Item: saved[command.input.Key.userEmail.S] ? { language: { S: saved[command.input.Key.userEmail.S] } } : undefined }) };
  class GetItemCommand { constructor(input) { this.input = input; } }
  class SendEmailCommand { constructor(input) { this.input = input; } }
  const sendTicketEmail = build(db, GetItemCommand, "DanzStak-UserSettings", { send: async command => sent.push(command.input) }, SendEmailCommand, randomUUID, v => String(v || "").replace(/[\r\n]/g, " ").trim(), mod.memberLanguage, mod.ticketEmailWords, mod.ticketWhen, Buffer);
  const decode = raw => {
    const text = raw.toString("utf8");
    const subject = Buffer.from(/Subject: =\?UTF-8\?B\?([^?]+)\?=/.exec(text)[1], "base64").toString("utf8");
    const bodies = [...text.matchAll(/Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=]+)/g)].map(m => Buffer.from(m[1], "base64").toString("utf8"));
    return { text, subject, plain: bodies[0], html: bodies[1] };
  };
  const ticket = { to: "", event: { title: "Eroticon live", venue: "Locomotiv, Bologna", startsAt: "2027-01-15T21:00:00Z", timezone: "Europe/Rome" }, tier: "Ticket", named: true, orderId: "ord-1", tickets: [{ code: "AB12CD", name: "Ana Rossi", qrPng: Buffer.from("png") }] };

  await sendTicketEmail({ ...ticket, to: "it@example.com" });
  let mail = decode(sent.at(-1).Content.Raw.Data);
  assert.equal(mail.subject, "I tuoi biglietti: Eroticon live");
  assert.match(mail.text, /Content-Language: it/);
  assert.match(mail.plain, /^I tuoi biglietti per Eroticon live\nvenerdì 15 gennaio 2027/);
  assert.match(mail.plain, /Biglietto 1: AB12CD/);
  assert.match(mail.plain, /Biglietto nominativo: non trasferibile/);
  assert.match(mail.html, /lang="it"/);
  assert.match(mail.html, /alt="Codice QR del biglietto AB12CD"/);
  for (const english of ["Your tickets", "Ticket 1", "Named ticket", "Show the QR", "Sold through", "Order ord-1"]) assert.ok(!mail.plain.includes(english) && !mail.html.includes(english), `Italian ticket email still says "${english}"`);

  // No saved language: the language the member bought in (Accept-Language stored on the order).
  await sendTicketEmail({ ...ticket, to: "nobody@example.com", named: false, language: "es-ES,es;q=0.9" });
  mail = decode(sent.at(-1).Content.Raw.Data);
  assert.equal(mail.subject, "Tus entradas: Eroticon live");
  assert.match(mail.plain, /Esta entrada es transferible\./);
  assert.match(mail.plain, /\nEntrada\n/, "the default tier name is translated");

  // A saved language wins over the browser.
  await sendTicketEmail({ ...ticket, to: "fr@example.com", tier: "Early bird", language: "es" });
  mail = decode(sent.at(-1).Content.Raw.Data);
  assert.equal(mail.subject, "Tes billets : Eroticon live");
  assert.match(mail.plain, /\nEarly bird\n/, "a promoter's own tier name stays as written");

  // English stays as it was.
  await sendTicketEmail({ ...ticket, to: "nobody@example.com" });
  mail = decode(sent.at(-1).Content.Raw.Data);
  assert.equal(mail.subject, "Your tickets: Eroticon live");
  assert.match(mail.plain, /Named ticket: non-transferable\. Bring photo ID that matches the name\./);

  console.log("member emails: sign-in alert and tickets in the member's language, Cognito pages get lang — OK");
})().catch(error => { console.error(error); process.exit(1); });
