"use strict";
// Task 21 (owner 2026-11-25: "Need to make the real time translations up and working with sync"; "my cousin who speaks
// French … shows up on my side in English"). Runs the real call-translate.mjs routes and the browser's event-stream code:
// - the SigV4 presigner reproduces AWS's own published example, and the Transcribe address is a wss:// signed for
//   transcribestreaming on :8443 with the member's language, PCM 16 kHz and the session token;
// - French → English goes through Translate; same language never calls it; the free daily minutes and characters stop;
// - no AWS error ever reaches the member; signed-out callers get 401; no credentials = "unavailable";
// - the event-stream framing the phone sends (AudioEvent) round-trips with valid CRCs;
// - chat.js, the More sheet, both SYNC pages, CSP and the deploy script are wired.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

(async () => {
  const mod = await import("./infrastructure/auth-api/call-translate.mjs");
  const { presignUrl, transcribeStreamUrl, createCallTranslate, LANGUAGES, FREE_MINUTES_PER_DAY, languageOf } = mod;

  // AWS's published query-string signing example (S3 GET test.txt, 2013-05-24).
  const example = presignUrl({ host: "examplebucket.s3.amazonaws.com", path: "/test.txt", service: "s3", region: "us-east-1", expires: 86400, now: new Date("2013-05-24T00:00:00Z"), payloadHash: "UNSIGNED-PAYLOAD", credentials: { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" } });
  assert.match(example, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/, "SigV4 matches AWS's own example");

  const creds = { accessKeyId: "ASIAEXAMPLE", secretAccessKey: "secret", sessionToken: "token/with+chars=" };
  const url = new URL(transcribeStreamUrl({ region: "us-west-1", credentials: creds, language: languageOf("fr-FR"), now: new Date("2026-11-25T18:00:00Z") }));
  assert.equal(url.protocol, "wss:");
  assert.equal(url.host, "transcribestreaming.us-west-1.amazonaws.com:8443");
  assert.equal(url.pathname, "/stream-transcription-websocket");
  assert.equal(url.searchParams.get("language-code"), "fr-FR");
  assert.equal(url.searchParams.get("media-encoding"), "pcm");
  assert.equal(url.searchParams.get("sample-rate"), "16000");
  assert.equal(url.searchParams.get("X-Amz-Security-Token"), creds.sessionToken);
  assert.equal(url.searchParams.get("X-Amz-Credential"), "ASIAEXAMPLE/20261125/us-west-1/transcribe/aws4_request");
  assert.ok(!url.href.includes("secret"), "the secret key never leaves the server");
  for (const code of ["en", "it", "fr", "de", "es", "he"]) assert.ok(LANGUAGES.some(language => language.code === code), `${code} is offered`);
  assert.equal(languageOf("he").rtl, true);

  // Routes against an in-memory table.
  class GetItemCommand { constructor(input) { this.input = input; } }
  class UpdateItemCommand { constructor(input) { this.input = input; } }
  const table = new Map(), keyOf = key => `${key.userId.S}|${key.tourId.S}`;
  const db = { send: async command => {
    const input = command.input, k = keyOf(input.Key);
    if (command instanceof GetItemCommand) return { Item: table.get(k) };
    const item = table.get(k) || {}, field = input.ExpressionAttributeNames["#field"], amount = Number(input.ExpressionAttributeValues[":amount"].N), room = Number(input.ExpressionAttributeValues[":room"].N);
    if (item[field] && Number(item[field].N) > room) throw Object.assign(new Error("no"), { name: "ConditionalCheckFailedException" });
    item[field] = { N: String(Number(item[field]?.N || 0) + amount) };
    table.set(k, item); return {};
  } };
  const translated = [], logs = [];
  let signedIn = "member-1", translateFails = false;
  const service = createCallTranslate({
    db, commands: { GetItemCommand, UpdateItemCommand }, tableName: "tours", authenticate: async () => signedIn,
    corsHeaders: () => ({ "access-control-allow-origin": "https://danzstak.com" }), originAllowed: origin => origin === "https://danzstak.com",
    credentials: () => creds, region: "us-west-1", clock: () => Date.parse("2026-11-25T18:00:00Z"), log: (...args) => logs.push(args),
    translate: async ({ text, from, to }) => { if (translateFails) throw Object.assign(new Error("User: arn:aws:sts::123456789012:assumed-role/x is not authorized"), { name: "AccessDeniedException" }); translated.push({ text, from, to }); return `[${to}] ${text}`; }
  });
  const call = async (method, route, body) => {
    const response = await service.handle({ headers: { origin: "https://danzstak.com" }, body: body ? JSON.stringify(body) : undefined }, method, route);
    return { status: response.statusCode, data: JSON.parse(response.body), raw: response.body };
  };

  let result = await call("GET", "/call-translate");
  assert.equal(result.status, 200);
  assert.equal(result.data.minutesLeft, FREE_MINUTES_PER_DAY);
  assert.ok(result.data.languages.find(language => language.code === "fr"));
  result = await call("POST", "/call-translate/stream", { language: "fr" });
  assert.equal(result.status, 200);
  assert.match(result.data.url, /^wss:\/\/transcribestreaming\.us-west-1\.amazonaws\.com:8443\/stream-transcription-websocket\?.*language-code=fr-FR/);
  assert.equal((await call("POST", "/call-translate/stream", { language: "klingon" })).status, 400);

  // The cousin speaks French; Shawn reads English.
  result = await call("POST", "/call-translate/text", { texts: ["On se voit à Paris le 12 décembre"], from: "fr", to: "en" });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data.texts, ["[en] On se voit à Paris le 12 décembre"]);
  assert.deepEqual(translated.at(-1), { text: "On se voit à Paris le 12 décembre", from: "fr", to: "en" });
  const count = translated.length;
  result = await call("POST", "/call-translate/text", { texts: ["hello"], from: "en", to: "en-US" });
  assert.deepEqual(result.data.texts, ["hello"]);
  assert.equal(translated.length, count, "same language never calls Translate");
  assert.equal((await call("POST", "/call-translate/text", { texts: [""], from: "fr", to: "en" })).status, 400);
  assert.equal((await call("POST", "/call-translate/text", { texts: "x", from: "fr", to: "en" })).status, 400);

  // An AWS refusal never reaches the member's screen.
  translateFails = true;
  result = await call("POST", "/call-translate/text", { texts: ["bonjour"], from: "fr", to: "en" });
  assert.equal(result.status, 503);
  assert.equal(result.data.code, "unavailable");
  assert.ok(!/arn:|not authorized|123456789012/.test(result.raw), "no raw AWS error");
  assert.equal(logs.at(-1)[1].name, "AccessDeniedException", "the details stay in the logs");
  translateFails = false;

  // Free daily minutes.
  for (let i = 0; i < FREE_MINUTES_PER_DAY; i += 1) assert.equal((await call("POST", "/call-translate/minute", {})).status, 200, `minute ${i + 1}`);
  result = await call("POST", "/call-translate/minute", {});
  assert.equal(result.status, 429);
  assert.equal(result.data.code, "minutes");
  assert.equal((await call("POST", "/call-translate/stream", { language: "fr" })).status, 429, "no new stream once today's minutes are used");
  assert.equal((await call("GET", "/call-translate")).data.minutesLeft, 0);
  // Characters too.
  signedIn = "member-2";
  const long = "a".repeat(500);
  let refused = false;
  for (let i = 0; i < 500 && !refused; i += 1) { const r = await call("POST", "/call-translate/text", { texts: [long, long, long, long], from: "fr", to: "en" }); if (r.status === 429) refused = true; }
  assert.ok(refused, "the daily character allowance stops translation");

  // Signed out, wrong origin, no credentials.
  signedIn = "";
  assert.equal((await call("GET", "/call-translate")).status, 401);
  signedIn = "member-3";
  assert.equal((await service.handle({ headers: { origin: "https://evil.example" } }, "GET", "/call-translate")).statusCode, 403);
  const off = createCallTranslate({ db, commands: { GetItemCommand, UpdateItemCommand }, tableName: "tours", authenticate: async () => "m", corsHeaders: () => ({}), originAllowed: () => true, credentials: () => ({ accessKeyId: "", secretAccessKey: "" }), translate: async () => "" });
  const offReply = await off.handle({ headers: { origin: "x" } }, "GET", "/call-translate");
  assert.equal(offReply.statusCode, 503);

  // The phone's event-stream framing.
  const source = fs.readFileSync(path.join(__dirname, "assets/call-translate.js"), "utf8");
  const window = {};
  const context = vm.createContext({ window, document: { readyState: "complete", documentElement: { lang: "en" }, getElementById: () => null, querySelector: () => null }, navigator: { language: "en" }, TextEncoder, TextDecoder, MutationObserver: class { observe() {} }, localStorage: { getItem: () => null, setItem() {} }, setTimeout, clearTimeout, setInterval, clearInterval, console, URL, Uint8Array, Uint32Array, DataView, JSON, Math, Date, Map, String, Number, Object, Boolean, Array, Error });
  context.window = window; context.addEventListener = () => {};
  vm.runInContext(source.replace("window.addEventListener(\"resize\"", "(window.addEventListener||(()=>{}))(\"resize\""), context);
  const { encodeEvent, decodeEvent, crc32 } = window.danzstakCallTranslate._eventStream;
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926, "CRC-32 check value");
  const pcm = new Uint8Array([1, 2, 3, 4, 250, 251]);
  const frame = encodeEvent({ ":content-type": "application/octet-stream", ":event-type": "AudioEvent", ":message-type": "event" }, pcm);
  const back = decodeEvent(frame.buffer);
  assert.equal(back.headers[":event-type"], "AudioEvent");
  assert.equal(back.headers[":message-type"], "event");
  assert.deepEqual([...back.payload], [...pcm]);
  frame[frame.length - 6] ^= 1;
  assert.throws(() => decodeEvent(frame.buffer), "a damaged frame is refused");
  const transcript = encodeEvent({ ":event-type": "TranscriptEvent", ":message-type": "event", ":content-type": "application/json" }, new TextEncoder().encode(JSON.stringify({ Transcript: { Results: [{ ResultId: "r1", IsPartial: false, Alternatives: [{ Transcript: "Salut" }] }] } })));
  assert.equal(JSON.parse(new TextDecoder().decode(decodeEvent(transcript.buffer).payload)).Transcript.Results[0].Alternatives[0].Transcript, "Salut");

  // Wiring.
  const chat = fs.readFileSync(path.join(__dirname, "assets/chat.js"), "utf8");
  assert.match(chat, /startsWith\('\{"type":"call-translate'\)\)\{window\.danzstakCallTranslate\?\.receive\(event\.data,contactName\);return;\}/, "translation messages never show in the chat");
  assert.match(fs.readFileSync(path.join(__dirname, "assets/sync-call-ui.js"), "utf8"), /danzstakCallTranslate\?\.menuItem/, "More offers Live translation");
  for (const page of ["messages.html", "sync/index.html"]) {
    const html = fs.readFileSync(path.join(__dirname, page), "utf8");
    assert.match(html, /connect-src [^;]*wss:\/\/transcribestreaming\.us-west-1\.amazonaws\.com:8443/, `${page}: CSP allows the Transcribe stream`);
    assert.match(html, /assets\/call-translate\.js\?v=\d+/);
    assert.match(html, /assets\/call-translate\.css\?v=\d+/);
  }
  const deploy = fs.readFileSync(path.join(__dirname, "aws-deploy-auth-api.ps1"), "utf8");
  assert.match(deploy, /"POST \/call-translate\/stream", "POST \/call-translate\/minute", "POST \/call-translate\/text"/);
  assert.match(deploy, /transcribe:StartStreamTranscriptionWebSocket/);
  assert.match(deploy, /translate:TranslateText/);
  assert.match(fs.readFileSync(path.join(__dirname, "infrastructure/auth-api/index.mjs"), "utf8"), /path === "\/call-translate" \|\| path\.startsWith\("\/call-translate\/"\)/);
  console.log("Call translation checks passed.");
})().catch(error => { console.error(error); process.exit(1); });
