

import {
  randomBytes,
  randomUUID,
  createHash,
  createHmac,
  createPublicKey,
  verify,
  timingSafeEqual
} from "node:crypto";

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
  UpdateItemCommand,
  ScanCommand,
  QueryCommand,
  BatchGetItemCommand,
  TransactWriteItemsCommand
} from "@aws-sdk/client-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminDeleteUserCommand
} from "@aws-sdk/client-cognito-identity-provider";
import {
  S3Client,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand
} from "@aws-sdk/client-s3";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import {
  GeoPlacesClient,
  GeocodeCommand,
  ReverseGeocodeCommand,
  SearchTextCommand
} from "@aws-sdk/client-geo-places";
import {
  GeoRoutesClient,
  CalculateRoutesCommand
} from "@aws-sdk/client-geo-routes";
import { createTourManagerBilling } from "./tour-manager-billing.mjs";
import QRCode from "qrcode";
import {
  DELETION_CONFIRMATION,
  beginDeletionPhase,
  cancelDeletionRequest,
  completeDeletionPhase,
  createDeletionRequest,
  deletionRequestKey,
  failDeletionPhase,
  publicDeletionStatus
} from "./account-data-control.mjs";
import { ACCOUNT_TABLES, accountMediaPrefixes, runAccountErasurePhase } from "./account-erasure.mjs";
import { createDynamoAccountErasureAdapters } from "./account-erasure-dynamodb.mjs";
import { accountMediaExportEntry, publicMediaManifest } from "./account-export-media.mjs";

const db = new DynamoDBClient({ region: "us-west-1" });
const s3 = new S3Client({ region: "us-west-1" });
const ses = new SESv2Client({ region: "us-west-1" });
const cognito = new CognitoIdentityProviderClient({ region: "us-east-1" });
const geoPlaces = new GeoPlacesClient({ region: "us-west-2", maxAttempts: 3 });
const geoRoutes = new GeoRoutesClient({ region: "us-west-2", maxAttempts: 3 });
const secretsManager = new SecretsManagerClient({ region: "us-west-1", maxAttempts: 3 });

const tableName = process.env.SESSIONS_TABLE;
const sessionDevicesTable = process.env.SESSION_DEVICES_TABLE || "DANZSTAK-SessionDevices";
const postsTable = "DANZSTAK-Posts";
const friendsTable = "DANZSTAK-Friends";
const reactionsTable = "DANZSTAK-Reactions";
const commentsTable = "DANZSTAK-Comments";
const engagementNotificationsTable = "DANZSTAK-EngagementNotifications";
const reportsTable = "DANZSTAK-Reports";
const presenceTable = "DANZSTAK-Presence";
const storiesTable = "DANZSTAK-Stories";
const groupsTable = "DANZSTAK-GroupMembers";
const settingsTable = "DanzStak-UserSettings";
const supportTicketsTable = process.env.SUPPORT_TICKETS_TABLE || "DANZSTAK-SupportTickets";
const toursTable = process.env.TOURS_TABLE || "DANZSTAK-Tours";
const venueDirectoryTable = process.env.VENUE_DIRECTORY_TABLE || "DANZSTAK-VenueDirectory";
const reviewsTable = process.env.REVIEWS_TABLE || "DANZSTAK-Reviews";
const clientId = process.env.COGNITO_CLIENT_ID;
const cognitoDomain = process.env.COGNITO_DOMAIN;
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const siteUrl = process.env.SITE_URL;
const mediaBucket = process.env.MEDIA_BUCKET;

const accountErasureAdapters = tableName ? createDynamoAccountErasureAdapters({
  db,
  s3,
  cognito,
  sessionsTable: tableName,
  mediaBucket,
  userPoolId,
  tables: { ...ACCOUNT_TABLES, tours: toursTable, postViews: process.env.POST_VIEWS_TABLE || ACCOUNT_TABLES.postViews },
  commands: {
    ScanCommand,
    QueryCommand,
    DeleteItemCommand,
    PutItemCommand,
    UpdateItemCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    CopyObjectCommand,
    AdminDeleteUserCommand,
    ListUsersCommand
  }
}) : null;

const callbackUrl = "https://api.danzstak.com/auth/callback";
const allowedOrigin = "https://danzstak.com";
const reviewOrigin = "https://review.danzstak.com";
const allowedOrigins = new Set([allowedOrigin, "https://www.danzstak.com", reviewOrigin]);
const securityHeaders = {
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "no-referrer"
};

const issuer =
  "https://cognito-idp.us-east-1.amazonaws.com/" +
  userPoolId;

const sessionCookieName = "__Host-danzstak_session";
const oauthCookieName = "__Host-danzstak_oauth";
const legalCookieName = "__Host-danzstak_legal";
const deletionProofCookieName = "__Host-danzstak_delete_proof";
const legalVersion = "2026-10-26";
const sessionLifetimeSeconds = 30 * 24 * 60 * 60;
const recentAuthenticationSeconds = 10 * 60;
const sessionTouchIntervalSeconds = 15 * 60;
const stripeEnvironment = { ...process.env };
const stripeSecretName = process.env.STRIPE_SECRET_NAME || "danzstak/stripe/secret-key";
const stripeWebhookSecretName = process.env.STRIPE_WEBHOOK_SECRET_NAME || "danzstak/stripe/webhook-secret";
let stripeSecretsPromise = null;

function secretText(result, fields) {
  const raw = typeof result?.SecretString === "string" ? result.SecretString : result?.SecretBinary ? Buffer.from(result.SecretBinary).toString("utf8") : "";
  if (!raw) throw new Error("Stripe secret is empty");
  if (!raw.trimStart().startsWith("{")) return raw.trim();
  let parsed; try { parsed = JSON.parse(raw); } catch { throw new Error("Stripe secret JSON is invalid"); }
  const value = fields.map(field => parsed?.[field]).find(candidate => typeof candidate === "string" && candidate.trim());
  if (!value) throw new Error("Stripe secret field is missing");
  return value.trim();
}

async function ensureStripeSecrets() {
  if (stripeEnvironment.STRIPE_SECRET_KEY && stripeEnvironment.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET) return true;
  if (!stripeSecretsPromise) {
    stripeSecretsPromise = Promise.all([
      secretsManager.send(new GetSecretValueCommand({ SecretId: stripeSecretName })),
      secretsManager.send(new GetSecretValueCommand({ SecretId: stripeWebhookSecretName }))
    ]).then(([keyResult, webhookResult]) => {
      const key = secretText(keyResult, ["STRIPE_SECRET_KEY", "secretKey", "key", "value"]);
      const webhook = secretText(webhookResult, ["STRIPE_TOUR_MANAGER_WEBHOOK_SECRET", "webhookSecret", "secret", "value"]);
      if (!/^sk_(?:test|live)_/.test(key) || !webhook.startsWith("whsec_")) throw new Error("Stripe secret format is invalid");
      stripeEnvironment.STRIPE_SECRET_KEY = key;
      stripeEnvironment.STRIPE_TOUR_MANAGER_WEBHOOK_SECRET = webhook;
      return true;
    }).catch(() => false);
  }
  const ready = await stripeSecretsPromise;
  if (!ready) stripeSecretsPromise = null;
  return ready;
}

const tourManagerBilling = createTourManagerBilling({
  db,
  commands: { GetItemCommand, PutItemCommand, QueryCommand, TransactWriteItemsCommand, UpdateItemCommand },
  authenticate: getAuthenticatedUser,
  corsHeaders,
  tableName: toursTable,
  env: stripeEnvironment,
  validateOutreachEpkLink: validateBookingOutreachEpkLink,
  sendBookingEmail: async ({ userId, sendId, artistName, venueName, to, subject, message, replyToken }) => {
    if (!/^[a-f0-9]{64}$/.test(replyToken || "")) throw new Error("Booking reply route is invalid");
    const safeArtistName = String(artistName || "Artist").replace(/[\r\n"<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Artist";
    const replyTo = `${replyToken}@reply.danzstak.com`;
    const result = await ses.send(new SendEmailCommand({
      FromEmailAddress: `"${safeArtistName} via DanzStak" <booking@danzstak.com>`,
      ConfigurationSetName: "DanzStakTourManager",
      EmailTags: [
        { Name: "DanzStakArtistId", Value: userId },
        { Name: "DanzStakSendId", Value: sendId },
        { Name: "DanzStakRecipientHash", Value: createHash("sha256").update(String(to).trim().toLowerCase()).digest("hex") }
      ],
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: [replyTo],
      Content: { Simple: {
        Subject: { Data: subject, Charset: "UTF-8" },
        Body: { Text: { Data: `${message}\n\nSent by ${artistName} using DanzStak Tour Manager.\nVenue: ${venueName}\nReply to this email to continue securely in the artist's DanzStak SYNC booking thread.`, Charset: "UTF-8" } }
      } }
    }));
    return { messageId: result.MessageId || "" };
  },
  sendBookingReply: async ({ artistName, venueName, to, subject, message, replyToken }) => {
    if (!/^[a-f0-9]{64}$/.test(replyToken || "")) throw new Error("Booking reply route is invalid");
    const safeArtistName = String(artistName || "Artist").replace(/[\r\n"<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Artist";
    const replyTo = `${replyToken}@reply.danzstak.com`;
    const result = await ses.send(new SendEmailCommand({
      FromEmailAddress: `"${safeArtistName} via DanzStak" <booking@danzstak.com>`,
      ConfigurationSetName: "DanzStakTourManager",
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: [replyTo],
      Content: { Simple: {
        Subject: { Data: `Re: ${String(subject || "Booking pitch").replace(/^Re:\s*/i, "")}`.slice(0, 200), Charset: "UTF-8" },
        Body: { Text: { Data: `${message}\n\nReply from ${safeArtistName} through DanzStak.\nVenue: ${venueName}\nReply to this email to continue securely in the artist's DanzStak SYNC booking thread.`, Charset: "UTF-8" } }
      } }
    }));
    return { messageId: result.MessageId || "" };
  }
});

const now = () => Math.floor(Date.now() / 1000);

async function scanAll(request, maximumItems = 5000) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await db.send(new ScanCommand({ ...request, ExclusiveStartKey }));
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey && items.length < maximumItems);
  return items.slice(0, maximumItems);
}

async function queryAll(request, maximumItems = 5000) {
  const items = [];
  let ExclusiveStartKey;
  do {
    const page = await db.send(new QueryCommand({ ...request, ExclusiveStartKey }));
    items.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey && items.length < maximumItems);
  return items.slice(0, maximumItems);
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function runCleanup(tasks, attempts = 3) {
  let pending = tasks;
  for (let attempt = 0; pending.length && attempt < attempts; attempt += 1) {
    const failed = [];
    for (let offset = 0; offset < pending.length; offset += 25) {
      const batch = pending.slice(offset, offset + 25);
      const results = await Promise.allSettled(batch.map(task => task()));
      results.forEach((result, index) => { if (result.status === "rejected") failed.push(batch[index]); });
    }
    pending = failed;
    if (pending.length && attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
  }
  return pending.length;
}

async function batchGetFriendships(viewerEmail, friendEmails) {
  const items = [];
  for (let offset = 0; offset < friendEmails.length; offset += 100) {
    let keys = friendEmails.slice(offset, offset + 100).map(email => ({
      userEmail: { S: viewerEmail },
      friendEmail: { S: email }
    }));
    for (let attempt = 0; keys.length && attempt < 4; attempt += 1) {
      const result = await db.send(new BatchGetItemCommand({
        RequestItems: {
          [friendsTable]: {
            Keys: keys,
            ConsistentRead: true,
            ProjectionExpression: "friendEmail, #status",
            ExpressionAttributeNames: { "#status": "status" }
          }
        }
      }));
      items.push(...(result.Responses?.[friendsTable] || []));
      keys = result.UnprocessedKeys?.[friendsTable]?.Keys || [];
    }
  }
  return items;
}

async function isBlockedPair(viewerEmail, memberEmail) {
  if (!viewerEmail || !memberEmail || viewerEmail === memberEmail) return false;
  const relationship = await db.send(new GetItemCommand({
    TableName: friendsTable,
    Key: { userEmail: { S: viewerEmail }, friendEmail: { S: memberEmail } },
    ConsistentRead: true,
    ProjectionExpression: "#status",
    ExpressionAttributeNames: { "#status": "status" }
  }));
  return ["blocked", "blocked_by"].includes(relationship.Item?.status?.S);
}

const sha256 = value =>
  createHash("sha256").update(value).digest("hex");

const randomValue = () =>
  randomBytes(32).toString("hex");

const encodeAws = value => encodeURIComponent(value).replace(/[!'()*]/g, character => "%" + character.charCodeAt(0).toString(16).toUpperCase());
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
function signedMediaUrl(key, expires = 900, responseHeaders = {}) {
  if (!mediaBucket || !key) return "";
  const region = process.env.AWS_REGION, access = process.env.AWS_ACCESS_KEY_ID, secret = process.env.AWS_SECRET_ACCESS_KEY, token = process.env.AWS_SESSION_TOKEN;
  const date = new Date(), stamp = date.toISOString().replace(/[:-]|\.\d{3}/g, ""), day = stamp.slice(0, 8), scope = `${day}/${region}/s3/aws4_request`;
  const host = `${mediaBucket}.s3.${region}.amazonaws.com`, uri = "/" + key.split("/").map(encodeAws).join("/");
  const responseQuery = Object.entries(responseHeaders).filter(([name, value]) => /^response-[a-z-]+$/.test(name) && value);
  const query = [["X-Amz-Algorithm", "AWS4-HMAC-SHA256"], ["X-Amz-Credential", `${access}/${scope}`], ["X-Amz-Date", stamp], ["X-Amz-Expires", String(expires)], ["X-Amz-Security-Token", token], ["X-Amz-SignedHeaders", "host"], ...responseQuery].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, value]) => `${encodeAws(name)}=${encodeAws(value)}`).join("&");
  const canonical = `GET\n${uri}\n${query}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`, toSign = `AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${sha256(canonical)}`;
  const signing = hmac(hmac(hmac(hmac("AWS4" + secret, day), region), "s3"), "aws4_request"), signature = hmac(signing, toSign, "hex");
  return `https://${host}${uri}?${query}&X-Amz-Signature=${signature}`;
}

function epkDownloadName(value, key) {
  const extension = String(key || "").match(/\.(jpg|png|webp|pdf)$/i)?.[0]?.toLowerCase() || "";
  const base = String(value || "press-material").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._ -]+/g, "-").replace(/[\r\n"\\/]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "press-material";
  return base.toLowerCase().endsWith(extension) ? base : `${base}${extension}`;
}

function validEpkQrUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { return false; }
  if (url.origin !== allowedOrigin || url.pathname !== "/epk.html") return false;
  const parameters = [...url.searchParams.entries()];
  if (parameters.length !== 1) return false;
  const [kind, identifier] = parameters[0];
  const fragment = new URLSearchParams(url.hash.slice(1));
  if (kind === "id") return /^[a-z0-9-]{3,64}$/.test(identifier) && !url.hash;
  if (!/^(share|outreach)$/.test(kind) || fragment.size !== 1 || !fragment.has("token")) return false;
  if (!/^[a-f0-9]{64}$/.test(fragment.get("token") || "")) return false;
  return kind === "share" ? /^[a-z0-9-]{3,64}$/.test(identifier) : /^[a-f0-9]{32}$/.test(identifier);
}

async function epkQr(event) {
  const origin = event.headers?.origin;
  const headers = { ...corsHeaders(origin), "content-type": "image/svg+xml; charset=utf-8", "cache-control": "no-store, private" };
  if (!allowedOrigins.has(origin)) return { statusCode: 404, headers, body: "EPK link not found." };
  const url = String(parseJsonBody(event)?.url || "");
  if (!validEpkQrUrl(url)) return { statusCode: 400, headers, body: "The EPK link is not valid." };
  const body = await QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, width: 512 });
  return { statusCode: 200, headers, body };
}

function corsHeaders(origin) {
  const headers = {
    ...securityHeaders,
    "content-type": "application/json",
    "cache-control": "no-store",
    "vary": "Origin"
  };

  if (allowedOrigins.has(origin)) {
    headers["access-control-allow-origin"] = origin;
    headers["access-control-allow-credentials"] = "true";
  }

  return headers;
}

function redirect(location, cookies = []) {
  return {
    statusCode: 302,
    headers: {
      ...securityHeaders,
      location,
      "cache-control": "no-store",
      "referrer-policy": "no-referrer"
    },
    cookies
  };
}

function errorResponse(statusCode, message, cookies = []) {
  return {
    statusCode,
    headers: {
      ...securityHeaders,
      "content-type": "application/json",
      "cache-control": "no-store"
    },
    cookies,
    body: JSON.stringify({ error: message })
  };
}

function getCookie(event, name) {
  const allCookies = [
    ...(Array.isArray(event.cookies) ? event.cookies : []),
    event.headers?.cookie || ""
  ];

  for (const cookieHeader of allCookies) {
    for (const part of cookieHeader.split(";")) {
      const trimmed = part.trim();
      if (trimmed.startsWith(name + "=")) {
        return trimmed.substring(name.length + 1);
      }
    }
  }

  return null;
}

function getSessionId(event) {
  const authorization = event.headers?.authorization || event.headers?.Authorization || "";
  const bearer = /^Bearer\s+([a-f0-9]{64})$/i.exec(authorization)?.[1];
  const value = bearer || getCookie(event, sessionCookieName);
  return value && /^[a-f0-9]{64}$/.test(value)
    ? value
    : null;
}

function sessionDeviceLabel(event, pending = null) {
  if (pending?.mobilePlatform?.S === "android") return "DanzStak Android app";
  if (pending?.mobilePlatform?.S === "ios") return "DanzStak iPhone or iPad app";
  const value = String(event?.headers?.["user-agent"] || event?.headers?.["User-Agent"] || "");
  const browser = /Edg\//.test(value) ? "Edge" : /Firefox\//.test(value) ? "Firefox" : /CriOS\//.test(value) ? "Chrome" : /Chrome\//.test(value) ? "Chrome" : /Safari\//.test(value) ? "Safari" : "Browser";
  const device = /Android/i.test(value) ? "Android" : /iPhone|iPad|iPod/i.test(value) ? "iPhone or iPad" : /Windows/i.test(value) ? "Windows" : /Macintosh|Mac OS X/i.test(value) ? "Mac" : /Linux/i.test(value) ? "Linux" : "device";
  return `${browser} on ${device}`.slice(0, 80);
}

function secureCookie(name, value, maxAge) {
  return (
    name + "=" + value +
    "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=" +
    maxAge
  );
}

function clearCookie(name) {
  return secureCookie(name, "", 0);
}

function safeEqual(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string"
  ) {
    return false;
  }

  const first = Buffer.from(a);
  const second = Buffer.from(b);

  if (first.length !== second.length) {
    return false;
  }

  return timingSafeEqual(first, second);
}

// VERIFY COGNITO ID TOKEN DIGITAL SIGNATURE
async function verifyIdToken(token, expectedNonce, expectedSub) {
  if (typeof token !== "string" || token.length > 20000) {
    throw new Error("Invalid identity token");
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid identity token structure");
  }

  let header;
  let claims;

  try {
    header = JSON.parse(
      Buffer.from(parts[0], "base64url").toString("utf8")
    );

    claims = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    );
  } catch {
    throw new Error("Invalid identity token encoding");
  }

  if (
    header.alg !== "RS256" ||
    typeof header.kid !== "string" ||
    !header.kid
  ) {
    throw new Error("Unsupported identity token signature");
  }

  const jwksUrl = issuer + "/.well-known/jwks.json";

  const jwksResponse = await fetch(jwksUrl, {
    signal: AbortSignal.timeout(8000)
  });

  if (!jwksResponse.ok) {
    throw new Error("Unable to obtain Cognito signing keys");
  }

  const jwks = await jwksResponse.json();

  if (!Array.isArray(jwks.keys)) {
    throw new Error("Invalid Cognito signing keys");
  }

  const jwk = jwks.keys.find(key =>
    key.kid === header.kid &&
    key.kty === "RSA" &&
    key.use === "sig" &&
    key.alg === "RS256"
  );

  if (!jwk) {
    throw new Error("Cognito signing key not found");
  }

  const publicKey = createPublicKey({
    key: jwk,
    format: "jwk"
  });

  const signedContent = Buffer.from(
    parts[0] + "." + parts[1]
  );

  const signature = Buffer.from(parts[2], "base64url");

  const validSignature = verify(
    "RSA-SHA256",
    signedContent,
    publicKey,
    signature
  );

  if (!validSignature) {
    throw new Error("Invalid Cognito token signature");
  }

  const currentTime = now();

  if (
    claims.iss !== issuer ||
    claims.aud !== clientId ||
    claims.token_use !== "id" ||
    claims.nonce !== expectedNonce ||
    claims.sub !== expectedSub ||
    typeof claims.sub !== "string" ||
    !claims.sub ||
    !Number.isInteger(claims.exp) ||
    claims.exp <= currentTime ||
    !Number.isInteger(claims.iat) ||
    claims.iat > currentTime + 60 ||
    claims.iat > claims.exp
  ) {
    throw new Error("Identity token claims verification failed");
  }

  return claims;
}

// START SECURE COGNITO LOGIN OR SIGNUP
async function startLogin(mode = "login", legalAcceptanceId = "", mobile = null, purpose = null) {
  const state = randomValue();
  const verifier = randomValue();
  const nonce = randomValue();

  // This secret binds the OAuth request to this browser.
  const browserSecret = randomValue();

  const pendingItem = {
      sessionId: { S: sha256("oauth:" + state) },
      type: { S: "oauth_pending" },
      verifier: { S: verifier },
      nonce: { S: nonce },
      browserHash: { S: sha256(browserSecret) },
      expiresAt: { N: String(now() + 300) }
  };
  if (legalAcceptanceId) pendingItem.legalAcceptanceId = { S: legalAcceptanceId };
  if (mode === "reauth") pendingItem.reauthentication = { BOOL: true };
  if (mobile) {
    pendingItem.mobilePlatform = { S: mobile.platform };
    pendingItem.mobileChallenge = { S: mobile.challenge };
  }
  if (purpose?.type === "account_deletion_reauth" && purpose.userId) {
    pendingItem.purpose = { S: purpose.type };
    pendingItem.expectedUserId = { S: purpose.userId };
  }

  await db.send(new PutItemCommand({
    TableName: tableName,
    Item: pendingItem,
    ConditionExpression: "attribute_not_exists(sessionId)"
  }));

  const challenge = createHash("sha256")
    .update(verifier)
    .digest("base64url");

  const url = new URL(
    mode === "signup" ? "/signup" : "/oauth2/authorize",
    cognitoDomain
  );

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", "openid email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (mode === "reauth" || purpose?.type === "account_deletion_reauth") url.searchParams.set("prompt", "login");

  const browserCookie = secureCookie(
    oauthCookieName,
    browserSecret,
    300
  );

  return redirect(url.toString(), [browserCookie]);
}

async function acceptLegalTerms(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  if (!allowedOrigins.has(origin)) return errorResponse(403, "DanzStak origin required");
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return errorResponse(400, "Invalid legal acceptance"); }
  if (body.version !== legalVersion || body.termsAccepted !== true || body.privacyAcknowledged !== true) {
    return errorResponse(400, "Terms and Privacy Policy acceptance required");
  }
  const token = randomValue();
  const acceptanceId = sha256("legal:" + token);
  await db.send(new PutItemCommand({
    TableName: tableName,
    Item: {
      sessionId: { S: acceptanceId },
      type: { S: "legal_pending" },
      legalVersion: { S: legalVersion },
      acceptedAt: { S: new Date().toISOString() },
      expiresAt: { N: String(now() + 1800) }
    },
    ConditionExpression: "attribute_not_exists(sessionId)"
  }));
  return { statusCode: 201, headers: corsHeaders(origin), cookies: [secureCookie(legalCookieName, token, 1800)], body: JSON.stringify({ accepted: true, version: legalVersion }) };
}

async function startSignup(event) {
  const token = getCookie(event, legalCookieName);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return redirect(siteUrl + "/?legal=required");
  const acceptanceId = sha256("legal:" + token);
  const result = await db.send(new GetItemCommand({ TableName: tableName, Key: { sessionId: { S: acceptanceId } }, ConsistentRead: true }));
  const acceptance = result.Item;
  if (acceptance?.type?.S !== "legal_pending" || acceptance.legalVersion?.S !== legalVersion || Number(acceptance.expiresAt?.N || 0) <= now()) {
    return redirect(siteUrl + "/?legal=required", [clearCookie(legalCookieName)]);
  }
  return startLogin("signup", acceptanceId);
}

// COMPLETE SECURE LOGIN
async function completeLogin(event) {
  const params = event.queryStringParameters || {};
  const code = params.code;
  const state = params.state;

  const expiredBrowserCookie = clearCookie(oauthCookieName);

  if (
    typeof code !== "string" ||
    code.length < 1 ||
    code.length > 4096 ||
    typeof state !== "string" ||
    !/^[a-f0-9]{64}$/.test(state)
  ) {
    return errorResponse(
      400,
      "Invalid login response",
      [expiredBrowserCookie]
    );
  }

  const browserSecret = getCookie(event, oauthCookieName);

  if (
    !browserSecret ||
    !/^[a-f0-9]{64}$/.test(browserSecret)
  ) {
    return errorResponse(
      400,
      "Login browser verification failed. Please start login again.",
      [expiredBrowserCookie]
    );
  }

  const pendingKey = {
    sessionId: { S: sha256("oauth:" + state) }
  };

  const pendingResult = await db.send(new GetItemCommand({
    TableName: tableName,
    Key: pendingKey,
    ConsistentRead: true
  }));

  const pending = pendingResult.Item;
  const pendingExpiry = Number(pending?.expiresAt?.N);

  if (
    !pending ||
    pending.type?.S !== "oauth_pending" ||
    !Number.isFinite(pendingExpiry) ||
    pendingExpiry <= now() ||
    !pending.verifier?.S ||
    !pending.nonce?.S ||
    !pending.browserHash?.S
  ) {
    return errorResponse(
      400,
      "Login request expired. Please start again.",
      [expiredBrowserCookie]
    );
  }

  if (
    !safeEqual(
      pending.browserHash.S,
      sha256(browserSecret)
    )
  ) {
    return errorResponse(
      400,
      "Login was started in a different browser.",
      [expiredBrowserCookie]
    );
  }

  // Consume the OAuth request exactly once.
  try {
    await db.send(new DeleteItemCommand({
      TableName: tableName,
      Key: pendingKey,
      ConditionExpression:
        "attribute_exists(sessionId) AND #t = :pending AND browserHash = :browserHash",
      ExpressionAttributeNames: {
        "#t": "type"
      },
      ExpressionAttributeValues: {
        ":pending": { S: "oauth_pending" },
        ":browserHash": { S: pending.browserHash.S }
      }
    }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return errorResponse(
        400,
        "Login request already used.",
        [expiredBrowserCookie]
      );
    }

    throw error;
  }

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: callbackUrl,
    code_verifier: pending.verifier.S
  });

  const tokenResponse = await fetch(
    new URL("/oauth2/token", cognitoDomain),
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded"
      },
      body: tokenBody.toString(),
      signal: AbortSignal.timeout(8000)
    }
  );

  if (!tokenResponse.ok) {
    return errorResponse(
      401,
      "Cognito login failed",
      [expiredBrowserCookie]
    );
  }

  const tokens = await tokenResponse.json();

  if (
    typeof tokens.access_token !== "string" ||
    typeof tokens.id_token !== "string"
  ) {
    return errorResponse(
      401,
      "Invalid Cognito token response",
      [expiredBrowserCookie]
    );
  }

  const userResponse = await fetch(
    new URL("/oauth2/userInfo", cognitoDomain),
    {
      headers: {
        authorization: "Bearer " + tokens.access_token
      },
      signal: AbortSignal.timeout(8000)
    }
  );

  if (!userResponse.ok) {
    return errorResponse(
      401,
      "Unable to verify Cognito user",
      [expiredBrowserCookie]
    );
  }

  const user = await userResponse.json();

  if (typeof user.sub !== "string" || !user.sub) {
    return errorResponse(
      401,
      "Missing Cognito user identity",
      [expiredBrowserCookie]
    );
  }

  try {
    await verifyIdToken(
      tokens.id_token,
      pending.nonce.S,
      user.sub
    );
  } catch (error) {
    console.error(
      "Cognito token verification:",
      error.message
    );

    return errorResponse(
      401,
      "Cognito identity verification failed",
      [expiredBrowserCookie]
    );
  }

  if (pending.purpose?.S === "account_deletion_reauth") {
    if (!pending.expectedUserId?.S || !safeEqual(pending.expectedUserId.S, user.sub)) {
      return redirect(siteUrl + "/feed.html?view=settings&deletion=identity-mismatch", [expiredBrowserCookie]);
    }
    const proof = randomValue();
    await db.send(new PutItemCommand({
      TableName: tableName,
      Item: {
        sessionId: { S: sha256("delete-proof:" + proof) },
        type: { S: "account_deletion_proof" },
        userId: { S: user.sub },
        expiresAt: { N: String(now() + 600) }
      },
      ConditionExpression: "attribute_not_exists(sessionId)"
    }));
    return redirect(
      siteUrl + "/feed.html?view=settings&deletion=verified",
      [secureCookie(deletionProofCookieName, proof, 600), expiredBrowserCookie]
    );
  }

  let acceptedLegal = null;
  if (pending.legalAcceptanceId?.S) {
    const legalKey = { sessionId: { S: pending.legalAcceptanceId.S } };
    const accepted = await db.send(new GetItemCommand({ TableName: tableName, Key: legalKey, ConsistentRead: true }));
    if (accepted.Item?.type?.S !== "legal_pending" || accepted.Item.legalVersion?.S !== legalVersion || Number(accepted.Item.expiresAt?.N || 0) <= now()) {
      return errorResponse(400, "Legal acceptance expired. Please start signup again.", [expiredBrowserCookie, clearCookie(legalCookieName)]);
    }
    acceptedLegal = { key: legalKey, item: accepted.Item };
  }

  const sessionId = randomValue();
  const issuedAt = now();
  const expiresAt = issuedAt + sessionLifetimeSeconds;
  const deviceId = randomUUID();
  const deviceLabel = sessionDeviceLabel(event, pending);

  let hasExistingDevice = false;
  try {
    const existing = await db.send(new QueryCommand({
      TableName: sessionDevicesTable,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": { S: user.sub } },
      ProjectionExpression: "deviceId",
      Limit: 1
    }));
    hasExistingDevice = Boolean(existing.Items?.length);
  } catch (error) {
    console.error("Session device history could not be checked", { errorName: error?.name || "Error" });
  }

  await db.send(new PutItemCommand({
    TableName: tableName,
    Item: {
      sessionId: { S: sha256(sessionId) },
      type: { S: "user_session" },
      userId: { S: user.sub },
      deviceId: { S: deviceId },
      deviceLabel: { S: deviceLabel },
      createdAt: { N: String(issuedAt) },
      authenticatedAt: { N: String(issuedAt) },
      lastUsedAt: { N: String(issuedAt) },
      expiresAt: { N: String(expiresAt) }
    },
    ConditionExpression: "attribute_not_exists(sessionId)"
  }));

  try {
    await db.send(new PutItemCommand({
      TableName: sessionDevicesTable,
      Item: {
        userId: { S: user.sub },
        deviceId: { S: deviceId },
        sessionHash: { S: sha256(sessionId) },
        deviceLabel: { S: deviceLabel },
        createdAt: { N: String(issuedAt) },
        authenticatedAt: { N: String(issuedAt) },
        lastUsedAt: { N: String(issuedAt) },
        expiresAt: { N: String(expiresAt) }
      },
      ConditionExpression: "attribute_not_exists(userId) AND attribute_not_exists(deviceId)"
    }));
  } catch (error) {
    try { await db.send(new DeleteItemCommand({ TableName: tableName, Key: { sessionId: { S: sha256(sessionId) } } })); }
    catch (cleanupError) { console.error("Incomplete session cleanup", { errorName: cleanupError?.name || "Error" }); }
    throw error;
  }

  if (hasExistingDevice) {
    try {
      const accountEmail = await accountForSub(user.sub);
      if (accountEmail) await ses.send(new SendEmailCommand({
        FromEmailAddress: "DanzStak Support <support@danzstak.com>",
        Destination: { ToAddresses: [accountEmail] },
        Content: { Simple: {
          Subject: { Data: "New DanzStak sign-in", Charset: "UTF-8" },
          Body: { Text: { Data: `A new sign-in to your DanzStak account was completed using ${deviceLabel}.\n\nReview signed-in devices in DanzStak Settings. If this was not you, sign out that device and change your password.\n\nDanzStak never asks for your password or verification code by email.`, Charset: "UTF-8" } }
        } }
      }));
    } catch (error) {
      console.error("New sign-in alert could not be sent", { errorName: error?.name || "Error" });
    }
  }

  const sessionCookie = secureCookie(
    sessionCookieName,
    sessionId,
    sessionLifetimeSeconds
  );

  const responseCookies = [sessionCookie, expiredBrowserCookie];
  if (acceptedLegal) {
    await db.send(new PutItemCommand({
      TableName: tableName,
      Item: {
        sessionId: { S: sha256("legal-account:" + user.sub) },
        type: { S: "legal_acceptance" },
        userId: { S: user.sub },
        legalVersion: { S: legalVersion },
        acceptedAt: { S: acceptedLegal.item.acceptedAt?.S || new Date().toISOString() }
      }
    }));
    await db.send(new DeleteItemCommand({ TableName: tableName, Key: acceptedLegal.key }));
    responseCookies.push(clearCookie(legalCookieName));
  }

  if (pending.mobilePlatform?.S && pending.mobileChallenge?.S) {
    const exchangeCode = randomValue();
    await db.send(new PutItemCommand({
      TableName: tableName,
      Item: {
        sessionId: { S: sha256("mobile-exchange:" + exchangeCode) },
        type: { S: "mobile_exchange" },
        platform: { S: pending.mobilePlatform.S },
        challenge: { S: pending.mobileChallenge.S },
        sessionToken: { S: sessionId },
        expiresAt: { N: String(now() + 120) }
      },
      ConditionExpression: "attribute_not_exists(sessionId)"
    }));
    return redirect(`danzstak://${pending.mobilePlatform.S}/auth?code=${exchangeCode}`, [expiredBrowserCookie]);
  }

  return redirect(pending.reauthentication?.BOOL ? siteUrl + "/feed.html?view=settings&security=1" : siteUrl + "/", responseCookies);
}

async function startMobileLogin(event) {
  const platform = String(event.queryStringParameters?.platform || "").toLowerCase();
  const challenge = String(event.queryStringParameters?.challenge || "").toLowerCase();
  if (!new Set(["android", "ios"]).has(platform) || !/^[a-f0-9]{64}$/.test(challenge)) {
    return errorResponse(400, "Valid native platform and device challenge required");
  }
  return startLogin("login", "", { platform, challenge });
}

async function exchangeMobileSession(event) {
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return errorResponse(400, "Invalid native session request"); }
  const code = String(body.code || "").toLowerCase();
  const verifier = String(body.verifier || "").toLowerCase();
  const platform = String(body.platform || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(code) || !/^[a-f0-9]{64}$/.test(verifier) || !new Set(["android", "ios"]).has(platform)) {
    return errorResponse(400, "Valid native session proof required");
  }
  const key = { sessionId: { S: sha256("mobile-exchange:" + code) } };
  const result = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
  const item = result.Item;
  if (item?.type?.S !== "mobile_exchange" || item.platform?.S !== platform || Number(item.expiresAt?.N || 0) <= now() || !safeEqual(item.challenge?.S, sha256(verifier)) || !/^[a-f0-9]{64}$/.test(item.sessionToken?.S || "")) {
    return errorResponse(401, "Native login expired or was already used");
  }
  try {
    await db.send(new DeleteItemCommand({
      TableName: tableName,
      Key: key,
      ConditionExpression: "#t = :exchange AND challenge = :challenge",
      ExpressionAttributeNames: { "#t": "type" },
      ExpressionAttributeValues: { ":exchange": { S: "mobile_exchange" }, ":challenge": { S: item.challenge.S } }
    }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return errorResponse(401, "Native login was already used");
    throw error;
  }
  return {
    statusCode: 200,
    headers: { ...securityHeaders, "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify({ sessionToken: item.sessionToken.S, expiresIn: sessionLifetimeSeconds })
  };
}

// VALIDATE SERVER-SIDE SESSION
async function getAuthenticatedSession(event, { touch = true } = {}) {
  const sessionId = getSessionId(event);

  if (!sessionId) {
    return null;
  }

  const sessionHash = sha256(sessionId);
  const result = await db.send(new GetItemCommand({
    TableName: tableName,
    Key: {
      sessionId: { S: sessionHash }
    },
    ConsistentRead: true
  }));

  const session = result.Item;
  const expiresAt = Number(session?.expiresAt?.N);

  if (
    !session ||
    session.type?.S !== "user_session" ||
    !session.userId?.S ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now()
  ) {
    return null;
  }

  let deviceId = session.deviceId?.S || "";
  let deviceLabel = session.deviceLabel?.S || sessionDeviceLabel(event);
  if (!deviceId && typeof sessionDevicesTable === "string" && sessionDevicesTable) {
    try {
      const proposedDeviceId = randomUUID();
      const updated = await db.send(new UpdateItemCommand({
        TableName: tableName,
        Key: { sessionId: { S: sessionHash } },
        UpdateExpression: "SET deviceId = if_not_exists(deviceId, :deviceId), deviceLabel = if_not_exists(deviceLabel, :deviceLabel), createdAt = if_not_exists(createdAt, :createdAt), authenticatedAt = if_not_exists(authenticatedAt, :authenticatedAt), lastUsedAt = if_not_exists(lastUsedAt, :lastUsedAt)",
        ConditionExpression: "#type = :sessionType AND userId = :userId AND expiresAt > :now",
        ExpressionAttributeNames: { "#type": "type" },
        ExpressionAttributeValues: {
          ":deviceId": { S: proposedDeviceId }, ":deviceLabel": { S: deviceLabel },
          ":createdAt": { N: String(now()) }, ":authenticatedAt": { N: String(now()) }, ":lastUsedAt": { N: String(now()) },
          ":sessionType": { S: "user_session" }, ":userId": { S: session.userId.S }, ":now": { N: String(now()) }
        },
        ReturnValues: "ALL_NEW"
      }));
      deviceId = updated.Attributes?.deviceId?.S || proposedDeviceId;
      deviceLabel = updated.Attributes?.deviceLabel?.S || deviceLabel;
      await db.send(new PutItemCommand({
        TableName: sessionDevicesTable,
        Item: {
          userId: { S: session.userId.S }, deviceId: { S: deviceId }, sessionHash: { S: sessionHash }, deviceLabel: { S: deviceLabel },
          createdAt: updated.Attributes?.createdAt || { N: String(now()) },
          authenticatedAt: updated.Attributes?.authenticatedAt || { N: String(now()) },
          lastUsedAt: updated.Attributes?.lastUsedAt || { N: String(now()) }, expiresAt: { N: String(expiresAt) }
        }
      }));
    } catch (error) {
      console.error("Legacy session device registration failed", { errorName: error?.name || "Error" });
    }
  }

  const lastUsedAt = Number(session.lastUsedAt?.N || 0);
  if (touch && deviceId && lastUsedAt <= now() - sessionTouchIntervalSeconds) {
    const touchedAt = now();
    try {
      await Promise.all([
        db.send(new UpdateItemCommand({
          TableName: tableName, Key: { sessionId: { S: sessionHash } },
          UpdateExpression: "SET lastUsedAt = :lastUsedAt", ConditionExpression: "#type = :sessionType AND userId = :userId AND expiresAt > :now",
          ExpressionAttributeNames: { "#type": "type" },
          ExpressionAttributeValues: { ":lastUsedAt": { N: String(touchedAt) }, ":sessionType": { S: "user_session" }, ":userId": { S: session.userId.S }, ":now": { N: String(touchedAt) } }
        })),
        db.send(new UpdateItemCommand({
          TableName: sessionDevicesTable, Key: { userId: { S: session.userId.S }, deviceId: { S: deviceId } },
          UpdateExpression: "SET lastUsedAt = :lastUsedAt, expiresAt = :expiresAt",
          ExpressionAttributeValues: { ":lastUsedAt": { N: String(touchedAt) }, ":expiresAt": { N: String(expiresAt) } }
        }))
      ]);
    } catch (error) {
      console.error("Session activity update failed", { errorName: error?.name || "Error" });
    }
  }

  return {
    userId: session.userId.S,
    sessionHash,
    deviceId,
    deviceLabel,
    createdAt: Number(session.createdAt?.N || 0),
    authenticatedAt: Number(session.authenticatedAt?.N || session.createdAt?.N || 0),
    lastUsedAt: Math.max(lastUsedAt, touch ? now() : 0),
    expiresAt
  };
}

async function getAuthenticatedUser(event) {
  return (await getAuthenticatedSession(event))?.userId || null;
}

async function startAccountDeletionReauth(event) {
  const userId = await getAuthenticatedUser(event);
  if (!userId) return errorResponse(401, "Authentication required");
  return startLogin("login", "", null, { type: "account_deletion_reauth", userId });
}

function deletionItemToRequest(item) {
  if (!item || item.type?.S !== "account_deletion_request") return null;
  return {
    requestId: item.requestId?.S || "",
    userId: item.userId?.S || "",
    accountEmail: item.accountEmail?.S || "",
    status: item.status?.S || "request_received",
    phaseIndex: Number(item.phaseIndex?.N || 0),
    requestedAt: Number(item.requestedAt?.N || 0),
    graceEndsAt: Number(item.graceEndsAt?.N || 0),
    updatedAt: Number(item.updatedAt?.N || 0),
    completedAt: item.completedAt?.N ? Number(item.completedAt.N) : null,
    failure: item.failure?.S || null
  };
}

async function accountDeletionStatus(event) {
  const headers = corsHeaders(event.headers?.origin || event.headers?.Origin);
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required" }) };
  const result = await db.send(new GetItemCommand({
    TableName: tableName,
    Key: { sessionId: { S: deletionRequestKey(userId) } },
    ConsistentRead: true
  }));
  return { statusCode: 200, headers, body: JSON.stringify(publicDeletionStatus(deletionItemToRequest(result.Item), now())) };
}

async function requestAccountDeletion(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = corsHeaders(origin);
  if (!allowedOrigins.has(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "DanzStak origin required" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required" }) };
  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid deletion request" }) }; }
  const proof = getCookie(event, deletionProofCookieName);
  if (!proof || !/^[a-f0-9]{64}$/.test(proof)) {
    return { statusCode: 403, headers, body: JSON.stringify({ error: "Verify your account again before requesting deletion", reauthRequired: true }) };
  }
  const proofKey = { sessionId: { S: sha256("delete-proof:" + proof) } };
  const proofResult = await db.send(new GetItemCommand({ TableName: tableName, Key: proofKey, ConsistentRead: true }));
  const proofItem = proofResult.Item;
  if (proofItem?.type?.S !== "account_deletion_proof" || proofItem.userId?.S !== userId || Number(proofItem.expiresAt?.N || 0) <= now()) {
    return { statusCode: 403, headers, cookies: [clearCookie(deletionProofCookieName)], body: JSON.stringify({ error: "Account verification expired", reauthRequired: true }) };
  }
  const requestKey = { sessionId: { S: deletionRequestKey(userId) } };
  const existing = await db.send(new GetItemCommand({ TableName: tableName, Key: requestKey, ConsistentRead: true }));
  if (existing.Item) {
    return { statusCode: 200, headers, cookies: [clearCookie(deletionProofCookieName)], body: JSON.stringify(publicDeletionStatus(deletionItemToRequest(existing.Item), now())) };
  }
  const accountEmail = await accountForSub(userId);
  let request;
  try {
    request = createDeletionRequest({
      userId,
      accountEmail,
      confirmation: body.confirmation,
      proofVerified: true,
      requestId: body.requestId,
      now: now()
    });
  } catch (error) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: error.message }) };
  }
  try {
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Delete: {
        TableName: tableName,
        Key: proofKey,
        ConditionExpression: "#type = :proof AND userId = :userId",
        ExpressionAttributeNames: { "#type": "type" },
        ExpressionAttributeValues: { ":proof": { S: "account_deletion_proof" }, ":userId": { S: userId } }
      } },
      { Put: {
        TableName: tableName,
        Item: {
          ...requestKey,
          type: { S: "account_deletion_request" },
          requestId: { S: request.requestId },
          userId: { S: request.userId },
          accountEmail: { S: request.accountEmail },
          status: { S: request.status },
          phaseIndex: { N: String(request.phaseIndex) },
          requestedAt: { N: String(request.requestedAt) },
          graceEndsAt: { N: String(request.graceEndsAt) },
          updatedAt: { N: String(request.updatedAt) }
        },
        ConditionExpression: "attribute_not_exists(sessionId)"
      } }
    ] }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException" || error.name === "TransactionCanceledException") {
      return { statusCode: 409, headers, cookies: [clearCookie(deletionProofCookieName)], body: JSON.stringify({ error: "Deletion verification was already used. Verify again." }) };
    }
    throw error;
  }
  return { statusCode: 202, headers, cookies: [clearCookie(deletionProofCookieName)], body: JSON.stringify(publicDeletionStatus(request, now())) };
}

async function cancelAccountDeletion(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = corsHeaders(origin);
  if (!allowedOrigins.has(origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "DanzStak origin required" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required" }) };
  const key = { sessionId: { S: deletionRequestKey(userId) } };
  const existing = await db.send(new GetItemCommand({ TableName: tableName, Key: key, ConsistentRead: true }));
  let cancelled;
  try { cancelled = cancelDeletionRequest(deletionItemToRequest(existing.Item), now()); }
  catch (error) { return { statusCode: 409, headers, body: JSON.stringify({ error: error.message }) }; }
  try {
    await db.send(new UpdateItemCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: "SET #status = :cancelled, updatedAt = :updated",
      ConditionExpression: "#status = :received AND graceEndsAt > :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: {
        ":cancelled": { S: "cancelled" },
        ":received": { S: "request_received" },
        ":updated": { N: String(cancelled.updatedAt) },
        ":now": { N: String(now()) }
      }
    }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return { statusCode: 409, headers, body: JSON.stringify({ error: "This deletion request can no longer be cancelled" }) };
    throw error;
  }
  return { statusCode: 200, headers, body: JSON.stringify(publicDeletionStatus(cancelled, now())) };
}

async function getAccountExportMedia(event) {
  const headers = corsHeaders(event.headers?.origin), userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const accountEmail = await accountForSub(userId);
  if (!accountEmail || !mediaBucket) return { statusCode: 503, headers, body: JSON.stringify({ error: "Media export is not configured." }) };
  const prefixes = accountMediaPrefixes(accountEmail), objects = [];
  let complete = true;
  for (const Prefix of prefixes) {
    let ContinuationToken;
    do {
      const page = await s3.send(new ListObjectsV2Command({ Bucket: mediaBucket, Prefix, ContinuationToken, MaxKeys: 250 }));
      objects.push(...(page.Contents || []));
      ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      if (objects.length >= 2000 && ContinuationToken) { complete = false; break; }
    } while (ContinuationToken);
    if (!complete) break;
  }
  const files = objects.slice(0, 2000).map(object => accountMediaExportEntry(object, prefixes, (key, filename) => signedMediaUrl(key, 900, {
    "response-content-disposition": `attachment; filename="${String(filename).replace(/[\r\n"\\]/g, "-")}"`
  }))).filter(Boolean);
  const manifest = publicMediaManifest(files, complete && objects.length <= 2000);
  return { statusCode: 200, headers, body: JSON.stringify({ ...manifest, files }) };
}

async function dueAccountDeletionRequests(limit = 5) {
  const requests = [];
  let ExclusiveStartKey;
  do {
    const page = await db.send(new ScanCommand({
      TableName: tableName,
      ConsistentRead: true,
      FilterExpression: "#type = :request AND graceEndsAt <= :now AND (#status = :received OR #status = :progress OR #status = :failed)",
      ExpressionAttributeNames: { "#type": "type", "#status": "status" },
      ExpressionAttributeValues: {
        ":request": { S: "account_deletion_request" },
        ":now": { N: String(now()) },
        ":received": { S: "request_received" },
        ":progress": { S: "in_progress" },
        ":failed": { S: "failed" }
      },
      ExclusiveStartKey
    }));
    requests.push(...(page.Items || []));
    ExclusiveStartKey = page.LastEvaluatedKey;
  } while (ExclusiveStartKey && requests.length < limit);
  return requests.slice(0, limit);
}

async function sendAccountDeletionReceipt(request) {
  if (!request?.accountEmail || !request?.requestId) return false;
  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: "DanzStak Privacy <support@danzstak.com>",
      Destination: { ToAddresses: [request.accountEmail] },
      Content: { Simple: {
        Subject: { Data: "Your DanzStak account deletion is complete", Charset: "UTF-8" },
        Body: { Text: { Data: `Your active DanzStak account data has been removed. Receipt: ${request.requestId}\n\nLimited records may remain only for payment, safety, legal, delivered-message, backup, or cache obligations described in the DanzStak Privacy Policy. This receipt does not contain your deleted content.`, Charset: "UTF-8" } }
      } }
    }));
    return true;
  } catch (error) {
    console.error("Account deletion receipt delivery failed", { requestId: request.requestId, errorName: error?.name || "Error" });
    return false;
  }
}

async function processAccountDeletionQueue(limit = 5) {
  if (!accountErasureAdapters) throw new Error("Account erasure is not configured");
  const items = await dueAccountDeletionRequests(limit);
  const results = [];
  for (const item of items) {
    const request = deletionItemToRequest(item), key = { sessionId: item.sessionId }, claim = beginDeletionPhase(request, now());
    if (!claim.phase) continue;
    const lockToken = randomValue(), lockUntil = now() + 300;
    try {
      await db.send(new UpdateItemCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: "SET #status = :progress, updatedAt = :updated, lockToken = :lock, lockUntil = :lockUntil REMOVE failure",
        ConditionExpression: "phaseIndex = :phaseIndex AND (#status = :received OR #status = :progress OR #status = :failed) AND (attribute_not_exists(lockUntil) OR lockUntil < :now)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":progress": { S: "in_progress" }, ":received": { S: "request_received" }, ":failed": { S: "failed" },
          ":updated": { N: String(now()) }, ":lock": { S: lockToken }, ":lockUntil": { N: String(lockUntil) },
          ":phaseIndex": { N: String(request.phaseIndex) }, ":now": { N: String(now()) }
        }
      }));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") continue;
      throw error;
    }
    try {
      const summary = await runAccountErasurePhase(claim.phase, request, accountErasureAdapters);
      const completed = completeDeletionPhase({ ...claim.request, status: "in_progress" }, claim.phase, now());
      const expressionValues = {
        ":phaseIndex": { N: String(completed.phaseIndex) }, ":status": { S: completed.status },
        ":updated": { N: String(completed.updatedAt) }, ":lock": { S: lockToken },
        ":summary": { S: JSON.stringify(summary) }
      };
      let updateExpression = "SET phaseIndex = :phaseIndex, #status = :status, updatedAt = :updated, lastPhaseSummary = :summary REMOVE lockToken, lockUntil, failure";
      if (completed.completedAt) {
        updateExpression = "SET phaseIndex = :phaseIndex, #status = :status, updatedAt = :updated, completedAt = :completed, expiresAt = :expires, lastPhaseSummary = :summary REMOVE lockToken, lockUntil, failure";
        expressionValues[":completed"] = { N: String(completed.completedAt) };
        expressionValues[":expires"] = { N: String(completed.completedAt + 35 * 86400) };
      }
      await db.send(new UpdateItemCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ConditionExpression: "lockToken = :lock",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: expressionValues
      }));
      if (completed.completedAt) await sendAccountDeletionReceipt(request);
      results.push({ requestId: request.requestId, phase: claim.phase, status: completed.status, summary });
    } catch (error) {
      const failed = failDeletionPhase({ ...claim.request, status: "in_progress" }, claim.phase, error, now());
      await db.send(new UpdateItemCommand({
        TableName: tableName,
        Key: key,
        UpdateExpression: "SET #status = :failed, updatedAt = :updated, failure = :failure REMOVE lockToken, lockUntil",
        ConditionExpression: "lockToken = :lock",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: {
          ":failed": { S: failed.status }, ":updated": { N: String(failed.updatedAt) },
          ":failure": { S: failed.failure }, ":lock": { S: lockToken }
        }
      }));
      results.push({ requestId: request.requestId, phase: claim.phase, status: "failed" });
    }
  }
  return { processed: results.length, results };
}

const groupCategories = new Set(["Artists", "DJs & Producers", "Fans", "Venues & Promoters", "Events", "Local Scenes", "Creators", "Industry Networking", "Politics", "Religion"]);
const defaultGroupIds = new Set(["default-0", "default-1", "default-2", "default-3", "default-4", "default-5", "default-6", "default-7", "default-8", "default-9"]);

async function groupExists(groupId) {
  if (defaultGroupIds.has(groupId)) return true;
  if (!/^[a-f0-9-]{36}$/.test(groupId)) return false;
  const found = await db.send(new GetItemCommand({
    TableName: groupsTable,
    Key: { userEmail: { S: `GROUP#${groupId}` }, groupId: { S: "META" } },
    ConsistentRead: true
  }));
  return Boolean(found.Item && found.Item.deletionState?.S !== "pending");
}

async function groupRecord(groupId) {
  if (!/^[a-f0-9-]{36}$/.test(groupId)) return null;
  const found = await db.send(new GetItemCommand({
    TableName: groupsTable,
    Key: { userEmail: { S: `GROUP#${groupId}` }, groupId: { S: "META" } },
    ConsistentRead: true
  }));
  return found.Item?.deletionState?.S === "pending" ? null : found.Item || null;
}

async function groupMembership(groupId, userEmail) {
  if (!userEmail || !defaultGroupIds.has(groupId) && !/^[a-f0-9-]{36}$/.test(groupId)) return null;
  const found = await db.send(new GetItemCommand({
    TableName: groupsTable,
    Key: { userEmail: { S: userEmail }, groupId: { S: groupId } },
    ConsistentRead: true
  }));
  return found.Item || null;
}

async function requireGroupMember(groupId, userId) {
  if (!defaultGroupIds.has(groupId) && !/^[a-f0-9-]{36}$/.test(groupId)) return { error: "Invalid Tribe.", statusCode: 400 };
  if (!(await groupExists(groupId))) return { error: "Tribe not found.", statusCode: 404 };
  const userEmail = await accountForSub(userId);
  if (!userEmail) return { error: "Account email could not be verified.", statusCode: 409 };
  const membership = await groupMembership(groupId, userEmail);
  if (!membership) return { error: "Join this Tribe to view or post in its discussion.", statusCode: 403 };
  return { userEmail, membership };
}

async function listGroups(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const viewerEmail = await accountForSub(userId);
  const items = await scanAll({ TableName: groupsTable, FilterExpression: "groupId = :meta", ExpressionAttributeValues: { ":meta": { S: "META" } }, ConsistentRead: true });
  const memberships = await scanAll({ TableName: groupsTable, FilterExpression: "groupId <> :meta", ExpressionAttributeValues: { ":meta": { S: "META" } }, ConsistentRead: true });
  const counts = new Map();
  for (const item of memberships) counts.set(item.groupId.S, (counts.get(item.groupId.S) || 0) + 1);
  const viewerMemberships = new Map(memberships.filter(item => item.userEmail?.S === viewerEmail).map(item => [item.groupId.S, item]));
  const groups = items.filter(item => item.groupId?.S === "META" && item.userEmail?.S?.startsWith("GROUP#") && item.deletionState?.S !== "pending").map(item => {
    const id = item.userEmail.S.slice(6), isOwner = item.ownerId?.S === userId, membership = viewerMemberships.get(id);
    const storedDescription = item.description?.S || "";
    const description = storedDescription === "A new DanzStak community group." ? "A new DanzStak Tribe." : storedDescription || "A DanzStak Tribe.";
    return { id, name: item.name?.S || "Tribe", category: item.category?.S || "Creators", description, coverUrl: item.coverKey?.S ? signedMediaUrl(item.coverKey.S, 3600) : "", createdAt: item.createdAt?.S || "", memberCount: counts.get(id) || 0, joined: Boolean(membership), isOwner, isElder: isOwner || membership?.role?.S === "elder" };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { statusCode: 200, headers, body: JSON.stringify({ groups }) };
}

async function createGroup(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  let data; try { data = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON." }) }; }
  const name = String(data.name || "").trim(), category = String(data.category || "").trim(), description = String(data.description || "A new DanzStak Tribe.").trim();
  if (!name || name.length > 80 || !groupCategories.has(category) || description.length > 240 || data.communityStandards !== true) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid Tribe details and Community Standards agreement are required." }) };
  const ownerEmail = await accountForSub(userId);
  if (!ownerEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const id = randomUUID(), createdAt = new Date().toISOString();
  await db.send(new PutItemCommand({ TableName: groupsTable, Item: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" }, ownerId: { S: userId }, name: { S: name }, category: { S: category }, description: { S: description }, createdAt: { S: createdAt } }, ConditionExpression: "attribute_not_exists(userEmail)" }));
  await db.send(new PutItemCommand({ TableName: groupsTable, Item: { userEmail: { S: ownerEmail }, groupId: { S: id }, joinedAt: { S: createdAt }, role: { S: "elder" } } }));
  return { statusCode: 201, headers, body: JSON.stringify({ group: { id, name, category, description, createdAt, memberCount: 1, joined: true, isOwner: true, isElder: true } }) };
}

async function listGroupMembers(event) {
  const headers = corsHeaders(event.headers?.origin), userId = await getAuthenticatedUser(event), id = String(event.pathParameters?.groupId || "");
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const access = await requireGroupMember(id, userId);
  if (access.error) return { statusCode: access.statusCode, headers, body: JSON.stringify({ error: access.error }) };
  const meta = await groupRecord(id);
  const rows = await scanAll({ TableName: groupsTable, FilterExpression: "groupId = :id", ExpressionAttributeValues: { ":id": { S: id } }, ConsistentRead: true });
  const emails = rows.map(item => item.userEmail?.S).filter(email => email && !email.startsWith("GROUP#"));
  const profiles = await loadFeedAuthorProfiles(emails.map(email => ({ userEmail: { S: email } })));
  const members = [];
  for (const email of emails) {
    const result = await cognito.send(new ListUsersCommand({ UserPoolId: userPoolId, Filter: `email = "${email.replace(/["\\]/g, "")}"`, Limit: 1 }));
    const memberId = result.Users?.[0]?.Attributes?.find(attribute => attribute.Name === "sub")?.Value || "";
    if (!memberId) continue;
    const row = rows.find(item => item.userEmail?.S === email), profile = profiles.get(email) || {};
    members.push({ memberId, name: profile.name || "DanzStak member", picture: profile.picture || "", role: meta?.ownerId?.S === memberId || row?.role?.S === "elder" ? "elder" : "member", isMe: memberId === userId });
  }
  members.sort((a, b) => Number(b.role === "elder") - Number(a.role === "elder") || a.name.localeCompare(b.name));
  const callerIsElder = meta?.ownerId?.S === userId || access.membership?.role?.S === "elder";
  return { statusCode: 200, headers, body: JSON.stringify({ members, canManageElders: callerIsElder }) };
}

async function manageGroupElder(event) {
  const headers = corsHeaders(event.headers?.origin), userId = await getAuthenticatedUser(event), id = String(event.pathParameters?.groupId || "");
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const meta = await groupRecord(id);
  if (!meta) return { statusCode: 404, headers, body: JSON.stringify({ error: "Tribe not found." }) };
  const callerEmail = await accountForSub(userId), callerMembership = await groupMembership(id, callerEmail);
  if (meta.ownerId?.S !== userId && callerMembership?.role?.S !== "elder") return { statusCode: 403, headers, body: JSON.stringify({ error: "Only an Elder can invite or manage other Elders." }) };
  const data = parseJsonBody(event), memberId = String(data?.memberId || ""), elder = data?.elder === true;
  if (!/^[a-f0-9-]{36}$/.test(memberId) || memberId === userId || memberId === meta.ownerId?.S) return { statusCode: 400, headers, body: JSON.stringify({ error: "Choose another Crew member. The founding Elder cannot be changed." }) };
  const memberEmail = await accountForSub(memberId);
  if (!memberEmail || !(await groupMembership(id, memberEmail))) return { statusCode: 404, headers, body: JSON.stringify({ error: "That member is not in this Tribe." }) };
  await db.send(new UpdateItemCommand({ TableName: groupsTable, Key: { userEmail: { S: memberEmail }, groupId: { S: id } }, UpdateExpression: elder ? "SET #role = :elder" : "REMOVE #role", ExpressionAttributeNames: { "#role": "role" }, ...(elder ? { ExpressionAttributeValues: { ":elder": { S: "elder" } } } : {}) }));
  return { statusCode: 200, headers, body: JSON.stringify({ memberId, role: elder ? "elder" : "member" }) };
}

const groupCoverKeyPattern = /^users\/[a-f0-9]{24}\/[a-f0-9-]{36}\.(jpg|png|webp|gif)$/;

async function cleanupGroupCoverObjects(id, keys, { allowActive = false } = {}) {
  const candidates = [...new Set((keys || []).filter(Boolean))];
  const resolved = candidates.filter(key => !groupCoverKeyPattern.test(key));
  const pending = [];
  for (const key of candidates.filter(key => groupCoverKeyPattern.test(key))) {
    const claim = randomUUID(), claimExpiresAt = now() + 300;
    try {
      await db.send(new UpdateItemCommand({
        TableName: groupsTable,
        Key: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } },
        UpdateExpression: "SET coverCleanupClaim = :claim, coverCleanupClaimKey = :candidate, coverCleanupClaimExpiresAt = :expires",
        ConditionExpression: (allowActive ? "attribute_exists(userEmail)" : "contains(coverCleanup, :candidate)") + " AND (attribute_not_exists(coverCleanupClaim) OR coverCleanupClaimExpiresAt < :now)" + (allowActive ? "" : " AND (attribute_not_exists(coverKey) OR coverKey <> :candidate)"),
        ExpressionAttributeValues: { ":claim": { S: claim }, ":candidate": { S: key }, ":expires": { N: String(claimExpiresAt) }, ":now": { N: String(now()) } }
      }));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        const current = await db.send(new GetItemCommand({
          TableName: groupsTable,
          Key: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } },
          ConsistentRead: true,
          ProjectionExpression: "coverKey, coverCleanup"
        }));
        if (!allowActive && current.Item?.coverKey?.S === key) {
          try {
            await db.send(new UpdateItemCommand({
              TableName: groupsTable,
              Key: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } },
              UpdateExpression: "DELETE coverCleanup :resolved",
              ConditionExpression: "coverKey = :candidate",
              ExpressionAttributeValues: { ":resolved": { SS: [key] }, ":candidate": { S: key } }
            }));
            resolved.push(key);
          } catch { pending.push(key); }
        } else if (!(current.Item?.coverCleanup?.SS || []).includes(key)) resolved.push(key);
        else pending.push(key);
        continue;
      }
      throw error;
    }
    let removed = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: mediaBucket, Key: key }));
        removed = true;
        break;
      } catch (error) {
        if (attempt === 2) console.error("Tribe cover cleanup remains pending", { id, key, error });
      }
    }
    if (removed) {
      try {
        await db.send(new UpdateItemCommand({
          TableName: groupsTable,
          Key: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } },
          UpdateExpression: "DELETE coverCleanup :resolved REMOVE coverCleanupClaim, coverCleanupClaimKey, coverCleanupClaimExpiresAt",
          ConditionExpression: "coverCleanupClaim = :claim AND coverCleanupClaimKey = :candidate",
          ExpressionAttributeValues: { ":resolved": { SS: [key] }, ":claim": { S: claim }, ":candidate": { S: key } }
        }));
        resolved.push(key);
      } catch (error) {
        console.error("Tribe cover cleanup acknowledgement remains pending", { id, key, error });
        pending.push(key);
      }
    } else {
      pending.push(key);
      try {
        await db.send(new UpdateItemCommand({
          TableName: groupsTable,
          Key: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } },
          UpdateExpression: "REMOVE coverCleanupClaim, coverCleanupClaimKey, coverCleanupClaimExpiresAt",
          ConditionExpression: "coverCleanupClaim = :claim AND coverCleanupClaimKey = :candidate",
          ExpressionAttributeValues: { ":claim": { S: claim }, ":candidate": { S: key } }
        }));
      } catch (error) {
        console.error("Tribe cover cleanup lease release remains pending", { id, key, error });
      }
    }
  }
  const invalid = resolved.filter(key => !groupCoverKeyPattern.test(key));
  if (invalid.length) {
    try {
      await db.send(new UpdateItemCommand({
        TableName: groupsTable,
        Key: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } },
        UpdateExpression: "DELETE coverCleanup :resolved",
        ExpressionAttributeValues: { ":resolved": { SS: invalid } },
        ConditionExpression: "attribute_exists(userEmail)"
      }));
    } catch (error) {
      console.error("Tribe cover cleanup queue remains pending", { id, error });
    }
  }
  return { cleaned: candidates.length - pending.length, pending: pending.length };
}

async function updateGroupCover(event) {
  const headers = corsHeaders(event.headers?.origin), userId = await getAuthenticatedUser(event), id = String(event.pathParameters?.groupId || "");
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const meta = await groupRecord(id);
  if (!meta) return { statusCode: 404, headers, body: JSON.stringify({ error: "Tribe not found." }) };
  const callerEmail = await accountForSub(userId), membership = await groupMembership(id, callerEmail);
  if (meta.ownerId?.S !== userId && membership?.role?.S !== "elder") return { statusCode: 403, headers, body: JSON.stringify({ error: "Only an Elder can change the Tribe cover." }) };
  const data = parseJsonBody(event), mediaKey = String(data?.mediaKey || ""), ownerPrefix = sha256(callerEmail).slice(0, 24);
  if (!new RegExp(`^users/${ownerPrefix}/[a-f0-9-]{36}\\.(jpg|png|webp|gif)$`).test(mediaKey)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Choose a photo you uploaded." }) };
  try { await s3.send(new HeadObjectCommand({ Bucket: mediaBucket, Key: mediaKey })); }
  catch { return { statusCode: 404, headers, body: JSON.stringify({ error: "Uploaded cover photo was not found." }) }; }
  const oldKey = meta.coverKey?.S || "";
  const replacedKey = oldKey && oldKey !== mediaKey && groupCoverKeyPattern.test(oldKey) ? oldKey : "";
  const pendingCoverCleanup = [...new Set([...(meta.coverCleanup?.SS || []), replacedKey].filter(key => key && key !== mediaKey))];
  const expressionValues = { ":cover": { S: mediaKey }, ":updated": { S: new Date().toISOString() }, ":now": { N: String(now()) } };
  if (pendingCoverCleanup.length) expressionValues[":coverCleanup"] = { SS: pendingCoverCleanup };
  if (oldKey) expressionValues[":oldCover"] = { S: oldKey };
  try {
    await db.send(new UpdateItemCommand({
      TableName: groupsTable,
      Key: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } },
      UpdateExpression: "SET coverKey = :cover, updatedAt = :updated" + (pendingCoverCleanup.length ? ", coverCleanup = :coverCleanup REMOVE " : " REMOVE coverCleanup, ") + "coverCleanupClaim, coverCleanupClaimKey, coverCleanupClaimExpiresAt",
      ExpressionAttributeValues: expressionValues,
      ConditionExpression: "attribute_exists(userEmail) AND attribute_not_exists(deletionState) AND (attribute_not_exists(coverCleanupClaim) OR coverCleanupClaimExpiresAt < :now) AND " + (oldKey ? "coverKey = :oldCover" : "attribute_not_exists(coverKey)")
    }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return { statusCode: 409, headers, body: JSON.stringify({ error: "The Tribe cover changed on another device. Try again." }) };
    throw error;
  }
  const cleanup = await cleanupGroupCoverObjects(id, pendingCoverCleanup);
  return { statusCode: 200, headers, body: JSON.stringify({ coverUrl: signedMediaUrl(mediaKey, 3600), cleanupPending: cleanup.pending }) };
}

async function deleteGroup(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event), id = String(event.pathParameters?.groupId || "");
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  if (!/^[a-f0-9-]{36}$/.test(id)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid Tribe required." }) };
  const key = { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } };
  const found = await db.send(new GetItemCommand({ TableName: groupsTable, Key: key, ConsistentRead: true }));
  if (!found.Item) return { statusCode: 404, headers, body: JSON.stringify({ error: "Tribe not found." }) };
  if (found.Item.ownerId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the Tribe founder can delete it." }) };
  const storedCoverKey = found.Item.coverKey?.S || "";
  if (found.Item.deletionState?.S !== "pending") {
    const pendingValues = { ":owner": { S: userId }, ":pending": { S: "pending" }, ":started": { S: new Date().toISOString() }, ":now": { N: String(now()) } };
    const pendingConditions = ["ownerId = :owner", "attribute_not_exists(deletionState)", "(attribute_not_exists(coverCleanupClaim) OR coverCleanupClaimExpiresAt < :now)"];
    if (storedCoverKey) { pendingValues[":cover"] = { S: storedCoverKey }; pendingConditions.push("coverKey = :cover"); }
    else pendingConditions.push("attribute_not_exists(coverKey)");
    try {
      await db.send(new UpdateItemCommand({
        TableName: groupsTable,
        Key: key,
        UpdateExpression: "SET deletionState = :pending, deletionStartedAt = :started REMOVE coverCleanupClaim, coverCleanupClaimKey, coverCleanupClaimExpiresAt",
        ConditionExpression: pendingConditions.join(" AND "),
        ExpressionAttributeValues: pendingValues
      }));
      found.Item.deletionState = { S: "pending" };
      found.Item.deletionStartedAt = pendingValues[":started"];
    } catch (error) {
      if (error.name !== "ConditionalCheckFailedException") throw error;
      const current = await db.send(new GetItemCommand({ TableName: groupsTable, Key: key, ConsistentRead: true }));
      if (current.Item?.ownerId?.S !== userId || current.Item?.deletionState?.S !== "pending") return { statusCode: 409, headers, body: JSON.stringify({ error: "The Tribe changed on another device. Try deletion again.", deleted: false }) };
      found.Item = current.Item;
    }
  }
  let members;
  try {
    members = await scanAll({ TableName: groupsTable, FilterExpression: "groupId = :id", ExpressionAttributeValues: { ":id": { S: id } }, ProjectionExpression: "userEmail, groupId", ConsistentRead: true });
  } catch (error) {
    console.error("Tribe member discovery remains pending", { id, error });
    return { statusCode: 503, headers, body: JSON.stringify({ error: "Tribe deletion is safely pending. Try again.", deleted: false, deletionPending: true }) };
  }
  let pendingMemberDeletes = members.map(item => () => db.send(new DeleteItemCommand({ TableName: groupsTable, Key: { userEmail: item.userEmail, groupId: item.groupId } })));
  for (let attempt = 0; attempt < 3 && pendingMemberDeletes.length; attempt += 1) {
    const settled = await Promise.allSettled(pendingMemberDeletes.map(remove => remove()));
    pendingMemberDeletes = pendingMemberDeletes.filter((remove, index) => settled[index].status === "rejected");
  }
  if (pendingMemberDeletes.length) return { statusCode: 503, headers, body: JSON.stringify({ error: "Tribe deletion is safely pending. Try again.", deleted: false, deletionPending: true }) };
  const coverCleanup = await cleanupGroupCoverObjects(id, [found.Item.coverKey?.S || "", ...(found.Item.coverCleanup?.SS || [])], { allowActive: true });
  if (coverCleanup.pending) return { statusCode: 503, headers, body: JSON.stringify({ error: "Tribe deletion is safely pending. Try again.", deleted: false, deletionPending: true }) };
  let deleted = false;
  const deleteValues = { ":owner": { S: userId }, ":pending": { S: "pending" } };
  const pendingCoverKey = found.Item.coverKey?.S || "";
  if (pendingCoverKey) deleteValues[":cover"] = { S: pendingCoverKey };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await db.send(new DeleteItemCommand({ TableName: groupsTable, Key: key, ConditionExpression: "ownerId = :owner AND deletionState = :pending AND " + (pendingCoverKey ? "coverKey = :cover" : "attribute_not_exists(coverKey)"), ExpressionAttributeValues: deleteValues }));
      deleted = true;
      break;
    } catch (error) {
      if (attempt === 2) console.error("Tribe deletion remains pending", { id, error });
    }
  }
  if (!deleted) return { statusCode: 503, headers, body: JSON.stringify({ error: "Tribe deletion is safely pending. Try again.", deleted: false, deletionPending: true }) };
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: true }) };
}

async function broadcastGroup(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event), id = String(event.pathParameters?.groupId || "");
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  if (!/^[a-f0-9-]{36}$/.test(id)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid Tribe required." }) };
  const data = parseJsonBody(event), message = String(data?.message || "").trim();
  if (!message || message.length > 500) return { statusCode: 400, headers, body: JSON.stringify({ error: "Announcement must contain 1–500 characters." }) };
  const meta = await groupRecord(id);
  if (!meta) return { statusCode: 404, headers, body: JSON.stringify({ error: "Tribe not found." }) };
  if (meta.ownerId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the Tribe creator can notify @everyone." }) };
  const actorEmail = await accountForSub(userId);
  if (!actorEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const members = (await scanAll({ TableName: groupsTable, FilterExpression: "groupId = :id", ExpressionAttributeValues: { ":id": { S: id } }, ProjectionExpression: "userEmail" }))
    .map(item => item.userEmail?.S).filter(email => email && email !== actorEmail && !email.startsWith("GROUP#"));
  const createdAt = new Date().toISOString(), eventId = `group_everyone#${id}#${randomUUID()}`, groupName = meta.name?.S || "your Tribe";
  for (let offset = 0; offset < members.length; offset += 25) {
    await Promise.all(members.slice(offset, offset + 25).map(userEmail => db.send(new PutItemCommand({
      TableName: engagementNotificationsTable,
      Item: { userEmail: { S: userEmail }, eventId: { S: eventId }, type: { S: "group_everyone" }, actorEmail: { S: actorEmail }, groupId: { S: id }, groupName: { S: groupName.slice(0, 80) }, preview: { S: message }, createdAt: { S: createdAt }, read: { BOOL: false }, expiresAt: { N: String(now() + 2592000) } }
    }))));
  }
  return { statusCode: 200, headers, body: JSON.stringify({ notified: members.length, createdAt }) };
}

async function canViewProfileMedia(viewerEmail, profileEmail) {
  if (viewerEmail === profileEmail) return true;
  const friendship = await db.send(new GetItemCommand({
    TableName: friendsTable,
    Key: { userEmail: { S: viewerEmail }, friendEmail: { S: profileEmail } },
    ConsistentRead: true
  }));
  if (["blocked", "blocked_by"].includes(friendship.Item?.status?.S)) return false;
  if (friendship.Item?.status?.S === "friends") return true;
  const memberships = await scanAll({
    TableName: groupsTable,
    ProjectionExpression: "userEmail, groupId",
    FilterExpression: "userEmail = :viewer OR userEmail = :profile",
    ExpressionAttributeValues: { ":viewer": { S: viewerEmail }, ":profile": { S: profileEmail } }
  });
  const viewerGroups = new Set(memberships.filter(item => item.userEmail?.S === viewerEmail).map(item => item.groupId?.S));
  const sharedGroups = [...new Set(memberships.filter(item => item.userEmail?.S === profileEmail && viewerGroups.has(item.groupId?.S)).map(item => item.groupId?.S))];
  for (const groupId of sharedGroups) if (await groupExists(groupId)) return true;
  return false;
}

async function getProfileVideo(event) {
  const headers = corsHeaders(event.headers?.origin), userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const viewerEmail = await accountForSub(userId);
  if (!viewerEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const memberId = String(event.queryStringParameters?.member || "");
  if (memberId && !/^[a-f0-9-]{36}$/.test(memberId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid member required." }) };
  const profileEmail = memberId ? await accountForSub(memberId) : String(event.queryStringParameters?.email || viewerEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid profile required." }) };
  if (!(await canViewProfileMedia(viewerEmail, profileEmail))) return { statusCode: 403, headers, body: JSON.stringify({ error: "Profile media is available to friends and members of the same Tribe." }) };
  const found = await db.send(new GetItemCommand({ TableName: settingsTable, Key: { userEmail: { S: profileEmail } }, ConsistentRead: true }));
  const mediaKey = found.Item?.profileVideoKey?.S || "";
  return { statusCode: 200, headers, body: JSON.stringify({ mediaKey, mediaUrl: signedMediaUrl(mediaKey, 3600) }) };
}

async function cleanupProfileMediaObjects(accountEmail, keys) {
  const prefix = `users/${sha256(accountEmail).slice(0, 24)}/`;
  const candidates = [...new Set((keys || []).filter(Boolean))];
  const owned = candidates.filter(key => key.startsWith(prefix));
  const resolved = candidates.filter(key => !key.startsWith(prefix));
  const pending = [];
  for (const key of owned) {
    const claim = randomUUID(), claimExpiresAt = now() + 300;
    try {
      await db.send(new UpdateItemCommand({
        TableName: settingsTable,
        Key: { userEmail: { S: accountEmail } },
        UpdateExpression: "SET profileMediaCleanupClaim = :claim, profileMediaCleanupClaimKey = :candidate, profileMediaCleanupClaimExpiresAt = :expires",
        ConditionExpression: "contains(profileMediaCleanup, :candidate) AND (attribute_not_exists(profileMediaCleanupClaim) OR profileMediaCleanupClaimExpiresAt < :now) AND (attribute_not_exists(profileAvatarKey) OR profileAvatarKey <> :candidate) AND (attribute_not_exists(profileCoverKey) OR profileCoverKey <> :candidate) AND (attribute_not_exists(profileVideoKey) OR profileVideoKey <> :candidate)",
        ExpressionAttributeValues: { ":claim": { S: claim }, ":candidate": { S: key }, ":expires": { N: String(claimExpiresAt) }, ":now": { N: String(now()) } }
      }));
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") {
        const current = await db.send(new GetItemCommand({ TableName: settingsTable, Key: { userEmail: { S: accountEmail } }, ConsistentRead: true, ProjectionExpression: "profileAvatarKey, profileCoverKey, profileVideoKey, profileMediaCleanup" }));
        const active = new Set([current.Item?.profileAvatarKey?.S, current.Item?.profileCoverKey?.S, current.Item?.profileVideoKey?.S].filter(Boolean));
        if (active.has(key)) {
          const activeConditions = ["profileAvatarKey = :candidate", "profileCoverKey = :candidate", "profileVideoKey = :candidate"].join(" OR ");
          try {
            await db.send(new UpdateItemCommand({
              TableName: settingsTable,
              Key: { userEmail: { S: accountEmail } },
              UpdateExpression: "DELETE profileMediaCleanup :resolved",
              ConditionExpression: activeConditions,
              ExpressionAttributeValues: { ":resolved": { SS: [key] }, ":candidate": { S: key } }
            }));
            resolved.push(key);
          } catch { pending.push(key); }
        } else if (!(current.Item?.profileMediaCleanup?.SS || []).includes(key)) resolved.push(key);
        else pending.push(key);
        continue;
      }
      throw error;
    }
    let removed = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: key }));
        removed = true;
        break;
      } catch (error) {
        if (attempt === 2) console.error("Profile media cleanup remains pending", { key, error });
      }
    }
    if (removed) {
      try {
        await db.send(new UpdateItemCommand({
          TableName: settingsTable,
          Key: { userEmail: { S: accountEmail } },
          UpdateExpression: "DELETE profileMediaCleanup :resolved REMOVE profileMediaCleanupClaim, profileMediaCleanupClaimKey, profileMediaCleanupClaimExpiresAt",
          ConditionExpression: "profileMediaCleanupClaim = :claim AND profileMediaCleanupClaimKey = :candidate",
          ExpressionAttributeValues: { ":resolved": { SS: [key] }, ":claim": { S: claim }, ":candidate": { S: key } }
        }));
        resolved.push(key);
      } catch (error) {
        console.error("Profile media cleanup acknowledgement remains pending", { accountEmail, key, error });
        pending.push(key);
      }
    } else {
      pending.push(key);
      try {
        await db.send(new UpdateItemCommand({
          TableName: settingsTable,
          Key: { userEmail: { S: accountEmail } },
          UpdateExpression: "REMOVE profileMediaCleanupClaim, profileMediaCleanupClaimKey, profileMediaCleanupClaimExpiresAt",
          ConditionExpression: "profileMediaCleanupClaim = :claim AND profileMediaCleanupClaimKey = :candidate",
          ExpressionAttributeValues: { ":claim": { S: claim }, ":candidate": { S: key } }
        }));
      } catch (error) {
        console.error("Profile media cleanup lease release remains pending", { accountEmail, key, error });
      }
    }
  }
  const invalid = resolved.filter(key => !key.startsWith(prefix));
  if (invalid.length) {
    try {
      await db.send(new UpdateItemCommand({
        TableName: settingsTable,
        Key: { userEmail: { S: accountEmail } },
        UpdateExpression: "DELETE profileMediaCleanup :resolved",
        ExpressionAttributeValues: { ":resolved": { SS: invalid } }
      }));
    } catch (error) {
      console.error("Profile media cleanup queue remains pending", { accountEmail, error });
    }
  }
  return { cleaned: resolved.length, pending: pending.length };
}

async function setProfileVideo(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin) && !/^Bearer\s+[a-f0-9]{64}$/i.test(event.headers?.authorization || event.headers?.Authorization || "")) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON." }) }; }
  const accountEmail = await accountForSub(userId), mediaKey = String(body.mediaKey || "");
  if (!accountEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const ownerPrefix = sha256(accountEmail).slice(0, 24);
  if (mediaKey && !new RegExp(`^users/${ownerPrefix}/[a-f0-9-]{36}\\.(mp4|webm|mov)$`).test(mediaKey)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Invalid profile video." }) };
  const key = { userEmail: { S: accountEmail } }, current = await db.send(new GetItemCommand({ TableName: settingsTable, Key: key, ConsistentRead: true }));
  const oldKey = current.Item?.profileVideoKey?.S || "";
  const replacedKey = oldKey && oldKey !== mediaKey && oldKey.startsWith(`users/${ownerPrefix}/`) ? oldKey : "";
  if (mediaKey) {
    try { await s3.send(new HeadObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: mediaKey })); }
    catch { return { statusCode: 404, headers, body: JSON.stringify({ error: "Uploaded profile video was not found." }) }; }
  }
  const active = new Set([current.Item?.profileAvatarKey?.S, current.Item?.profileCoverKey?.S, mediaKey].filter(Boolean));
  const pendingProfileMedia = [...new Set([...(current.Item?.profileMediaCleanup?.SS || []), replacedKey].filter(candidate => candidate && !active.has(candidate)))];
  const expressionValues = { ":video": { S: mediaKey }, ":updated": { S: new Date().toISOString() }, ":now": { N: String(now()) } };
  const conditions = ["attribute_not_exists(profileMediaCleanupClaim) OR profileMediaCleanupClaimExpiresAt < :now"];
  for (const [field, token] of [["profileAvatarKey", "avatar"], ["profileCoverKey", "cover"], ["profileVideoKey", "oldVideo"]]) {
    const value = current.Item?.[field]?.S || "";
    if (value) { expressionValues[`:${token}`] = { S: value }; conditions.push(`${field} = :${token}`); }
    else conditions.push(`attribute_not_exists(${field})`);
  }
  if (pendingProfileMedia.length) expressionValues[":profileCleanup"] = { SS: pendingProfileMedia };
  try {
    await db.send(new UpdateItemCommand({
      TableName: settingsTable,
      Key: key,
      UpdateExpression: "SET profileVideoKey = :video, updatedAt = :updated" + (pendingProfileMedia.length ? ", profileMediaCleanup = :profileCleanup REMOVE " : " REMOVE profileMediaCleanup, ") + "profileMediaCleanupClaim, profileMediaCleanupClaimKey, profileMediaCleanupClaimExpiresAt",
      ConditionExpression: conditions.map(condition => `(${condition})`).join(" AND "),
      ExpressionAttributeValues: expressionValues
    }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return { statusCode: 409, headers, body: JSON.stringify({ error: "Your profile media changed on another device. Reload and try again." }) };
    throw error;
  }
  await cleanupProfileMediaObjects(accountEmail, pendingProfileMedia);
  return { statusCode: 200, headers, body: JSON.stringify({ mediaKey }) };
}

// CHECK SESSION
async function checkSession(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event);
  const email = userId ? await accountForSub(userId) : "";

  return {
    statusCode: userId ? 200 : 401,
    headers,
    body: JSON.stringify({
      authenticated: Boolean(userId),
      user: userId && email ? { email } : undefined
    })
  };
}

// RESOLVE THE CURRENT ACCOUNT WITHOUT EXPOSING TOKENS TO THE BROWSER
async function accountForSub(userId) {
  const result = await cognito.send(new ListUsersCommand({
    UserPoolId: userPoolId,
    Filter: `sub = "${String(userId).replace(/["\\]/g, "")}"`,
    Limit: 1
  }));
  const account = result.Users?.[0];
  const email = account?.Attributes?.find(attribute => attribute.Name === "email")?.Value;
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

// READ POSTS WITH SERVER-SIDE AUDIENCE ENFORCEMENT
function postEditHistory(item) {
  try {
    const history = JSON.parse(item?.editHistory?.S || "[]");
    if (!Array.isArray(history)) return [];
    return history.filter(entry => entry && typeof entry.content === "string" && typeof entry.editedAt === "string").slice(-20);
  } catch { return []; }
}

async function loadFeedAuthorProfiles(items) {
  const emails = [...new Set(items.map(item => String(item.userEmail?.S || "").trim().toLowerCase()).filter(Boolean))];
  const profiles = new Map();
  let next = 0;
  async function worker() {
    while (next < emails.length) {
      const email = emails[next++];
      let picture = "";
      try {
        const found = await db.send(new GetItemCommand({
          TableName: settingsTable, Key: { userEmail: { S: email } },
          ProjectionExpression: "profileName, profileAvatarKey", ConsistentRead: true
        }));
        const name = String(found.Item?.profileName?.S || "").trim().slice(0, 80);
        const avatarKey = String(found.Item?.profileAvatarKey?.S || "");
        picture = avatarKey ? signedMediaUrl(avatarKey, 3600) : "";
        if (name) {
          profiles.set(email, { name, picture });
          continue;
        }
      } catch (error) { console.warn("Feed display-name lookup failed", error.name || "UnknownError"); }
      try {
        const result = await cognito.send(new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${email.replace(/["\\]/g, "")}"`,
          Limit: 1
        }));
        const attributes = result.Users?.[0]?.Attributes || [];
        const publicName = String(attributes.find(attribute => attribute.Name === "name")?.Value || attributes.find(attribute => attribute.Name === "preferred_username")?.Value || "").trim().slice(0, 80);
        if (publicName) profiles.set(email, { name: publicName, picture });
      } catch (error) { console.warn("Cognito display-name lookup failed", error.name || "UnknownError"); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, emails.length) }, worker));
  return profiles;
}

async function loadFeedAuthorNames(items, existingProfiles = null) {
  const profiles = existingProfiles || await loadFeedAuthorProfiles(items);
  return new Map([...profiles].map(([email, profile]) => [email, profile.name]));
}

async function getSecurePosts(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event);

  if (!userId) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  }

  const rawPosts = (await scanAll({ TableName: postsTable, ConsistentRead: true }))
    .filter(item => item.postId?.S && item.content?.S && item.createdAt?.S);
  const viewerEmail = await accountForSub(userId);
  const otherAuthors = [...new Set(rawPosts
    .filter(item => item.userId?.S !== userId && item.userEmail?.S)
    .map(item => item.userEmail.S))];
  const friendEmails = new Set();
  const blockedEmails = new Set();
  const viewerGroupIds = new Set();
  const activeGroupIds = new Set(defaultGroupIds);
  const groupNames = new Map([
    ["default-0", "Visual Artist"], ["default-1", "DJs & Producers"], ["default-2", "Fans"], ["default-3", "Venues"], ["default-4", "Events"],
    ["default-5", "Scenes"], ["default-6", "Bands"], ["default-7", "Industry"], ["default-8", "Politics"], ["default-9", "Religion"]
  ]);

  if (viewerEmail && otherAuthors.length) {
    const friendships = await batchGetFriendships(viewerEmail, otherAuthors);
    for (const item of friendships) {
      if (item.status?.S === "friends" && item.friendEmail?.S) friendEmails.add(item.friendEmail.S);
      if (["blocked", "blocked_by"].includes(item.status?.S) && item.friendEmail?.S) blockedEmails.add(item.friendEmail.S);
    }
  }

  if (viewerEmail && rawPosts.some(item => item.groupId?.S)) {
    const groupItems = await scanAll({ TableName: groupsTable, ConsistentRead: true });
    for (const item of groupItems) {
      if (item.userEmail?.S === viewerEmail && item.groupId?.S && item.groupId.S !== "META") viewerGroupIds.add(item.groupId.S);
      if (item.groupId?.S === "META" && item.userEmail?.S?.startsWith("GROUP#") && item.deletionState?.S !== "pending") {
        const groupId = item.userEmail.S.slice(6);
        activeGroupIds.add(groupId);
        groupNames.set(groupId, item.name?.S || "Tribe");
      }
    }
  }

  const canView = item => item.groupId?.S
    ? activeGroupIds.has(item.groupId.S) && (item.userId?.S === userId || !blockedEmails.has(item.userEmail?.S) && viewerGroupIds.has(item.groupId.S))
    : item.userId?.S === userId || !blockedEmails.has(item.userEmail?.S) && (item.audience?.S === "public" || item.audience?.S === "friends" && friendEmails.has(item.userEmail?.S));
  const accessibleSources = new Map(rawPosts.filter(canView).map(item => [item.postId.S, item]));
  const visiblePosts = rawPosts.filter(item => item.placementRemoved?.BOOL !== true && canView(item) && (!item.sharedPostId?.S || accessibleSources.has(item.sharedPostId.S)));
  const tagNames = visiblePosts.flatMap(item => (item.taggedUsers?.L || []).map(tag => ({userEmail:tag.M?.userEmail})));
  const authorProfiles = typeof loadFeedAuthorProfiles === "function" ? await loadFeedAuthorProfiles([...visiblePosts,...tagNames]) : new Map();
  const authorNames = await loadFeedAuthorNames([...visiblePosts,...tagNames], authorProfiles);
  const authorName = email => authorNames.get(String(email || "").trim().toLowerCase()) || "DanzStak member";
  const authorPicture = email => authorProfiles.get(String(email || "").trim().toLowerCase())?.picture || "";
  const sharedPreview = item => item ? ({postId:item.postId.S,authorMemberId:item.userId?.S || "",content:item.content.S,authorName:authorName(item.userEmail?.S),authorPicture:authorPicture(item.userEmail?.S),createdAt:item.createdAt.S,mediaType:item.mediaType?.S || "",mediaUrl:item.mediaKey?.S ? signedMediaUrl(item.mediaKey.S,3600) : ""}) : null;
  const posts = visiblePosts.map(item => ({
      postId: item.postId.S,
      userId: item.userId?.S ?? null,
      isOwner: item.userId?.S === userId,
      featured: item.featured?.BOOL === true,
      profileOwnerMemberId: item.profileOwnerId?.S ?? "",
      canRemoveFromProfile: item.profileOwnerId?.S === userId && item.userId?.S !== userId,
      authorName: authorName(item.userEmail?.S),
      authorPicture: authorPicture(item.userEmail?.S),
      importSource: item.importSource?.S || "",
      content: item.content.S,
      location: item.location?.S || "",
      viewCount: Math.max(0,Number(item.viewCount?.N || 0)),
      taggedUsers:(item.taggedUsers?.L || []).map(tag => ({memberId:tag.M?.memberId?.S || "",name:authorNames.get(tag.M?.userEmail?.S) || tag.M?.name?.S || "DanzStak member",isMe:tag.M?.memberId?.S === userId})),
      sharedPostId:item.sharedPostId?.S || "",
      sharedPost:sharedPreview(accessibleSources.get(item.sharedPostId?.S)),
      audience: item.audience?.S ?? "public",
      groupId: item.groupId?.S || "",
      groupName: item.groupId?.S ? groupNames.get(item.groupId.S) || "Tribe" : "",
      mediaKey: item.mediaKey?.S ?? "",
      mediaUrl: item.mediaKey?.S ? signedMediaUrl(item.mediaKey.S, 3600) : "",
      mediaType: item.mediaType?.S ?? "",
      reel: item.reel?.BOOL === true,
      commentPolicy: item.commentPolicy?.S ?? "everyone",
      editHistory: postEditHistory(item),
      updatedAt: item.updatedAt?.S ?? "",
      createdAt: item.createdAt.S
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return { statusCode: 200, headers, body: JSON.stringify({ posts }) };
}

async function postForEngagement(postId, userId) {
  if (!/^[a-f0-9-]{36}$/.test(postId)) return { error: "Invalid post.", statusCode: 400 };
  const found = await db.send(new GetItemCommand({ TableName: postsTable, Key: { postId: { S: postId } }, ConsistentRead: true }));
  const post = found.Item;
  if (!post) return { error: "Post not found.", statusCode: 404 };
  if (post.placementRemoved?.BOOL === true) return { error: "Post is not available.", statusCode: 404 };
  if (post.userId?.S === userId) return { post };
  const viewerEmail = await accountForSub(userId);
  if (!viewerEmail) return { error: "Account email could not be verified.", statusCode: 409 };
  if (post.userEmail?.S && await isBlockedPair(viewerEmail, post.userEmail.S)) return { error: "Post is not available.", statusCode: 403 };
  if (post.groupId?.S) {
    const access = await requireGroupMember(post.groupId.S, userId);
    return access.error ? access : { post };
  }
  if (post.audience?.S === "public") return { post };
  if (post.audience?.S !== "friends" || !post.userEmail?.S) return { error: "Post is not available.", statusCode: 403 };
  const friendship = await db.send(new BatchGetItemCommand({
    RequestItems: {
      [friendsTable]: {
        Keys: [{ userEmail: { S: viewerEmail }, friendEmail: { S: post.userEmail.S } }],
        ConsistentRead: true,
        ProjectionExpression: "#status",
        ExpressionAttributeNames: { "#status": "status" }
      }
    }
  }));
  if (friendship.Responses?.[friendsTable]?.[0]?.status?.S !== "friends") return { error: "Post is not available.", statusCode: 403 };
  return { post };
}

function parseJsonBody(event) {
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : event.body || "";
    return JSON.parse(raw);
  } catch { return null; }
}

async function notifyPostOwner(post, eventId, type, actorEmail, preview) {
  const ownerEmail = post.userEmail?.S;
  if (!ownerEmail || ownerEmail === actorEmail) return;
  const settings = await db.send(new GetItemCommand({
    TableName: settingsTable,
    Key: { userEmail: { S: ownerEmail } },
    ConsistentRead: true,
    ProjectionExpression: "mutedPosts"
  }));
  if (settings.Item?.mutedPosts?.SS?.includes(post.postId.S)) return;
  const createdAt = new Date().toISOString();
  await db.send(new PutItemCommand({
    TableName: engagementNotificationsTable,
    Item: {
      userEmail: { S: ownerEmail }, eventId: { S: eventId }, type: { S: type }, actorEmail: { S: actorEmail },
      postId: { S: post.postId.S }, preview: { S: String(preview || "").slice(0, 160) }, createdAt: { S: createdAt },
      read: { BOOL: false },
      expiresAt: { N: String(now() + 2592000) }
    }
  }));
}

async function getEngagement(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const postId = String(event.queryStringParameters?.postId || "");
  const access = await postForEngagement(postId, userId);
  if (!access.post) return { statusCode: access.statusCode, headers, body: JSON.stringify({ error: access.error }) };
  const [reactionItemsRaw, commentItemsRaw] = await Promise.all([
    queryAll({ TableName: reactionsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ConsistentRead: true }),
    queryAll({ TableName: commentsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ConsistentRead: true })
  ]);
  const viewerEmail = await accountForSub(userId);
  const interactionEmails = [...new Set([...reactionItemsRaw, ...commentItemsRaw].map(item => item.userEmail?.S).filter(email => email && email !== viewerEmail))];
  const blockedEmails = new Set();
  if (viewerEmail && interactionEmails.length) {
    for (const item of await batchGetFriendships(viewerEmail, interactionEmails)) {
      if (["blocked", "blocked_by"].includes(item.status?.S) && item.friendEmail?.S) blockedEmails.add(item.friendEmail.S);
    }
  }
  const reactionItems = reactionItemsRaw.filter(item => !blockedEmails.has(item.userEmail?.S));
  const commentItems = commentItemsRaw.filter(item => !blockedEmails.has(item.userEmail?.S));
  const commentReactionItems = reactionItems.filter(item => item.commentId?.S);
  const authorProfiles = await loadFeedAuthorProfiles([...commentItems, ...commentReactionItems]);
  const authorNames = await loadFeedAuthorNames([...commentItems, ...commentReactionItems], authorProfiles);
  const friends = new Set();
  if (commentReactionItems.length) {
    const viewerEmail = await accountForSub(userId), emails = [...new Set(commentReactionItems.map(item => item.userEmail?.S).filter(Boolean))];
    if (viewerEmail && emails.length) { try { for (const item of await batchGetFriendships(viewerEmail, emails)) if (item.status?.S === "friends") friends.add(item.friendEmail.S); } catch (error) { console.warn("Comment friendship lookup failed",error.name); } }
  }
  const reactionCounts = {}, commentReactions = new Map();
  let myReaction = "";
  for (const item of reactionItems) {
    const reaction = item.reaction?.S || "Like";
    if (item.commentId?.S) {
      const id = item.commentId.S, summary = commentReactions.get(id) || {reactionCounts:{}, myReaction:"", reactionTotal:0, reactors:[]};
      summary.reactionCounts[reaction] = (summary.reactionCounts[reaction] || 0) + 1; summary.reactionTotal++;
      if (item.actorUserId?.S === userId) summary.myReaction = reaction;
      summary.reactors.push({memberId:item.actorUserId?.S || "",name:authorNames.get(item.userEmail?.S) || "DanzStak member",reaction,isFriend:friends.has(item.userEmail?.S)});
      commentReactions.set(id, summary); continue;
    }
    reactionCounts[reaction] = (reactionCounts[reaction] || 0) + 1;
    if (item.userId?.S === userId) myReaction = reaction;
  }
  const commentRecords = commentItems.map(item => ({
    ...(commentReactions.get(item.commentId.S) || {reactionCounts:{}, myReaction:"", reactionTotal:0}),
    authorName:authorNames.get(item.userEmail?.S) || "DanzStak member",
    authorPicture:authorProfiles.get(String(item.userEmail?.S || "").trim().toLowerCase())?.picture || "",
    authorMemberId:item.userId?.S || "", commentId:item.commentId.S, content:item.content.S,
    createdAt: item.createdAt.S, isOwner: item.userId?.S === userId, canDelete: item.userId?.S === userId || access.post.userId?.S === userId,
    ...(item.parentCommentId?.S ? { parentCommentId: item.parentCommentId.S, replyToName: item.replyToName?.S || "DanzStak member" } : {})
  }));
  const commentById = new Map(commentRecords.map(comment => [comment.commentId, comment]));
  const children = new Map();
  for (const comment of commentRecords) if (comment.parentCommentId && commentById.has(comment.parentCommentId)) {
    const list = children.get(comment.parentCommentId) || []; list.push(comment); children.set(comment.parentCommentId, list);
  }
  const comments = [], appendThread = comment => { comments.push(comment); for (const reply of (children.get(comment.commentId) || []).sort((a,b) => a.createdAt.localeCompare(b.createdAt))) appendThread(reply); };
  commentRecords.filter(comment => !comment.parentCommentId || !commentById.has(comment.parentCommentId))
    .sort((a,b) => b.reactionTotal - a.reactionTotal || a.createdAt.localeCompare(b.createdAt)).forEach(appendThread);
  return { statusCode: 200, headers, body: JSON.stringify({ reactionCounts, myReaction, comments }) };
}

async function recordPostView(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin) && !/^Bearer\s+[a-f0-9]{64}$/i.test(event.headers?.authorization || event.headers?.Authorization || "")) return {statusCode:403,headers,body:JSON.stringify({error:"Forbidden origin"})};
  const userId = await getAuthenticatedUser(event); if (!userId) return {statusCode:401,headers,body:JSON.stringify({error:"Authentication required"})};
  const data = parseJsonBody(event), postId = String(data?.postId || ""), access = await postForEngagement(postId,userId);
  if (!access.post) return {statusCode:access.statusCode,headers,body:JSON.stringify({error:access.error})};
  if (access.post.userId?.S === userId) return {statusCode:200,headers,body:JSON.stringify({viewCount:Number(access.post.viewCount?.N || 0),recorded:false})};
  if (!process.env.POST_VIEWS_TABLE) return {statusCode:503,headers,body:JSON.stringify({error:"View counting is not available yet"})};
  const day = new Date().toISOString().slice(0,10), viewerKey = day + "#" + sha256(userId);
  let recorded = true;
  try { await db.send(new TransactWriteItemsCommand({TransactItems:[
    {Put:{TableName:process.env.POST_VIEWS_TABLE,Item:{postId:{S:postId},viewerKey:{S:viewerKey},expiresAt:{N:String(now()+90*86400)}},ConditionExpression:"attribute_not_exists(postId)"}},
    {Update:{TableName:postsTable,Key:{postId:{S:postId}},UpdateExpression:"ADD viewCount :one",ExpressionAttributeValues:{":one":{N:"1"}},ConditionExpression:"attribute_exists(postId)"}}
  ]})); } catch (error) {
    if (error.name !== "TransactionCanceledException") throw error;
    if (error.CancellationReasons?.[1]?.Code === "ConditionalCheckFailed") return {statusCode:404,headers,body:JSON.stringify({error:"Post not found"})};
    const duplicate = await db.send(new GetItemCommand({TableName:process.env.POST_VIEWS_TABLE,Key:{postId:{S:postId},viewerKey:{S:viewerKey}},ConsistentRead:true}));
    if (!duplicate.Item) throw error;
    recorded = false;
  }
  const found = await db.send(new GetItemCommand({TableName:postsTable,Key:{postId:{S:postId}},ConsistentRead:true}));
  if (!found.Item) return {statusCode:404,headers,body:JSON.stringify({error:"Post not found"})};
  return {statusCode:200,headers,body:JSON.stringify({viewCount:Number(found.Item.viewCount?.N || 0),recorded})};
}

async function setReaction(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin) && !/^Bearer\s+[a-f0-9]{64}$/i.test(event.headers?.authorization || event.headers?.Authorization || "")) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const data = parseJsonBody(event);
  const postId = String(data?.postId || ""), reaction = String(data?.reaction || "");
  if (reaction && !["Like", "Dislike", "Love", "Laugh", "Wow", "Sad", "Fire"].includes(reaction)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Unsupported reaction." }) };
  const access = await postForEngagement(postId, userId);
  if (!access.post) return { statusCode: access.statusCode, headers, body: JSON.stringify({ error: access.error }) };
  const commentId = String(data?.commentId || "");
  if (commentId) {
    if (!/^\d{13}#[a-f0-9-]{36}$/.test(commentId)) return {statusCode:400,headers,body:JSON.stringify({error:"Invalid comment."})};
    const found = await db.send(new GetItemCommand({TableName:commentsTable,Key:{postId:{S:postId},commentId:{S:commentId}},ConsistentRead:true}));
    if (!found.Item) return {statusCode:404,headers,body:JSON.stringify({error:"Comment not found."})};
    const actorEmail = await accountForSub(userId);
    if (!actorEmail) return {statusCode:409,headers,body:JSON.stringify({error:"Account email could not be verified."})};
    const names = reaction ? await loadFeedAuthorNames([{userEmail:{S:actorEmail}}]) : new Map();
    const key = {postId:{S:postId},userId:{S:"comment#"+commentId+"#"+userId}};
    if (!reaction) await db.send(new DeleteItemCommand({TableName:reactionsTable,Key:key}));
    else await db.send(new PutItemCommand({TableName:reactionsTable,Item:{...key,commentId:{S:commentId},actorUserId:{S:userId},userEmail:{S:actorEmail},actorName:{S:names.get(actorEmail)||"DanzStak member"},reaction:{S:reaction},createdAt:{S:new Date().toISOString()}}}));
    return {statusCode:200,headers,body:JSON.stringify({reaction,commentId})};
  }
  const key = { postId: { S: postId }, userId: { S: userId } };
  const actorEmail = await accountForSub(userId);
  if (!actorEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const notificationId = `reaction#${postId}#${userId}`;
  if (!reaction) {
    await db.send(new DeleteItemCommand({ TableName: reactionsTable, Key: key }));
    if (access.post.userEmail?.S) await db.send(new DeleteItemCommand({ TableName: engagementNotificationsTable, Key: { userEmail: { S: access.post.userEmail.S }, eventId: { S: notificationId } } }));
  } else {
    await db.send(new PutItemCommand({ TableName: reactionsTable, Item: { ...key, reaction: { S: reaction }, userEmail: { S: actorEmail }, createdAt: { S: new Date().toISOString() } } }));
    await notifyPostOwner(access.post, notificationId, "reaction", actorEmail, reaction);
  }
  return { statusCode: 200, headers, body: JSON.stringify({ reaction }) };
}

async function addComment(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const data = parseJsonBody(event), postId = String(data?.postId || ""), content = String(data?.content || "").trim(), parentCommentId = String(data?.parentCommentId || "");
  if (!content || content.length > 1000) return { statusCode: 400, headers, body: JSON.stringify({ error: "Comment must contain 1–1000 characters." }) };
  const access = await postForEngagement(postId, userId);
  if (!access.post) return { statusCode: access.statusCode, headers, body: JSON.stringify({ error: access.error }) };
  const userEmail = await accountForSub(userId);
  if (!userEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const actorProfiles = await loadFeedAuthorProfiles([{ userEmail: { S: userEmail } }]), actorProfile = actorProfiles.get(userEmail) || {};
  const commentPolicy = access.post.commentPolicy?.S || "everyone", ownerEmail = access.post.userEmail?.S || "";
  if (commentPolicy === "off" && access.post.userId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Comments are turned off for this post." }) };
  if (commentPolicy === "friends" && access.post.userId?.S !== userId) {
    const friendship = await db.send(new GetItemCommand({ TableName: friendsTable, Key: { userEmail: { S: ownerEmail }, friendEmail: { S: userEmail } }, ConsistentRead: true }));
    if (friendship.Item?.status?.S !== "friends") return { statusCode: 403, headers, body: JSON.stringify({ error: "Only friends can comment on this post." }) };
  }
  let parentComment = null, replyToName = "";
  if (parentCommentId) {
    if (!/^\d{13}#[a-f0-9-]{36}$/.test(parentCommentId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid reply target." }) };
    const found = await db.send(new GetItemCommand({ TableName: commentsTable, Key: { postId: { S: postId }, commentId: { S: parentCommentId } }, ConsistentRead: true }));
    parentComment = found.Item;
    if (!parentComment) return { statusCode: 404, headers, body: JSON.stringify({ error: "The comment you are replying to no longer exists." }) };
    const names = await loadFeedAuthorNames([parentComment]);
    replyToName = names.get(parentComment.userEmail?.S) || "DanzStak member";
  }
  const commentId = `${String(Date.now()).padStart(13, "0")}#${randomUUID()}`, createdAt = new Date().toISOString();
  await db.send(new PutItemCommand({ TableName: commentsTable, Item: { postId: { S: postId }, commentId: { S: commentId }, userId: { S: userId }, userEmail: { S: userEmail }, content: { S: content }, createdAt: { S: createdAt }, ...(parentComment ? { parentCommentId: { S: parentCommentId }, replyToName: { S: replyToName } } : {}) } }));
  await notifyPostOwner(access.post, `comment#${commentId}`, "comment", userEmail, content);
  if (parentComment?.userEmail?.S && parentComment.userEmail.S !== access.post.userEmail?.S) await notifyPostOwner({ ...access.post, userEmail: parentComment.userEmail }, `reply#${commentId}`, "reply", userEmail, content);
  return { statusCode: 201, headers, body: JSON.stringify({ comment: { commentId, authorMemberId:userId, content, createdAt, authorName: actorProfile.name || "DanzStak member", authorPicture: actorProfile.picture || "", isOwner: true, canDelete: true, ...(parentComment ? { parentCommentId, replyToName } : {}) } }) };
}

async function reportPost(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const data = parseJsonBody(event), postId = String(data?.postId || ""), reason = String(data?.reason || ""), details = String(data?.details || "").trim();
  const allowedReasons = new Set(["copyright", "hate_speech", "harassment", "violence", "spam", "other"]);
  if (!allowedReasons.has(reason)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Choose a valid report reason." }) };
  if (details.length > 500) return { statusCode: 400, headers, body: JSON.stringify({ error: "Report details cannot exceed 500 characters." }) };
  const groupReport = data?.targetType === "group", groupId = String(data?.groupId || "");
  let reportedUserId = "unknown";
  if (groupReport) {
    if (!details) return { statusCode: 400, headers, body: JSON.stringify({ error: "Describe the Tribe concern." }) };
    if (!(await groupExists(groupId))) return { statusCode: 404, headers, body: JSON.stringify({ error: "Tribe not found." }) };
  } else {
    const access = await postForEngagement(postId, userId);
    if (!access.post) return { statusCode: access.statusCode, headers, body: JSON.stringify({ error: access.error }) };
    if (access.post.userId?.S === userId) return { statusCode: 400, headers, body: JSON.stringify({ error: "Only other members' posts can be reported." }) };
    reportedUserId = access.post.userId?.S || "unknown";
  }
  const reporterEmail = await accountForSub(userId);
  if (!reporterEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const reportId = randomUUID(), createdAt = new Date().toISOString();
  await db.send(new PutItemCommand({
    TableName: reportsTable,
    Item: {
      reportId: { S: reportId }, reporterId: { S: userId }, reporterEmail: { S: reporterEmail },
      ...(groupReport ? { targetType: { S: "group" }, groupId: { S: groupId } } : { postId: { S: postId }, reportedUserId: { S: reportedUserId } }),
      reason: { S: reason }, details: { S: details },
      status: { S: "open" }, createdAt: { S: createdAt }
    },
    ConditionExpression: "attribute_not_exists(reportId)"
  }));
  return { statusCode: 201, headers, body: JSON.stringify({ report: { reportId, status: "open", createdAt } }) };
}

async function deleteComment(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event), postId = String(event.queryStringParameters?.postId || ""), commentId = String(event.pathParameters?.commentId || "");
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  if (!/^[a-f0-9-]{36}$/.test(postId) || !/^\d{13}#[a-f0-9-]{36}$/.test(commentId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid comment." }) };
  const [commentResult, post] = await Promise.all([
    db.send(new GetItemCommand({ TableName: commentsTable, Key: { postId: { S: postId }, commentId: { S: commentId } }, ConsistentRead: true })),
    db.send(new GetItemCommand({ TableName: postsTable, Key: { postId: { S: postId } }, ConsistentRead: true }))
  ]);
  const comment = commentResult.Item;
  if (!comment) return { statusCode: 404, headers, body: JSON.stringify({ error: "Comment not found." }) };
  if (comment.userId?.S !== userId && post.Item?.userId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the comment or post owner can delete this comment." }) };
  const [comments, reactions] = await Promise.all([
    queryAll({ TableName: commentsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ProjectionExpression: "postId, commentId, userId, userEmail, parentCommentId", ConsistentRead: true }, Number.MAX_SAFE_INTEGER),
    queryAll({ TableName: reactionsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ProjectionExpression: "postId, userId, commentId", ConsistentRead: true }, Number.MAX_SAFE_INTEGER)
  ]);
  const commentsById = new Map(comments.map(item => [item.commentId?.S, item]));
  commentsById.set(commentId, comment);
  const notificationKeys = new Map();
  const rememberNotification = (userEmail, eventId) => {
    if (!userEmail || !eventId) return;
    notificationKeys.set(`${userEmail}\u0000${eventId}`, { userEmail: { S: userEmail }, eventId: { S: eventId } });
  };
  const postOwnerEmail = post.Item?.userEmail?.S || "", commentOwnerEmail = comment.userEmail?.S || "";
  if (postOwnerEmail) rememberNotification(postOwnerEmail, `comment#${commentId}`);
  const parent = commentsById.get(comment.parentCommentId?.S), parentEmail = parent?.userEmail?.S || "";
  if (parentEmail && parentEmail !== postOwnerEmail) rememberNotification(parentEmail, `reply#${commentId}`);
  for (const child of comments) if (child.parentCommentId?.S === commentId && commentOwnerEmail && commentOwnerEmail !== postOwnerEmail) {
    rememberNotification(commentOwnerEmail, `reply#${child.commentId?.S || ""}`);
  }
  const cleanupTasks = [
    ...reactions.filter(item => item.commentId?.S === commentId).map(item => () => db.send(new DeleteItemCommand({ TableName: reactionsTable, Key: { postId: item.postId, userId: item.userId } }))),
    ...[...notificationKeys.values()].map(key => () => db.send(new DeleteItemCommand({ TableName: engagementNotificationsTable, Key: key })))
  ];
  const cleanupPending = await runCleanup(cleanupTasks);
  if (cleanupPending) {
    console.error("Comment dependency deletion remains pending", { postId, commentId, cleanupPending });
    return { statusCode: 503, headers, body: JSON.stringify({ error: "The comment is still being removed. Try again.", deleted: false, cleanupPending }) };
  }
  const commentCleanupPending = await runCleanup([() => db.send(new DeleteItemCommand({
    TableName: commentsTable,
    Key: { postId: { S: postId }, commentId: { S: commentId } },
    ConditionExpression: "userId = :owner",
    ExpressionAttributeValues: { ":owner": { S: comment.userId.S } }
  }))]);
  if (commentCleanupPending) {
    console.error("Comment deletion remains pending", { postId, commentId, commentCleanupPending });
    return { statusCode: 503, headers, body: JSON.stringify({ error: "The comment is still being removed. Try again.", deleted: false, cleanupPending: commentCleanupPending }) };
  }
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: true, cleanupPending: 0 }) };
}

async function getEngagementNotifications(event) {
  const headers = corsHeaders(event.headers?.origin), userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const userEmail = await accountForSub(userId);
  if (!userEmail) return { statusCode: 200, headers, body: JSON.stringify({ notifications: [] }) };
  const items = await queryAll({ TableName: engagementNotificationsTable, KeyConditionExpression: "userEmail = :u", ExpressionAttributeValues: { ":u": { S: userEmail } }, ConsistentRead: true });
  const actorEmails = [...new Set(items.map(item => item.actorEmail?.S).filter(Boolean))];
  const [actorProfiles, actorMemberEntries] = await Promise.all([
    loadFeedAuthorProfiles(actorEmails.map(email => ({ userEmail: { S: email } }))),
    mapLimit(actorEmails, 8, async email => {
      try {
        const result = await cognito.send(new ListUsersCommand({ UserPoolId: userPoolId, Filter: `email = "${email.replace(/["\\]/g, "")}"`, Limit: 1 }));
        return [email, result.Users?.[0]?.Attributes?.find(attribute => attribute.Name === "sub")?.Value || ""];
      } catch (error) {
        console.warn("Notification member lookup failed", error.name || "UnknownError");
        return [email, ""];
      }
    })
  ]);
  const actorMembers = new Map(actorMemberEntries);
  const notifications = items.map(item => {
    const profile = actorProfiles.get(item.actorEmail?.S || "") || {};
    return { type: item.type.S, memberId: actorMembers.get(item.actorEmail?.S || "") || "", name: profile.name || "DanzStak member", picture: profile.picture || "", ...(item.postId?.S ? { postId: item.postId.S } : {}), ...(item.groupId?.S ? { groupId: item.groupId.S, groupName: item.groupName?.S || "Tribe" } : {}), preview: item.preview?.S || "", createdAt: item.createdAt.S, unread: item.read?.BOOL !== true };
  })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 100);
  return { statusCode: 200, headers, body: JSON.stringify({ notifications }) };
}

async function clearEngagementNotifications(event) {
  const headers = corsHeaders(event.headers?.origin), userId = await getAuthenticatedUser(event);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const userEmail = await accountForSub(userId);
  if (!userEmail) return { statusCode: 200, headers, body: JSON.stringify({ cleared: 0 }) };
  const items = await queryAll({ TableName: engagementNotificationsTable, KeyConditionExpression: "userEmail = :u", ExpressionAttributeValues: { ":u": { S: userEmail } }, ProjectionExpression: "eventId, #read", ExpressionAttributeNames: { "#read": "read" }, ConsistentRead: true });
  const unread = items.filter(item => item.read?.BOOL !== true);
  await Promise.all(unread.map(item => db.send(new UpdateItemCommand({ TableName: engagementNotificationsTable, Key: { userEmail: { S: userEmail }, eventId: { S: item.eventId.S } }, UpdateExpression: "SET #read = :read", ExpressionAttributeNames: { "#read": "read" }, ExpressionAttributeValues: { ":read": { BOOL: true } } }))));
  return { statusCode: 200, headers, body: JSON.stringify({ cleared: unread.length }) };
}

// CREATE SECURE POST
async function createSecurePost(event) {
  const headers = corsHeaders(event.headers?.origin);

  if (!allowedOrigins.has(event.headers?.origin) && !/^Bearer\s+[a-f0-9]{64}$/i.test(event.headers?.authorization || event.headers?.Authorization || "")) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({
        error: "Forbidden origin"
      })
    };
  }

  const contentType =
    event.headers?.["content-type"] || "";

  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return {
      statusCode: 415,
      headers,
      body: JSON.stringify({
        error: "JSON content type required"
      })
    };
  }

  const userId = await getAuthenticatedUser(event);

  if (!userId) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({
        error: "Authentication required."
      })
    };
  }

  let data;

  try {
    const body = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body || "";

    data = JSON.parse(body);
  } catch {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Invalid JSON request."
      })
    };
  }

  let sharedSource = null;
  if (data?.sharedPostId !== undefined) {
    if (typeof data.sharedPostId !== "string" || !/^[a-f0-9-]{36}$/.test(data.sharedPostId) || data.importSource !== undefined) return {statusCode:400,headers,body:JSON.stringify({error:"Invalid shared post."})};
    let sourceId = data.sharedPostId;
    for (let depth=0;depth<5;depth++) {
      const access = await postForEngagement(sourceId,userId);
      if (!access.post || access.post.audience?.S !== "public") return {statusCode:403,headers,body:JSON.stringify({error:"Only available Public posts can be shared."})};
      sharedSource = access.post;
      if (!sharedSource.sharedPostId?.S) break;
      sourceId = sharedSource.sharedPostId.S;
    }
    if (sharedSource.sharedPostId?.S) return {statusCode:400,headers,body:JSON.stringify({error:"Open the original post to share it."})};
  }
  const facebookImport = data?.importSource === "facebook";
  if (data?.importSource !== undefined && !facebookImport) return { statusCode: 400, headers, body: JSON.stringify({ error: "Unsupported import source." }) };
  if (facebookImport && !/^[a-f0-9]{64}$/.test(data.importKey || "")) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid import identifier." }) };
  const importHash = facebookImport ? sha256(`facebook:${userId}:${data.importKey}`) : "";
  const importPostId = facebookImport ? `${importHash.slice(0,8)}-${importHash.slice(8,12)}-5${importHash.slice(13,16)}-a${importHash.slice(17,20)}-${importHash.slice(20,32)}` : "";
  if (facebookImport && data.importCheckOnly === true) {
    const existing = await db.send(new GetItemCommand({ TableName: postsTable, Key: { postId: { S: importPostId } }, ConsistentRead: true }));
    return { statusCode: 200, headers, body: JSON.stringify({ exists: existing.Item?.userId?.S === userId && existing.Item?.importKey?.S === data.importKey, postId: importPostId }) };
  }
  const importedDate = facebookImport ? new Date(data.originalCreatedAt) : null;
  if (facebookImport && (!Number.isFinite(importedDate.getTime()) || importedDate.getTime() < 0 || importedDate.getTime() > Date.now() + 86400000)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid original post date." }) };

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.content !== "string" ||
    (!data.content.trim() && !sharedSource) ||
    data.content.length > 5000
  ) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({
        error: "Post must contain 1–5000 characters."
      })
    };
  }

  const location = data.location === undefined ? "" : typeof data.location === "string" ? data.location.trim() : null;
  if (location === null || location.length > 120) return {statusCode:400,headers,body:JSON.stringify({error:"Location must be at most 120 characters."})};
  const content = data.content.trim() || "Shared a post.";
  if (!sharedSource && data.originalContentCertified !== true) return { statusCode: 400, headers, body: JSON.stringify({ error: "Original-content certification is required." }) };
  const requestedGroupId = data.groupId === undefined ? "" : String(data.groupId || "");
  const requestedAudience = data.audience === undefined ? "public" : String(data.audience || "");
  if (!requestedGroupId && !["public", "friends", "private"].includes(requestedAudience)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid audience." }) };
  }
  const audience = requestedGroupId ? "group" : requestedAudience;
  const mediaKey = typeof data.mediaKey === "string" ? data.mediaKey : "";
  const mediaType = ["image", "video"].includes(data.mediaType) ? data.mediaType : "";
  const reel = mediaType === "video" && data.reel === true;
  if (sharedSource && (mediaKey || mediaType || reel)) return {statusCode:400,headers,body:JSON.stringify({error:"Shared posts reference the original media."})};
  const userEmail = await accountForSub(userId);
  if (!userEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  if (requestedGroupId) {
    if (facebookImport) return { statusCode: 400, headers, body: JSON.stringify({ error: "Import posts to your feed before sharing them to a Tribe." }) };
    const groupAccess = await requireGroupMember(requestedGroupId, userId);
    if (groupAccess.error) return { statusCode: groupAccess.statusCode, headers, body: JSON.stringify({ error: groupAccess.error }) };
  }
  const profileOwnerId = data.profileMemberId === undefined ? "" : String(data.profileMemberId || "");
  let profileOwnerEmail = "";
  let profilePermissionChecks = [];
  if (profileOwnerId) {
    if (requestedGroupId) return { statusCode: 400, headers, body: JSON.stringify({ error: "Choose either a Tribe or a member profile, not both." }) };
    if (!/^[a-f0-9-]{36}$/.test(profileOwnerId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid profile." }) };
    profileOwnerEmail = await accountForSub(profileOwnerId);
    if (!profileOwnerEmail) return { statusCode: 404, headers, body: JSON.stringify({ error: "Profile not found." }) };
    if (profileOwnerId !== userId) {
      if (facebookImport || sharedSource) return { statusCode: 400, headers, body: JSON.stringify({ error: "Create a new post when posting on another profile." }) };
      if (audience !== "public") return { statusCode: 400, headers, body: JSON.stringify({ error: "Posts on another profile must be Public." }) };
      const [setting, friendship] = await Promise.all([
        db.send(new GetItemCommand({ TableName: settingsTable, Key: { userEmail: { S: profileOwnerEmail } }, ConsistentRead: true, ProjectionExpression: "profilePostPermission" })),
        db.send(new GetItemCommand({ TableName: friendsTable, Key: { userEmail: { S: profileOwnerEmail }, friendEmail: { S: userEmail } }, ConsistentRead: true, ProjectionExpression: "#status", ExpressionAttributeNames: { "#status": "status" } }))
      ]);
      const permission = setting.Item?.profilePostPermission?.S || "owner";
      const allowed = permission === "anyone" || (permission === "friends" && friendship.Item?.status?.S === "friends");
      if (!allowed) return { statusCode: 403, headers, body: JSON.stringify({ error: permission === "friends" ? "Only accepted friends can post on this profile." : "Only this member can post on their profile." }) };
      profilePermissionChecks = [
        { ConditionCheck: { TableName: settingsTable, Key: { userEmail: { S: profileOwnerEmail } }, ConditionExpression: "profilePostPermission = :permission", ExpressionAttributeValues: { ":permission": { S: permission } } } },
        ...(permission === "friends" ? [{ ConditionCheck: { TableName: friendsTable, Key: { userEmail: { S: profileOwnerEmail }, friendEmail: { S: userEmail } }, ConditionExpression: "#status = :friends", ExpressionAttributeNames: { "#status": "status" }, ExpressionAttributeValues: { ":friends": { S: "friends" } } } }] : [])
      ];
    }
  }
  const ownerPrefix = sha256(userEmail).slice(0, 24);
  if ((mediaKey && (!/^users\/[a-f0-9]{24}\/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|mov)$/.test(mediaKey) || !mediaKey.startsWith(`users/${ownerPrefix}/`))) || Boolean(mediaKey) !== Boolean(mediaType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid media reference." }) };
  }
  const postId = facebookImport ? importPostId : randomUUID();
  const importedAt = new Date().toISOString();
  const createdAt = facebookImport ? importedDate.toISOString() : importedAt;

  const putPost = {
    TableName: postsTable,
    Item: {
      postId: { S: postId },
      userId: { S: userId },
      userEmail: { S: userEmail },
      ...(profileOwnerId ? { profileOwnerId: { S: profileOwnerId }, profileOwnerEmail: { S: profileOwnerEmail } } : {}),
      content: { S: content },
      ...(location ? {location:{S:location}} : {}),
      ...(sharedSource ? {sharedPostId:{S:sharedSource.postId.S}} : {}),
      ...(requestedGroupId ? { groupId: { S: requestedGroupId } } : {}),
      createdAt: { S: createdAt },
      audience: { S: audience },
      ...(facebookImport ? { importSource: { S: "facebook" }, importKey: { S: data.importKey }, importedAt: { S: importedAt } } : {}),
      ...(mediaKey ? { mediaKey: { S: mediaKey }, mediaType: { S: mediaType }, ...(reel ? { reel: { BOOL: true } } : {}) } : {})
    },
    ConditionExpression: "attribute_not_exists(postId)"
  };
  try {
    if (profilePermissionChecks.length) await db.send(new TransactWriteItemsCommand({ TransactItems: [...profilePermissionChecks, { Put: putPost }] }));
    else await db.send(new PutItemCommand(putPost));
  } catch (error) {
    if (profilePermissionChecks.length && ["TransactionCanceledException", "ConditionalCheckFailedException"].includes(error.name)) return { statusCode: 409, headers, body: JSON.stringify({ error: "Profile posting permission changed. Reload the profile and try again." }) };
    if (!facebookImport || error.name !== "ConditionalCheckFailedException") throw error;
    const existing = await db.send(new GetItemCommand({ TableName: postsTable, Key: { postId: { S: postId } }, ConsistentRead: true }));
    if (existing.Item?.userId?.S !== userId || existing.Item?.importKey?.S !== data.importKey) throw error;
    return { statusCode: 200, headers, body: JSON.stringify({ postId, deduplicated: true, createdAt: existing.Item.createdAt.S }) };
  }

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      postId,
      userId,
      userEmail,
      profileOwnerMemberId: profileOwnerId,
      content,
      audience,
      groupId: requestedGroupId,
      location,
      mediaKey,
      mediaType,
      reel,
      createdAt
    })
  };
}

// LOG OUT
async function deleteSecurePost(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin) && !/^Bearer\s+[a-f0-9]{64}$/i.test(event.headers?.authorization || event.headers?.Authorization || "")) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const postId = String(event.pathParameters?.postId || "");
  if (!/^[a-f0-9-]{36}$/.test(postId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid post." }) };
  const found = await db.send(new GetItemCommand({ TableName: postsTable, Key: { postId: { S: postId } }, ConsistentRead: true }));
  if (!found.Item) return { statusCode: 404, headers, body: JSON.stringify({ error: "Post not found." }) };
  const isAuthor = found.Item.userId?.S === userId;
  const isProfileOwner = found.Item.profileOwnerId?.S === userId;
  if (!isAuthor && !isProfileOwner) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the author or profile owner can remove this post." }) };
  if (isProfileOwner && !isAuthor) {
    await db.send(new UpdateItemCommand({
      TableName: postsTable,
      Key: { postId: { S: postId } },
      UpdateExpression: "REMOVE profileOwnerId, profileOwnerEmail",
      ConditionExpression: "profileOwnerId = :owner AND userId <> :owner",
      ExpressionAttributeValues: { ":owner": { S: userId } }
    }));
    return { statusCode: 200, headers, body: JSON.stringify({ deleted: false, removedFromProfile: true }) };
  }
  const request = parseJsonBody(event) || {};
  const mode = request.mode === "remove_here" ? "remove_here" : "delete_everywhere";
  const isShare = Boolean(found.Item.sharedPostId?.S);
  const shares = isShare ? [] : await scanAll({
    TableName: postsTable,
    FilterExpression: "sharedPostId = :source",
    ExpressionAttributeValues: { ":source": { S: postId } }
  }, Number.MAX_SAFE_INTEGER);
  if (mode === "remove_here" && !isShare && shares.length) {
    await db.send(new UpdateItemCommand({
      TableName: postsTable,
      Key: { postId: { S: postId } },
      UpdateExpression: "SET placementRemoved = :yes, placementRemovedAt = :at",
      ConditionExpression: "userId = :owner",
      ExpressionAttributeValues: { ":yes": { BOOL: true }, ":at": { S: new Date().toISOString() }, ":owner": { S: userId } }
    }));
    return { statusCode: 200, headers, body: JSON.stringify({ deleted: false, removedFromHere: true, sharesPreserved: shares.length }) };
  }
  const deletionRecords = mode === "delete_everywhere" && !isShare ? [...shares, found.Item] : [found.Item];
  let linkedStories = [];
  let mediaKey = "";
  if (found.Item.mediaKey?.S) {
    const ownerPrefix = sha256(found.Item.userEmail?.S || "").slice(0, 24);
    if (!found.Item.mediaKey.S.startsWith(`users/${ownerPrefix}/`)) return { statusCode: 409, headers, body: JSON.stringify({ error: "Post media ownership could not be verified." }) };
    mediaKey = found.Item.mediaKey.S;
    linkedStories = await scanAll({
      TableName: storiesTable,
      FilterExpression: "mediaKey = :media AND userEmail = :owner",
      ExpressionAttributeValues: { ":media": { S: found.Item.mediaKey.S }, ":owner": { S: found.Item.userEmail?.S || "" } },
      ProjectionExpression: "storyId"
    }, Number.MAX_SAFE_INTEGER);
  }
  if (mediaKey) {
    const mediaCleanupPending = await runCleanup([
      () => s3.send(new DeleteObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: mediaKey }))
    ]);
    if (mediaCleanupPending) {
      console.error("Post media deletion remains pending", { postId, mediaKey });
      return { statusCode: 503, headers, body: JSON.stringify({ error: "Post media could not be removed yet. Try again.", deleted: false }) };
    }
  }
  const notificationCleanupTasks = [];
  const cleanupTasks = [];
  const shareDeleteTasks = [];
  let sourceDeleteTask = null;
  for (const record of deletionRecords) {
    const recordId = record.postId.S;
    const [reactions, comments, views] = await Promise.all([
      queryAll({ TableName: reactionsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: recordId } }, ProjectionExpression: "postId, userId, commentId", ConsistentRead: true }, Number.MAX_SAFE_INTEGER),
      queryAll({ TableName: commentsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: recordId } }, ProjectionExpression: "postId, commentId, userEmail, parentCommentId", ConsistentRead: true }, Number.MAX_SAFE_INTEGER),
      process.env.POST_VIEWS_TABLE ? queryAll({ TableName: process.env.POST_VIEWS_TABLE, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: recordId } }, ProjectionExpression: "postId, viewerKey", ConsistentRead: true }, Number.MAX_SAFE_INTEGER) : Promise.resolve([])
    ]);
    const commentById = new Map(comments.map(item => [item.commentId?.S, item]));
    const notificationKeys = new Map();
    const rememberNotification = (userEmail, eventId) => {
      if (!userEmail || !eventId) return;
      notificationKeys.set(`${userEmail}\u0000${eventId}`, { userEmail: { S: userEmail }, eventId: { S: eventId } });
    };
    for (const reaction of reactions) if (!reaction.commentId?.S && record.userEmail?.S && reaction.userId?.S) {
      rememberNotification(record.userEmail.S, `reaction#${recordId}#${reaction.userId.S}`);
    }
    for (const comment of comments) {
      if (record.userEmail?.S && comment.commentId?.S) rememberNotification(record.userEmail.S, `comment#${comment.commentId.S}`);
      const parent = commentById.get(comment.parentCommentId?.S), parentEmail = parent?.userEmail?.S;
      if (parentEmail && parentEmail !== record.userEmail?.S && parentEmail !== comment.userEmail?.S && comment.commentId?.S) {
        rememberNotification(parentEmail, `reply#${comment.commentId.S}`);
      }
    }
    for (const tag of record.taggedUsers?.L || []) {
      const taggedEmail = tag.M?.userEmail?.S, taggedId = tag.M?.memberId?.S;
      if (taggedEmail && taggedId) rememberNotification(taggedEmail, `tag#${recordId}#${taggedId}`);
    }
    const deleteRecord = () => db.send(new DeleteItemCommand({ TableName: postsTable, Key: { postId: { S: recordId } } }));
    cleanupTasks.push(
      ...reactions.map(item => () => db.send(new DeleteItemCommand({ TableName: reactionsTable, Key: { postId: item.postId, userId: item.userId } }))),
      ...comments.map(item => () => db.send(new DeleteItemCommand({ TableName: commentsTable, Key: { postId: item.postId, commentId: item.commentId } }))),
      ...views.map(item => () => db.send(new DeleteItemCommand({ TableName: process.env.POST_VIEWS_TABLE, Key: { postId: item.postId, viewerKey: item.viewerKey } })))
    );
    notificationCleanupTasks.push(...[...notificationKeys.values()].map(key => () => db.send(new DeleteItemCommand({ TableName: engagementNotificationsTable, Key: key }))));
    if (!isShare && recordId === postId) sourceDeleteTask = deleteRecord;
    else shareDeleteTasks.push(deleteRecord);
  }
  cleanupTasks.push(...linkedStories.map(item => () => db.send(new DeleteItemCommand({ TableName: storiesTable, Key: { storyId: item.storyId } }))));
  const notificationCleanupPending = await runCleanup(notificationCleanupTasks);
  if (notificationCleanupPending) {
    console.error("Post notification deletion remains pending", { postId, notificationCleanupPending });
    return { statusCode: 503, headers, body: JSON.stringify({ error: "The post is still being removed. Try again.", deleted: false, cleanupPending: notificationCleanupPending }) };
  }
  const cleanupPending = await runCleanup(cleanupTasks);
  if (cleanupPending) {
    console.error("Post deletion cleanup remains pending", { postId, cleanupPending });
    return { statusCode: 503, headers, body: JSON.stringify({ error: "The post is still being removed. Try again.", deleted: false, cleanupPending }) };
  }
  const shareCleanupPending = await runCleanup(shareDeleteTasks);
  if (shareCleanupPending) {
    console.error("Post share deletion remains pending", { postId, shareCleanupPending });
    return { statusCode: 503, headers, body: JSON.stringify({ error: "The post is still being removed. Try again.", deleted: false, cleanupPending: shareCleanupPending }) };
  }
  const sourceCleanupPending = sourceDeleteTask ? await runCleanup([sourceDeleteTask]) : 0;
  if (sourceCleanupPending) {
    console.error("Post source deletion remains pending", { postId, sourceCleanupPending });
    return { statusCode: 503, headers, body: JSON.stringify({ error: "The post is still being removed. Try again.", deleted: false, cleanupPending: sourceCleanupPending }) };
  }
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: true, deletedEverywhere: mode === "delete_everywhere" && !isShare, removedShares: mode === "delete_everywhere" && !isShare ? shares.length : 0, cleanupPending: 0 }) };
}

async function resolveMediaTags(ids, ownerId, previous, declined) {
  if (!Array.isArray(ids) || ids.length > 10 || ids.some(id => typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))) return {error:"Choose at most 10 valid members.",statusCode:400};
  const unique = [...new Set(ids)]; if (unique.some(id => declined.has(id))) return {error:"A member removed their tag and cannot be tagged again on this post.",statusCode:409};
  const ownerEmail = await accountForSub(ownerId); if (!ownerEmail) return {error:"Account could not be verified.",statusCode:409};
  const targets = [];
  for (const id of unique) {
    const accounts = await cognito.send(new ListUsersCommand({UserPoolId:userPoolId,Filter:`sub = "${id}"`,Limit:1})), account = accounts.Users?.[0];
    const email = account?.Attributes?.find(value => value.Name === "email")?.Value?.trim().toLowerCase();
    if (!email || account.Enabled === false) return {error:"A selected member is unavailable.",statusCode:404};
    const settings = await db.send(new GetItemCommand({TableName:settingsTable,Key:{userEmail:{S:email}},ConsistentRead:true}));
    if (!previous.has(id) && id !== ownerId && settings.Item?.allowTags?.BOOL === false) return {error:"A selected friend has turned off tagging.",statusCode:409};
    const attributes = Object.fromEntries((account.Attributes || []).map(value => [value.Name,value.Value]));
    targets.push({id,email,name:settings.Item?.profileName?.S || attributes.name || attributes.preferred_username || "DanzStak member"});
  }
  if (new Set(targets.map(value=>value.email)).size !== targets.length) return {error:"Choose each person once.",statusCode:400};
  const newTargets = targets.filter(value => value.id !== ownerId && !previous.has(value.id));
  const friends = new Set((newTargets.length ? await batchGetFriendships(ownerEmail,newTargets.map(value => value.email)) : []).filter(item => item.status?.S === "friends").map(item => item.friendEmail.S));
  if (newTargets.some(value => !friends.has(value.email))) return {error:"You can tag accepted friends only.",statusCode:403};
  const checks = newTargets.flatMap(value => [
    {ConditionCheck:{TableName:settingsTable,Key:{userEmail:{S:value.email}},ConditionExpression:"attribute_not_exists(allowTags) OR allowTags = :allowed",ExpressionAttributeValues:{":allowed":{BOOL:true}}}},
    {ConditionCheck:{TableName:friendsTable,Key:{userEmail:{S:ownerEmail},friendEmail:{S:value.email}},ConditionExpression:"#status = :friends",ExpressionAttributeNames:{"#status":"status"},ExpressionAttributeValues:{":friends":{S:"friends"}}}}
  ]);
  return {checks,tags:targets.map(value => ({M:{memberId:{S:value.id},userEmail:{S:value.email},name:{S:String(value.name).slice(0,80)}}}))};
}

async function updateSecurePost(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin) && !/^Bearer\s+[a-f0-9]{64}$/i.test(event.headers?.authorization || event.headers?.Authorization || "")) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const postId = String(event.pathParameters?.postId || ""), data = parseJsonBody(event);
  if (!/^[a-f0-9-]{36}$/.test(postId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid post." }) };
  if (!data || typeof data !== "object" || Array.isArray(data)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON request." }) };
  const found = await db.send(new GetItemCommand({ TableName: postsTable, Key: { postId: { S: postId } }, ConsistentRead: true }));
  if (!found.Item) return { statusCode: 404, headers, body: JSON.stringify({ error: "Post not found." }) };
  if (data.removeOwnTag === true) {
    const tags = found.Item.taggedUsers?.L || [], remaining = tags.filter(tag => tag.M?.memberId?.S !== userId);
    if (remaining.length === tags.length) return {statusCode:200,headers,body:JSON.stringify({removed:true})};
    const version = Number(found.Item.tagVersion?.N || 0);
    try { await db.send(new UpdateItemCommand({TableName:postsTable,Key:{postId:{S:postId}},UpdateExpression:"SET taggedUsers = :tags, tagVersion = :next, updatedAt = :updated ADD tagDeclinedBy :declined",ConditionExpression:"attribute_exists(postId) AND (attribute_not_exists(tagVersion) OR tagVersion = :previous)",ExpressionAttributeValues:{":tags":{L:remaining},":next":{N:String(version+1)},":previous":{N:String(version)},":updated":{S:new Date().toISOString()},":declined":{SS:[userId]}}})); }
    catch (error) { if (error.name === "ConditionalCheckFailedException") return {statusCode:409,headers,body:JSON.stringify({error:"Tags changed. Reload and try again."})}; throw error; }
    const taggedEmail = tags.find(tag => tag.M?.memberId?.S === userId)?.M?.userEmail?.S;
    if (taggedEmail) await db.send(new DeleteItemCommand({TableName:engagementNotificationsTable,Key:{userEmail:{S:taggedEmail},eventId:{S:"tag#"+postId+"#"+userId}}})).catch(error => console.warn("Tag notice cleanup failed",error.name));
    return {statusCode:200,headers,body:JSON.stringify({removed:true})};
  }
  if (found.Item.userId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the owner can edit this post." }) };
  const updates = [], names = {}, values = { ":updated": { S: new Date().toISOString() } };
  let tagCondition = "", tagNotices = [], removedTags = [], tagChecks = [];
  if (Object.prototype.hasOwnProperty.call(data, "featured")) {
    if (typeof data.featured !== "boolean") return {statusCode:400,headers,body:JSON.stringify({error:"Featured must be true or false."})};
    updates.push("featured = :featured"); values[":featured"] = {BOOL:data.featured};
  }
  if (Object.prototype.hasOwnProperty.call(data,"taggedMembers")) {
    if (!["image","video"].includes(found.Item.mediaType?.S)) return {statusCode:400,headers,body:JSON.stringify({error:"Tag people on photos or videos only."})};
    const current = new Set((found.Item.taggedUsers?.L || []).map(tag => tag.M?.memberId?.S)), declined = new Set(found.Item.tagDeclinedBy?.SS || []);
    const resolved = await resolveMediaTags(data.taggedMembers,userId,current,declined); if (resolved.error) return {statusCode:resolved.statusCode,headers,body:JSON.stringify({error:resolved.error})};
    tagChecks = resolved.checks || [];
    tagNotices = resolved.tags.filter(tag => !current.has(tag.M.memberId.S) && tag.M.memberId.S !== userId);
    removedTags = (found.Item.taggedUsers?.L || []).filter(tag => !resolved.tags.some(next => next.M.memberId.S === tag.M.memberId.S));
    const version = Number(found.Item.tagVersion?.N || 0); updates.push("taggedUsers = :tags", "tagVersion = :nextTagVersion"); values[":tags"] = {L:resolved.tags}; values[":nextTagVersion"] = {N:String(version+1)}; values[":oldTagVersion"] = {N:String(version)};
    tagCondition = " AND (attribute_not_exists(tagVersion) OR tagVersion = :oldTagVersion)";
  }
  if (Object.prototype.hasOwnProperty.call(data,"location")) {
    if (typeof data.location !== "string" || data.location.trim().length > 120) return {statusCode:400,headers,body:JSON.stringify({error:"Location must be at most 120 characters."})};
    names["#location"] = "location"; values[":location"] = {S:data.location.trim()}; updates.push("#location = :location");
  }
  if (Object.prototype.hasOwnProperty.call(data, "content")) {
    const content = typeof data.content === "string" ? data.content.trim() : "";
    if (!content || content.length > 5000) return { statusCode: 400, headers, body: JSON.stringify({ error: "Post must contain 1–5000 characters." }) };
    updates.push("#content = :content"); names["#content"] = "content"; values[":content"] = { S: content };
    if (content !== found.Item.content?.S) {
      const editHistory = postEditHistory(found.Item);
      editHistory.push({ content: found.Item.content?.S || "", editedAt: values[":updated"].S });
      updates.push("editHistory = :editHistory");
      values[":editHistory"] = { S: JSON.stringify(editHistory.slice(-20)) };
    }
  }
  if (Object.prototype.hasOwnProperty.call(data, "audience")) {
    const audience = String(data.audience || "");
    if (!["public", "friends", "private"].includes(audience)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid audience." }) };
    updates.push("audience = :audience"); values[":audience"] = { S: audience };
  }
  if (Object.prototype.hasOwnProperty.call(data, "commentPolicy")) {
    const commentPolicy = String(data.commentPolicy || "");
    if (!["everyone", "friends", "off"].includes(commentPolicy)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid comment policy." }) };
    updates.push("commentPolicy = :commentPolicy"); values[":commentPolicy"] = { S: commentPolicy };
  }
  if (!updates.length) return { statusCode: 400, headers, body: JSON.stringify({ error: "No supported post changes were provided." }) };
  updates.push("updatedAt = :updated");
  const request = { TableName: postsTable, Key: { postId: { S: postId } }, UpdateExpression: `SET ${updates.join(", ")}`, ExpressionAttributeValues: values };
  if (Object.keys(names).length) request.ExpressionAttributeNames = names;
  values[":postOwner"] = {S:userId}; request.ConditionExpression = "attribute_exists(postId) AND userId = :postOwner" + tagCondition;
  try { if (tagChecks.length) await db.send(new TransactWriteItemsCommand({TransactItems:[...tagChecks,{Update:request}]})); else await db.send(new UpdateItemCommand(request)); } catch (error) { if (["ConditionalCheckFailedException","TransactionCanceledException"].includes(error.name)) return {statusCode:409,headers,body:JSON.stringify({error:"The post changed. Reload and try again."})}; throw error; }
  const tagNoticeTasks = removedTags.filter(tag=>tag.M.userEmail?.S).map(tag=>db.send(new DeleteItemCommand({TableName:engagementNotificationsTable,Key:{userEmail:tag.M.userEmail,eventId:{S:"tag#"+postId+"#"+tag.M.memberId.S}}})));
  if (found.Item.audience?.S !== "private") for (const tag of tagNotices) tagNoticeTasks.push(notifyPostOwner({...found.Item,userEmail:tag.M.userEmail},"tag#"+postId+"#"+tag.M.memberId.S,"tag",found.Item.userEmail?.S || "","Tagged in a photo or video"));
  if (tagNoticeTasks.length) await Promise.allSettled(tagNoticeTasks);
  return { statusCode: 200, headers, body: JSON.stringify({ updated: true, updatedAt: values[":updated"].S, editHistory: values[":editHistory"] ? JSON.parse(values[":editHistory"].S) : postEditHistory(found.Item) }) };
}

async function createSupportTicket(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const data = parseJsonBody(event);
  if (!data || typeof data !== "object" || Array.isArray(data)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON request." }) };
  const category = String(data.category || "").trim();
  const subject = String(data.subject || "").trim();
  const message = String(data.message || "").trim();
  const categories = new Set(["account", "safety", "copyright", "technical", "booking", "billing", "other"]);
  if (!categories.has(category)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Choose a valid support category." }) };
  if (subject.length < 3 || subject.length > 120) return { statusCode: 400, headers, body: JSON.stringify({ error: "Subject must contain 3–120 characters." }) };
  if (message.length < 20 || message.length > 5000) return { statusCode: 400, headers, body: JSON.stringify({ error: "Message must contain 20–5,000 characters." }) };
  const email = await accountForSub(userId);
  if (!email) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const createdAt = new Date().toISOString();
  const windowId = Math.floor(Date.now() / 600000);
  const ticketId = sha256(`support:${userId}:${windowId}`).slice(0, 24);
  try {
    await db.send(new PutItemCommand({
      TableName: supportTicketsTable,
      Item: {
        ticketId: { S: ticketId }, userId: { S: userId }, userEmail: { S: email },
        category: { S: category }, subject: { S: subject }, message: { S: message },
        createdAt: { S: createdAt }, status: { S: "new" }, emailStatus: { S: "pending" },
        expiresAt: { N: String(now() + 63072000) }
      },
      ConditionExpression: "attribute_not_exists(ticketId)"
    }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return { statusCode: 429, headers: { ...headers, "retry-after": "600" }, body: JSON.stringify({ error: "A support request was already submitted recently. Please wait up to 10 minutes before sending another." }) };
    throw error;
  }
  let emailed = false;
  try {
    await ses.send(new SendEmailCommand({
      FromEmailAddress: "DanzStak Support <support@danzstak.com>",
      Destination: { ToAddresses: ["support@danzstak.com"] },
      ReplyToAddresses: [email],
      Content: { Simple: {
        Subject: { Data: `[${category.toUpperCase()}] ${subject}`, Charset: "UTF-8" },
        Body: { Text: { Data: `Ticket: ${ticketId}\nMember: ${email}\nCreated: ${createdAt}\nCategory: ${category}\n\n${message}`, Charset: "UTF-8" } }
      } }
    }));
    emailed = true;
  } catch (error) {
    console.error("Support email notification failed:", error.name);
  }
  await db.send(new UpdateItemCommand({
    TableName: supportTicketsTable,
    Key: { ticketId: { S: ticketId } },
    UpdateExpression: "SET emailStatus = :status",
    ExpressionAttributeValues: { ":status": { S: emailed ? "sent" : "queued" } }
  }));
  return { statusCode: 201, headers, body: JSON.stringify({ ticketId, status: "received", emailed }) };
}

function publicPlace(place) {
  const websites = (place.Contacts?.Websites || []).map(item => String(item.Value || "")).filter(value => /^https:\/\//i.test(value)).slice(0, 2);
  const emails = (place.Contacts?.Emails || []).map(item => String(item.Value || "").trim().toLowerCase()).filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)).slice(0, 2);
  const phones = (place.Contacts?.Phones || []).map(item => String(item.Value || "").trim()).filter(value => /^\+?[0-9 ()-]{7,24}$/.test(value)).slice(0, 2);
  const categories = [...new Set((place.Categories || []).flatMap(item => [item.LocalizedName, item.Name, item.Id].filter(Boolean).map(String)))].slice(0, 24);
  const name = String(place.Title || "Venue").slice(0, 160);
  const address = String(place.Address?.Label || "").slice(0, 300);
  const discoveredAt = new Date(now() * 1000).toISOString();
  return {
    venueKey: createHash("sha256").update(`${name.toLowerCase()}|${address.toLowerCase()}`).digest("hex").slice(0, 20),
    name,
    address,
    locality: String(place.Address?.Locality || place.Address?.District || "").slice(0, 120),
    position: Array.isArray(place.Position) ? place.Position.slice(0, 2) : [],
    distanceMiles: Number.isFinite(place.Distance) ? Math.round(place.Distance / 160.934) / 10 : null,
    websites,
    emails,
    phones,
    categories,
    contactVerificationRequired: true,
    sourceName: "AWS Places public listing",
    sourceUrl: websites[0] || "",
    sources: [{ name: "AWS Places public listing", url: websites[0] || "" }],
    discoveredAt,
    activityEvidence: websites.length
      ? "Current public place data includes this venue website. Check its live calendar and booking instructions before pitching."
      : emails.length || phones.length
        ? "Current public place data includes a direct contact. Confirm that it handles live-show booking before pitching."
        : "No usable public contact was returned. This listing is not eligible for a DanzStak booking lead."
  };
}

function isBookableClub(place, genre = "") {
  // Provider category IDs, OSM tags and local descriptions establish existence;
  // neither the act's genre nor the presence of a contact establishes it.
  const evidence = `${(place.categories || []).join(" ")} ${place.programmingEvidence || ""}`.toLowerCase();
  if (place.businessStatus === "CLOSED_PERMANENTLY") return false;
  if (/night_club|live_music_venue|performing_arts_theater|concert_hall|poppodium|muziekpodium|concertzaal|discoteca|sala concerti|salle de concert|sala de conciertos|casa de shows|ライブハウス|コンサート会場|공연장|现场音乐|演出场地|قاعة حفلات|संगीत/.test(evidence)) return true;
  if (/\b(live music|live_music|concert venue|music venue)\b/.test(evidence) && /\b(event space|community cent(?:er|re)|museum|gallery|church|theat(?:er|re)|auditorium|cocktail)\b/.test(evidence)) return true;
  const description = `${place.name} ${(place.categories || []).join(" ")} ${place.programmingEvidence || ""}`.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const selectedGenre = genre.toLowerCase();
  const classicalSearch = selectedGenre.includes("orchestra") || selectedGenre.includes("classical");
  const wrongScale = /\b(stadium|arena|auditorium|amphitheat(?:er|re)|pavilion|pavillon|kurpavillon|stadthalle|konzertmuschel|band shell|performing arts cent(?:er|re)|sports complex|convention cent(?:er|re)|exhibition cent(?:er|re)|raceway|speedway)\b/;
  const nonClassicalInstitution = /\b(symphony|orchestra|opera house|chamber music|kammermusik\w*|philharmoni(?:c|e))\b/;
  const wrongFormat = /\b(comedy|comic|laughs?|punch\s*l.?ne|piano bar|cocktail bar|cocktail lounge|salsa|ballroom|table\s*dance|strip club|adult entertainment|escort|dance school|dance class|kindermusik|music school|music academy|music lesson|music teacher|music instructor|music with|rehearsal|practice room|studio|choir|chorus|chorale|workshop|clinic|training(?: and development)?|promoter|promotion|productions?|entertainment company|entertainment and recreation|business services?|geschaftliche dienstleistungen|event consultant|entertainment consultant|event planner|event services?|event cent(?:er|re)|event space|mobile dj|dj services?|dj['’]?s? and event services?|party band|consumer services|photography|swimming pool|veterans? (?:memorial )?hall|fraternal order|performance hall|church|worship|jubilee|gospel\w*|christmas market|weihnachtsmarkt|variete|museum|gallery|library|retail|specialty store|music store|record store|instrument store|downtown association|business district|community cent(?:er|re)|recreation cent(?:er|re)|hotel|lodging|restaurant only|tourist attraction|park|passport|visa service|consular|government|office|real estate|realtor|property management|mortgage|insurance|financial services?|law firm|attorney|accountant|medical|dental|auto repair|car dealer)\b/;
  const eventNotRoom = /\b(concerts? in the|concert series|music festival|festival|festspiele|festival office|jazzfest|walking tour|history tour|guided tour|tourist information|tourismus|ostseebad)\b/;
  const strongVenue = /\b(live music|live entertainment[- /]?music|livemusik|live musik|musica dal vivo|musique live|musica en vivo|music venue|rock club|punk club|metal club|night ?club|concert venue|concert hall)\b/.test(description);
  const electronicOnly = /\b(dj|electronic|techno|house|night ?club)\b/.test(description) && !/\b(live music|live entertainment[- ]?music|rock|punk|metal|hardcore|diy)\b/.test(description);
  const genreEvidence = selectedGenre.includes("punk")
    ? /\b(punk|hardcore|diy)\b/.test(description) || (strongVenue && !electronicOnly)
    : selectedGenre.includes("metal")
      ? /\b(metal|hardcore)\b/.test(description) || (strongVenue && !electronicOnly)
      : selectedGenre === "rock"
        ? /\b(rock|punk|metal)\b/.test(description) || (strongVenue && !electronicOnly)
        : selectedGenre.includes("dj") || selectedGenre.includes("electronic")
          ? /\b(dj|electronic|techno|house|night ?club)\b/.test(description)
          : selectedGenre.includes("hip-hop")
            ? /\b(hip[- ]?hop|rap)\b/.test(description)
            : selectedGenre.includes("jazz")
              ? /\bjazz\b/.test(description)
              : classicalSearch
                ? /\b(classical|orchestra|symphony|chamber|opera|concert hall|recital)\b/.test(description)
                : true;
  const plausibleRoom = /\b(club|bar|pub|tavern|lounge|music hall|social hall|taproom|brewery|roadhouse)\b/.test(description);
  const musicSignal = /\b(music|musik|musica|musique|concert|live|rock|punk|metal|electronic|dj|hip[- ]?hop|jazz)\b/.test(description);
  const classicalRoom = classicalSearch && /\b(symphony|orchestra|opera house|concert hall|recital hall|chamber music)\b/.test(description);
  // Discovery and suitability are intentionally separate. A mixed-programming
  // room must remain visible even when its public category does not name the
  // requested genre. Genre evidence affects ranking, not existence.
  return !wrongScale.test(description) && (classicalSearch || !nonClassicalInstitution.test(description)) && !wrongFormat.test(description) && !eventNotRoom.test(description) && (strongVenue || classicalRoom || (plausibleRoom && musicSignal));
}

function venueDiscoveryAssessment(place, genre = "", venueType = "any") {
  const relevant = place.verifiedRoom === true || isBookableClub(place, genre);
  const typeMatch = isVenueTypeMatch(place, venueType);
  const hasContact = hasBookingContact(place);
  const description = `${place.name} ${(place.categories || []).join(" ")}`.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const requested = String(genre || "").toLowerCase();
  const families = requested.includes("tekno")
    ? ["tekno", "free party", "soundsystem", "hardtek", "tribe"]
    : requested.includes("hardcore") && !requested.includes("punk")
      ? ["gabber", "hardstyle", "hardcore electronic", "hardcore techno"]
    : requested.includes("techno") || requested.includes("electronic") || requested.includes("dj")
      ? ["techno", "electronic", "dj", "club", "house", "hardcore electronic"]
      : requested.includes("hardcore") && requested.includes("punk")
        ? ["hardcore punk", "punk", "diy", "all ages"]
        : requested.split(/[^\p{L}\p{N}]+/u).filter(word => word.length > 2);
  const genreMatch = !families.length || families.some(word => description.includes(word));
  const suitability = !relevant ? "not-a-venue" : hasContact && typeMatch && genreMatch ? "contact-found" : "needs-research";
  const reasons = [];
  if (!genreMatch) reasons.push("The public listing does not prove programming for this act yet.");
  if (!typeMatch) reasons.push("The public venue type does not clearly match the selected room preference.");
  if (!hasContact) reasons.push("No public booking contact was returned; check the official site or calendar.");
  return { relevant, typeMatch, genreMatch, hasContact, suitability, reasons };
}

function venueSuitability(place, genre = "") {
  const description = `${place.name} ${(place.categories || []).join(" ")}`.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  let score = 0;
  // A human-reviewed room with an official booking page is more useful to a
  // touring act than a famous venue returned by a broad map keyword search.
  if (place.verifiedRoom) score += 40;
  if (/\b(live music|livemusik|live musik|musica dal vivo|musique live|musica en vivo|music venue|rock club|punk club|metal club|concert venue)\b/.test(description)) score += 12;
  if (/\b(club|bar|pub|tavern|lounge|music hall|taproom|brewery|roadhouse)\b/.test(description)) score += 5;
  if (/\b(independent|diy|all ages|punk|metal|rock)\b/.test(description)) score += 4;
  const genreWords = genre.toLowerCase().split(/[^a-z0-9]+/).filter(word => word.length > 2 && !["electronic", "classical", "other"].includes(word));
  if (genreWords.some(word => description.includes(word))) score += 5;
  if (place.emails?.length) score += 3;
  if (place.websites?.length) score += 2;
  if (place.phones?.length) score += 1;
  return score;
}

function isVenueTypeMatch(place, venueType = "any") {
  if (venueType === "any") return true;
  const description = `${place.name} ${(place.categories || []).join(" ")}`.toLowerCase();
  if (venueType === "diy") return /\b(diy|all ages|all-ages|community music|independent)\b/.test(description);
  if (venueType === "bar") return /\b(bar|pub|tavern|taproom|brewery|roadhouse)\b/.test(description);
  if (venueType === "club") return /\b(club|night ?club|lounge)\b/.test(description);
  if (venueType === "hall") return /\b(music hall|concert hall|concert venue|recital hall)\b/.test(description);
  // Unknown localized categories remain research leads instead of disappearing.
  return !/\b(stadium|arena|sports complex|government office|real estate|medical|school)\b/.test(description);
}

function isRecordStore(place) {
  const name = String(place.name || "").toLowerCase();
  const description = `${name} ${(place.categories || []).join(" ")}`.toLowerCase();
  const strongNameSignal = /\b(records?|record shop|record store|vinyl|turntable|music millennium|music millenium)\b/.test(name);
  const recordCategorySignal = /\brecord,? cd (?:&|and) video\b/.test(description) || (place.categories || []).includes("record,_cd_and_video");
  const descriptiveSignal = /\b(record store|record shop|vinyl records?|vinyl shop|used records?|new records?|dischi|vinili|plattenladen|schallplatten|disquaire|tienda de discos|platenzaak|platenzaken|platenwinkel)\b|レコード|唱片|레코드/.test(description)
    || (place.sourceName === osmAttribution && (place.categories || []).includes("music"));
  // A broad place-category match alone is not evidence that a shop sells records.
  // It regularly includes audio installers, video production, instrument shops,
  // bookstores and unrelated retailers. Prefer a shorter list with explicit
  // record/vinyl evidence in the public name over wasting an artist's outreach.
  const clearlyWrongName = /\b(dental|dentist|medical|county records?|public records?|records? office|real estate|realtor|video transfer|video production|audio visual|audio|best buy|dvd|airport video|grocery|instrument|guitar|piano|music school|music lessons?|recording studio|books?|press|productions?|music company|music center)\b/.test(name);
  return !clearlyWrongName
    && (descriptiveSignal || strongNameSignal || recordCategorySignal);
}

const osmAttribution = "© OpenStreetMap contributors";
const defaultOsmOverpassEndpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];
const configuredOsmOverpassEndpoints = String(globalThis.process?.env?.OSM_OVERPASS_ENDPOINTS || globalThis.process?.env?.OSM_OVERPASS_ENDPOINT || "")
  .split(",")
  .map(value => value.trim())
  .filter(value => /^https:\/\/[^\s]+$/i.test(value));
const osmOverpassEndpoints = configuredOsmOverpassEndpoints.length ? configuredOsmOverpassEndpoints : defaultOsmOverpassEndpoints;
const discoveryCache = new Map();
const osmFailureBackoffMs = 5 * 60 * 1000;
let osmBackoffUntil = 0;

function cacheDiscovery(key, loader, ttlMs = 15 * 60 * 1000) {
  const hit = discoveryCache.get(key);
  if (hit?.expiresAt > Date.now()) return Promise.resolve(hit.value);
  return loader().then(value => {
    discoveryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
    if (discoveryCache.size > 100) discoveryCache.delete(discoveryCache.keys().next().value);
    return value;
  });
}

function osmElementUrl(element) {
  const type = element.type === "node" ? "node" : element.type === "way" ? "way" : "relation";
  return `https://www.openstreetmap.org/${type}/${element.id}`;
}

function osmPosition(element) {
  const lat = Number(element.lat ?? element.center?.lat), lon = Number(element.lon ?? element.center?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lon, lat] : [];
}

function osmPlace(element) {
  const tags = element.tags || {}, position = osmPosition(element), name = String(tags.name || tags.brand || "").trim();
  if (!name || position.length !== 2) return null;
  const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:city"] || tags["addr:town"] || tags["addr:village"], tags["addr:postcode"], tags["addr:country"]].filter(Boolean).join(" ");
  const websites = [tags.website, tags["contact:website"], tags.url].filter(value => /^https:\/\//i.test(String(value || ""))).slice(0, 2);
  const emails = [tags.email, tags["contact:email"]].filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""))).slice(0, 2);
  const phones = [tags.phone, tags["contact:phone"]].filter(Boolean).map(String).slice(0, 2);
  const categories = [tags.amenity, tags.shop, tags.club, tags.leisure, tags.music, tags["music:genre"], tags.genre, tags.live_music === "yes" ? "live music" : "", tags.description]
    .filter(Boolean)
    .map(value => String(value).replace(/_/g, " "))
    .slice(0, 10);
  const sourceUrl = osmElementUrl(element);
  return {
    venueKey: `osm-${element.type}-${element.id}`,
    name: name.slice(0, 160), address: address.slice(0, 300),
    locality: String(tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || "").slice(0, 120),
    position, websites, emails, phones, categories,
    contactVerificationRequired: true, sourceName: osmAttribution, sourceUrl,
    sources: [{ name: osmAttribution, url: sourceUrl }], discoveredAt: new Date().toISOString(),
    activityEvidence: tags.opening_hours
      ? `OpenStreetMap lists opening hours (${String(tags.opening_hours).slice(0, 160)}). Confirm the current calendar and booking contact before pitching.`
      : "A current OpenStreetMap business listing was returned. Confirm the current calendar and booking contact before pitching."
  };
}

async function overpassPlaces(point, kind, radiusMiles = 30) {
  if (osmBackoffUntil > Date.now()) {
    throw Object.assign(new Error("OpenStreetMap is cooling down after a provider failure."), { provider: "OpenStreetMap", retryAfter: osmBackoffUntil });
  }
  const radius = Math.max(1000, Math.min(100000, Math.round(radiusMiles * 1609.344)));
  const [lon, lat] = point.position;
  const selectors = kind === "record-store"
    ? [
        `["shop"="music"]`, `["shop"="video"]`,
        `["name"~"record|records|vinyl|dischi|vinili|platten|schallplatten|disquaire|discos|レコード",i]`
      ]
    : [
        `["amenity"="music_venue"]`, `["amenity"="nightclub"]`, `["club"="music"]`,
        `["live_music"="yes"]`, `["music"~"live|rock|punk|metal|electronic|techno|house|jazz",i]`,
        `["name"~"music club|live music|rock club|punk club|jazz club|concert hall",i]`
      ];
  const query = `[out:json][timeout:18];(${selectors.map(selector => `nwr(around:${radius},${lat},${lon})${selector};`).join("")});out center tags 300;`;
  // Overpass is a community service and individual public instances can be
  // busy or unavailable. Race a small, operator-configurable mirror set under
  // one latency budget; abort the losers as soon as a valid response arrives.
  // This keeps a slow mirror from delaying an otherwise healthy AWS result.
  const controllers = osmOverpassEndpoints.map(() => new AbortController());
  const timeout = setTimeout(() => controllers.forEach(controller => controller.abort()), 7000);
  try {
    const data = await Promise.any(osmOverpassEndpoints.map(async (endpoint, index) => {
      try {
        const response = await fetch(endpoint, {
          method: "POST", signal: controllers[index].signal,
          headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8", "user-agent": "DanzStak/1.0 (support@danzstak.com)" },
          body: new URLSearchParams({ data: query })
        });
        if (!response.ok) throw new Error(`OpenStreetMap mirror returned ${response.status}`);
        const value = await response.json();
        if (!Array.isArray(value.elements)) throw new Error("OpenStreetMap mirror returned invalid data");
        return value;
      } catch (error) {
        console.warn("OpenStreetMap mirror unavailable", { endpoint: new URL(endpoint).host, name: error.name });
        throw error;
      }
    }));
    osmBackoffUntil = 0;
    controllers.forEach(controller => controller.abort());
    return data.elements.map(osmPlace).filter(Boolean).map(place => ({
      ...place,
      distanceMiles: Math.round(approximateMilesBetween(point.position, place.position) * 10) / 10
    }));
  } catch (error) {
    osmBackoffUntil = Date.now() + osmFailureBackoffMs;
    throw Object.assign(error, { provider: "OpenStreetMap" });
  } finally {
    clearTimeout(timeout);
    controllers.forEach(controller => controller.abort());
  }
}

function discoveryBoundingBox(position, radiusMiles) {
  const [longitude, latitude] = position;
  const latitudeDelta = radiusMiles / 69;
  const longitudeDelta = radiusMiles / (69 * Math.max(0.2, Math.cos(latitude * Math.PI / 180)));
  return [longitude - longitudeDelta, latitude - latitudeDelta, longitude + longitudeDelta, latitude + latitudeDelta];
}

async function awsPlaceSearch(point, queries, radiusMiles = 30) {
  const boundingBox = discoveryBoundingBox(point.position, radiusMiles);
  const batches = await mapLimit(queries, 2, async query => {
    const result = await geoPlaces.send(new SearchTextCommand({ QueryText: query, Filter: { BoundingBox: boundingBox }, MaxResults: 50, AdditionalFeatures: ["Contact"] }));
    return (result.ResultItems || []).map(publicPlace).map(place => ({ ...place, discoveryQuery: query }));
  });
  return batches.flat();
}

const regionalVenueTerms = {
  IT: ["locale musica dal vivo", "club musicale", "sala concerti", "discoteca techno"],
  NL: ["poppodium", "muziekpodium", "live muziek", "concertzaal", "nachtclub"],
  DE: ["live musik club", "musikclub", "konzerthaus", "veranstaltungsort"],
  FR: ["salle de concert", "club de musique", "musique live", "discotheque"],
  ES: ["sala de conciertos", "club de musica", "musica en vivo"],
  PT: ["sala de concertos", "clube de musica", "musica ao vivo"],
  PL: ["klub muzyczny", "sala koncertowa", "muzyka na zywo"],
  CZ: ["hudebni klub", "koncertni sal", "ziva hudba"],
  JP: ["ライブハウス", "音楽クラブ", "コンサート会場"],
  KR: ["라이브 클럽", "공연장", "음악 공연장"],
  CN: ["现场音乐", "音乐俱乐部", "演出场地"],
  BR: ["casa de shows", "clube de musica", "musica ao vivo"],
  SE: ["musikklubb", "konsertlokal", "livemusik"],
  NO: ["musikklubb", "konsertsted", "levende musikk"],
  DK: ["musikklub", "koncertsted", "livemusik"],
  FI: ["musiikkiklubi", "konserttipaikka", "elava musiikki"],
  HU: ["zenei klub", "koncerthelyszin", "elo zene"],
  RO: ["club de muzica", "sala de concerte", "muzica live"],
  GR: ["μουσική σκηνή", "χώρος συναυλιών", "ζωντανή μουσική"],
  TR: ["muzik kulubu", "konser mekani", "canli muzik"],
  RU: ["музыкальный клуб", "концертная площадка", "живая музыка"],
  UA: ["музичний клуб", "концертний майданчик", "жива музика"],
  IN: ["live music venue", "music club", "concert hall"],
  ZA: ["live music venue", "music club", "music festival venue"],
  MX: ["foro de musica", "sala de conciertos", "musica en vivo"],
  AR: ["club de musica", "sala de conciertos", "musica en vivo"],
  CL: ["club de musica", "sala de conciertos", "musica en vivo"]
};

function venueDiscoveryQueries(point, genre = "") {
  const selected = String(genre || "").trim();
  const localTerms = regionalVenueTerms[String(point.countryCode || "").toUpperCase()] || [];
  const sceneTerms = selected.toLowerCase().includes("tekno")
    ? ["tekno soundsystem venue", "free party electronic club", "hardtek club"]
    : selected.toLowerCase().includes("hardcore") && selected.toLowerCase().includes("punk")
      ? ["hardcore punk venue", "DIY punk club", "all ages music venue"]
      : selected ? [`${selected} live venue`, `${selected} music club`] : [];
  return [...new Set([
    ...localTerms, ...sceneTerms, "live music venue", "music club", "independent music venue",
    "concert venue", "live music bar", "nightclub live music"
  ])].slice(0, 16);
}

function googlePlace(place, point, query) {
  const position = place.location && Number.isFinite(place.location.longitude) && Number.isFinite(place.location.latitude)
    ? [place.location.longitude, place.location.latitude] : [];
  const website = /^https:\/\//i.test(String(place.websiteUri || "")) ? place.websiteUri : "";
  const phone = String(place.internationalPhoneNumber || place.nationalPhoneNumber || "").trim();
  const categories = [place.primaryTypeDisplayName?.text, place.primaryType, ...(place.types || [])].filter(Boolean).map(value => String(value).replace(/_/g, " ")).slice(0, 10);
  const name = String(place.displayName?.text || "Venue").slice(0, 160);
  const address = String(place.formattedAddress || place.shortFormattedAddress || "").slice(0, 300);
  return {
    venueKey: `google-${String(place.id || createHash("sha256").update(`${name}|${address}`).digest("hex").slice(0, 20))}`,
    name, address, locality: String(place.addressComponents?.find(component => (component.types || []).includes("locality"))?.longText || "").slice(0, 120),
    position, distanceMiles: position.length === 2 ? Math.round(approximateMilesBetween(point.position, position) * 10) / 10 : null,
    websites: website ? [website] : [], emails: [], phones: phone ? [phone] : [], categories,
    businessStatus: String(place.businessStatus || ""), contactVerificationRequired: true,
    sourceName: "Google Places", sourceUrl: place.googleMapsUri || website,
    sources: [{ name: "Google Places", url: place.googleMapsUri || website }], discoveryQuery: query,
    discoveredAt: new Date().toISOString(),
    activityEvidence: place.businessStatus === "CLOSED_PERMANENTLY"
      ? "Google Places reports this location permanently closed."
      : "Google Places returned a current public business listing. Check the official calendar and booking instructions before pitching."
  };
}

async function googlePlacesSearch(point, queries, radiusMiles = 30) {
  const apiKey = String(globalThis.process?.env?.GOOGLE_PLACES_API_KEY || "").trim();
  if (!apiKey) return { skipped: true, places: [] };
  const places = [];
  const radius = Math.min(50000, Math.max(1000, Math.round(radiusMiles * 1609.344)));
  await mapLimit(queries.slice(0, 5), 2, async query => {
    let pageToken = "";
    for (let page = 0; page < 2; page += 1) {
      const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 7000);
      try {
        const body = { textQuery: `${query} ${point.label}`, pageSize: 20, languageCode: point.languageCode || "en", locationBias: { circle: { center: { latitude: point.position[1], longitude: point.position[0] }, radius } } };
        if (pageToken) body.pageToken = pageToken;
        const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
          method: "POST", signal: controller.signal,
          headers: {
            "content-type": "application/json", "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.shortFormattedAddress,places.addressComponents,places.location,places.primaryType,places.primaryTypeDisplayName,places.types,places.websiteUri,places.googleMapsUri,places.nationalPhoneNumber,places.internationalPhoneNumber,places.businessStatus,nextPageToken"
          }, body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`Google Places returned ${response.status}`);
        const data = await response.json();
        places.push(...(data.places || []).map(place => googlePlace(place, point, query)).filter(place => place.position.length === 2));
        pageToken = String(data.nextPageToken || "");
        if (!pageToken) break;
      } finally { clearTimeout(timeout); }
    }
  });
  return { skipped: false, places };
}

async function webVenueResearch(point, genre = "") {
  const apiKey = String(globalThis.process?.env?.BRAVE_SEARCH_API_KEY || "").trim();
  if (!apiKey) return { skipped: true, leads: [] };
  const queryTerms = venueDiscoveryQueries(point, genre).slice(0, 2);
  const leads = [];
  await mapLimit(queryTerms, 2, async term => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const search = new URLSearchParams({ q: `${term} ${point.label} official events calendar booking`, count: "10", search_lang: point.languageCode || "en", safesearch: "moderate" });
      if (/^[A-Z]{2}$/.test(point.countryCode || "")) search.set("country", point.countryCode);
      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${search}`, {
        signal: controller.signal, headers: { accept: "application/json", "X-Subscription-Token": apiKey }
      });
      if (!response.ok) throw new Error(`Brave Search returned ${response.status}`);
      const data = await response.json();
      for (const result of data.web?.results || []) {
        const url = String(result.url || "");
        const title = String(result.title || "").replace(/\s+[|–—-]\s+.*$/, "").trim().slice(0, 160);
        const description = String(result.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
        if (!title || !/^https:\/\//i.test(url)) continue;
        leads.push({ title, url, description, query: term, sourceName: "Brave Search web result", needsResearch: true });
      }
    } finally { clearTimeout(timeout); }
  });
  return { skipped: false, leads: leads.filter((lead, index, all) => all.findIndex(candidate => candidate.url === lead.url) === index).slice(0, 20) };
}

async function multiSourceDiscovery(point, kind, { genre = "", radiusMiles = 30 } = {}) {
  const awsQueries = kind === "record-store"
    ? ["record store", "vinyl record shop", "independent record store", "used records vinyl", "new and used record shop", "music store vinyl records"]
    : venueDiscoveryQueries(point, genre);
  const cacheKey = `${kind}|${point.position.map(value => value.toFixed(3)).join(",")}|${genre.toLowerCase()}|${radiusMiles}`;
  return cacheDiscovery(cacheKey, async () => {
    const googleResult = kind === "venue" ? googlePlacesSearch(point, awsQueries, radiusMiles) : Promise.resolve({ skipped: true, places: [] });
    const webResult = kind === "venue" ? webVenueResearch(point, genre) : Promise.resolve({ skipped: true, leads: [] });
    const attempts = await Promise.allSettled([
      awsPlaceSearch(point, awsQueries, radiusMiles),
      overpassPlaces(point, kind, radiusMiles),
      googleResult,
      webResult
    ]);
    const names = ["AWS Places", "OpenStreetMap", "Google Places", "Brave Search"];
    const providers = names.map((name, index) => {
      const value = attempts[index].status === "fulfilled" ? attempts[index].value : null;
      const skipped = Boolean(value?.skipped);
      const list = Array.isArray(value) ? value : value?.places || value?.leads || [];
      return { name, ok: attempts[index].status === "fulfilled" && !skipped, skipped, count: list.length, error: attempts[index].status === "rejected" ? "Provider temporarily unavailable" : skipped ? "Not configured" : "" };
    });
    const successful = attempts.filter(result => result.status === "fulfilled" && !result.value?.skipped);
    if (!successful.length) throw Object.assign(new Error("All discovery providers are temporarily unavailable."), { providerStatuses: providers });
    const placeResults = attempts.slice(0, 3).filter(result => result.status === "fulfilled" && !result.value?.skipped);
    const researchLeads = attempts[3].status === "fulfilled" ? attempts[3].value.leads || [] : [];
    return { places: deduplicateVenues(placeResults.flatMap(result => Array.isArray(result.value) ? result.value : result.value.places || [])), researchLeads, providers };
  });
}

async function recordStoreCandidates(point, maximumMiles = 45) {
  const discovery = await multiSourceDiscovery(point, "record-store", { radiusMiles: maximumMiles });
  const stores = discovery.places
    .filter(isRecordStore)
    .filter(place => approximateMilesBetween(point.position, place.position) <= maximumMiles)
    .sort((left, right) => approximateMilesBetween(point.position, left.position) - approximateMilesBetween(point.position, right.position))
    .map(place => ({
      ...place,
      activityEvidence: place.activityEvidence || "A current public record-store listing was returned. Check the store website before visiting."
    }));
  return { stores, providers: discovery.providers };
}

async function searchRecordStores(event) {
  const headers = corsHeaders(event.headers?.origin);
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const data = parseJsonBody(event);
  const location = String(data?.location || "").trim().slice(0, 120);
  if (location.length < 2) return reply(400, { error: "Enter a city or region." });
  try {
    const point = await geocodeTourPlace(location);
    const page = Math.max(0, Math.min(20, Math.trunc(Number(data?.page) || 0)));
    const radiusMiles = Math.max(5, Math.min(60, Number(data?.radiusMiles) || 30));
    const discovery = await recordStoreCandidates(point, radiusMiles);
    const offset = page * 20, stores = discovery.stores.slice(offset, offset + 20);
    return reply(200, { location: point, stores, providers: discovery.providers, page, hasMore: discovery.stores.length > offset + stores.length, canExpand: radiusMiles < 60, radiusMiles });
  } catch (error) {
    if (error.statusCode === 422) return reply(422, { error: "That location could not be found." });
    console.error("Record store search failed", { name: error.name });
    return reply(502, { error: "Record store search is temporarily unavailable.", providers: error.providerStatuses || [] });
  }
}

const recordStoreWorkspaceId = "record-store-workspace-v1";
async function recordStoreWorkspace(event, method) {
  const headers = corsHeaders(event.headers?.origin);
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const Key = { userId: { S: userId }, tourId: { S: recordStoreWorkspaceId } };
  if (method === "GET") {
    const result = await db.send(new GetItemCommand({ TableName: toursTable, Key, ConsistentRead: true }));
    return reply(200, result.Item ? { ...JSON.parse(result.Item.plan.S), revision: result.Item.revision?.S || "" } : { release: {}, stores: [], revision: "" });
  }
  const data = parseJsonBody(event);
  if (!data || !Array.isArray(data.stores) || data.stores.length > 100 || typeof data.revision !== "string") return reply(400, { error: "Provide up to 100 stores and the loaded revision." });
  const text = (value, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const https = value => /^https:\/\//i.test(text(value, 600)) ? text(value, 600) : "";
  const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value, 254)) ? text(value, 254).toLowerCase() : "";
  const list = (value, clean) => Array.isArray(value) ? value.slice(0, 8).map(clean).filter(Boolean) : [];
  const stages = new Set(["Research", "Ready to pitch", "Contacted", "Follow up", "Interested", "Stocking", "Passed"]);
  const stores = data.stores.map(store => {
    if (!store || typeof store !== "object" || !text(store.name, 160)) return null;
    const sources = Array.isArray(store.sources) ? store.sources.slice(0, 6).map(source => source && typeof source === "object" ? { name: text(source.name, 120), url: https(source.url) } : null).filter(source => source?.name) : [];
    return { name: text(store.name, 160), address: text(store.address), locality: text(store.locality, 160), websites: list(store.websites, https), emails: list(store.emails, email), phones: list(store.phones, item => text(item, 40)), sources, activityEvidence: text(store.activityEvidence, 1000), stage: stages.has(store.stage) ? store.stage : "Research", followUp: /^\d{4}-\d{2}-\d{2}$/.test(text(store.followUp, 10)) ? text(store.followUp, 10) : "", notes: text(store.notes, 2000), outreachDraft: text(store.outreachDraft, 5000) };
  });
  if (stores.some(store => !store)) return reply(400, { error: "Each store needs a name." });
  const release = data.release && typeof data.release === "object" ? data.release : {};
  const cleanedRelease = { artist: text(release.artist, 120), title: text(release.title, 160), format: text(release.format, 80), genre: text(release.genre, 120), releaseDate: /^\d{4}-\d{2}-\d{2}$/.test(text(release.releaseDate, 10)) ? text(release.releaseDate, 10) : "", wholesale: text(release.wholesale, 80), suggestedRetail: text(release.suggestedRetail, 80), terms: text(release.terms, 1000), epk: https(release.epk), listen: https(release.listen), contactName: text(release.contactName, 120), contactEmail: email(release.contactEmail) };
  const plan = JSON.stringify({ release: cleanedRelease, stores });
  if (Buffer.byteLength(plan, "utf8") > 250000) return reply(400, { error: "Placement workspace is too large." });
  const revision = randomUUID();
  try {
    await db.send(new PutItemCommand({ TableName: toursTable, Item: { ...Key, name: { S: "Record placement workspace" }, plan: { S: plan }, revision: { S: revision }, updatedAt: { S: new Date().toISOString() } }, ConditionExpression: data.revision ? "revision = :revision" : "attribute_not_exists(userId)", ...(data.revision ? { ExpressionAttributeValues: { ":revision": { S: data.revision } } } : {}) }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return reply(409, { error: "Another device saved changes. Reload before saving again." });
    throw error;
  }
  return reply(200, { revision });
}

function hasBookingContact(place) {
  return Boolean(place.websites?.length || place.emails?.length || place.phones?.length);
}

function isSupportedBookingLead(place, genre = "") {
  // A plausible name is not a booking lead. Every result shown to an artist
  // must have positive live-room evidence and a usable public contact path.
  // Results that fail either check are omitted instead of being placed on a
  // tour calendar with invented or incomplete information.
  // Reviewed directory entries already passed a human venue/genre check. Do
  // not let broad place-search rejection words (for example "ballroom" in a
  // real venue name or "jazz" in a room that also books punk) discard that
  // stronger evidence. Unreviewed discovery results still use the strict
  // classifier above.
  return venueDiscoveryAssessment(place, genre).relevant && place.businessStatus !== "CLOSED_PERMANENTLY";
}

function normalizedVenueText(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/^the\s+/, "").replace(/\b(inc|llc|ltd|club|venue|bar)\b/g, " ").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function deduplicateVenues(places) {
  const unique = new Map();
  for (const place of places) {
    const streetNumber = String(place.address || "").match(/\b\d+[a-z]?\b/i)?.[0]?.toLowerCase() || "";
    const identity = `${normalizedVenueText(place.name)}|${streetNumber}|${normalizedVenueText(place.locality)}`;
    const key = identity === "||" ? place.venueKey : identity;
    const current = unique.get(key);
    if (!current) { unique.set(key, place); continue; }
    const merge = field => [...new Set([...(current[field] || []), ...(place[field] || [])])];
    current.websites = merge("websites").slice(0, 2);
    current.emails = merge("emails").slice(0, 2);
    current.phones = merge("phones").slice(0, 2);
    current.categories = merge("categories").slice(0, 8);
    const sources = [...(current.sources || [{ name: current.sourceName, url: current.sourceUrl }]), ...(place.sources || [{ name: place.sourceName, url: place.sourceUrl }])]
      .filter(source => source?.name)
      .filter((source, index, all) => all.findIndex(candidate => candidate.name === source.name && candidate.url === source.url) === index)
      .slice(0, 6);
    current.sources = sources;
    if (!current.sourceUrl && place.sourceUrl) current.sourceUrl = place.sourceUrl;
    if (!current.activityEvidence && place.activityEvidence) current.activityEvidence = place.activityEvidence;
  }
  return [...unique.values()];
}

let reviewedVenueCache = { expiresAt: 0, records: [] };
let reviewedVenueLoad = null;

async function reviewedVenueDirectoryRecords() {
  if (reviewedVenueCache.expiresAt > Date.now()) return reviewedVenueCache.records;
  if (reviewedVenueLoad) return reviewedVenueLoad;
  reviewedVenueLoad = scanAll({
    TableName: venueDirectoryTable,
    FilterExpression: "#status = :approved",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":approved": { S: "approved" } },
    Limit: 500
  }, 500).then(records => {
    reviewedVenueCache = { records, expiresAt: Date.now() + 300000 };
    return records;
  }).finally(() => { reviewedVenueLoad = null; });
  return reviewedVenueLoad;
}

function approximateMilesBetween(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== 2 || right.length !== 2) return Number.POSITIVE_INFINITY;
  if (![...left, ...right].every(Number.isFinite)) return Number.POSITIVE_INFINITY;
  const radians = Math.PI / 180;
  const a = Math.sin((right[1] - left[1]) * radians / 2) ** 2
    + Math.cos(left[1] * radians) * Math.cos(right[1] * radians)
    * Math.sin((right[0] - left[0]) * radians / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
}

async function approvedMemberVenueLeads(point, searchBounds = null) {
  try {
    const records = await reviewedVenueDirectoryRecords();
    return records.map(item => {
      const position = [Number(item.longitude?.N), Number(item.latitude?.N)];
      const websites = item.website?.S ? [item.website.S] : [];
      const emails = item.email?.S ? [item.email.S] : [];
      const phones = item.phone?.S ? [item.phone.S] : [];
      return {
        venueKey: item.venueKey?.S || "", name: item.name?.S || "Public venue", address: item.address?.S || "",
        locality: item.locality?.S || "", position, websites, emails, phones,
        categories: (item.categories?.SS || ["Member-verified public live music venue"]).slice(0, 8),
        distanceMiles: Math.round(approximateMilesBetween(point.position, position) * 10) / 10,
        contactVerificationRequired: true, sourceName: "DanzStak reviewed venue directory",
        sourceUrl: websites[0] || "", sources: [{ name: "DanzStak reviewed venue directory", url: websites[0] || "" }],
        discoveredAt: item.approvedAt?.S || item.createdAt?.S || "",
        activityEvidence: "A moderator reviewed this member-supplied public venue lead. Confirm its current calendar before pitching."
      };
    }).filter(place => place.venueKey && place.position.every(Number.isFinite))
      .filter(place => !searchBounds || (place.position[1] <= searchBounds.north && place.position[1] >= searchBounds.south && place.position[0] <= searchBounds.east && place.position[0] >= searchBounds.west));
  } catch (error) {
    console.error("Reviewed venue directory unavailable:", error.name);
    return [];
  }
}

function distanceToSearchPathMiles(position, path) {
  if (!Array.isArray(position) || position.length !== 2 || !Array.isArray(path) || path.length < 2) return Number.POSITIVE_INFINITY;
  const longitudeScale = Math.max(0.2, Math.cos(Number(position[1]) * Math.PI / 180));
  const point = [Number(position[0]) * 69 * longitudeScale, Number(position[1]) * 69];
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < path.length; index += 1) {
    const start = [path[index - 1][0] * 69 * longitudeScale, path[index - 1][1] * 69];
    const end = [path[index][0] * 69 * longitudeScale, path[index][1] * 69];
    const dx = end[0] - start[0], dy = end[1] - start[1], lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared)) : 0;
    nearest = Math.min(nearest, Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy)));
  }
  return nearest;
}

const tourDirections = new Set(["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest"]);
const tourActTypes = new Set(["band", "dj", "solo", "duo", "electronic", "ensemble"]);
const tourGenres = new Set(["DIY Punk", "Metal", "Rock", "DJ / Electronic", "Hip-Hop", "Jazz", "Orchestra / Classical", "Other"]);

function directionalBias(origin, direction, distanceMiles) {
  const bearings = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
  const radians = bearings[direction] * Math.PI / 180;
  const latitude = origin[1] + Math.cos(radians) * distanceMiles / 69;
  const longitudeScale = Math.max(0.2, Math.cos(origin[1] * Math.PI / 180));
  const longitude = origin[0] + Math.sin(radians) * distanceMiles / (69 * longitudeScale);
  return [Math.max(-179.9, Math.min(179.9, longitude)), Math.max(-84, Math.min(84, latitude))];
}

async function suggestDirectionalMarkets(home, direction, days, genre = "") {
  const outboundNights = Math.max(1, Math.min(5, Math.floor((days - 1) / 2)));
  const stepMiles = days <= 3 ? 70 : days <= 7 ? 100 : 125;
  const markets = [];
  for (let index = 1; index <= outboundNights; index += 1) {
    const bias = directionalBias(home.position, direction, stepMiles * index);
    const queries = [...new Set([genre ? `${genre} music club` : "DIY punk metal rock music club", "live music club", "live music venue"])];
    let places = [];
    for (const query of queries) {
      const result = await geoPlaces.send(new SearchTextCommand({ QueryText: query, Filter: { Circle: { Center: bias, Radius: 60000 } }, MaxResults: 10, AdditionalFeatures: ["Contact"] }));
      places = (result.ResultItems || []).map(publicPlace).filter(place => place.position.length === 2 && isBookableClub(place, genre));
      if (places.length) break;
    }
    const lead = places.sort((left, right) => (left.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (right.distanceMiles ?? Number.MAX_SAFE_INTEGER))[0];
    if (!lead) continue;
    const label = lead.locality || lead.address || lead.name;
    if (!markets.some(market => market.label.toLowerCase() === label.toLowerCase())) markets.push({ label, position: lead.position, lead });
  }
  if (!markets.length) throw Object.assign(new Error("No practical music markets were found in that direction. Try a nearby city or another direction."), { statusCode: 422 });
  return markets;
}

async function geocodeTourPlace(query, { requireDisambiguation = false } = {}) {
  const aliases = new Map([
    ["la", "Los Angeles, California, United States"],
    ["l.a.", "Los Angeles, California, United States"],
    ["sf", "San Francisco, California, United States"],
    ["nyc", "New York City, New York, United States"]
  ]);
  const normalizedQuery = aliases.get(String(query || "").trim().toLowerCase()) || query;
  const result = await geoPlaces.send(new GeocodeCommand({ QueryText: normalizedQuery, MaxResults: 5 }));
  const candidates = (result.ResultItems || []).filter(item => Array.isArray(item.Position) && item.Position.length === 2);
  const place = candidates.find(item => item.Address?.Locality || item.PlaceType === "Locality") || candidates[0];
  if (!place || !Array.isArray(place.Position) || place.Position.length !== 2) throw Object.assign(new Error("Tour location not found"), { statusCode: 422 });
  const countryCode = String(place.Address?.Country?.Code2 || place.Address?.Country?.Code || "").toUpperCase();
  const languageByCountry = { IT: "it", NL: "nl", DE: "de", AT: "de", CH: "de", FR: "fr", BE: "nl", ES: "es", PT: "pt", PL: "pl", CZ: "cs", JP: "ja", KR: "ko", CN: "zh", TW: "zh", BR: "pt" };
  const alternatives = candidates.slice(1, 5).map(item => ({
    label: String(item.Title || item.Address?.Label || "").slice(0, 160),
    position: item.Position.slice(0, 2),
    countryCode: String(item.Address?.Country?.Code2 || item.Address?.Country?.Code || "").toUpperCase()
  })).filter(item => item.label && approximateMilesBetween(place.Position, item.position) > 10);
  const resolved = {
    label: String(place.Title || place.Address?.Label || query).slice(0, 160), position: place.Position.slice(0, 2),
    locality: String(place.Address?.Locality || place.Address?.District || "").slice(0, 120), countryCode,
    languageCode: languageByCountry[countryCode] || "en", alternatives
  };
  if (requireDisambiguation && alternatives.length && !/[,،，]/u.test(String(query || ""))) {
    throw Object.assign(new Error("Several places match that name. Add the region or country and search again."), {
      statusCode: 409, locationChoices: [{ label: resolved.label, position: resolved.position, countryCode }, ...alternatives]
    });
  }
  return resolved;
}

async function reverseGeocodeTourMarket(position) {
  try {
    const result = await geoPlaces.send(new ReverseGeocodeCommand({
      QueryPosition: position,
      MaxResults: 1,
      Filter: { IncludePlaceTypes: ["Locality"] }
    }));
    const place = result.ResultItems?.[0];
    if (!place) return null;
    // A reverse-geocode result title can be a nearby business (for example a
    // real-estate office). A tour market must come from an address locality,
    // never from the result title.
    const locality = place.Address?.Locality || place.Address?.District || place.Address?.SubRegion?.Name || "";
    const region = place.Address?.Region?.Code || place.Address?.Region?.Name || "";
    const country = place.Address?.Country?.Name || "";
    const label = [locality, region, country].filter(Boolean).join(", ");
    if (!locality || /\b(real estate|realtor|property|office|hotel|restaurant|store)\b/i.test(locality)) return null;
    return label ? { label: label.slice(0, 160), position: position.slice(0, 2) } : null;
  } catch (error) {
    console.error("Route market reverse geocode unavailable:", error.name);
    return null;
  }
}

async function discoverRouteMarkets(route, allRoutePoints, requestedDays, requestedShows = 1) {
  const explicitMarkets = allRoutePoints.slice(1, -1);
  const legs = (route?.Routes?.[0]?.Legs || []).map(leg => leg.Geometry?.LineString || []).filter(line => line.length >= 3);
  const line = legs.flat();
  const desired = Math.max(4, Math.min(10, Math.max(Math.ceil(Math.max(1, requestedDays) / 3), Math.ceil(Math.max(1, requestedShows) / 2))));
  const sampleDescriptors = line.length >= 3
    ? Array.from({ length: desired }, (_, index) => {
        const pointIndex = Math.round(((index + 1) * (line.length - 1)) / (desired + 1));
        return { position: line[pointIndex].slice(0, 2) };
      })
    : allRoutePoints.slice(0, -1).flatMap((start, index) => {
        const end = allRoutePoints[index + 1];
        return [{
          position: [(start.position[0] + end.position[0]) / 2, (start.position[1] + end.position[1]) / 2],
          fallbackLabel: ""
        }];
      }).slice(0, desired);
  const sampled = (await Promise.all(sampleDescriptors.map(item => reverseGeocodeTourMarket(item.position))))
    .filter(Boolean);
  const nearestLineIndex = position => line.reduce((best, point, index) => {
    const distance = approximateMilesBetween(position, point);
    return distance < best.distance ? { index, distance } : best;
  }, { index: 0, distance: Number.POSITIVE_INFINITY }).index;
  const combined = [...sampled, ...explicitMarkets]
    .sort((left, right) => nearestLineIndex(left.position) - nearestLineIndex(right.position));
  const unique = [];
  for (const market of combined) {
    const locality = market.label.split(",")[0].trim().toLowerCase();
    if (!locality) continue;
    if (unique.some(item => item.label.split(",")[0].trim().toLowerCase() === locality)) {
      continue;
    }
    unique.push(market);
  }
  return unique.slice(0, 8);
}

function westCoastTourCorridor(points) {
  const labels = points.map(point => point.label.toLowerCase()).join(" | ");
  if (!labels.includes("san francisco") || !labels.includes("seattle")) return null;
  if (!labels.includes("los angeles")) {
    const i5Markets = [
      "Seattle, Washington", "Tacoma, Washington", "Olympia, Washington",
      "Centralia, Washington", "Kelso, Washington", "Longview, Washington", "Vancouver, Washington",
      "Portland, Oregon", "Salem, Oregon", "Albany, Oregon", "Corvallis, Oregon", "Eugene, Oregon",
      "Cottage Grove, Oregon", "Roseburg, Oregon", "Grants Pass, Oregon", "Medford, Oregon", "Ashland, Oregon",
      "Yreka, California", "Weed, California", "Mount Shasta, California",
      "Dunsmuir, California", "Redding, California", "Anderson, California", "Red Bluff, California",
      "Chico, California", "Sacramento, California", "San Francisco, California"
    ];
    return points[0].label.toLowerCase().includes("seattle") ? i5Markets : [...i5Markets].reverse();
  }
  return [
    "San Francisco, California", "San Jose, California", "Santa Cruz, California",
    "San Luis Obispo, California", "Los Angeles, California", "Bakersfield, California",
    "Fresno, California", "Sacramento, California", "Redding, California",
    "Medford, Oregon", "Eugene, Oregon", "Portland, Oregon",
    "Olympia, Washington", "Tacoma, Washington", "Seattle, Washington"
  ];
}

const reviewedCorridorCoordinates = new Map([
  ["seattle, washington", [-122.3321, 47.6062]],
  ["tacoma, washington", [-122.4443, 47.2529]],
  ["olympia, washington", [-122.9007, 47.0379]],
  ["portland, oregon", [-122.6765, 45.5231]],
  ["eugene, oregon", [-123.0868, 44.0521]],
  ["medford, oregon", [-122.8756, 42.3265]],
  ["redding, california", [-122.3917, 40.5865]],
  ["sacramento, california", [-121.4944, 38.5816]],
  ["san francisco, california", [-122.4194, 37.7749]],
]);

function reviewedCorridorPoint(market) {
  const label = String(market || "").trim(), position = reviewedCorridorCoordinates.get(label.toLowerCase());
  return position ? { label, position: [...position] } : null;
}

function sampleTourCorridorMarkets(corridor, requestedDays = 1, requestedShows = 1, variation = 0) {
  if (!Array.isArray(corridor) || !corridor.length) return [];
  // Do not fan one request out into hundreds of live place lookups. That made
  // AWS throttle the middle of a tour and left the user with only endpoints.
  // Search the strongest road markets plus a rotating sample of smaller towns;
  // the complete named corridor remains in route.itineraryMarkets.
  const limit = Math.min(corridor.length, Math.max(8, Math.min(12, requestedShows + 2, Math.ceil(requestedDays / 2) + 5)));
  if (corridor.length <= limit) return [...corridor];

  const anchorPattern = /^(seattle|tacoma|portland|eugene|medford|redding|sacramento|san francisco),/i;
  const selectedIndexes = new Set([0, corridor.length - 1]);
  corridor.forEach((market, index) => {
    if (selectedIndexes.size < limit && anchorPattern.test(String(market))) selectedIndexes.add(index);
  });
  const optional = corridor.map((_, index) => index).filter(index => !selectedIndexes.has(index));
  const offset = optional.length ? Math.max(0, Math.trunc(variation)) % optional.length : 0;
  const rotated = [...optional.slice(offset), ...optional.slice(0, offset)];
  const remaining = limit - selectedIndexes.size;
  for (let slot = 0; slot < remaining && rotated.length; slot += 1) {
    selectedIndexes.add(rotated[Math.round(slot * (rotated.length - 1) / Math.max(1, remaining - 1))]);
  }
  return [...selectedIndexes]
    .sort((left, right) => left - right)
    .slice(0, limit)
    .map(index => corridor[index]);
}

async function addManualBookingVenue(event) {
  const headers = corsHeaders(event.headers?.origin);
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const data = parseJsonBody(event);
  if (!data || typeof data !== "object" || Array.isArray(data)) return reply(400, { error: "Invalid venue details." });
  const clean = (value, maximum) => String(value || "").trim().slice(0, maximum);
  const name = clean(data.name, 160), address = clean(data.address, 300);
  const genre = clean(data.genre, 80), venueType = clean(data.venueType, 20).toLowerCase();
  const submitForReview = data.submitForReview === true;
  const publicVenueCertified = data.publicVenueCertified === true;
  let website = clean(data.website, 600), email = clean(data.email, 254).toLowerCase(), phone = clean(data.phone, 30);
  if (!name || !address) return reply(400, { error: "Add the club name and public street address." });
  if (!tourGenres.has(genre) || !new Set(["live", "diy", "bar", "club", "hall"]).has(venueType)) return reply(400, { error: "Choose the club's music style and room type." });
  if (website) {
    try { const url = new URL(website); website = url.protocol === "https:" ? url.href : ""; } catch { website = ""; }
    if (!website) return reply(400, { error: "The club website must be a complete HTTPS link." });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "Add a valid public booking email or leave it blank." });
  if (phone && !/^\+?[0-9 ()-]{7,24}$/.test(phone)) return reply(400, { error: "Add a valid public phone number or leave it blank." });
  if (!website && !email && !phone) return reply(400, { error: "Add at least one public website, booking email, or phone number." });
  if (submitForReview && !publicVenueCertified) return reply(400, { error: "Confirm that this is a public business venue before submitting it for directory review." });
  const result = await geoPlaces.send(new GeocodeCommand({ QueryText: address, MaxResults: 3 }));
  const match = (result.ResultItems || []).find(place => Array.isArray(place.Position) && place.Position.length === 2);
  if (!match) return reply(422, { error: "That public address could not be placed on the map. Check it and try again." });
  const position = match.Position.slice(0, 2), locality = clean(match.Address?.Locality || match.Address?.District, 120);
  const discoveredAt = new Date(now() * 1000).toISOString();
  const venueKey = createHash("sha256").update(`${name.toLowerCase()}|${address.toLowerCase()}|${position.join(",")}`).digest("hex").slice(0, 20);
  if (submitForReview) {
    const ticketId = `venue-${venueKey}-${sha256(userId).slice(0, 8)}`;
    try {
      await db.send(new PutItemCommand({
        TableName: supportTicketsTable,
        Item: {
          ticketId: { S: ticketId }, userId: { S: userId },
          category: { S: "venue-directory" }, subject: { S: `Review public venue: ${name}` },
          message: { S: JSON.stringify({ venueKey, name, address, locality, position, website, email, phone, genre, venueType, categories: ["Live Music Venue", genre, venueType] }) },
          createdAt: { S: discoveredAt }, status: { S: "pending-review" },
          publicVenueCertified: { BOOL: true }, expiresAt: { N: String(now() + 31536000) }
        },
        ConditionExpression: "attribute_not_exists(ticketId)"
      }));
    } catch (error) {
      if (error.name !== "ConditionalCheckFailedException") throw error;
    }
  }
  return reply(200, { reviewSubmitted: submitForReview, venue: {
    venueKey, name, address, locality, position,
    distanceMiles: null,
    websites: website ? [website] : [], emails: email ? [email] : [], phones: phone ? [phone] : [],
    categories: ["Member-added public live music venue", genre, venueType],
    contactVerificationRequired: true,
    sourceName: "Member-added public booking lead",
    sourceUrl: website,
    sources: [{ name: "Member-added public booking lead", url: website }],
    discoveredAt,
    activityEvidence: "A DanzStak member supplied this public club contact. Verify the official website, current calendar, and buyer before outreach."
  } });
}

const verifiedSanFranciscoRooms = [
  { name: "The Knockout", address: "3223 Mission St, San Francisco, CA 94110", position: [-122.4198, 37.7456], websites: ["https://theknockoutsf.com/events-2-1"], emails: ["knockoutsfbooking@gmail.com"], phones: [], categories: ["Live Music Venue", "Punk", "Rock", "Metal"] },
  { name: "Kilowatt", address: "3160 16th St, San Francisco, CA 94103", position: [-122.4235, 37.7643], websites: ["https://kilowattbar.com/"], emails: ["kilowatt@kilowattbar.com"], phones: ["415-861-2595"], categories: ["Live Music Venue", "Punk", "Rock"] },
  { name: "Bottom of the Hill", address: "1233 17th St, San Francisco, CA 94107", position: [-122.3951, 37.7651], websites: ["https://www.bottomofthehill.com/bookingAB.html"], emails: ["booking@bottomofthehill.com"], phones: [], categories: ["Live Music Venue", "Punk", "Rock", "Metal"] },
  { name: "Hotel Utah Saloon", address: "500 4th St, San Francisco, CA 94107", position: [-122.3976, 37.7795], websites: ["https://hotelutah.com/utah-booking-request/"], emails: [], phones: ["415-546-6300"], categories: ["Live Music Venue", "Punk", "Rock", "Hardcore"] },
  { name: "Brick & Mortar Music Hall", address: "1710 Mission St, San Francisco, CA 94103", position: [-122.4198, 37.7693], websites: ["https://www.brickandmortarmusic.com/contact/"], emails: ["booking@brickandmortarmusic.org"], phones: [], categories: ["Music Venue", "Rock", "Metal", "Hip-Hop"] },
  { name: "Neck of the Woods", address: "406 Clement St, San Francisco, CA 94118", position: [-122.4631, 37.7830], websites: ["https://www.neckofthewoodssf.com/faq/page/4/"], emails: ["booking@neckofthewoodssf.com"], phones: [], categories: ["Live Music Venue", "Punk", "Rock", "Metal", "Hip-Hop"] },
  { name: "Thee Parkside", address: "1600 17th St, San Francisco, CA 94107", position: [-122.4014, 37.7652], websites: ["https://www.theeparkside.com/"], emails: [], phones: ["415-252-1330"], categories: ["Live Music Venue", "Punk", "Rock"] },
  { name: "Rickshaw Stop", address: "155 Fell St, San Francisco, CA 94102", position: [-122.4200, 37.7756], websites: ["https://rickshawstop.com/contact/"], emails: ["info@rickshawstop.com"], phones: ["415-861-2011"], categories: ["Music Venue", "Rock", "Electronic"] },
  { name: "The Chapel", address: "777 Valencia St, San Francisco, CA 94110", position: [-122.4212, 37.7605], websites: ["https://thechapelsf.com/contact/"], emails: ["booking@thechapelsf.com"], phones: ["415-551-5157"], categories: ["Music Venue", "Rock"] },
  { name: "Lucky Horseshoe", address: "453 Cortland Ave, San Francisco, CA 94110", position: [-122.4160, 37.7390], websites: ["https://www.theluckyhorseshoebar.com/band-info"], emails: [], phones: [], categories: ["Live Music Venue", "Rock"] },
  { name: "Music City San Francisco", address: "1355 Bush St, San Francisco, CA 94109", position: [-122.4196, 37.7886], websites: ["https://musiccitysf.com/mcsf-venue/"], emails: ["info@musiccitysf.org"], phones: ["415-816-6207"], categories: ["DIY Music Venue", "Punk", "Rock", "Hip-Hop"] },
  { name: "Tupelo", address: "1337 Grant Ave, San Francisco, CA 94133", position: [-122.4071, 37.7994], websites: ["https://tupelosf.com/"], emails: ["tupelosf@gmail.com"], phones: ["415-981-9177"], categories: ["Live Music Venue", "Rock"] },
  { name: "Public Works", address: "161 Erie St, San Francisco, CA 94103", position: [-122.4192, 37.7682], websites: ["https://publicsf.com/booking/"], emails: [], phones: [], categories: ["Nightclub", "DJ", "Electronic"] },
  { name: "Monarch", address: "101 6th St, San Francisco, CA 94103", position: [-122.4091, 37.7804], websites: ["https://www.monarchsf.com/contact-us"], emails: ["info@monarchsf.com"], phones: [], categories: ["Nightclub", "DJ", "Electronic"] },
  { name: "1015 Folsom", address: "1015 Folsom St, San Francisco, CA 94103", position: [-122.4059, 37.7781], websites: ["https://1015.com/venue-rental/"], emails: ["josh@1015.com"], phones: [], categories: ["Nightclub", "DJ", "Electronic", "House", "Techno"] },
  { name: "The Midway", address: "900 Marin St, San Francisco, CA 94124", position: [-122.3866, 37.7491], websites: ["https://themidwaysf.com/connect/contact/"], emails: ["brendan@themidwaysf.com"], phones: ["831-239-2435"], categories: ["Music Venue", "DJ", "Electronic"] },
  { name: "Audio SF", address: "316 11th St, San Francisco, CA 94103", position: [-122.4137, 37.7717], websites: ["https://www.audiosf.com/contact/"], emails: ["info@audiosf.com"], phones: [], categories: ["Nightclub", "DJ", "Electronic", "House", "Techno"] },
  { name: "The Great Northern", address: "119 Utah St, San Francisco, CA 94103", position: [-122.4066, 37.7669], websites: ["https://www.thegreatnorthernsf.com/contact-us"], emails: [], phones: [], categories: ["Nightclub", "DJ", "Electronic"] },
  { name: "Halcyon", address: "314 11th St, San Francisco, CA 94103", position: [-122.4137, 37.7718], websites: ["https://halcyon-sf.com/main/contact/"], emails: [], phones: [], categories: ["Nightclub", "DJ", "Electronic", "House", "Techno"] },
  { name: "DNA Lounge", address: "375 11th St, San Francisco, CA 94103", position: [-122.4129, 37.7710], websites: ["https://www.dnalounge.com/contact/"], emails: [], phones: ["415-626-1409"], categories: ["Live Music Venue", "Nightclub", "Punk", "Rock", "Metal", "DJ", "Electronic"] },
  { name: "Bimbo's 365 Club", address: "1025 Columbus Ave, San Francisco, CA 94133", position: [-122.4130, 37.8037], websites: ["https://bimbos365club.com/contact/"], emails: ["info@bimbos365club.com"], phones: ["415-474-0365"], categories: ["Live Music Venue", "Rock"] },
  { name: "Great American Music Hall", address: "859 O'Farrell St, San Francisco, CA 94109", position: [-122.4187, 37.7850], websites: ["https://gamh.com/contact/"], emails: ["info@gamh.com"], phones: ["415-885-0750"], categories: ["Live Music Venue", "Rock", "Punk", "Metal"] },
  { name: "Savoy Tivoli", address: "1434 Grant Ave, San Francisco, CA 94133", position: [-122.4071, 37.8000], websites: ["https://www.savoytivoli.com/"], emails: ["thesavoytivoli@gmail.com"], phones: ["415-970-6901"], categories: ["Live Music Venue", "Bar", "Rock", "DJ", "Electronic"] },
  { name: "August Hall", address: "420 Mason St, San Francisco, CA 94102", position: [-122.4091, 37.7877], websites: ["https://www.augusthallsf.com/contact/"], emails: ["booking@augusthallsf.com"], phones: ["415-872-5745"], categories: ["Live Music Venue", "Rock", "Punk", "Metal", "Hip-Hop", "Electronic"] },
  { name: "Boom Boom Room", address: "1601 Fillmore St, San Francisco, CA 94115", position: [-122.4327, 37.7847], websites: ["https://boomboomroomsf.com/"], emails: [], phones: ["415-673-8000"], categories: ["Live Music Venue", "Rock", "Funk", "Blues"] },
  { name: "Make-Out Room", address: "3225 22nd St, San Francisco, CA 94110", position: [-122.4197, 37.7553], websites: ["https://www.makeoutroom.com/"], emails: [], phones: ["415-647-2888"], categories: ["Live Music Venue", "Rock", "Punk", "DJ", "Electronic", "Jazz"] }
];

const verifiedPortlandRooms = [
  { name: "Hawthorne Theatre", address: "1507 SE 39th Ave, Portland, OR 97214", position: [-122.6223, 45.5119], websites: ["https://hawthornetheatre.com/booking/"], emails: [], phones: [], categories: ["Live Music Venue", "Punk", "Rock", "Metal", "Hip-Hop"] },
  { name: "Kelly's Olympian", address: "426 SW Washington St, Portland, OR 97204", position: [-122.6748, 45.5202], websites: ["https://kellysolympian.com/"], emails: ["bookings@kellysolympian.com"], phones: ["503-228-3669"], categories: ["Live Music Venue", "Punk", "Rock", "Metal"] },
  { name: "Turn! Turn! Turn!", address: "8 NE Killingsworth St, Portland, OR 97211", position: [-122.6666, 45.5628], websites: ["https://turnturnturnpdx.com/booking/"], emails: ["turnturnturnpdx.booking@gmail.com"], phones: [], categories: ["DIY Music Venue", "Punk", "Rock"] },
  { name: "The Goodfoot", address: "2845 SE Stark St, Portland, OR 97214", position: [-122.6358, 45.5191], websites: ["https://thegoodfoot.com/contact/"], emails: ["neil@thegoodfoot.com"], phones: ["503-239-9292"], categories: ["Live Music Venue", "Rock", "DJ", "Electronic"] },
  { name: "The Get Down", address: "680 SE 6th Ave, Portland, OR 97214", position: [-122.6598, 45.5179], websites: ["https://thegetdownpdx.com/contact"], emails: ["booking@thegetdownpdx.com"], phones: [], categories: ["Live Music Venue", "Rock", "DJ", "Electronic", "Hip-Hop"] },
  { name: "Revival Patio", address: "6716 SE 16th Ave, Portland, OR 97202", position: [-122.6489, 45.4744], websites: ["https://bibleclubpdx.com/revival-patio"], emails: ["musicbooking@pdxrevival.com"], phones: [], categories: ["Live Music Venue", "Rock", "DJ", "Electronic"] },
  { name: "Polaris Hall", address: "635 N Killingsworth Ct, Portland, OR 97217", position: [-122.6745, 45.5625], websites: ["https://polarishall.com/contact"], emails: [], phones: [], categories: ["Independent Music Venue", "Punk", "Rock"] },
  { name: "Haymaker", address: "1233 N Killingsworth St, Portland, OR 97217", position: [-122.6839, 45.5625], websites: ["https://www.haymakerportland.com/"], emails: ["haymakermusicbooking@gmail.com"], phones: ["971-871-5429"], categories: ["Live Music Venue", "Punk", "Rock"] }
];

const verifiedOlympiaRooms = [
  { name: "The Crypt", address: "421 4th Ave E, Olympia, WA 98501", position: [-122.8970477, 47.0450635], websites: ["https://www.thecryptbar.com/contact"], emails: ["booking@thecryptbar.com"], phones: [], categories: ["Independent Music Venue", "Punk", "Rock", "Metal", "21+"] },
  { name: "Rhythms Coffee", address: "210 4th Ave W, Olympia, WA 98501", position: [-122.9034761, 47.0448992], websites: ["https://rhythms-coffee.com/"], emails: [], phones: [], categories: ["All Ages Venue", "Live Music", "Rock", "Folk"] }
];

const verifiedSeattleRooms = [
  { name: "The Vera Project", address: "161 Republican St, Seattle, WA 98109", position: [-122.35391, 47.62313], websites: ["https://theveraproject.org/booking-info/"], emails: ["booking@theveraproject.org"], phones: ["206-956-8372"], categories: ["Nonprofit All Ages Venue", "DIY", "Punk", "Hardcore", "Rock", "Electronic"] },
  { name: "Blue Moon Tavern", address: "712 NE 45th St, Seattle, WA 98105", position: [-122.32002, 47.66149], websites: ["https://www.thebluemoonseattle.com/specs-booking"], emails: ["bluemoonseattle@gmail.com"], phones: ["206-675-9116"], categories: ["Independent Live Music Venue", "Bar", "Punk", "Rock", "Metal"] },
  { name: "The Mountain Room", address: "3100 Airport Way S, Seattle, WA 98134", position: [-122.32044, 47.57655], websites: ["https://www.themountainroomseattle.com/booking"], emails: [], phones: [], categories: ["Independent Live Music Venue", "Bar", "Punk", "Rock", "Metal", "Emerging Artists"] },
  { name: "Substation", address: "645 NW 45th St, Seattle, WA 98107", position: [-122.36564, 47.66125], websites: ["https://substationseattle.com/"], emails: ["booking@substationseattle.com"], phones: ["206-782-1885"], categories: ["DIY Live Music Venue", "Punk", "Hardcore", "Rock", "Metal", "Electronic"] },
  { name: "Tractor Tavern", address: "5213 Ballard Ave NW, Seattle, WA 98107", position: [-122.3828, 47.66571], websites: ["https://tractortavern.com/booking/"], emails: ["booking@tractortavern.com"], phones: ["206-789-3599"], categories: ["Independent Live Music Venue", "Rock", "Punk", "Country", "Hip-Hop"] }
];

const verifiedTacomaRooms = [
  { name: "Real Art Tacoma", address: "5412 S Tacoma Way, Tacoma, WA 98409", position: [-122.4829, 47.2067], websites: ["https://www.realarttacoma.com/how-to-book"], emails: ["booking@realarttacoma.com"], phones: [], categories: ["Nonprofit All Ages Venue", "DIY", "Punk", "Hardcore", "Rock", "Metal"] },
  { name: "Airport Tavern", address: "5406 S Tacoma Way, Tacoma, WA 98409", position: [-122.4840, 47.2078], websites: ["https://www.airporttavern.com/"], emails: ["info@airporttavern.com"], phones: ["253-212-0709"], categories: ["Independent Live Music Venue", "Bar", "Punk", "Rock", "Metal"] },
  { name: "Jazzbones", address: "2803 6th Ave, Tacoma, WA 98406", position: [-122.4746, 47.2556], websites: ["https://jazzbones.com/"], emails: ["booking@jazzbones.com"], phones: [], categories: ["Live Music Venue", "Rock", "Punk", "Metal", "Hip-Hop"] },
  { name: "Spanish Ballroom", address: "565 Broadway, Tacoma, WA 98402", position: [-122.4401, 47.2583], websites: ["https://www.mcmenamins.com/spanish-ballroom"], emails: ["tacbox@mcmenamins.com"], phones: ["253-300-8744"], categories: ["Live Music Venue", "Rock", "Punk", "Metal"] }
];

const verifiedLongviewRooms = [
  { name: "The Roxy Theater", address: "1101 Commerce Ave, Longview, WA 98632", position: [-122.9358010, 46.1338320], websites: ["https://www.theroxylongview.com/contact"], emails: [], phones: ["360-703-3678"], categories: ["Independent Theater", "Live Music Venue", "Rock"] }
];

const verifiedKelsoRooms = [
  { name: "The Basement on Allen", address: "802 Allen St, Kelso, WA 98626", position: [-122.9038322, 46.1435688], websites: ["https://www.thebasementonallen.com/contact-us/"], emails: ["thebasementonallen@gmail.com"], phones: ["360-703-8202"], categories: ["Independent Event Space", "DIY Show Venue", "Live Music", "Rock"] }
];

const verifiedSalemRooms = [
  { name: "Victory Club", address: "155 Liberty St NE, Salem, OR 97301", position: [-123.0389917, 44.9407303], websites: ["https://vagabondbrewing.wixsite.com/mysite-2"], emails: ["info@victoryclubsalem.com"], phones: ["971-304-0004"], categories: ["Live Music Venue", "Bar", "Rock"] },
  { name: "The BAD Space at Santiam Brewing", address: "2572 19th St SE, Salem, OR 97302", position: [-123.0177, 44.9177], websites: ["https://www.santiambrewing.com/the-bad-space.html"], emails: ["ian@santiambrewing.com"], phones: ["503-507-5257"], categories: ["All Ages Venue", "Live Music Venue", "Rock", "Punk", "Metal"] }
];

const verifiedAlbanyOregonRooms = [
  { name: "The 520 Event Center", address: "520 Pacific Blvd SW, Albany, OR 97321", position: [-123.1080254, 44.6248871], websites: ["https://pnwdynamic.com/"], emails: [], phones: [], categories: ["All Ages Venue", "Live Music Venue", "Metal", "Hardcore", "Screamo", "Rock"] }
];

const verifiedCorvallisRooms = [
  { name: "Common Fields", address: "545 SW 3rd St, Corvallis, OR 97333", position: [-123.2629558, 44.5596305], websites: ["https://www.commonfieldscorvallis.com/live-music.html"], emails: [], phones: ["541-690-2940"], categories: ["Independent Outdoor Venue", "Original Live Music", "Rock", "Folk"] }
];

const verifiedCottageGroveRooms = [
  { name: "Axe & Fiddle", address: "657 E Main St, Cottage Grove, OR 97424", position: [-123.0611462, 43.7970789], websites: ["https://axeandfiddle.com/contact/"], emails: [], phones: ["541-942-5942"], categories: ["Independent Pub", "Live Music Venue", "Rock", "DJ"] }
];

const verifiedRoseburgRooms = [
  { name: "The Rosebud Theatre", address: "663 SE Jackson St, Roseburg, OR 97470", position: [-123.3445504, 43.2079745], websites: ["https://www.therosebudtheatre.com/faqs"], emails: ["booking@therosebudtheatre.com"], phones: [], categories: ["Independent Music Venue", "All Ages", "Rock", "Punk"] }
];

const verifiedSouthernOregonRooms = [
  { name: "Rockafairy", address: "1600 N Riverside Ave, Medford, OR 97501", position: [-122.8772680, 42.3442689], websites: ["https://www.rockafairy.org/"], emails: ["contactus@rockafairy.org"], phones: [], categories: ["All Ages Venue", "DIY", "Punk", "Rock", "Metal", "Hardcore"] },
  { name: "Grape Street Bar & Grill", address: "31 S Grape St, Medford, OR 97501", position: [-122.8747382, 42.3248195], websites: ["https://www.grapestreetmedford.com/"], emails: ["grapestreetbar@gmail.com"], phones: [], categories: ["Live Music Venue", "Bar", "Rock", "DJ", "Electronic"] },
  { name: "Medford Brewing Company", address: "1922 United Way, Medford, OR 97504", position: [-122.8309, 42.3077], websites: ["https://medfordbrew.com/contact-us/musician-booking/"], emails: [], phones: [], categories: ["Live Music Venue", "Brewery", "Rock"] },
  { name: "Dangerous Lee's Local 31", address: "31 Water St, Ashland, OR 97520", position: [-122.7154993, 42.1985182], websites: ["https://local31pub.ai/booking/"], emails: [], phones: ["541-708-6813"], categories: ["Live Music Venue", "Bar", "Rock", "Punk"] }
];

const verifiedReddingRooms = [
  { name: "The Dip", address: "1730 California St, Redding, CA 96001", position: [-122.3916333, 40.5817582], websites: ["https://www.thedipredding.com/venue"], emails: ["aaron@thedipredding.com"], phones: ["530-605-0827"], categories: ["Independent Music Venue", "Punk", "Rock", "Metal", "21+"] }
];

const verifiedAndersonRooms = [
  { name: "Firehouse Lounge", address: "2905 E Center St, Anderson, CA 96007", position: [-122.2988578, 40.4496041], websites: ["https://thefirehouselounge.com/"], emails: [], phones: ["530-365-7844"], categories: ["Independent Bar", "Live Music Venue", "Rock", "Dance Floor"] }
];

const verifiedWeedRooms = [
  { name: "Mount Shasta Brewing Company", address: "360 College Ave, Weed, CA 96094", position: [-122.3869185, 41.4161669], websites: ["https://mountshastabrewingcompany.com/"], emails: ["cheers@mountshastabrewingcompany.com"], phones: ["530-938-2394"], categories: ["All Ages Venue", "Brewery", "Live Music Venue", "Rock"] }
];

const verifiedDunsmuirRooms = [
  { name: "Dunsmuir Brewery Works", address: "5701 Dunsmuir Ave, Dunsmuir, CA 96025", position: [-122.2718891, 41.2119583], websites: ["https://www.dunsmuirbreweryworks.com/"], emails: ["info@dunsmuirbreweryworks.com"], phones: ["530-235-1900"], categories: ["Independent Brewpub", "Live Music Venue", "Open Mic", "All Ages"] },
  { name: "Jubilee Railroad Dining Car", address: "100 Railroad Park Rd, Dunsmuir, CA 96025", position: [-122.2931185, 41.1850309], websites: ["https://www.jubileerailroad.com/events-calendar"], emails: [], phones: ["530-235-4440"], categories: ["Independent Restaurant", "Live Music Venue", "Rock", "Folk", "Jazz"] }
];

const verifiedRedBluffRooms = [
  { name: "Enjoy Local", address: "615 Main St, Red Bluff, CA 96080", position: [-122.2347188, 40.1767524], websites: ["https://www.enjoylocalredbluff.com/events"], emails: [], phones: ["530-727-9016"], categories: ["Live Music Venue", "Bar", "Rock"] }
];

const verifiedChicoRooms = [
  { name: "Lost on Main", address: "319 Main St Ste F, Chico, CA 95928", position: [-121.8392528, 39.7295082], websites: ["https://www.ilovelost.com/"], emails: [], phones: ["530-892-2445"], categories: ["Live Music Venue", "Rock", "DJ", "Electronic"] },
  { name: "The Breakbeat", address: "112 W 2nd St, Chico, CA 95928", position: [-121.8406519, 39.7302849], websites: ["https://www.thebreakbeatchico.com/"], emails: ["contact@thebreakbeatchico.com"], phones: [], categories: ["Live Music Venue", "Rock", "DJ", "Electronic"] },
  { name: "Argus Bar & Patio", address: "212 W 2nd St, Chico, CA 95928", position: [-121.8415732, 39.7296666], websites: ["https://www.argusvenue.com/about"], emails: ["argusbarandpatio@gmail.com"], phones: ["530-520-8233"], categories: ["Live Music Venue", "Bar", "Rock", "Punk"] },
  { name: "The Tackle Box", address: "379 E Park Ave, Chico, CA 95928", position: [-121.8379, 39.7141], websites: ["https://www.tackleboxchico.com/bands/"], emails: ["tackleboxevents@gmail.com"], phones: [], categories: ["Live Music Venue", "Bar", "Rock"] }
];

const verifiedSacramentoRooms = [
  { name: "Cafe Colonial", address: "3520 Stockton Blvd, Sacramento, CA 95820", position: [-121.4516060, 38.5425680], websites: ["https://www.colonialpresents.com/booking-and-private-events"], emails: ["booking@colonialpresents.com"], phones: [], categories: ["All Ages Venue", "DIY", "Punk", "Rock", "Metal", "Hardcore", "Hip-Hop"] },
  { name: "Harlow's", address: "2708 J St, Sacramento, CA 95816", position: [-121.4701361, 38.5738508], websites: ["https://www.harlows.com/faq/"], emails: ["booking@harlows.com"], phones: ["916-441-4693"], categories: ["Independent Music Venue", "Rock", "Punk", "Metal", "Hip-Hop"] }
];

function verifiedVenueKey(place) {
  return createHash("sha256").update(`${place.name.toLowerCase()}|${place.address.toLowerCase()}`).digest("hex").slice(0, 20);
}

function curatedVenueLeads(point, genre = "", variation = 0) {
  const [longitude, latitude] = point.position || [];
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return [];
  const pointLabel = String(point.label || "").toLowerCase();
  let rooms = [], locality = "";
  if (pointLabel.includes("san francisco") || (latitude >= 37.68 && latitude <= 37.86 && longitude >= -122.55 && longitude <= -122.32)) {
    rooms = verifiedSanFranciscoRooms;
    locality = "San Francisco";
  } else if (pointLabel.includes("seattle") || (latitude >= 47.50 && latitude <= 47.73 && longitude >= -122.46 && longitude <= -122.22)) {
    rooms = verifiedSeattleRooms;
    locality = "Seattle";
  } else if (latitude >= 45.40 && latitude <= 45.65 && longitude >= -122.85 && longitude <= -122.45) {
    rooms = verifiedPortlandRooms;
    locality = "Portland";
  } else if (pointLabel.includes("tacoma") || (latitude >= 47.15 && latitude <= 47.32 && longitude >= -122.58 && longitude <= -122.34)) {
    rooms = verifiedTacomaRooms;
    locality = "Tacoma";
  } else if (latitude >= 46.95 && latitude <= 47.15 && longitude >= -123.05 && longitude <= -122.75) {
    rooms = verifiedOlympiaRooms;
    locality = "Olympia";
  } else if (pointLabel.includes("kelso")) {
    rooms = verifiedKelsoRooms;
    locality = "Kelso";
  } else if (latitude >= 46.02 && latitude <= 46.24 && longitude >= -123.10 && longitude <= -122.75) {
    rooms = verifiedLongviewRooms;
    locality = "Longview";
  } else if (latitude >= 44.85 && latitude <= 45.02 && longitude >= -123.18 && longitude <= -122.90) {
    rooms = verifiedSalemRooms;
    locality = "Salem";
  } else if (pointLabel.includes("corvallis")) {
    rooms = verifiedCorvallisRooms;
    locality = "Corvallis";
  } else if (latitude >= 44.52 && latitude <= 44.72 && longitude >= -123.25 && longitude <= -122.95) {
    rooms = verifiedAlbanyOregonRooms;
    locality = "Albany";
  } else if (pointLabel.includes("cottage grove")) {
    rooms = verifiedCottageGroveRooms;
    locality = "Cottage Grove";
  } else if (latitude >= 43.10 && latitude <= 43.32 && longitude >= -123.48 && longitude <= -123.18) {
    rooms = verifiedRoseburgRooms;
    locality = "Roseburg";
  } else if (latitude >= 42.12 && latitude <= 42.42 && longitude >= -123.05 && longitude <= -122.60) {
    rooms = verifiedSouthernOregonRooms;
    locality = pointLabel.includes("ashland") ? "Ashland" : "Medford";
  } else if (latitude >= 41.30 && latitude <= 41.52 && longitude >= -122.52 && longitude <= -122.22) {
    rooms = verifiedWeedRooms;
    locality = "Weed";
  } else if (latitude >= 41.10 && latitude <= 41.30 && longitude >= -122.42 && longitude <= -122.15) {
    rooms = verifiedDunsmuirRooms;
    locality = "Dunsmuir";
  } else if (pointLabel.includes("anderson")) {
    rooms = verifiedAndersonRooms;
    locality = "Anderson";
  } else if (latitude >= 40.45 && latitude <= 40.75 && longitude >= -122.55 && longitude <= -122.20) {
    rooms = verifiedReddingRooms;
    locality = "Redding";
  } else if (latitude >= 40.08 && latitude <= 40.28 && longitude >= -122.38 && longitude <= -122.08) {
    rooms = verifiedRedBluffRooms;
    locality = "Red Bluff";
  } else if (latitude >= 39.62 && latitude <= 39.86 && longitude >= -122.02 && longitude <= -121.68) {
    rooms = verifiedChicoRooms;
    locality = "Chico";
  } else if (latitude >= 38.42 && latitude <= 38.72 && longitude >= -121.65 && longitude <= -121.30) {
    rooms = verifiedSacramentoRooms;
    locality = "Sacramento";
  } else return [];
  const wanted = genre.toLowerCase();
  const genreTerms = wanted.includes("punk") ? ["punk", "diy"] : wanted.includes("metal") ? ["metal"] : wanted.includes("rock") ? ["rock"] : wanted.includes("dj") || wanted.includes("electronic") ? ["dj", "electronic"] : wanted.includes("hip-hop") ? ["hip-hop"] : [];
  const genreMatches = genreTerms.length ? rooms.filter(place => genreTerms.some(term => place.categories.some(category => category.toLowerCase().includes(term)))) : rooms;
  // In a small market, a legitimate current live room is a better lead than an
  // empty town. Prefer exact genre evidence, then retain the verified room with
  // the existing "confirm the calendar before pitching" warning.
  const matches = genreTerms.length && genreMatches.length ? genreMatches : rooms;
  const offset = matches.length ? variation % matches.length : 0;
  return [...matches.slice(offset), ...matches.slice(0, offset)].map(place => ({
    ...place,
    venueKey: verifiedVenueKey(place),
    locality,
    distanceMiles: null,
    contactVerificationRequired: true,
    verifiedRoom: true,
    sourceName: "DanzStak curated public venue directory",
    sourceUrl: place.websites?.[0] || "",
    sources: [{ name: "DanzStak curated public venue directory", url: place.websites?.[0] || "" }],
    discoveredAt: new Date(now() * 1000).toISOString(),
    activityEvidence: "A public venue or booking page is available; confirm the current calendar before pitching."
  }));
}

async function tourCandidates(point, genre = "", excludedVenueKeys = new Set(), variation = 0, searchBounds = null, venueType = "any") {
  const search = async query => {
    const locationConstraint = searchBounds
      ? { Filter: { BoundingBox: [searchBounds.west, searchBounds.south, searchBounds.east, searchBounds.north] } }
      : { BiasPosition: point.position };
    const result = await geoPlaces.send(new SearchTextCommand({ QueryText: query, ...locationConstraint, MaxResults: 50, AdditionalFeatures: ["Contact"] }));
    return (result.ResultItems || []).map(publicPlace);
  };
  const selectedGenre = String(genre || "").trim();
  const discoveryGenre = selectedGenre
    .replace(/DIY/gi, "")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const venueQueries = [...new Set([
    discoveryGenre ? `${discoveryGenre} live music venue` : "live music venue",
    discoveryGenre ? `${discoveryGenre} music club` : "independent music club",
    discoveryGenre ? `${discoveryGenre} bar live music` : "bar live music",
    discoveryGenre ? `${discoveryGenre} concert club` : "concert club",
    "independent live music venue",
    "live music bar",
    selectedGenre.includes("DJ") || selectedGenre.includes("Electronic")
      ? "nightclub DJ electronic music"
      : selectedGenre.includes("Orchestra") || selectedGenre.includes("Classical")
        ? "classical concert hall orchestra venue"
        : "rock punk metal music venue"
  ])];
  const localizedVenueQueries = venueDiscoveryQueries(point, selectedGenre);
  const discoveryQueries = [
    "budget hotel motel hostel",
    "truck stop rest area campground",
    ...new Set([...venueQueries, ...localizedVenueQueries])
  ];
  const [searchResults, reviewedDirectory, recordDiscovery, osmVenueDiscovery] = await Promise.all([
    mapLimit(discoveryQueries, 3, async query => {
      try {
        return { status: "fulfilled", value: await search(query) };
      } catch (reason) {
        return { status: "rejected", reason };
      }
    }),
    approvedMemberVenueLeads(point, searchBounds),
    recordStoreCandidates(point).catch(() => ({ stores: [], providers: [{ name: "Record-store discovery", ok: false, count: 0, error: "Provider temporarily unavailable" }] })),
    multiSourceDiscovery(point, "venue", { genre, radiusMiles: searchBounds ? 75 : 60 }).catch(() => ({ places: [], providers: [{ name: "Venue discovery", ok: false, count: 0, error: "Provider temporarily unavailable" }] }))
  ]);
  const [hotelSearch, vanRestSearch, ...venueSearches] = searchResults;
  const curatedPool = curatedVenueLeads(point, genre, variation);
  // Live discovery can be throttled when one tour fans out across several
  // road markets. A reviewed public lead is still useful in that case, so do
  // not erase Redding, Eugene, Olympia, or another real stop merely because
  // every Places query for that one market failed temporarily.
  if (venueSearches.every(result => result.status === "rejected") && !curatedPool.length && !osmVenueDiscovery.places.length) throw venueSearches[0].reason;
  const hotelResults = hotelSearch.status === "fulfilled" ? hotelSearch.value : [];
  const vanRestResults = vanRestSearch.status === "fulfilled" ? vanRestSearch.value : [];
  const venueBatches = [...venueSearches.filter(result => result.status === "fulfilled").map(result => result.value), osmVenueDiscovery.places];
  const nearby = (place, maximumMiles) => {
    const distance = Number.isFinite(place.distanceMiles)
      ? place.distanceMiles
      : approximateMilesBetween(point.position, place.position);
    return distance <= maximumMiles;
  };
  const annotate = place => {
    const assessment = venueDiscoveryAssessment(place, genre, venueType);
    const distanceMiles = Number.isFinite(place.distanceMiles) ? place.distanceMiles : Math.round(approximateMilesBetween(point.position, place.position) * 10) / 10;
    return { ...place, distanceMiles, bookingSuitability: assessment.suitability, suitabilityReasons: assessment.reasons, genreMatch: assessment.genreMatch, venueTypeMatch: assessment.typeMatch };
  };
  const curated = curatedPool.filter(place => isSupportedBookingLead(place, genre) && !excludedVenueKeys.has(place.venueKey)).map(annotate);
  const reviewed = reviewedDirectory.filter(place => nearby(place, 60) && isSupportedBookingLead(place, genre) && !excludedVenueKeys.has(place.venueKey)).map(annotate);
  const discovered = venueBatches.flat()
    .filter(place => nearby(place, 60) && isSupportedBookingLead(place, genre) && !excludedVenueKeys.has(place.venueKey))
    .map(annotate)
    .sort((left, right) => venueSuitability(right, genre) - venueSuitability(left, genre));
  const initialFallback = excludedVenueKeys.size || curated.length || discovered.length
    ? []
    : curatedPool.filter(place => isSupportedBookingLead(place, genre));
  // Live map discovery is the product. Curated records only fill genuine gaps and
  // must never crowd newly discovered rooms out of the first results.
  const venuePool = deduplicateVenues([...reviewed, ...discovered, ...curated, ...initialFallback])
    .sort((left, right) => venueSuitability(right, genre) - venueSuitability(left, genre)
      || (left.distanceMiles ?? 999) - (right.distanceMiles ?? 999));
  const offset = venuePool.length ? variation % venuePool.length : 0;
  const venues = [...venuePool.slice(offset), ...venuePool.slice(0, offset)].slice(0, 60);
  const hotels = hotelResults.filter(place => nearby(place, 35)).sort((left, right) => (left.distanceMiles ?? 999) - (right.distanceMiles ?? 999)).slice(0, 2);
  const vanStops = vanRestResults.filter(place => nearby(place, 25)).sort((left, right) => (left.distanceMiles ?? 999) - (right.distanceMiles ?? 999)).slice(0, 2);
  return { stop: point.label, position: point.position, venues, hotels, vanStops, recordStores: recordDiscovery.stores || [], researchLeads: osmVenueDiscovery.researchLeads || [], providerStatus: [...(osmVenueDiscovery.providers || []), ...(recordDiscovery.providers || [])] };
}

function parseVenueDiscoveryRequest(data) {
  const raw = String(data?.query || "").trim().slice(0, 240);
  let location = String(data?.location || "").trim().slice(0, 160), genre = String(data?.genre || "").trim().slice(0, 80);
  if (!location && raw) {
    const match = raw.match(/\b(?:in|near|around)\s+(.+?)(?:\s+to\s+play)?$/i);
    location = String(match?.[1] || raw).replace(/[?.!]+$/, "").trim();
  }
  if (!genre && raw) {
    const match = raw.match(/\b(techno|house|electronic|edm|punk|hardcore|metal|rock|jazz|hip[- ]?hop|rap|classical|orchestra|folk|country|blues)\b/i);
    genre = match?.[1] || "";
  }
  return { raw, location, genre };
}

async function searchVenues(event) {
  const headers = corsHeaders(event.headers?.origin), reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  if (!(await getAuthenticatedUser(event))) return reply(401, { error: "Authentication required." });
  const data = parseJsonBody(event), parsed = parseVenueDiscoveryRequest(data);
  if (parsed.location.length < 2) return reply(400, { error: "Enter a city or region to search." });
  const page = Math.max(0, Math.min(20, Math.trunc(Number(data?.page) || 0)));
  const requestedRadiusMiles = Math.max(5, Math.min(150, Number(data?.radiusMiles) || 25));
  try {
    const point = await geocodeTourPlace(parsed.location, { requireDisambiguation: true });
    let radiusMiles = requestedRadiusMiles;
    let discovery = await multiSourceDiscovery(point, "venue", { genre: parsed.genre, radiusMiles });
    let discovered = discovery.places.filter(place => approximateMilesBetween(point.position, place.position) <= radiusMiles).filter(place => isSupportedBookingLead(place, parsed.genre));
    // A handful of results is not useful tour research in a sparse market.
    // Expand once before presenting the locality as covered so nearby rooms in
    // distinct towns remain available with their real distance and address.
    const expandedFromMiles = discovered.length < 10 && radiusMiles < 75 ? radiusMiles : null;
    if (expandedFromMiles) {
      radiusMiles = Math.min(75, Math.max(40, radiusMiles * 2));
      discovery = await multiSourceDiscovery(point, "venue", { genre: parsed.genre, radiusMiles });
      discovered = discovery.places.filter(place => approximateMilesBetween(point.position, place.position) <= radiusMiles).filter(place => isSupportedBookingLead(place, parsed.genre));
    }
    const ranked = discovered.map(place => {
      const assessment = venueDiscoveryAssessment(place, parsed.genre, String(data?.venueType || "any"));
      return { ...place, distanceMiles: Math.round(approximateMilesBetween(point.position, place.position) * 10) / 10, bookingSuitability: assessment.suitability, suitabilityReasons: assessment.reasons, genreMatch: assessment.genreMatch, venueTypeMatch: assessment.typeMatch };
    }).sort((left, right) => venueSuitability(right, parsed.genre) - venueSuitability(left, parsed.genre) || (left.distanceMiles ?? 999) - (right.distanceMiles ?? 999));
    const offset = page * 20, venues = ranked.slice(offset, offset + 20);
    const providerFailures = discovery.providers.filter(provider => !provider.ok && !provider.skipped);
    return reply(200, { query: parsed.raw, location: point, genre: parsed.genre, venues, researchLeads: discovery.researchLeads || [], providers: discovery.providers, coverage: providerFailures.length ? "partial" : "provider-complete", coverageNotice: providerFailures.length ? "Some discovery providers were unavailable; these results are incomplete." : ranked.length ? "Results are current public leads, not guaranteed booking availability." : "No relevant public venue leads were found in the searched radius. This does not prove that no venues exist.", page, hasMore: ranked.length > offset + venues.length, canExpand: radiusMiles < 150, radiusMiles, expandedFromMiles });
  } catch (error) {
    if (error.statusCode === 422) return reply(422, { error: "That location could not be found." });
    if (error.statusCode === 409) return reply(409, { error: error.message, locationChoices: error.locationChoices || [] });
    console.error("Venue discovery failed", { name: error.name, provider: error.provider });
    return reply(502, { error: "Venue discovery is temporarily unavailable.", providers: error.providerStatuses || [] });
  }
}

async function planTourRoute(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const data = parseJsonBody(event);
  if (!data || typeof data !== "object" || Array.isArray(data)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON request." }) };
  const cleanPlace = value => String(value || "").trim();
  const excludedVenueKeys = new Set((Array.isArray(data.excludeVenueKeys) ? data.excludeVenueKeys : []).slice(0, 120).map(value => String(value || "").trim()).filter(value => /^[a-f0-9]{20}$/.test(value)));
  const variation = Math.max(0, Math.min(1000, Math.trunc(Number(data.variation) || 0)));
  const local = data.mode === "local", directional = data.mode === "direction", direction = cleanPlace(data.direction).toLowerCase(), genre = cleanPlace(data.genre).slice(0, 80), venueType = cleanPlace(data.venueType || "any").toLowerCase(), requestedDays = Math.max(1, Math.min(180, Math.trunc(Number(data.days) || 0))), requestedShows = Math.max(1, Math.min(requestedDays, Math.trunc(Number(data.shows) || 1))), requestedDepartOn = cleanPlace(data.departOn), returnBy = cleanPlace(data.returnBy), start = cleanPlace(data.start), suppliedStops = local || directional ? [] : Array.isArray(data.stops) ? data.stops.map(cleanPlace).filter(Boolean) : [], suppliedEnd = local || directional ? start : cleanPlace(data.end), end = suppliedEnd || suppliedStops.at(-1) || "", stops = suppliedEnd ? suppliedStops : suppliedStops.slice(0, -1);
  const rawBounds = data.searchBounds && typeof data.searchBounds === "object" ? data.searchBounds : null;
  const searchBounds = rawBounds ? { north: Number(rawBounds.north), south: Number(rawBounds.south), east: Number(rawBounds.east), west: Number(rawBounds.west) } : null;
  const searchPath = Array.isArray(data.searchPath) ? data.searchPath.slice(0, 40).map(point => Array.isArray(point) ? [Number(point[0]), Number(point[1])] : []) : [];
  if (searchBounds && (!Object.values(searchBounds).every(Number.isFinite) || searchBounds.north <= searchBounds.south || searchBounds.east <= searchBounds.west || (searchPath.length < 2 && (searchBounds.north - searchBounds.south > 8 || searchBounds.east - searchBounds.west > 8)))) return { statusCode: 400, headers, body: JSON.stringify({ error: "Draw a smaller valid map search area." }) };
  if (searchPath.length && (searchPath.length < 2 || searchPath.some(point => point.length !== 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1]) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90))) return { statusCode: 400, headers, body: JSON.stringify({ error: "Draw a valid route on the map." }) };
  if (!new Set(["any", "diy", "bar", "club", "hall"]).has(venueType)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Choose a valid venue type." }) };
  if (directional && (!tourDirections.has(direction) || !requestedDays)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Choose a travel direction and provide 1–180 tour days." }) };
  if ((requestedDepartOn && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDepartOn)) || (returnBy && !/^\d{4}-\d{2}-\d{2}$/.test(returnBy))) return { statusCode: 400, headers, body: JSON.stringify({ error: "Tour dates must use YYYY-MM-DD." }) };
  if (requestedDepartOn && returnBy && requestedDepartOn > returnBy) return { statusCode: 400, headers, body: JSON.stringify({ error: "The home date must be on or after the first show date." }) };
  if (start.length < 2 || start.length > 120 || end.length < 2 || end.length > 120 || stops.length > 8 || stops.some(stop => stop.length > 120)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Provide a home or starting city, a destination for tours, and no more than eight valid stops." }) };
  try {
    if (local) {
      const homePoint = await geocodeTourPlace(start);
      if (searchPath.length >= 2) {
        const sampleCount = Math.min(5, searchPath.length);
        const samplePoints = Array.from({ length: sampleCount }, (_, index) => searchPath[Math.round(index * (searchPath.length - 1) / Math.max(1, sampleCount - 1))]);
        const batches = await Promise.all(samplePoints.map((position, index) => tourCandidates({ label: `Drawn route area ${index + 1}`, position }, genre, excludedVenueKeys, variation + index, null, venueType)));
        const venues = deduplicateVenues(batches.flatMap(batch => batch.venues || []))
          .filter(place => distanceToSearchPathMiles(place.position, searchPath) <= 25)
          .sort((left, right) => venueSuitability(right, genre) - venueSuitability(left, genre))
          .slice(0, 30);
        const hotels = deduplicateVenues(batches.flatMap(batch => batch.hotels || [])).slice(0, 2);
        const vanStops = deduplicateVenues(batches.flatMap(batch => batch.vanStops || [])).slice(0, 2);
        if (requestedDepartOn) batches.forEach(batch => { batch.proposedDate = requestedDepartOn; });
        return { statusCode: 200, headers, body: JSON.stringify({ route: { start: homePoint, end: homePoint, stops: samplePoints.map((position, index) => ({ label: `Drawn route area ${index + 1}`, position })), distanceMiles: 0, durationHours: 0, minimumDrivingDays: 0, requestedDays, departOn: requestedDepartOn, returnBy, provider: "Amazon Location Service", planningOnly: true, local: true, drawn: true }, candidates: [{ stop: "Clubs along your drawn route", position: samplePoints[0], venues, hotels, vanStops, ...(requestedDepartOn ? { proposedDate: requestedDepartOn } : {}) }] }) };
      }
      const point = searchBounds ? {
        label: `${homePoint.label} map area`,
        position: [(searchBounds.east + searchBounds.west) / 2, (searchBounds.north + searchBounds.south) / 2]
      } : homePoint;
      const candidates = await tourCandidates(point, genre, excludedVenueKeys, variation, searchBounds, venueType);
      if (searchBounds) candidates.venues = candidates.venues.filter(place => Array.isArray(place.position) && place.position.length === 2 && place.position[1] <= searchBounds.north && place.position[1] >= searchBounds.south && place.position[0] <= searchBounds.east && place.position[0] >= searchBounds.west);
      if (searchPath.length >= 2) candidates.venues = candidates.venues.filter(place => distanceToSearchPathMiles(place.position, searchPath) <= 25);
      if (requestedDepartOn) candidates.proposedDate = requestedDepartOn;
      return { statusCode: 200, headers, body: JSON.stringify({ route: { start: homePoint, end: homePoint, stops: [], distanceMiles: 0, durationHours: 0, minimumDrivingDays: 0, requestedDays, departOn: requestedDepartOn, returnBy, provider: "Amazon Location Service", planningOnly: true, local: true }, candidates: [candidates] }) };
    }
    const home = await geocodeTourPlace(start);
    const suggestedMarkets = directional ? await suggestDirectionalMarkets(home, direction, requestedDays, genre) : [];
    let points = directional ? [home, ...suggestedMarkets, home] : await Promise.all([start, ...stops, end, start].map(value => geocodeTourPlace(value)));
    let route;
    while (points.length >= 3) {
      try {
        route = await geoRoutes.send(new CalculateRoutesCommand({ Origin: points[0].position, Destination: points.at(-1).position, Waypoints: points.slice(1, -1).map(point => ({ Position: point.position })), TravelMode: "Car", LegGeometryFormat: "Simple" }));
      } catch (error) {
        if (!directional) throw error;
        route = undefined;
      }
      if (route?.Routes?.[0]?.Summary || !directional || points.length === 3) break;
      points = [...points.slice(0, -2), points.at(-1)];
    }
    const summary = route?.Routes?.[0]?.Summary;
    if (!summary) return { statusCode: 422, headers, body: JSON.stringify({ error: "A drivable route could not be calculated." }) };
    const markets = points.slice(1, -1), corridor = directional ? null : westCoastTourCorridor(points),
      itineraryMarkets = corridor || null,
      corridorSearchMarkets = corridor ? sampleTourCorridorMarkets(corridor, requestedDays, requestedShows, variation) : null,
      selected = directional
      ? (markets.length <= 6 ? markets : Array.from({ length: 6 }, (_, index) => markets[Math.round(index * (markets.length - 1) / 5)]))
      : corridor
        ? (await mapLimit([...new Set(corridorSearchMarkets)], 4, async market => {
            try {
              return reviewedCorridorPoint(market) || await geocodeTourPlace(market);
            } catch (error) {
              // Keep the itinerary usable even if one road town cannot be
              // geocoded during this request. The client still renders the
              // named market and a later search can retry its venue lookup.
              console.warn("Tour corridor geocode unavailable", { market, name: error.name });
              return null;
            }
          })).filter(Boolean)
        : await discoverRouteMarkets(route, points, requestedDays, requestedShows),
      candidates = await mapLimit(selected, 4, async point => {
        try {
          return await tourCandidates(point, genre, excludedVenueKeys, variation, null, venueType);
        } catch (error) {
          // A temporary lookup failure in one road town must not throw away the
          // rest of a multi-city tour. Keep the market visible so the band can
          // retry or add a verified lead without rebuilding the whole route.
          console.warn("Tour market discovery unavailable", { market: point.label, name: error.name });
          return { stop: point.label, position: point.position, venues: [], hotels: [], vanStops: [], discoveryUnavailable: true };
        }
      });
    candidates.forEach(candidate => {
      const localities = (candidate.venues || []).map(venue => String(venue.locality || "").trim()).filter(Boolean);
      if (!localities.length) return;
      const counts = localities.reduce((all, locality) => all.set(locality, (all.get(locality) || 0) + 1), new Map());
      const [dominantLocality, dominantCount] = [...counts].sort((left, right) => right[1] - left[1])[0];
      const currentLocality = String(candidate.stop || "").split(",")[0].trim().toLowerCase();
      if (dominantCount < Math.ceil(localities.length * 0.6) || dominantLocality.toLowerCase() === currentLocality) return;
      const lead = candidate.venues.find(venue => venue.locality === dominantLocality);
      candidate.stop = dominantLocality;
      if (Array.isArray(lead?.position) && lead.position.length === 2) candidate.position = lead.position;
    });
    const distanceMiles = Math.round(Number(summary.Distance || 0) / 1609.344), durationHours = Math.round(Number(summary.Duration || 0) / 360) / 10;
    const minimumDrivingDays = Math.max(1, Math.ceil(durationHours / 8));
    if (directional && minimumDrivingDays >= requestedDays) return { statusCode: 422, headers, body: JSON.stringify({ error: `That ${direction} loop needs at least ${minimumDrivingDays} full driving days. Add days or choose a shorter direction-based plan.` }) };
    let departOn = requestedDepartOn;
    if (directional && returnBy && !departOn) {
      const returnDate = new Date(`${returnBy}T12:00:00Z`);
      if (!Number.isFinite(returnDate.getTime()) || returnDate < new Date()) return { statusCode: 400, headers, body: JSON.stringify({ error: "Choose a future home-by date." }) };
      const departureDate = new Date(returnDate); departureDate.setUTCDate(departureDate.getUTCDate() - requestedDays + 1); departOn = departureDate.toISOString().slice(0, 10);
    }
    if (departOn) candidates.forEach((market, index) => { const date = new Date(`${departOn}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + Math.min(Math.max(0, requestedDays - 1), index + (local ? 0 : 1))); market.proposedDate = date.toISOString().slice(0, 10); market.bookingStatus = "proposed"; });
    return { statusCode: 200, headers, body: JSON.stringify({ route: { start: points[0], end: points.at(-1), turnaround: points.at(-2), stops: points.slice(1, -1), itineraryMarkets: itineraryMarkets || candidates.map(candidate => candidate.stop), distanceMiles, durationHours, minimumDrivingDays, requestedDays, requestedShows, direction: directional ? direction : undefined, departOn, returnBy, bookingStatus: "proposed", roundTrip: true, provider: "Amazon Location Service", planningOnly: true }, candidates }) };
  } catch (error) {
    if (error.statusCode === 422) return { statusCode: 422, headers, body: JSON.stringify({ error: error.message }) };
    console.error("Tour route planning failed", { name: error.name });
    return { statusCode: 502, headers, body: JSON.stringify({ error: "Route and venue information is temporarily unavailable." }) };
  }
}

function cleanTourMarket(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const stop = String(value.stop || "").trim().slice(0, 160), proposedDate = String(value.proposedDate || "").trim();
  if (!stop || (proposedDate && !/^\d{4}-\d{2}-\d{2}$/.test(proposedDate))) return null;
  const venue = value.venue && typeof value.venue === "object" && !Array.isArray(value.venue) ? {
    name: String(value.venue.name || "").trim().slice(0, 160),
    address: String(value.venue.address || "").trim().slice(0, 300),
    website: /^https:\/\//i.test(String(value.venue.website || "")) ? String(value.venue.website).slice(0, 500) : "",
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value.venue.email || "")) ? String(value.venue.email).slice(0, 254).toLowerCase() : "",
    phone: /^\+?[0-9 ()-]{7,24}$/.test(String(value.venue.phone || "")) ? String(value.venue.phone).slice(0, 24) : ""
  } : null;
  return { stop, proposedDate, confirmed: value.confirmed === true, venue };
}

const bookingWorkspaceId = "booking-workspace-v1";
const epkWorkspaceId = "epk-workspace-v1";
const epkPublicPartition = "epk-public";
const epkSharePartition = "epk-private-share";
const epkOutreachPartition = "epk-outreach-share";
const epkOutreachPrefix = "EPK#OUTREACH#";

const epkMediaRoles = new Set(["press-photo", "logo", "artwork", "press-clipping", "biography", "technical-rider", "hospitality-rider", "stage-plot", "other"]);
const epkMediaPattern = ownerPrefix => new RegExp(`^epk/${ownerPrefix}/[a-f0-9-]{36}\\.(jpg|png|webp|pdf)$`);

const reviewTargetTypes = new Set(["show", "release"]);
const reviewIdPattern = /^[a-f0-9]{32}$/;

function reviewTargetId(targetType, artistUserId, naturalKey) {
  if (!reviewTargetTypes.has(targetType) || !artistUserId || !naturalKey) return "";
  return sha256(`review-target:${targetType}:${artistUserId}:${String(naturalKey).trim().toLowerCase()}`).slice(0, 32);
}

function cleanReviewDraft(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if ((Array.isArray(data.media) && data.media.length) || data.video || data.images) return null;
  const targetType = String(data.targetType || "").trim().toLowerCase();
  const targetId = String(data.targetId || "").trim().toLowerCase();
  const artistPublicId = String(data.artistPublicId || "").trim().toLowerCase();
  const body = typeof data.body === "string" ? data.body.trim() : "";
  if (!reviewTargetTypes.has(targetType) || !reviewIdPattern.test(targetId) || !/^[a-z0-9-]{3,64}$/.test(artistPublicId)) return null;
  if (body.length < 10 || body.length > 5000 || Buffer.byteLength(body, "utf8") > 12000) return null;
  return { targetType, targetId, artistPublicId, body };
}

function reviewEntityToView(item) {
  if (!item?.reviewId?.S || !item?.authorUserId?.S || !item?.targetId?.S) return null;
  return {
    reviewId: item.reviewId.S,
    authorUserId: item.authorUserId.S,
    artistUserId: item.artistUserId?.S || "",
    artistPublicId: item.artistPublicId?.S || "",
    targetType: item.targetType?.S || "",
    targetId: item.targetId.S,
    targetTitle: item.targetTitle?.S || "",
    targetDetail: item.targetDetail?.S || "",
    body: item.body?.S || "",
    createdAt: item.createdAt?.S || "",
    updatedAt: item.updatedAt?.S || ""
  };
}

function cleanEpk(data, ownerPrefix = "") {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const text = (value, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const https = value => /^https:\/\//i.test(text(value, 600)) ? text(value, 600) : "";
  const email = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(value, 254)) ? text(value, 254).toLowerCase() : "";
  const list = (value, max, cleaner) => Array.isArray(value) ? value.slice(0, max).map(cleaner).filter(Boolean) : [];
  const links = value => list(value, 12, item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const label = text(item.label, 100), url = https(item.url);
    return label && url ? { label, url } : null;
  });
  const quotes = list(data.pressQuotes, 8, item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const quote = text(item.quote, 500), source = text(item.source, 160), url = https(item.url);
    return quote && source ? { quote, source, url } : null;
  });
  const rawMedia = Array.isArray(data.media) ? data.media.slice(0, 40) : [];
  const media = list(rawMedia, 40, item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const key = text(item.key, 300), role = text(item.role, 40), name = text(item.name, 160);
    if (!ownerPrefix || !epkMediaPattern(ownerPrefix).test(key) || !epkMediaRoles.has(role) || !name) return null;
    return { id: text(item.id, 36) || key.split("/").at(-1).split(".")[0], key, role, name, public: item.public === true, featured: item.featured === true };
  });
  if (media.length !== rawMedia.length) return null;
  const look = new Set(["techno", "punk", "metal", "house"]).has(data.look) ? data.look : "techno";
  const actType = new Set(["band", "dj", "electronic", "solo"]).has(data.actType) ? data.actType : "band";
  const plotKinds = new Set(["vocal-mic", "instrument-mic", "di", "monitor", "amplifier", "drum-kit", "keyboard", "dj-mixer", "playback", "power", "other"]), plotPositions = new Set(["rear-left", "rear-center", "rear-right", "front-left", "front-center", "front-right"]), inputConnections = new Set(["mic", "di", "stereo-di", "line", "power"]), inputStands = new Set(["none", "straight", "boom", "short"]);
  const plotItems = list(data.production?.plotItems, 24, item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const label = text(item.label, 100), kind = plotKinds.has(item.kind) ? item.kind : "", position = plotPositions.has(item.position) ? item.position : "";
    return label && kind && position ? { id:text(item.id,64), kind, label, position } : null;
  });
  const inputs = list(data.production?.inputs, 48, item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const source = text(item.source, 100), connection = inputConnections.has(item.connection) ? item.connection : "", stand = inputStands.has(item.stand) ? item.stand : "";
    return source && connection && stand ? { id:text(item.id,64), source, connection, stand, phantom:item.phantom === true, notes:text(item.notes,240) } : null;
  });
  const kit = {
    artistName: text(data.artistName, 120), hometown: text(data.hometown, 160), actType, look,
    genres: list(data.genres, 8, item => text(item, 60)), shortPitch: text(data.shortPitch, 300),
    shortBio: text(data.shortBio, 1000), bio: text(data.bio, 5000), lineup: list(data.lineup, 16, item => text(item, 160)),
    releases: list(data.releases, 20, item => text(item, 300)), achievements: list(data.achievements, 20, item => text(item, 300)),
    notableShows: list(data.notableShows, 20, item => text(item, 240)), pressQuotes: quotes,
    musicLinks: links(data.musicLinks), videoLinks: links(data.videoLinks), socialLinks: links(data.socialLinks),
    heroImage: https(data.heroImage), logoImage: https(data.logoImage), media,
    stageRequirements: text(data.stageRequirements, 3000), production: { plotItems, inputs }, techRequirements: text(data.techRequirements, 5000), hospitalityRequirements: text(data.hospitalityRequirements, 3000),
    bookingName: text(data.bookingName, 120), bookingEmail: email(data.bookingEmail),
    bookingPhone: text(data.bookingPhone, 40), website: https(data.website),
    publicDetails: {
      bookingEmail: data.publicDetails?.bookingEmail === true,
      bookingPhone: data.publicDetails?.bookingPhone === true,
      technical: data.publicDetails?.technical === true,
      hospitality: data.publicDetails?.hospitality === true
    }
  };
  return kit.artistName ? kit : null;
}

async function validatedEpkMedia(media) {
  let total = 0;
  for (const item of media || []) {
    let head;
    try { head = await s3.send(new HeadObjectCommand({ Bucket: mediaBucket, Key: item.key })); }
    catch { throw Object.assign(new Error(`Uploaded file not found: ${item.name}`), { statusCode: 422 }); }
    const size = Number(head.ContentLength || 0), contentType = String(head.ContentType || "").toLowerCase();
    const image = /\.(jpg|png|webp)$/.test(item.key), allowedType = image ? /^image\/(jpeg|png|webp)$/.test(contentType) : contentType === "application/pdf";
    const maximum = image ? 12 * 1024 * 1024 : 20 * 1024 * 1024;
    if (!allowedType || size <= 0 || size > maximum) throw Object.assign(new Error(`${item.name} has an unsupported type or size.`), { statusCode: 422 });
    total += size;
    item.contentType = contentType; item.size = size;
  }
  if (total > 100 * 1024 * 1024) throw Object.assign(new Error("EPK media exceeds the 100 MB account quota."), { statusCode: 413 });
  return media;
}

function epkForViewer(kit, publicView = false, ownerView = true, allowDownloads = true) {
  const copy = structuredClone(kit || {});
  copy.media = (copy.media || []).filter(item => !publicView || item.public).map(item => {
    const expires = publicView ? 3600 : 900, downloadName = epkDownloadName(item.name, item.key);
    const view = {
      ...item,
      url: signedMediaUrl(item.key, expires)
    };
    if (allowDownloads) view.downloadUrl = signedMediaUrl(item.key, expires, { "response-content-disposition": `attachment; filename="${downloadName}"` });
    return view;
  });
  if (publicView && copy.publicDetails && typeof copy.publicDetails === "object") {
    if (copy.publicDetails.bookingEmail !== true) copy.bookingEmail = "";
    if (copy.publicDetails.bookingPhone !== true) copy.bookingPhone = "";
    if (copy.publicDetails.technical !== true) { copy.techRequirements = ""; copy.production = { plotItems:[], inputs:[] }; }
    if (copy.publicDetails.hospitality !== true) copy.hospitalityRequirements = "";
    delete copy.publicDetails;
  }
  if (!ownerView) delete copy.publicDetails;
  return copy;
}

function epkOutreachTokenMatches(token, storedHash) {
  return /^[a-f0-9]{64}$/.test(token || "")
    && /^[a-f0-9]{64}$/.test(storedHash || "")
    && safeEqual(sha256(`epk-outreach:${token}`), storedHash);
}

function epkOutreachLinkParts(value) {
  try {
    const url = new URL(String(value || ""));
    const shareId = url.searchParams.get("outreach") || "", token = new URLSearchParams(url.hash.slice(1)).get("token") || "";
    if (url.origin !== "https://danzstak.com" || url.pathname !== "/epk.html" || !/^[a-f0-9]{32}$/.test(shareId) || !/^[a-f0-9]{64}$/.test(token)) return null;
    return { shareId, token, href: url.href };
  } catch { return null; }
}

async function validateBookingOutreachEpkLink({ userId, venueKey, outreachId, message }) {
  const match = String(message || "").match(/https:\/\/danzstak\.com\/epk\.html\?outreach=[a-f0-9]{32}#token=[a-f0-9]{64}/i);
  const parts = epkOutreachLinkParts(match?.[0] || "");
  if (!parts) return false;
  const result = await db.send(new GetItemCommand({ TableName: toursTable, Key: { userId: { S: epkOutreachPartition }, tourId: { S: parts.shareId } }, ConsistentRead: true }));
  const item = result.Item;
  return item?.ownerId?.S === userId
    && item?.venueKey?.S === venueKey
    && item?.outreachId?.S === outreachId
    && Number(item?.expiresAt?.N || 0) > now()
    && epkOutreachTokenMatches(parts.token, item?.shareHash?.S || "");
}

function epkDeletionPlan(existingItem, ownerPrefix, ownerKey) {
  const publicId = /^[a-z0-9-]{3,64}$/.test(existingItem?.publicId?.S || "") ? existingItem.publicId.S : "";
  const transaction = [{ Delete: { TableName: toursTable, Key: ownerKey } }];
  if (publicId) transaction.push({ Delete: { TableName: toursTable, Key: { userId: { S: epkPublicPartition }, tourId: { S: publicId } } } });
  if (publicId) transaction.push({ Delete: { TableName: toursTable, Key: { userId: { S: epkSharePartition }, tourId: { S: publicId } } } });
  let previousKit = {};
  try { previousKit = JSON.parse(existingItem?.plan?.S || "{}"); } catch { previousKit = {}; }
  const mediaKeys = [...new Set([
    ...(previousKit.media || []).map(item => item?.key || ""),
    ...(existingItem?.mediaCleanup?.SS || [])
  ].filter(key => epkMediaPattern(ownerPrefix).test(key)))];
  return { transaction, mediaKeys };
}

async function cleanupEpkMediaObjects(ownerKey, ownerPrefix, keys, retainedKeys = []) {
  const candidates = [...new Set((keys || []).filter(Boolean))];
  const retained = new Set((retainedKeys || []).filter(key => epkMediaPattern(ownerPrefix).test(key)));
  const owned = candidates.filter(key => epkMediaPattern(ownerPrefix).test(key) && !retained.has(key));
  const resolved = candidates.filter(key => !epkMediaPattern(ownerPrefix).test(key) || retained.has(key));
  const pending = [];
  for (const key of owned) {
    let removed = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: mediaBucket, Key: key }));
        removed = true;
        break;
      } catch (error) {
        if (attempt === 2) console.error("EPK media cleanup remains pending", { userId: ownerKey.userId.S, key, error });
      }
    }
    if (removed) resolved.push(key);
    else pending.push(key);
  }
  if (resolved.length) {
    try {
      await db.send(new UpdateItemCommand({
        TableName: toursTable,
        Key: ownerKey,
        UpdateExpression: "DELETE mediaCleanup :resolved",
        ExpressionAttributeValues: { ":resolved": { SS: resolved } },
        ConditionExpression: "attribute_exists(userId)"
      }));
    } catch (error) {
      console.error("EPK media cleanup queue remains pending", { userId: ownerKey.userId.S, error });
    }
  }
  return { cleaned: candidates.length - pending.length, pending: pending.length };
}

async function deleteEpkOutreachShares(userId) {
  const mappings = await queryAll({ TableName: toursTable, KeyConditionExpression: "userId = :user AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":user": { S: userId }, ":prefix": { S: epkOutreachPrefix } }, ConsistentRead: true }, 500);
  for (let offset = 0; offset < mappings.length; offset += 50) {
    const batch = mappings.slice(offset, offset + 50), transaction = [];
    for (const item of batch) {
      transaction.push({ Delete: { TableName: toursTable, Key: { userId: { S: userId }, tourId: { S: item.tourId.S } } } });
      if (/^[a-f0-9]{32}$/.test(item.shareId?.S || "")) transaction.push({ Delete: { TableName: toursTable, Key: { userId: { S: epkOutreachPartition }, tourId: { S: item.shareId.S } } } });
    }
    if (transaction.length) await db.send(new TransactWriteItemsCommand({ TransactItems: transaction }));
  }
  return mappings.length;
}

function epkShareTokenMatches(token, storedHash) {
  return /^[a-f0-9]{64}$/.test(token || "")
    && /^[a-f0-9]{64}$/.test(storedHash || "")
    && safeEqual(sha256(`epk-share:${token}`), storedHash);
}

async function epkWorkspace(event, method) {
  const headers = corsHeaders(event.headers?.origin);
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const accountEmail = await accountForSub(userId);
  if (!accountEmail) return reply(409, { error: "Account email could not be verified." });
  const ownerPrefix = sha256(accountEmail).slice(0, 24), ownerKey = { userId: { S: userId }, tourId: { S: epkWorkspaceId } };
  if (method === "DELETE") {
    const existing = await db.send(new GetItemCommand({ TableName: toursTable, Key: ownerKey, ConsistentRead: true }));
    if (!existing.Item) return reply(200, { deleted: false, cleanupPending: false });
    const { transaction, mediaKeys } = epkDeletionPlan(existing.Item, ownerPrefix, ownerKey);
    const cleanupPending = mediaKeys.length
      ? await runCleanup(mediaKeys.map(key => () => s3.send(new DeleteObjectCommand({ Bucket: mediaBucket, Key: key }))))
      : 0;
    if (cleanupPending) {
      console.error("EPK media deletion remains pending", { userId, cleanupPending });
      return reply(503, { error: "EPK files could not be removed yet. Try again.", deleted: false });
    }
    await deleteEpkOutreachShares(userId);
    await db.send(new TransactWriteItemsCommand({ TransactItems: transaction }));
    return reply(200, { deleted: true, cleanupPending: false });
  }
  if (method === "GET") {
    const result = await db.send(new GetItemCommand({ TableName: toursTable, Key: ownerKey, ConsistentRead: true }));
    if (!result.Item) return reply(200, { kit: null, publicId: "", published: false, updatedAt: "" });
    return reply(200, { kit: epkForViewer(JSON.parse(result.Item.plan?.S || "{}")), publicId: result.Item.publicId?.S || "", published: result.Item.published?.BOOL === true, privateShared: Boolean(result.Item.shareHash?.S), updatedAt: result.Item.updatedAt?.S || "" });
  }
  const data = parseJsonBody(event), kit = cleanEpk(data?.kit, ownerPrefix), publish = data?.publish === true;
  if (!kit) return reply(400, { error: "Add an artist name and valid EPK details." });
  const existing = await db.send(new GetItemCommand({ TableName: toursTable, Key: ownerKey, ConsistentRead: true }));
  try { await validatedEpkMedia(kit.media); } catch (error) { return reply(error.statusCode || 422, { error: error.message }); }
  let publicId = /^[a-z0-9-]{3,64}$/.test(existing.Item?.publicId?.S || "") ? existing.Item.publicId.S : kit.artistName.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  if (publicId.length < 3) publicId = randomUUID();
  if (!existing.Item?.publicId?.S) {
    const collision = await db.send(new GetItemCommand({ TableName: toursTable, Key: { userId: { S: epkPublicPartition }, tourId: { S: publicId } }, ConsistentRead: true }));
    if (collision.Item) publicId = `${publicId.slice(0, 39)}-${sha256(userId).slice(0, 8)}`;
  }
  const nowIso = new Date().toISOString(), plan = JSON.stringify(kit), shareHash = /^[a-f0-9]{64}$/.test(existing.Item?.shareHash?.S || "") ? existing.Item.shareHash.S : "";
  if (Buffer.byteLength(plan, "utf8") > 200000) return reply(400, { error: "This EPK is too large." });
  const publicKey = { userId: { S: epkPublicPartition }, tourId: { S: publicId } };
  let previousKit = {};
  try { previousKit = JSON.parse(existing.Item?.plan?.S || "{}"); } catch { previousKit = {}; }
  const retained = new Set((kit.media || []).map(item => item.key));
  const removedKeys = (previousKit.media || []).map(item => item?.key || "").filter(key => epkMediaPattern(ownerPrefix).test(key) && !retained.has(key));
  const pendingMediaCleanup = [...new Set([...(existing.Item?.mediaCleanup?.SS || []), ...removedKeys])];
  const ownerValues = {
    ":name": { S: `${kit.artistName} EPK` },
    ":plan": { S: plan },
    ":publicId": { S: publicId },
    ":published": { BOOL: publish },
    ":updated": { S: nowIso }
  };
  let ownerUpdate = "SET #name = :name, #plan = :plan, publicId = :publicId, published = :published, updatedAt = :updated";
  if (shareHash) { ownerUpdate += ", shareHash = :shareHash"; ownerValues[":shareHash"] = { S: shareHash }; }
  else ownerUpdate += " REMOVE shareHash";
  if (removedKeys.length) { ownerUpdate += " ADD mediaCleanup :mediaCleanup"; ownerValues[":mediaCleanup"] = { SS: [...new Set(removedKeys)] }; }
  await db.send(new TransactWriteItemsCommand({ TransactItems: [
    { Update: { TableName: toursTable, Key: ownerKey, UpdateExpression: ownerUpdate, ExpressionAttributeNames: { "#name": "name", "#plan": "plan" }, ExpressionAttributeValues: ownerValues } },
    publish
      ? { Put: { TableName: toursTable, Item: { ...publicKey, name: { S: `${kit.artistName} EPK` }, plan: { S: plan }, ownerId: { S: userId }, updatedAt: { S: nowIso } } } }
      : { Delete: { TableName: toursTable, Key: publicKey } },
    ...(shareHash ? [{ Put: { TableName: toursTable, Item: { userId: { S: epkSharePartition }, tourId: { S: publicId }, name: { S: `${kit.artistName} private EPK` }, plan: { S: plan }, shareHash: { S: shareHash }, ownerId: { S: userId }, updatedAt: { S: nowIso } } } }] : [])
  ] }));
  const cleanup = await cleanupEpkMediaObjects(ownerKey, ownerPrefix, pendingMediaCleanup, [...retained]);
  return reply(200, { publicId, published: publish, updatedAt: nowIso, cleanupPending: cleanup.pending });
}

async function publicEpk(event, publicId) {
  const headers = corsHeaders(event.headers?.origin);
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin) || !/^[a-z0-9-]{3,64}$/i.test(publicId)) return reply(404, { error: "EPK not found." });
  const result = await db.send(new GetItemCommand({ TableName: toursTable, Key: { userId: { S: epkPublicPartition }, tourId: { S: publicId } } }));
  if (!result.Item) return reply(404, { error: "EPK not found." });
  return reply(200, { kit: epkForViewer(JSON.parse(result.Item.plan?.S || "{}"), true), updatedAt: result.Item.updatedAt?.S || "" });
}

async function privateEpkShare(event, method, publicId = "") {
  const headers = corsHeaders(event.headers?.origin);
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(404, { error: "EPK not found." });
  if (publicId) {
    const token = String(parseJsonBody(event)?.token || "");
    if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-z0-9-]{3,64}$/i.test(publicId)) return reply(404, { error: "Private EPK link is invalid or has been revoked." });
    const result = await db.send(new GetItemCommand({ TableName: toursTable, Key: { userId: { S: epkSharePartition }, tourId: { S: publicId } }, ConsistentRead: true }));
    const storedHash = result.Item?.shareHash?.S || "";
    if (!epkShareTokenMatches(token, storedHash)) return reply(404, { error: "Private EPK link is invalid or has been revoked." });
    return reply(200, { kit: epkForViewer(JSON.parse(result.Item.plan?.S || "{}"), false, false), private: true, updatedAt: result.Item.updatedAt?.S || "" });
  }
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const ownerKey = { userId: { S: userId }, tourId: { S: epkWorkspaceId } };
  const existing = await db.send(new GetItemCommand({ TableName: toursTable, Key: ownerKey, ConsistentRead: true }));
  if (!existing.Item) return reply(404, { error: "Save the EPK before creating a private review link." });
  const data = parseJsonBody(event), action = String(data?.action || "");
  const id = /^[a-z0-9-]{3,64}$/.test(existing.Item.publicId?.S || "") ? existing.Item.publicId.S : "";
  if (!id) return reply(409, { error: "Save the EPK before creating a private review link." });
  const shareKey = { userId: { S: epkSharePartition }, tourId: { S: id } };
  if (action === "revoke") {
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Update: { TableName: toursTable, Key: ownerKey, UpdateExpression: "REMOVE shareHash", ConditionExpression: "attribute_exists(userId)" } },
      { Delete: { TableName: toursTable, Key: shareKey } }
    ] }));
    return reply(200, { privateShared: false });
  }
  if (action !== "create") return reply(400, { error: "Choose create or revoke." });
  const token = randomValue(), shareHash = sha256(`epk-share:${token}`), nowIso = new Date().toISOString();
  await db.send(new TransactWriteItemsCommand({ TransactItems: [
    { Update: { TableName: toursTable, Key: ownerKey, UpdateExpression: "SET shareHash = :hash, updatedAt = :updated", ConditionExpression: "attribute_exists(userId)", ExpressionAttributeValues: { ":hash": { S: shareHash }, ":updated": { S: nowIso } } } },
    { Put: { TableName: toursTable, Item: { ...shareKey, name: { S: `${existing.Item.name?.S || "Private EPK"} review` }, plan: { S: existing.Item.plan?.S || "{}" }, shareHash: { S: shareHash }, ownerId: { S: userId }, updatedAt: { S: nowIso } } } }
  ] }));
  return reply(200, { privateShared: true, publicId: id, token });
}

async function outreachEpkShare(event, method, shareId = "") {
  const headers = { ...corsHeaders(event.headers?.origin), "cache-control": "no-store, private", pragma: "no-cache" };
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(404, { error: "EPK not found." });
  if (shareId) {
    const data = parseJsonBody(event), token = String(data?.token || ""), openId = String(data?.openId || "");
    if (!/^[a-f0-9]{32}$/.test(shareId) || !/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9-]{16,100}$/i.test(openId)) return reply(404, { error: "This booking EPK link is invalid or has expired." });
    let result = await db.send(new GetItemCommand({ TableName: toursTable, Key: { userId: { S: epkOutreachPartition }, tourId: { S: shareId } }, ConsistentRead: true }));
    let item = result.Item;
    if (!item || Number(item.expiresAt?.N || 0) <= now() || !epkOutreachTokenMatches(token, item.shareHash?.S || "")) return reply(404, { error: "This booking EPK link is invalid or has expired." });
    const openedAt = new Date().toISOString(), openHash = sha256(`epk-open:${shareId}:${openId}`), ownerId = item.ownerId?.S || "", outreachId = item.outreachId?.S || "";
    if (!ownerId || !/^[a-zA-Z0-9_-]{16,100}$/.test(outreachId)) return reply(404, { error: "This booking EPK link is invalid or has expired." });
    const values = { ":zero": { N: "0" }, ":one": { N: "1" }, ":opened": { S: openedAt }, ":hash": { S: openHash } };
    try {
      await db.send(new TransactWriteItemsCommand({ TransactItems: [
        { Update: { TableName: toursTable, Key: { userId: { S: epkOutreachPartition }, tourId: { S: shareId } }, UpdateExpression: "SET openCount = if_not_exists(openCount, :zero) + :one, firstOpenedAt = if_not_exists(firstOpenedAt, :opened), lastOpenedAt = :opened, lastOpenHash = :hash", ConditionExpression: "attribute_not_exists(lastOpenHash) OR lastOpenHash <> :hash", ExpressionAttributeValues: values } },
        { Update: { TableName: toursTable, Key: { userId: { S: ownerId }, tourId: { S: `${epkOutreachPrefix}${outreachId}` } }, UpdateExpression: "SET openCount = if_not_exists(openCount, :zero) + :one, firstOpenedAt = if_not_exists(firstOpenedAt, :opened), lastOpenedAt = :opened", ConditionExpression: "shareId = :shareId", ExpressionAttributeValues: { ":zero": values[":zero"], ":one": values[":one"], ":opened": values[":opened"], ":shareId": { S: shareId } } } }
      ] }));
    } catch (error) {
      if (error.name !== "TransactionCanceledException" && error.name !== "ConditionalCheckFailedException") throw error;
    }
    result = await db.send(new GetItemCommand({ TableName: toursTable, Key: { userId: { S: epkOutreachPartition }, tourId: { S: shareId } }, ConsistentRead: true }));
    item = result.Item;
    if (!item || Number(item.expiresAt?.N || 0) <= now() || !epkOutreachTokenMatches(token, item.shareHash?.S || "")) return reply(404, { error: "This booking EPK link is invalid or has expired." });
    return reply(200, {
      kit: epkForViewer(JSON.parse(item.plan?.S || "{}"), true, false, item.allowPdf?.BOOL === true),
      private: true,
      bookingShare: true,
      permissions: { allowPdf: item.allowPdf?.BOOL === true },
      disclosure: "The artist can see that this venue link was opened and when. DanzStak does not store who viewed it.",
      expiresAt: new Date(Number(item.expiresAt.N) * 1000).toISOString(),
      updatedAt: item.epkUpdatedAt?.S || ""
    });
  }

  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  if (method === "GET") {
    const items = await queryAll({ TableName: toursTable, KeyConditionExpression: "userId = :user AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":user": { S: userId }, ":prefix": { S: epkOutreachPrefix } }, ConsistentRead: true }, 500);
    return reply(200, { shares: items.map(item => ({ outreachId: String(item.outreachId?.S || item.tourId?.S?.slice(epkOutreachPrefix.length) || ""), venueKey: item.venueKey?.S || "", venueName: item.venueName?.S || "Venue", shareId: item.shareId?.S || "", openCount: Number(item.openCount?.N || 0), firstOpenedAt: item.firstOpenedAt?.S || "", lastOpenedAt: item.lastOpenedAt?.S || "", expiresAt: item.expiresAt?.N ? new Date(Number(item.expiresAt.N) * 1000).toISOString() : "", revoked: item.revoked?.BOOL === true })) });
  }
  const data = parseJsonBody(event), action = String(data?.action || "create"), venueKey = String(data?.venueKey || "").trim(), outreachId = String(data?.outreachId || "").trim();
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(outreachId) || !venueKey || venueKey.length > 240) return reply(400, { error: "Choose a saved venue and a valid outreach draft." });
  const ownerKey = { userId: { S: userId }, tourId: { S: epkWorkspaceId } }, mapKey = { userId: { S: userId }, tourId: { S: `${epkOutreachPrefix}${outreachId}` } };
  const [epkResult, workspaceResult, priorResult] = await Promise.all([
    db.send(new GetItemCommand({ TableName: toursTable, Key: ownerKey, ConsistentRead: true })),
    db.send(new GetItemCommand({ TableName: toursTable, Key: { userId: { S: userId }, tourId: { S: bookingWorkspaceId } }, ConsistentRead: true })),
    db.send(new GetItemCommand({ TableName: toursTable, Key: mapKey, ConsistentRead: true }))
  ]);
  if (!epkResult.Item || epkResult.Item.published?.BOOL !== true) return reply(409, { error: "Publish the EPK before creating a venue link." });
  let workspace = {}; try { workspace = JSON.parse(workspaceResult.Item?.plan?.S || "{}"); } catch { workspace = {}; }
  const venue = (workspace.venues || []).find(item => item?.venueKey === venueKey);
  if (!venue) return reply(404, { error: "Save this venue in the booking workspace first." });
  const oldShareId = priorResult.Item?.shareId?.S || "";
  if (action === "revoke") {
    if (!/^[a-f0-9]{32}$/.test(oldShareId)) return reply(200, { revoked: false });
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Delete: { TableName: toursTable, Key: mapKey } },
      { Delete: { TableName: toursTable, Key: { userId: { S: epkOutreachPartition }, tourId: { S: oldShareId } } } }
    ] }));
    return reply(200, { revoked: true });
  }
  if (action !== "create") return reply(400, { error: "Choose create or revoke." });
  const token = randomValue(), newShareId = randomBytes(16).toString("hex"), shareHash = sha256(`epk-outreach:${token}`), createdAt = new Date().toISOString(), expiresAt = now() + 45 * 86400, allowPdf = data?.allowPdf === true;
  const publicItem = { userId: { S: epkOutreachPartition }, tourId: { S: newShareId }, ownerId: { S: userId }, outreachId: { S: outreachId }, venueKey: { S: venueKey }, venueName: { S: String(venue.name || "Venue").slice(0, 160) }, plan: { S: epkResult.Item.plan?.S || "{}" }, shareHash: { S: shareHash }, epkUpdatedAt: { S: epkResult.Item.updatedAt?.S || createdAt }, allowPdf: { BOOL: allowPdf }, openCount: { N: "0" }, createdAt: { S: createdAt }, expiresAt: { N: String(expiresAt) } };
  const ownerItem = { ...mapKey, outreachId: { S: outreachId }, shareId: { S: newShareId }, venueKey: { S: venueKey }, venueName: publicItem.venueName, allowPdf: { BOOL: allowPdf }, openCount: { N: "0" }, createdAt: { S: createdAt }, expiresAt: { N: String(expiresAt) } };
  const transaction = [
    { Put: { TableName: toursTable, Item: publicItem } },
    { Put: { TableName: toursTable, Item: ownerItem } }
  ];
  if (/^[a-f0-9]{32}$/.test(oldShareId) && oldShareId !== newShareId) transaction.push({ Delete: { TableName: toursTable, Key: { userId: { S: epkOutreachPartition }, tourId: { S: oldShareId } } } });
  await db.send(new TransactWriteItemsCommand({ TransactItems: transaction }));
  return reply(200, { outreachId, venueKey, shareId: newShareId, shareUrl: `https://danzstak.com/epk.html?outreach=${newShareId}#token=${token}`, expiresAt: new Date(expiresAt * 1000).toISOString(), permissions: { allowPdf } });
}

function reviewTargetsFromPublishedEpk(item) {
  if (!item?.ownerId?.S || !item?.plan?.S) return [];
  let kit;
  try { kit = JSON.parse(item.plan.S); } catch { return []; }
  const artistUserId = item.ownerId.S, artistName = String(kit.artistName || "Artist").trim().slice(0, 120);
  const makeTargets = (targetType, values) => {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).slice(0, 20).map(value => {
      const label = typeof value === "string" ? value.trim().slice(0, 300) : "";
      const normalized = label.toLowerCase();
      if (!label || seen.has(normalized)) return null;
      seen.add(normalized);
      const targetId = reviewTargetId(targetType, artistUserId, label);
      return targetId ? { targetType, targetId, artistUserId, artistName, title: label, detail: targetType === "show" ? "Show" : "Release" } : null;
    }).filter(Boolean);
  };
  return [
    ...makeTargets("show", kit.notableShows),
    ...makeTargets("release", kit.releases)
  ];
}

async function publishedReviewTargets(publicId) {
  if (!/^[a-z0-9-]{3,64}$/.test(publicId)) return [];
  const result = await db.send(new GetItemCommand({
    TableName: toursTable,
    Key: { userId: { S: epkPublicPartition }, tourId: { S: publicId } },
    ConsistentRead: true
  }));
  return reviewTargetsFromPublishedEpk(result.Item);
}

async function reviewableTargets(event) {
  const headers = corsHeaders(event.headers?.origin), reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  const publicId = String(event.queryStringParameters?.artist || "").trim().toLowerCase();
  const targets = await publishedReviewTargets(publicId);
  if (!targets.length) return reply(404, { error: "This artist has no published shows or releases available for review." });
  if (userId) {
    const viewerEmail = await accountForSub(userId), artistEmail = await accountForSub(targets[0].artistUserId);
    if (!viewerEmail || !artistEmail || await isBlockedPair(viewerEmail, artistEmail)) return reply(404, { error: "Review targets are not available." });
  }
  return reply(200, { artistPublicId: publicId, artistName: targets[0].artistName, canReview: Boolean(userId && userId !== targets[0].artistUserId), targets: targets.map(({ artistUserId: _artistUserId, ...target }) => target) });
}

function reviewRecordKeys(review) {
  const suffix = `${review.createdAt}#${review.reviewId}`;
  return [
    { pk: { S: `REVIEW#${review.reviewId}` }, sk: { S: "META" } },
    { pk: { S: `UNIQUE#${review.authorUserId}#${review.targetType}#${review.targetId}` }, sk: { S: "LOCK" } },
    { pk: { S: "REVIEWS" }, sk: { S: suffix } },
    { pk: { S: `TARGET#${review.targetType}#${review.targetId}` }, sk: { S: suffix } },
    { pk: { S: `ARTIST#${review.artistUserId}` }, sk: { S: suffix } },
    { pk: { S: `AUTHOR#${review.authorUserId}` }, sk: { S: suffix } }
  ];
}

async function reviewItemsByKeys(keys) {
  const ordered = [], lookup = new Map();
  for (let offset = 0; offset < keys.length; offset += 100) {
    let pending = keys.slice(offset, offset + 100).map(reviewId => ({ pk: { S: `REVIEW#${reviewId}` }, sk: { S: "META" } }));
    for (let attempt = 0; pending.length && attempt < 4; attempt += 1) {
      const result = await db.send(new BatchGetItemCommand({ RequestItems: { [reviewsTable]: { Keys: pending, ConsistentRead: true } } }));
      for (const item of result.Responses?.[reviewsTable] || []) lookup.set(item.reviewId?.S || "", item);
      pending = result.UnprocessedKeys?.[reviewsTable]?.Keys || [];
    }
  }
  for (const id of keys) if (lookup.has(id)) ordered.push(lookup.get(id));
  return ordered;
}

async function visibleReviewViews(items, viewerId, surface = "") {
  const viewerEmail = viewerId ? await accountForSub(viewerId) : "";
  if (viewerId && !viewerEmail) return [];
  const views = [], emailByUser = new Map(viewerId ? [[viewerId, viewerEmail]] : []), targetsByArtist = new Map();
  const emailFor = async userId => {
    if (!emailByUser.has(userId)) emailByUser.set(userId, await accountForSub(userId));
    return emailByUser.get(userId);
  };
  for (const item of items) {
    if (surface && item.hiddenPlacements?.SS?.includes(surface)) continue;
    const view = reviewEntityToView(item);
    if (!view) continue;
    if (!targetsByArtist.has(view.artistPublicId)) targetsByArtist.set(view.artistPublicId, await publishedReviewTargets(view.artistPublicId));
    if (!targetsByArtist.get(view.artistPublicId).some(target => target.targetType === view.targetType && target.targetId === view.targetId)) continue;
    const authorEmail = await emailFor(view.authorUserId), artistEmail = await emailFor(view.artistUserId);
    if (!authorEmail || !artistEmail) continue;
    if (viewerEmail && (await isBlockedPair(viewerEmail, authorEmail) || await isBlockedPair(viewerEmail, artistEmail))) continue;
    const profile = await db.send(new GetItemCommand({ TableName: settingsTable, Key: { userEmail: { S: authorEmail } }, ProjectionExpression: "profileName, profileAvatarKey", ConsistentRead: true }));
    views.push({ ...view, authorName: String(profile.Item?.profileName?.S || "DanzStak member").slice(0, 80), authorAvatar: profile.Item?.profileAvatarKey?.S ? signedMediaUrl(profile.Item.profileAvatarKey.S, 3600) : "", ownedByViewer: view.authorUserId === viewerId });
  }
  return views;
}

async function listReviews(event) {
  const headers = corsHeaders(event.headers?.origin), reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  const targetType = String(event.queryStringParameters?.targetType || "").trim().toLowerCase();
  const targetId = String(event.queryStringParameters?.targetId || "").trim().toLowerCase();
  const artistPublicId = String(event.queryStringParameters?.artist || "").trim().toLowerCase();
  const surface = new Set(["epk", "news", "mix", "target"]).has(String(event.queryStringParameters?.surface || "").trim().toLowerCase()) ? String(event.queryStringParameters.surface).trim().toLowerCase() : "";
  let partition = "REVIEWS";
  if (targetType || targetId) {
    if (!reviewTargetTypes.has(targetType) || !reviewIdPattern.test(targetId)) return reply(400, { error: "Choose a valid show or release." });
    partition = `TARGET#${targetType}#${targetId}`;
  } else if (artistPublicId) {
    const targets = await publishedReviewTargets(artistPublicId);
    if (!targets.length) return reply(404, { error: "Artist not found." });
    partition = `ARTIST#${targets[0].artistUserId}`;
  }
  const result = await db.send(new QueryCommand({ TableName: reviewsTable, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": { S: partition } }, ProjectionExpression: "reviewId", ScanIndexForward: false, Limit: 50, ConsistentRead: true }));
  const reviewIds = (result.Items || []).map(item => item.reviewId?.S || "").filter(reviewId => reviewIdPattern.test(reviewId));
  return reply(200, { reviews: await visibleReviewViews(await reviewItemsByKeys(reviewIds), userId, surface) });
}

async function createReview(event) {
  const headers = corsHeaders(event.headers?.origin), reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const authorUserId = await getAuthenticatedUser(event);
  if (!authorUserId) return reply(401, { error: "Authentication required." });
  const draft = cleanReviewDraft(parseJsonBody(event));
  if (!draft) return reply(400, { error: "Choose a published show or release and write a review between 10 and 5,000 characters. Review media is not available yet." });
  const targets = await publishedReviewTargets(draft.artistPublicId), target = targets.find(item => item.targetType === draft.targetType && item.targetId === draft.targetId);
  if (!target) return reply(404, { error: "That show or release is no longer available for review." });
  if (target.artistUserId === authorUserId) return reply(403, { error: "Artists cannot review their own show or release." });
  const [authorEmail, artistEmail] = await Promise.all([accountForSub(authorUserId), accountForSub(target.artistUserId)]);
  if (!authorEmail || !artistEmail) return reply(409, { error: "The member accounts could not be verified." });
  if (await isBlockedPair(authorEmail, artistEmail)) return reply(403, { error: "You cannot review this artist." });
  const reviewId = sha256(`review:${authorUserId}:${target.targetType}:${target.targetId}`).slice(0, 32), createdAt = new Date().toISOString();
  const review = { reviewId, authorUserId, artistUserId: target.artistUserId, artistPublicId: draft.artistPublicId, targetType: target.targetType, targetId: target.targetId, targetTitle: target.title, targetDetail: target.detail, body: draft.body, createdAt, updatedAt: createdAt };
  const [entityKey, uniqueKey, ...indexKeys] = reviewRecordKeys(review);
  const entity = { ...entityKey, entityType: { S: "review" }, reviewId: { S: reviewId }, authorUserId: { S: authorUserId }, artistUserId: { S: target.artistUserId }, artistPublicId: { S: draft.artistPublicId }, targetType: { S: target.targetType }, targetId: { S: target.targetId }, targetTitle: { S: target.title }, targetDetail: { S: target.detail }, body: { S: draft.body }, createdAt: { S: createdAt }, updatedAt: { S: createdAt } };
  const indexItem = key => ({ ...key, entityType: { S: "review-index" }, reviewId: { S: reviewId }, createdAt: { S: createdAt } });
  try {
    await db.send(new TransactWriteItemsCommand({ TransactItems: [
      { Put: { TableName: reviewsTable, Item: entity, ConditionExpression: "attribute_not_exists(pk)" } },
      { Put: { TableName: reviewsTable, Item: { ...uniqueKey, entityType: { S: "review-unique" }, reviewId: { S: reviewId } }, ConditionExpression: "attribute_not_exists(pk)" } },
      ...indexKeys.map(key => ({ Put: { TableName: reviewsTable, Item: indexItem(key), ConditionExpression: "attribute_not_exists(pk)" } }))
    ] }));
  } catch (error) {
    if (error.name === "TransactionCanceledException" || error.name === "ConditionalCheckFailedException") return reply(409, { error: "You already reviewed this show or release. Edit your existing review instead." });
    throw error;
  }
  return reply(201, { review: { ...review, authorName: "You", authorAvatar: "", ownedByViewer: true } });
}

async function updateReview(event, reviewId) {
  const headers = corsHeaders(event.headers?.origin), reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const data = parseJsonBody(event), body = data?.body;
  if (data?.action === "remove_from_here") {
    const surface = String(data.surface || "").trim().toLowerCase();
    if (!new Set(["epk", "news", "mix", "target"]).has(surface)) return reply(400, { error: "Choose where to remove this review." });
    try {
      await db.send(new UpdateItemCommand({ TableName: reviewsTable, Key: { pk: { S: `REVIEW#${reviewId}` }, sk: { S: "META" } }, UpdateExpression: "SET updatedAt = :updated ADD hiddenPlacements :surface", ConditionExpression: "authorUserId = :author", ExpressionAttributeValues: { ":surface": { SS: [surface] }, ":updated": { S: new Date().toISOString() }, ":author": { S: userId } } }));
      return reply(200, { removedFrom: surface, reviewId });
    } catch (error) {
      if (error.name === "ConditionalCheckFailedException") return reply(404, { error: "Review not found." });
      throw error;
    }
  }
  if (typeof body !== "string" || body.trim().length < 10 || body.trim().length > 5000 || Buffer.byteLength(body.trim(), "utf8") > 12000) return reply(400, { error: "Write a review between 10 and 5,000 characters." });
  try {
    const result = await db.send(new UpdateItemCommand({ TableName: reviewsTable, Key: { pk: { S: `REVIEW#${reviewId}` }, sk: { S: "META" } }, UpdateExpression: "SET body = :body, updatedAt = :updated", ConditionExpression: "authorUserId = :author", ExpressionAttributeValues: { ":body": { S: body.trim() }, ":updated": { S: new Date().toISOString() }, ":author": { S: userId } }, ReturnValues: "ALL_NEW" }));
    return reply(200, { review: { ...reviewEntityToView(result.Attributes), ownedByViewer: true } });
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return reply(404, { error: "Review not found." });
    throw error;
  }
}

async function deleteReview(event, reviewId) {
  const headers = corsHeaders(event.headers?.origin), reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const result = await db.send(new GetItemCommand({ TableName: reviewsTable, Key: { pk: { S: `REVIEW#${reviewId}` }, sk: { S: "META" } }, ConsistentRead: true }));
  const review = reviewEntityToView(result.Item);
  if (!review || review.authorUserId !== userId) return reply(404, { error: "Review not found." });
  const keys = reviewRecordKeys(review);
  await db.send(new TransactWriteItemsCommand({ TransactItems: keys.map(key => ({ Delete: { TableName: reviewsTable, Key: key } })) }));
  return reply(200, { deleted: true, reviewId });
}

const bookingPipelineStatuses = new Set(["Not contacted", "Email prepared", "Email sent", "Reply received", "Interested", "Negotiating", "Date proposed", "Confirmed", "Declined", "No response"]);
const legacyBookingStatuses = new Map([["Research", "Not contacted"], ["Ready to pitch", "Email prepared"], ["Contacted", "Email sent"], ["In conversation", "Reply received"], ["Hold", "Interested"]]);

function cleanTourBudget(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const number = (input, maximum = 1000000) => Math.max(0, Math.min(maximum, Number.isFinite(Number(input)) ? Number(input) : 0));
  const integer = (input, maximum = 10000) => Math.round(number(input, maximum));
  const text = (input, maximum = 120) => typeof input === "string" ? input.trim().slice(0, maximum) : "";
  const date = input => typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input) && !Number.isNaN(Date.parse(`${input}T12:00:00Z`)) ? input : "";
  const currency = /^[A-Z]{3}$/.test(String(source.currency || "").toUpperCase()) ? String(source.currency).toUpperCase() : "USD";
  const departOn = date(source.departOn), returnBy = date(source.returnBy);
  const durationDays = departOn && returnBy ? Math.max(1, Math.min(365, Math.floor((Date.parse(`${returnBy}T12:00:00Z`) - Date.parse(`${departOn}T12:00:00Z`)) / 86400000) + 1)) : Math.max(1, integer(source.durationDays, 365));
  return {
    name: text(source.name, 100), departOn, returnBy, durationDays,
    distanceKm: number(source.distanceKm, 200000), vehicleType: text(source.vehicleType, 80),
    fuelLitersPer100Km: number(source.fuelLitersPer100Km, 100), fuelPricePerLiter: number(source.fuelPricePerLiter, 100),
    tolls: number(source.tolls), parking: number(source.parking), vehicleRental: number(source.vehicleRental),
    nights: integer(source.nights, 365), rooms: integer(source.rooms, 100), roomRate: number(source.roomRate, 10000),
    people: Math.max(1, integer(source.people, 200)), mealPerPersonDay: number(source.mealPerPersonDay, 1000),
    equipment: number(source.equipment), crew: number(source.crew), miscellaneous: number(source.miscellaneous),
    contingencyPercent: Math.min(100, number(source.contingencyPercent, 100)),
    confirmedRevenue: number(source.confirmedRevenue, 10000000), potentialRevenue: number(source.potentialRevenue, 10000000), currency
  };
}

function tourBudgetEstimate(tour, bookingEmailCount = 0, venues = []) {
  const fuel = tour.distanceKm / 100 * tour.fuelLitersPer100Km * tour.fuelPricePerLiter;
  const accommodation = tour.nights * tour.rooms * tour.roomRate;
  const meals = tour.people * tour.durationDays * tour.mealPerPersonDay;
  const transportation = fuel + tour.tolls + tour.parking + tour.vehicleRental;
  const base = transportation + accommodation + meals + tour.equipment + tour.crew + tour.miscellaneous;
  const contingency = base * tour.contingencyPercent / 100;
  const bookingEmailsUsd = Math.max(0, Math.trunc(bookingEmailCount)) * 1.5;
  const bookingEmails = tour.currency === "USD" ? bookingEmailsUsd : 0;
  const fees = venues.filter(venue => venue.booking?.feeCurrency === tour.currency).map(venue => ({ status: legacyBookingStatuses.get(venue.booking?.stage) || venue.booking?.status || venue.booking?.stage || "Not contacted", amount: Math.max(0, Number(venue.booking?.performanceFee) || 0) }));
  const confirmedRevenue = Math.max(tour.confirmedRevenue, fees.filter(item => item.status === "Confirmed").reduce((sum, item) => sum + item.amount, 0));
  const potentialRevenue = Math.max(tour.potentialRevenue, fees.filter(item => !["Declined", "No response"].includes(item.status)).reduce((sum, item) => sum + item.amount, 0));
  const total = base + contingency + bookingEmails;
  return { fuel, transportation, accommodation, meals, contingency, bookingEmails, bookingEmailsUsd, total, confirmedRevenue, potentialRevenue, confirmedProfit: confirmedRevenue - total, potentialProfit: potentialRevenue - total, breakEvenRevenue: total, currency: tour.currency };
}

async function sentBookingEmailCount(userId) {
  const result = await db.send(new QueryCommand({ TableName: toursTable, KeyConditionExpression: "userId = :userId AND begins_with(tourId, :prefix)", ExpressionAttributeValues: { ":userId": { S: userId }, ":prefix": { S: "TOUR_MANAGER#EMAIL_SEND#" } }, ProjectionExpression: "#status", ExpressionAttributeNames: { "#status": "status" }, ConsistentRead: true, Limit: 500 }));
  return (result.Items || []).filter(item => item.status?.S === "sent").length;
}

async function bookingWorkspace(event, method) {
  const headers = corsHeaders(event.headers?.origin);
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const Key = { userId: { S: userId }, tourId: { S: bookingWorkspaceId } };
  if (method === "GET") {
    const result = await db.send(new GetItemCommand({ TableName: toursTable, Key, ConsistentRead: true }));
    const bookingEmailCount = await sentBookingEmailCount(userId);
    if (!result.Item) return reply(200, { venues: [], artist: {}, tour: cleanTourBudget({}), estimate: tourBudgetEstimate(cleanTourBudget({}), bookingEmailCount), revision: "" });
    const saved = JSON.parse(result.Item.plan.S), tour = cleanTourBudget(saved.tour);
    return reply(200, { ...saved, tour, estimate: tourBudgetEstimate(tour, bookingEmailCount, saved.venues || []), revision: result.Item.revision?.S || "" });
  }
  const data = parseJsonBody(event);
  if (!data || !Array.isArray(data.venues) || data.venues.length > 100 || typeof data.revision !== "string") return reply(400, { error: "Provide up to 100 venues and the loaded revision." });
  const text = (value, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const https = value => /^https:\/\//i.test(text(value, 600)) ? text(value, 600) : "";
  const list = (value, clean) => Array.isArray(value) ? value.slice(0, 8).map(clean).filter(Boolean) : [];
  const date = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : "";
  const timestamp = value => typeof value === "string" && /^\d{4}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : "";
  let invalidConfirmation = false;
  const venues = data.venues.map(v => {
    if (!v || typeof v !== "object" || !text(v.name)) return null;
    const b = v.booking || {};
    const sources = Array.isArray(v.sources) ? v.sources.slice(0, 6).map(source => source && typeof source === "object" ? { name: text(source.name, 120), url: https(source.url) } : null).filter(source => source?.name) : [];
    const requestedStatus = legacyBookingStatuses.get(b.stage) || b.status || b.stage;
    const status = bookingPipelineStatuses.has(requestedStatus) ? requestedStatus : "Not contacted";
    const showDate = date(b.showDate), confirmationEvidence = text(b.confirmationEvidence, 3000);
    if (status === "Confirmed" && (!showDate || !confirmationEvidence)) invalidConfirmation = true;
    return { name: text(v.name, 160), address: text(v.address), venueKey: text(v.venueKey), categories: list(v.categories, x => text(x, 80)), websites: list(v.websites, https), emails: list(v.emails, x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) ? text(x, 254) : ""), phones: list(v.phones, x => text(x, 30)), sourceUrl: https(v.sourceUrl), sourceName: text(v.sourceName), sources, activityEvidence: text(v.activityEvidence, 1000), discoveredAt: timestamp(v.discoveredAt), imageUrl: https(v.imageUrl), ...(Array.isArray(v.position) && v.position.length === 2 && v.position.every(Number.isFinite) && Math.abs(v.position[0]) <= 180 && Math.abs(v.position[1]) <= 90 ? { position: v.position } : {}), booking: { status, showDate, dateEnd: date(b.dateEnd), followUp: date(b.followUp), performanceFee: Math.max(0, Math.min(10000000, Number(b.performanceFee) || 0)), feeCurrency: /^[A-Z]{3}$/.test(String(b.feeCurrency || "").toUpperCase()) ? String(b.feeCurrency).toUpperCase() : "USD", deal: text(b.deal, 2000), replySummary: text(b.replySummary, 3000), confirmationEvidence, notes: text(b.notes, 2000), pitchTemplate: ["band", "dj", "festival"].includes(String(b.pitchTemplate)) ? String(b.pitchTemplate) : "band", expectedDraw: Math.max(0, Math.min(100000, Number(b.expectedDraw) || 0)), setDetails: text(b.setDetails, 300), allowEpkPdfDownload: b.allowEpkPdfDownload === true, outreachSubject: text(b.outreachSubject, 180), outreachDraft: text(b.outreachDraft, 5000) } };
  });
  if (venues.some(v => !v)) return reply(400, { error: "Each venue needs a name." });
  if (invalidConfirmation) return reply(400, { error: "A confirmed performance requires a show date and written confirmation evidence." });
  const a = data.artist || {};
  const tour = cleanTourBudget(data.tour), bookingEmailCount = await sentBookingEmailCount(userId);
  const estimate = tourBudgetEstimate(tour, bookingEmailCount, venues);
  const plan = JSON.stringify({ venues, artist: { name: text(a.name, 100), genre: text(a.genre, 100), hometown: text(a.hometown, 160), epk: https(a.epk), pitch: text(a.pitch, 1000) }, tour });
  if (Buffer.byteLength(plan, "utf8") > 250000) return reply(400, { error: "Workspace is too large. Export a copy and reduce the list." });
  const revision = randomUUID();
  try {
    await db.send(new PutItemCommand({ TableName: toursTable, Item: { ...Key, name: { S: "Booking workspace" }, plan: { S: plan }, revision: { S: revision }, updatedAt: { S: new Date().toISOString() } }, ConditionExpression: data.revision ? "revision = :revision" : "attribute_not_exists(userId)", ...(data.revision ? { ExpressionAttributeValues: { ":revision": { S: data.revision } } } : {}) }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return reply(409, { error: "Another device saved changes. Export your work, then reload the account workspace before saving." });
    throw error;
  }
  return reply(200, { revision, estimate });
}

async function bookingIdentity(event) {
  const headers = corsHeaders(event.headers?.origin);
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const data = parseJsonBody(event);
  if (!data || typeof data !== "object" || Array.isArray(data) || typeof data.revision !== "string") return reply(400, { error: "Provide the loaded booking revision." });
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 100) : null;
  const hometown = typeof data.hometown === "string" ? data.hometown.trim().slice(0, 160) : null;
  if (name === null || hometown === null || !hometown) return reply(400, { error: "Add a valid home city before saving." });
  const Key = { userId: { S: userId }, tourId: { S: bookingWorkspaceId } };
  const current = await db.send(new GetItemCommand({ TableName: toursTable, Key, ConsistentRead: true }));
  const currentRevision = current.Item?.revision?.S || "";
  if (currentRevision !== data.revision) return reply(409, { error: "Your booking details changed on another device. Reload them before saving." });
  let saved = {};
  try { saved = current.Item?.plan?.S ? JSON.parse(current.Item.plan.S) : {}; } catch { return reply(409, { error: "Your saved booking workspace needs to be reloaded before editing." }); }
  const plan = JSON.stringify({
    venues: Array.isArray(saved.venues) ? saved.venues : [],
    artist: { ...(saved.artist && typeof saved.artist === "object" && !Array.isArray(saved.artist) ? saved.artist : {}), name, hometown },
    tour: saved.tour && typeof saved.tour === "object" && !Array.isArray(saved.tour) ? saved.tour : cleanTourBudget({})
  });
  if (Buffer.byteLength(plan, "utf8") > 250000) return reply(400, { error: "Workspace is too large. Export a copy and reduce the list." });
  const revision = randomUUID(), timestamp = new Date().toISOString();
  try {
    await db.send(new PutItemCommand({
      TableName: toursTable,
      Item: { ...(current.Item || {}), ...Key, name: { S: "Booking workspace" }, plan: { S: plan }, revision: { S: revision }, updatedAt: { S: timestamp } },
      ConditionExpression: currentRevision ? "revision = :revision" : "attribute_not_exists(userId)",
      ...(currentRevision ? { ExpressionAttributeValues: { ":revision": { S: currentRevision } } } : {})
    }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return reply(409, { error: "Your booking details changed on another device. Reload them before saving." });
    throw error;
  }
  return reply(200, { artist: { name, hometown }, revision, updatedAt: timestamp });
}

async function saveTourPlan(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const data = parseJsonBody(event);
  if (!data || typeof data !== "object" || Array.isArray(data)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON request." }) };
  const name = String(data.name || "").trim().slice(0, 100), artist = String(data.artist || "").trim().slice(0, 100), tourId = /^[0-9a-f-]{36}$/i.test(String(data.tourId || "")) ? String(data.tourId) : randomUUID();
  const requestedActType = String(data.actType || "").trim().toLowerCase(), requestedGenre = String(data.genre || "").trim(), requestedVenueType = String(data.venueType || "any").trim().toLowerCase();
  const actType = tourActTypes.has(requestedActType) ? requestedActType : "band", genre = tourGenres.has(requestedGenre) ? requestedGenre : "DIY Punk", venueType = new Set(["any", "diy", "bar", "club", "hall"]).has(requestedVenueType) ? requestedVenueType : "any";
  const start = String(data.start || "").trim().slice(0, 160), direction = String(data.direction || "").trim().toLowerCase(), departOn = String(data.departOn || "").trim(), returnBy = String(data.returnBy || "").trim();
  const days = Math.max(1, Math.min(180, Math.trunc(Number(data.days) || 0))), distanceMiles = Math.max(0, Math.min(100000, Math.round(Number(data.distanceMiles) || 0)));
  const markets = Array.isArray(data.markets) ? data.markets.slice(0, 24).map(cleanTourMarket) : [];
  if (!name || !start || !days || markets.some(market => !market) || (departOn && !/^\d{4}-\d{2}-\d{2}$/.test(departOn)) || (returnBy && !/^\d{4}-\d{2}-\d{2}$/.test(returnBy))) return { statusCode: 400, headers, body: JSON.stringify({ error: "Tour name, starting city, dates, and stops must be valid." }) };
  const nowIso = new Date().toISOString(), plan = { name, artist, actType, genre, venueType, start, direction: tourDirections.has(direction) ? direction : "custom", departOn, returnBy, days, distanceMiles, markets };
  await db.send(new PutItemCommand({ TableName: toursTable, Item: { userId: { S: userId }, tourId: { S: tourId }, name: { S: name }, plan: { S: JSON.stringify(plan) }, createdAt: { S: nowIso }, updatedAt: { S: nowIso } } }));
  return { statusCode: 200, headers, body: JSON.stringify({ tourId, updatedAt: nowIso }) };
}

async function listTourPlans(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const result = await db.send(new QueryCommand({ TableName: toursTable, KeyConditionExpression: "userId = :userId", ExpressionAttributeValues: { ":userId": { S: userId } }, ProjectionExpression: "tourId, #name, #plan, updatedAt", ExpressionAttributeNames: { "#name": "name", "#plan": "plan" }, Limit: 50, ScanIndexForward: false }));
  const reservedWorkspaceIds = new Set([bookingWorkspaceId, epkWorkspaceId, recordStoreWorkspaceId]);
  const tours = (result.Items || []).filter(item => {
    const id = item.tourId?.S || "";
    return !reservedWorkspaceIds.has(id) && !id.startsWith("TOUR_MANAGER#");
  }).map(item => { let plan = {}; try { plan = JSON.parse(item.plan?.S || "{}"); } catch { /* Ignore malformed legacy data. */ } return { tourId: item.tourId?.S || "", name: item.name?.S || "Tour", updatedAt: item.updatedAt?.S || "", plan }; });
  return { statusCode: 200, headers, body: JSON.stringify({ tours }) };
}

async function deleteTourPlan(event, tourId) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  if (!/^[0-9a-f-]{36}$/i.test(tourId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid tour identifier." }) };
  await db.send(new DeleteItemCommand({ TableName: toursTable, Key: { userId: { S: userId }, tourId: { S: tourId } } }));
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: true }) };
}

function accountSecurityOriginAllowed(event) {
  const origin = event.headers?.origin || event.headers?.Origin || "";
  const authorization = event.headers?.authorization || event.headers?.Authorization || "";
  return allowedOrigins.has(origin) || /^Bearer\s+[a-f0-9]{64}$/i.test(authorization);
}

function publicSessionDevice(item, currentDeviceId) {
  const deviceId = item?.deviceId?.S || "";
  return {
    deviceId,
    label: String(item?.deviceLabel?.S || "DanzStak session").slice(0, 80),
    current: Boolean(deviceId && deviceId === currentDeviceId),
    createdAt: Number(item?.createdAt?.N || 0),
    lastUsedAt: Number(item?.lastUsedAt?.N || 0),
    expiresAt: Number(item?.expiresAt?.N || 0)
  };
}

async function listAccountSessions(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = corsHeaders(origin);
  if (!accountSecurityOriginAllowed(event)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const authenticated = await getAuthenticatedSession(event, { touch: false });
  if (!authenticated) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const result = await db.send(new QueryCommand({
    TableName: sessionDevicesTable,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": { S: authenticated.userId } },
    Limit: 50,
    ConsistentRead: true
  }));
  const devices = (result.Items || [])
    .filter(item => Number(item.expiresAt?.N || 0) > now())
    .map(item => publicSessionDevice(item, authenticated.deviceId));
  if (authenticated.deviceId && !devices.some(device => device.current)) {
    devices.push({
      deviceId: authenticated.deviceId, label: authenticated.deviceLabel || "This device", current: true,
      createdAt: authenticated.createdAt, lastUsedAt: authenticated.lastUsedAt, expiresAt: authenticated.expiresAt
    });
  }
  devices.sort((first, second) => Number(second.current) - Number(first.current) || second.lastUsedAt - first.lastUsedAt);
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ devices, sessionLifetimeSeconds, recentAuthenticationSeconds })
  };
}

function recentAuthenticationRequired(authenticated, headers) {
  if (authenticated.authenticatedAt > now() - recentAuthenticationSeconds) return null;
  return {
    statusCode: 403,
    headers,
    body: JSON.stringify({
      error: "Sign in again before signing out another device.",
      reauthenticationRequired: true,
      reauthenticationUrl: "https://api.danzstak.com/auth/reauth"
    })
  };
}

async function revokeAccountSession(event, deviceId) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = corsHeaders(origin);
  if (!accountSecurityOriginAllowed(event)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  if (!/^[0-9a-f-]{36}$/i.test(deviceId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid device identifier." }) };
  const authenticated = await getAuthenticatedSession(event, { touch: false });
  if (!authenticated) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  if (deviceId === authenticated.deviceId) return { statusCode: 400, headers, body: JSON.stringify({ error: "Use Logout to sign out this device." }) };
  const reauthentication = recentAuthenticationRequired(authenticated, headers);
  if (reauthentication) return reauthentication;
  const key = { userId: { S: authenticated.userId }, deviceId: { S: deviceId } };
  const found = await db.send(new GetItemCommand({ TableName: sessionDevicesTable, Key: key, ConsistentRead: true }));
  const sessionHash = found.Item?.sessionHash?.S || "";
  if (!/^[a-f0-9]{64}$/.test(sessionHash)) {
    await db.send(new DeleteItemCommand({ TableName: sessionDevicesTable, Key: key }));
    return { statusCode: 200, headers, body: JSON.stringify({ revoked: true, alreadyInactive: true }) };
  }
  try {
    await db.send(new DeleteItemCommand({
      TableName: tableName,
      Key: { sessionId: { S: sessionHash } },
      ConditionExpression: "#type = :sessionType AND userId = :userId",
      ExpressionAttributeNames: { "#type": "type" },
      ExpressionAttributeValues: { ":sessionType": { S: "user_session" }, ":userId": { S: authenticated.userId } }
    }));
  } catch (error) {
    if (error?.name !== "ConditionalCheckFailedException") throw error;
  }
  await db.send(new DeleteItemCommand({ TableName: sessionDevicesTable, Key: key }));
  return { statusCode: 200, headers, body: JSON.stringify({ revoked: true }) };
}

async function revokeOtherAccountSessions(event) {
  const origin = event.headers?.origin || event.headers?.Origin;
  const headers = corsHeaders(origin);
  if (!accountSecurityOriginAllowed(event)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const contentType = event.headers?.["content-type"] || event.headers?.["Content-Type"] || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) return { statusCode: 415, headers, body: JSON.stringify({ error: "JSON content type required" }) };
  const authenticated = await getAuthenticatedSession(event, { touch: false });
  if (!authenticated) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const reauthentication = recentAuthenticationRequired(authenticated, headers);
  if (reauthentication) return reauthentication;
  const result = await db.send(new QueryCommand({
    TableName: sessionDevicesTable,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: { ":userId": { S: authenticated.userId } },
    Limit: 50,
    ConsistentRead: true
  }));
  let revoked = 0;
  for (const item of result.Items || []) {
    const deviceId = item.deviceId?.S || "";
    if (!deviceId || deviceId === authenticated.deviceId) continue;
    const sessionHash = item.sessionHash?.S || "";
    if (/^[a-f0-9]{64}$/.test(sessionHash)) {
      try {
        await db.send(new DeleteItemCommand({
          TableName: tableName, Key: { sessionId: { S: sessionHash } },
          ConditionExpression: "#type = :sessionType AND userId = :userId",
          ExpressionAttributeNames: { "#type": "type" },
          ExpressionAttributeValues: { ":sessionType": { S: "user_session" }, ":userId": { S: authenticated.userId } }
        }));
      } catch (error) {
        if (error?.name !== "ConditionalCheckFailedException") throw error;
      }
    }
    await db.send(new DeleteItemCommand({ TableName: sessionDevicesTable, Key: { userId: { S: authenticated.userId }, deviceId: { S: deviceId } } }));
    revoked += 1;
  }
  return { statusCode: 200, headers, body: JSON.stringify({ revoked }) };
}

// LOG OUT
async function logout(event) {
  const origin = event.headers?.origin;
  const headers = corsHeaders(origin);
  const authorization = event.headers?.authorization || event.headers?.Authorization || "";

  if (!allowedOrigins.has(origin) && !/^Bearer\s+[a-f0-9]{64}$/i.test(authorization)) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({
        error: "Forbidden origin"
      })
    };
  }

  const contentType =
    event.headers?.["content-type"] || "";

  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return {
      statusCode: 415,
      headers,
      body: JSON.stringify({
        error: "JSON content type required"
      })
    };
  }

  const sessionId = getSessionId(event);
  const authenticated = await getAuthenticatedSession(event, { touch: false });
  const userId = authenticated?.userId || null;
  const userEmail = userId ? await accountForSub(userId) : "";

  if (sessionId) {
    try {
      await db.send(new DeleteItemCommand({
        TableName: tableName,
        Key: {
          sessionId: { S: sha256(sessionId) }
        },
        ConditionExpression: "#t = :userSession",
        ExpressionAttributeNames: {
          "#t": "type"
        },
        ExpressionAttributeValues: {
          ":userSession": { S: "user_session" }
        }
      }));
    } catch (error) {
      if (
        error.name !== "ConditionalCheckFailedException"
      ) {
        throw error;
      }
    }
  }

  if (authenticated?.deviceId) {
    try {
      await db.send(new DeleteItemCommand({
        TableName: sessionDevicesTable,
        Key: { userId: { S: authenticated.userId }, deviceId: { S: authenticated.deviceId } }
      }));
    } catch (error) {
      console.error("Session device cleanup failed during logout", { errorName: error?.name || "Error" });
    }
  }

  if (userEmail) {
    try {
      await db.send(new DeleteItemCommand({
        TableName: presenceTable,
        Key: { email: { S: userEmail } }
      }));
    } catch (error) {
      console.error("Presence cleanup failed during logout:", error.name);
    }
  }

  return {
    statusCode: 200,
    headers,
    cookies: [clearCookie(sessionCookieName)],
    body: JSON.stringify({
      loggedOut: true
    })
  };
}

// API GATEWAY ROUTES
export const handler = async event => {
  const method = event?.requestContext?.http?.method;
  const path = event?.rawPath;

  try {
    if (Array.isArray(event?.Records) && event.Records.some(record => record?.EventSource === "aws:sns")) {
      return await tourManagerBilling(event);
    }

    if (event?.source === "danzstak.account-data-control" && event?.detail?.action === "process-account-deletions") {
      return await processAccountDeletionQueue(5);
    }
    if (path?.startsWith("/tour-manager/") || path?.startsWith("/phone-number/")) {
      if (method === "POST" && ["/tour-manager/stripe/webhook", "/tour-manager/checkout", "/tour-manager/contact-unlock/checkout", "/phone-number/checkout"].includes(path)) await ensureStripeSecrets();
      const billingResponse = await tourManagerBilling(event);
      if (billingResponse) return billingResponse;
    }

    if (method === "GET" && path === "/auth/login") {
      return await startLogin("login");
    }

    if (method === "GET" && path === "/auth/mobile-login") {
      return await startMobileLogin(event);
    }

    if (method === "POST" && path === "/auth/mobile-session") {
      return await exchangeMobileSession(event);
    }

    if (method === "GET" && path === "/auth/signup") {
      return await startSignup(event);
    }

    if (method === "POST" && path === "/auth/legal-acceptance") {
      return await acceptLegalTerms(event);
    }

    if (method === "GET" && path === "/auth/callback") {
      return await completeLogin(event);
    }

    if (method === "GET" && path === "/auth/session") {
      return await checkSession(event);
    }

    if (method === "GET" && path === "/auth/reauth") {
      const authenticated = await getAuthenticatedSession(event, { touch: false });
      if (!authenticated) return redirect(siteUrl + "/?signin=required");
      return await startLogin("reauth");
    }

    if (method === "GET" && path === "/auth/sessions") {
      return await listAccountSessions(event);
    }

    const accountSessionMatch = path?.match(/^\/auth\/sessions\/([0-9a-f-]{36})$/i);
    if (method === "DELETE" && accountSessionMatch) {
      return await revokeAccountSession(event, accountSessionMatch[1]);
    }

    if (method === "POST" && path === "/auth/sessions/revoke-others") {
      return await revokeOtherAccountSessions(event);
    }

    if (method === "GET" && path === "/auth/account-deletion/reauth") {
      return await startAccountDeletionReauth(event);
    }

    if (method === "GET" && path === "/account-deletion") {
      return await accountDeletionStatus(event);
    }

    if (method === "POST" && path === "/account-deletion") {
      return await requestAccountDeletion(event);
    }

    if (method === "DELETE" && path === "/account-deletion") {
      return await cancelAccountDeletion(event);
    }
    if (method === "GET" && path === "/account-export/media") {
      return await getAccountExportMedia(event);
    }

    if (method === "GET" && path === "/secure-posts") {
      return await getSecurePosts(event);
    }

    if (method === "POST" && path === "/secure-posts") {
      return await createSecurePost(event);
    }

    if (method === "DELETE" && path.startsWith("/secure-posts/")) {
      return await deleteSecurePost(event);
    }

    if (method === "PATCH" && path.startsWith("/secure-posts/")) {
      return await updateSecurePost(event);
    }

    if (method === "GET" && path === "/engagement") {
      return await getEngagement(event);
    }

    if (method === "POST" && path === "/post-views") return await recordPostView(event);

    if (method === "POST" && path === "/reactions") {
      return await setReaction(event);
    }

    if (method === "POST" && path === "/comments") {
      return await addComment(event);
    }

    if (method === "POST" && path === "/reports") {
      return await reportPost(event);
    }

    if (method === "DELETE" && path.startsWith("/comments/")) {
      return await deleteComment(event);
    }

    if (method === "GET" && path === "/engagement-notifications") {
      return await getEngagementNotifications(event);
    }

    if (method === "POST" && path === "/engagement-notifications/read") {
      return await clearEngagementNotifications(event);
    }

    if (method === "GET" && path === "/groups") {
      return await listGroups(event);
    }

    if (method === "POST" && path === "/groups") {
      return await createGroup(event);
    }

    if (method === "DELETE" && path.startsWith("/groups/")) {
      return await deleteGroup(event);
    }

    if (method === "POST" && path.startsWith("/groups/") && path.endsWith("/everyone")) {
      return await broadcastGroup(event);
    }

    if (method === "GET" && path.startsWith("/groups/") && path.endsWith("/members")) {
      return await listGroupMembers(event);
    }

    if (method === "POST" && path.startsWith("/groups/") && path.endsWith("/elders")) {
      return await manageGroupElder(event);
    }

    if (method === "POST" && path.startsWith("/groups/") && path.endsWith("/cover")) {
      return await updateGroupCover(event);
    }

    if (method === "GET" && path === "/profile-video") {
      return await getProfileVideo(event);
    }

    if (method === "POST" && path === "/profile-video") {
      return await setProfileVideo(event);
    }

    if (method === "POST" && path === "/support-tickets") {
      return await createSupportTicket(event);
    }

    if (method === "POST" && path === "/tour/route") {
      return await planTourRoute(event);
    }

    if (method === "POST" && path === "/venues/search") return await searchVenues(event);

    if (method === "POST" && path === "/record-stores/search") return await searchRecordStores(event);
    if ((method === "GET" || method === "POST") && path === "/record-store-workspace") return await recordStoreWorkspace(event, method);

    if (method === "POST" && path === "/tour/manual-venue") return await addManualBookingVenue(event);

    if ((method === "GET" || method === "POST") && path === "/booking-pipeline") return await bookingWorkspace(event, method);
    if (method === "PATCH" && path === "/booking-pipeline/identity") return await bookingIdentity(event);
    if ((method === "GET" || method === "POST" || method === "DELETE") && path === "/epk") return await epkWorkspace(event, method);
    if (method === "POST" && path === "/epk/qr") return await epkQr(event);
    if (method === "POST" && path === "/epk/share") return await privateEpkShare(event, method);
    if ((method === "GET" || method === "POST") && path === "/epk/outreach-share") return await outreachEpkShare(event, method);
    const epkOutreachMatch = path.match(/^\/epk\/outreach\/([a-f0-9]{32})$/i);
    if (method === "POST" && epkOutreachMatch) return await outreachEpkShare(event, method, epkOutreachMatch[1].toLowerCase());
    const epkPublicMatch = path.match(/^\/epk\/public\/([a-z0-9-]{3,64})$/i);
    if (method === "GET" && epkPublicMatch) return await publicEpk(event, epkPublicMatch[1]);
    const epkPrivateMatch = path.match(/^\/epk\/shared\/([a-z0-9-]{3,64})$/i);
    if (method === "POST" && epkPrivateMatch) return await privateEpkShare(event, method, epkPrivateMatch[1]);
    if (method === "GET" && path === "/review-targets") return await reviewableTargets(event);
    if (method === "GET" && path === "/reviews") return await listReviews(event);
    if (method === "POST" && path === "/reviews") return await createReview(event);
    const reviewMatch = path.match(/^\/reviews\/([a-f0-9]{32})$/i);
    if (method === "PATCH" && reviewMatch) return await updateReview(event, reviewMatch[1].toLowerCase());
    if (method === "DELETE" && reviewMatch) return await deleteReview(event, reviewMatch[1].toLowerCase());
    if (method === "GET" && path === "/tours") return await listTourPlans(event);
    if (method === "POST" && path === "/tours") return await saveTourPlan(event);
    if (method === "DELETE" && path.startsWith("/tours/")) return await deleteTourPlan(event, decodeURIComponent(path.slice(7)));

    if (method === "POST" && path === "/auth/logout") {
      return await logout(event);
    }

    return errorResponse(404, "Not found");

  } catch (error) {
    console.error("Authentication request failed", {
      method: method || "UNKNOWN",
      path: path || "UNKNOWN",
      errorName: error?.name || "Error",
      errorMessage: error?.message || "Unknown error"
    });

    return errorResponse(
      500,
      "Authentication service error"
    );
  }
};

// Named exports keep provider and classifier integration tests on the same
// implementation that Lambda runs. They do not expose an HTTP route.
export { geocodeTourPlace, multiSourceDiscovery, recordStoreCandidates, isRecordStore, isBookableClub, deduplicateVenues, cleanEpk, epkForViewer, epkDeletionPlan, epkShareTokenMatches, epkOutreachTokenMatches, epkOutreachLinkParts, epkDownloadName, validEpkQrUrl, reviewTargetId, cleanReviewDraft, reviewEntityToView, reviewTargetsFromPublishedEpk, reviewRecordKeys };
