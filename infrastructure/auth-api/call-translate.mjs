// Task 21, step 1 (owner 2026-11-17 "add a real-time voice translator in video calls"; 2026-11-25 "Need to make the
// real time translations up and working with sync", "Free for testers first"): live translated captions in SYNC calls.
//
// How it works (nothing here sees the call itself, which stays peer to peer):
// - Each person who allowed translation streams only their OWN microphone, from their own phone, to Amazon Transcribe
//   streaming in their own language. GET /call-translate lists the languages; POST /call-translate/stream hands out a
//   short-lived signed WebSocket address for one stream (SigV4 query signing, 5 minutes to connect).
// - The words go to the other phone over the call's own data channel. The other phone asks POST /call-translate/text to
//   turn them into its member's language (Amazon Translate) and shows them as captions.
// - POST /call-translate/minute is called once a minute while a stream runs and keeps the free tester allowance:
//   FREE_MINUTES_PER_DAY per account, characters per day for Translate. Paid packs (30 / 180 minutes) come before doors open.
// - Nothing is stored: no audio, no words. Only the day's counters (minutes, characters), which expire after 2 days.
// - Fail-closed: if AWS can't be reached, every route answers "unavailable" and the call carries on without captions.
import { createHash, createHmac } from "node:crypto";

export const FREE_MINUTES_PER_DAY = 60;
export const FREE_CHARACTERS_PER_DAY = 200000; // about an hour of fast speech, partial captions included
export const STREAMS_PER_DAY = 120;
const PARTITION = "call-translate#";
const MAX_TEXTS = 4, MAX_TEXT = 500;

// Languages both Amazon Transcribe streaming and Amazon Translate handle. Owner 2026-11-17: Italian, French, German and
// Spanish at launch; 2026-11-25 a call to Jerusalem worked clean, so Hebrew (and Arabic) are in, written right to left.
export const LANGUAGES = [
  { code: "en", transcribe: "en-US", label: "English" },
  { code: "it", transcribe: "it-IT", label: "Italiano" },
  { code: "fr", transcribe: "fr-FR", label: "Français" },
  { code: "de", transcribe: "de-DE", label: "Deutsch" },
  { code: "es", transcribe: "es-US", label: "Español" },
  { code: "pt", transcribe: "pt-BR", label: "Português" },
  { code: "nl", transcribe: "nl-NL", label: "Nederlands" },
  { code: "he", transcribe: "he-IL", label: "עברית", rtl: true },
  { code: "ar", transcribe: "ar-SA", label: "العربية", rtl: true },
  { code: "ja", transcribe: "ja-JP", label: "日本語" },
  { code: "ko", transcribe: "ko-KR", label: "한국어" },
  { code: "zh", transcribe: "zh-CN", label: "中文" },
  { code: "hi", transcribe: "hi-IN", label: "हिन्दी" }
];
const byCode = new Map(LANGUAGES.map(language => [language.code, language]));
export const languageOf = value => byCode.get(String(value || "").toLowerCase().split(/[-_]/)[0]) || null;

const sha256hex = value => createHash("sha256").update(value).digest("hex");
const hmac = (key, value) => createHmac("sha256", key).update(value).digest();
// RFC 3986: encodeURIComponent leaves !'()* alone; AWS signing wants them encoded.
const awsEncode = value => encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);

// SigV4 query signing (presigned URL). Kept general so its test can check AWS's published S3 example.
export function presignUrl({ method = "GET", protocol = "https", host, path, service, region, credentials, query = {}, expires = 300, now = new Date(), payloadHash = sha256hex("") }) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""), day = amzDate.slice(0, 8);
  const scope = `${day}/${region}/${service}/aws4_request`;
  const params = { ...query, "X-Amz-Algorithm": "AWS4-HMAC-SHA256", "X-Amz-Credential": `${credentials.accessKeyId}/${scope}`, "X-Amz-Date": amzDate, "X-Amz-Expires": String(expires), "X-Amz-SignedHeaders": "host" };
  if (credentials.sessionToken) params["X-Amz-Security-Token"] = credentials.sessionToken;
  const canonicalQuery = Object.keys(params).sort().map(key => `${awsEncode(key)}=${awsEncode(params[key])}`).join("&");
  const canonicalRequest = [method, path, canonicalQuery, `host:${host}\n`, "host", payloadHash].join("\n");
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256hex(canonicalRequest)].join("\n");
  const signingKey = ["aws4_request"].reduce((key, part) => hmac(key, part), [day, region, service].reduce((key, part) => hmac(key, part), `AWS4${credentials.secretAccessKey}`));
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  return `${protocol}://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

// Owner 2026-11-26 ("It starts up but crashes right away"): Amazon Transcribe has no streaming in us-west-1 (batch only,
// docs.aws.amazon.com/transcribe/latest/dg/what-is.html), so the address handed to the phone pointed at a host that
// doesn't exist and every stream closed at once. The stream goes to the nearest region that has streaming; the words
// are still translated in the Auth API's own region. Audio is not stored in either.
export const TRANSCRIBE_STREAMING_REGIONS = Object.freeze(["af-south-1", "ap-northeast-1", "ap-northeast-2", "ap-south-1", "ap-southeast-1", "ap-southeast-2", "ca-central-1", "eu-central-1", "eu-central-2", "eu-west-1", "eu-west-2", "sa-east-1", "us-east-1", "us-east-2", "us-west-2"]);
const NEAREST_STREAMING_REGION = Object.freeze({ "us-west-1": "us-west-2", "eu-west-3": "eu-west-1", "eu-north-1": "eu-central-1", "me-south-1": "eu-central-1", "ap-east-1": "ap-southeast-1" });
export const streamingRegion = region => (TRANSCRIBE_STREAMING_REGIONS.includes(region) ? region : NEAREST_STREAMING_REGION[region] || "us-east-1");

export function transcribeStreamUrl({ region, credentials, language, now = new Date() }) {
  return presignUrl({
    protocol: "wss", host: `transcribestreaming.${region}.amazonaws.com:8443`, path: "/stream-transcription-websocket",
    service: "transcribe", region, credentials, now, expires: 300,
    query: { "language-code": language.transcribe, "media-encoding": "pcm", "sample-rate": "16000", "enable-partial-results-stabilization": "true", "partial-results-stability": "medium" }
  });
}

export function createCallTranslate({ db, commands, tableName, authenticate, corsHeaders, originAllowed, credentials = () => ({ accessKeyId: process.env.AWS_ACCESS_KEY_ID || "", secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "", sessionToken: process.env.AWS_SESSION_TOKEN || "" }), translate, region = process.env.AWS_REGION || "us-west-1", clock = Date.now, log = (...args) => console.error(...args) }) {
  const { UpdateItemCommand, GetItemCommand } = commands;
  const day = () => new Date(clock()).toISOString().slice(0, 10);
  const key = userId => ({ userId: { S: `${PARTITION}${userId}` }, tourId: { S: day() } });
  const expires = () => String(Math.floor(clock() / 1000) + 2 * 86400);
  const ready = () => { const creds = credentials(); return Boolean(creds.accessKeyId && creds.secretAccessKey && typeof translate === "function"); };

  async function usage(userId) {
    const item = (await db.send(new GetItemCommand({ TableName: tableName, Key: key(userId), ConsistentRead: true }))).Item || {};
    return { minutes: Number(item.minutes?.N || 0), characters: Number(item.characters?.N || 0), streams: Number(item.streams?.N || 0) };
  }
  // Adds to one of today's counters unless it would pass the cap; false when today's allowance is used up.
  async function spend(userId, field, amount, cap) {
    try {
      await db.send(new UpdateItemCommand({ TableName: tableName, Key: key(userId), UpdateExpression: "ADD #field :amount SET expiresAt = :expires", ConditionExpression: "attribute_not_exists(#field) OR #field <= :room", ExpressionAttributeNames: { "#field": field }, ExpressionAttributeValues: { ":amount": { N: String(amount) }, ":room": { N: String(cap - amount) }, ":expires": { N: expires() } } }));
      return true;
    } catch (error) {
      if (error?.name === "ConditionalCheckFailedException") return false;
      throw error;
    }
  }

  async function handle(event, method, path) {
    const headers = corsHeaders(event.headers?.origin);
    const reply = (statusCode, data) => ({ statusCode, headers: { ...headers, "cache-control": "no-store" }, body: JSON.stringify(data) });
    if (!originAllowed(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
    const userId = await authenticate(event);
    if (!userId) return reply(401, { error: "Authentication required." });
    if (!ready()) return reply(503, { error: "Live translation isn't available right now.", code: "unavailable" });
    let body = {};
    if (method === "POST") { try { body = JSON.parse(event.body || "{}") || {}; } catch { return reply(400, { error: "Bad request." }); } }
    try {
      if (method === "GET" && path === "/call-translate") {
        const used = await usage(userId);
        return reply(200, { available: true, languages: LANGUAGES.map(({ code, label, rtl }) => ({ code, label, rtl: rtl === true })), minutesLeft: Math.max(0, FREE_MINUTES_PER_DAY - used.minutes), freeMinutesPerDay: FREE_MINUTES_PER_DAY });
      }
      if (method === "POST" && path === "/call-translate/stream") {
        const language = languageOf(body.language);
        if (!language) return reply(400, { error: "Choose a language for live translation.", code: "language" });
        const used = await usage(userId);
        if (used.minutes >= FREE_MINUTES_PER_DAY) return reply(429, { error: "Today's free translation minutes are used up. They come back tomorrow.", code: "minutes" });
        if (!await spend(userId, "streams", 1, STREAMS_PER_DAY)) return reply(429, { error: "Today's free translation minutes are used up. They come back tomorrow.", code: "minutes" });
        return reply(200, { url: transcribeStreamUrl({ region: streamingRegion(region), credentials: credentials(), language, now: new Date(clock()) }), language: language.code, sampleRate: 16000, minutesLeft: FREE_MINUTES_PER_DAY - used.minutes });
      }
      if (method === "POST" && path === "/call-translate/minute") {
        if (!await spend(userId, "minutes", 1, FREE_MINUTES_PER_DAY)) return reply(429, { error: "Today's free translation minutes are used up. They come back tomorrow.", code: "minutes", minutesLeft: 0 });
        const used = await usage(userId);
        return reply(200, { minutesLeft: Math.max(0, FREE_MINUTES_PER_DAY - used.minutes) });
      }
      if (method === "POST" && path === "/call-translate/text") {
        const from = languageOf(body.from), to = languageOf(body.to);
        const texts = Array.isArray(body.texts) ? body.texts.slice(0, MAX_TEXTS).map(text => String(text || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_TEXT)) : [];
        if (!from || !to || !texts.length || texts.some(text => !text)) return reply(400, { error: "Bad request." });
        if (from.code === to.code) return reply(200, { texts });
        const characters = texts.reduce((sum, text) => sum + text.length, 0);
        if (!await spend(userId, "characters", characters, FREE_CHARACTERS_PER_DAY)) return reply(429, { error: "Today's free translation minutes are used up. They come back tomorrow.", code: "minutes" });
        const out = await Promise.all(texts.map(text => translate({ text, from: from.code, to: to.code })));
        return reply(200, { texts: out.map(text => String(text || "")) });
      }
      return reply(404, { error: "Not found." });
    } catch (error) {
      // Details stay in the logs (L1: never a raw AWS error on a member's screen).
      log("Call translation failed", { name: error?.name || "Error", path });
      return reply(503, { error: "Live translation isn't available right now.", code: "unavailable" });
    }
  }
  return { handle };
}
