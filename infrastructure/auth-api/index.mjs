

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
  ListUsersCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { S3Client, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import {
  GeoPlacesClient,
  GeocodeCommand,
  SearchTextCommand
} from "@aws-sdk/client-geo-places";
import {
  GeoRoutesClient,
  CalculateRoutesCommand
} from "@aws-sdk/client-geo-routes";

const db = new DynamoDBClient({ region: "us-west-1" });
const s3 = new S3Client({ region: "us-west-1" });
const ses = new SESv2Client({ region: "us-west-1" });
const cognito = new CognitoIdentityProviderClient({ region: "us-east-1" });
const geoPlaces = new GeoPlacesClient({ region: "us-west-2", maxAttempts: 3 });
const geoRoutes = new GeoRoutesClient({ region: "us-west-2", maxAttempts: 3 });

const tableName = process.env.SESSIONS_TABLE;
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
const clientId = process.env.COGNITO_CLIENT_ID;
const cognitoDomain = process.env.COGNITO_DOMAIN;
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const siteUrl = process.env.SITE_URL;
const mediaBucket = process.env.MEDIA_BUCKET;

const callbackUrl = "https://api.danzstak.com/auth/callback";
const allowedOrigin = "https://danzstak.com";
const allowedOrigins = new Set([allowedOrigin, "https://www.danzstak.com"]);
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
const legalVersion = "2026-10-26";

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

const sha256 = value =>
  createHash("sha256").update(value).digest("hex");

const randomValue = () =>
  randomBytes(32).toString("hex");

const encodeAws = value => encodeURIComponent(value).replace(/[!'()*]/g, character => "%" + character.charCodeAt(0).toString(16).toUpperCase());
const hmac = (key, value, encoding) => createHmac("sha256", key).update(value).digest(encoding);
function signedMediaUrl(key, expires = 900) {
  if (!mediaBucket || !key) return "";
  const region = process.env.AWS_REGION, access = process.env.AWS_ACCESS_KEY_ID, secret = process.env.AWS_SECRET_ACCESS_KEY, token = process.env.AWS_SESSION_TOKEN;
  const date = new Date(), stamp = date.toISOString().replace(/[:-]|\.\d{3}/g, ""), day = stamp.slice(0, 8), scope = `${day}/${region}/s3/aws4_request`;
  const host = `${mediaBucket}.s3.${region}.amazonaws.com`, uri = "/" + key.split("/").map(encodeAws).join("/");
  const query = [["X-Amz-Algorithm", "AWS4-HMAC-SHA256"], ["X-Amz-Credential", `${access}/${scope}`], ["X-Amz-Date", stamp], ["X-Amz-Expires", String(expires)], ["X-Amz-Security-Token", token], ["X-Amz-SignedHeaders", "host"]].sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${encodeAws(name)}=${encodeAws(value)}`).join("&");
  const canonical = `GET\n${uri}\n${query}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`, toSign = `AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${sha256(canonical)}`;
  const signing = hmac(hmac(hmac(hmac("AWS4" + secret, day), region), "s3"), "aws4_request"), signature = hmac(signing, toSign, "hex");
  return `https://${host}${uri}?${query}&X-Amz-Signature=${signature}`;
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
async function startLogin(mode = "login", legalAcceptanceId = "", mobile = null) {
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
  if (mobile) {
    pendingItem.mobilePlatform = { S: mobile.platform };
    pendingItem.mobileChallenge = { S: mobile.challenge };
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
  const expiresAt = now() + 31536000;

  await db.send(new PutItemCommand({
    TableName: tableName,
    Item: {
      sessionId: { S: sha256(sessionId) },
      type: { S: "user_session" },
      userId: { S: user.sub },
      expiresAt: { N: String(expiresAt) }
    },
    ConditionExpression: "attribute_not_exists(sessionId)"
  }));

  const sessionCookie = secureCookie(
    sessionCookieName,
    sessionId,
    31536000
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

  return redirect(siteUrl + "/", responseCookies);
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
    body: JSON.stringify({ sessionToken: item.sessionToken.S, expiresIn: 31536000 })
  };
}

// VALIDATE SERVER-SIDE SESSION
async function getAuthenticatedUser(event) {
  const sessionId = getSessionId(event);

  if (!sessionId) {
    return null;
  }

  const result = await db.send(new GetItemCommand({
    TableName: tableName,
    Key: {
      sessionId: { S: sha256(sessionId) }
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

  return session.userId.S;
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
  return Boolean(found.Item);
}

async function groupRecord(groupId) {
  if (!/^[a-f0-9-]{36}$/.test(groupId)) return null;
  const found = await db.send(new GetItemCommand({
    TableName: groupsTable,
    Key: { userEmail: { S: `GROUP#${groupId}` }, groupId: { S: "META" } },
    ConsistentRead: true
  }));
  return found.Item || null;
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
  const groups = items.filter(item => item.groupId?.S === "META" && item.userEmail?.S?.startsWith("GROUP#")).map(item => {
    const id = item.userEmail.S.slice(6), isOwner = item.ownerId?.S === userId, membership = viewerMemberships.get(id);
    return { id, name: item.name?.S || "Tribe", category: item.category?.S || "Creators", description: item.description?.S || "A DanzStak community.", coverUrl: item.coverKey?.S ? signedMediaUrl(item.coverKey.S, 3600) : "", createdAt: item.createdAt?.S || "", memberCount: counts.get(id) || 0, joined: Boolean(membership), isOwner, isElder: isOwner || membership?.role?.S === "elder" };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return { statusCode: 200, headers, body: JSON.stringify({ groups }) };
}

async function createGroup(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  let data; try { data = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON." }) }; }
  const name = String(data.name || "").trim(), category = String(data.category || "").trim(), description = String(data.description || "A new DanzStak community group.").trim();
  if (!name || name.length > 80 || !groupCategories.has(category) || description.length > 240 || data.communityStandards !== true) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid group details and Community Standards agreement are required." }) };
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
  await db.send(new UpdateItemCommand({
    TableName: groupsTable,
    Key: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } },
    UpdateExpression: "SET coverKey = :cover, updatedAt = :updated",
    ExpressionAttributeValues: { ":cover": { S: mediaKey }, ":updated": { S: new Date().toISOString() } },
    ConditionExpression: "attribute_exists(userEmail)"
  }));
  if (oldKey && oldKey !== mediaKey) {
    try { await s3.send(new DeleteObjectCommand({ Bucket: mediaBucket, Key: oldKey })); }
    catch (error) { console.error("Tribe cover cleanup remains pending", { id, error }); }
  }
  return { statusCode: 200, headers, body: JSON.stringify({ coverUrl: signedMediaUrl(mediaKey, 3600) }) };
}

async function deleteGroup(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event), id = String(event.pathParameters?.groupId || "");
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  if (!/^[a-f0-9-]{36}$/.test(id)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid group required." }) };
  const key = { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } };
  const found = await db.send(new GetItemCommand({ TableName: groupsTable, Key: key, ConsistentRead: true }));
  if (!found.Item) return { statusCode: 404, headers, body: JSON.stringify({ error: "Group not found." }) };
  if (found.Item.ownerId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the group owner can delete it." }) };
  const members = await scanAll({ TableName: groupsTable, FilterExpression: "groupId = :id", ExpressionAttributeValues: { ":id": { S: id } }, ProjectionExpression: "userEmail, groupId" });
  await Promise.all([db.send(new DeleteItemCommand({ TableName: groupsTable, Key: key })), ...members.map(item => db.send(new DeleteItemCommand({ TableName: groupsTable, Key: { userEmail: item.userEmail, groupId: item.groupId } })))]);
  if (found.Item.coverKey?.S) {
    try { await s3.send(new DeleteObjectCommand({ Bucket: mediaBucket, Key: found.Item.coverKey.S })); }
    catch (error) { console.error("Deleted Tribe cover cleanup remains pending", { id, error }); }
  }
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
  const found = await db.send(new GetItemCommand({ TableName: groupsTable, Key: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } }, ConsistentRead: true }));
  if (!found.Item) return { statusCode: 404, headers, body: JSON.stringify({ error: "Tribe not found." }) };
  if (found.Item.ownerId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the Tribe creator can notify @everyone." }) };
  const actorEmail = await accountForSub(userId);
  if (!actorEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const members = (await scanAll({ TableName: groupsTable, FilterExpression: "groupId = :id", ExpressionAttributeValues: { ":id": { S: id } }, ProjectionExpression: "userEmail" }))
    .map(item => item.userEmail?.S).filter(email => email && email !== actorEmail && !email.startsWith("GROUP#"));
  const createdAt = new Date().toISOString(), eventId = `group_everyone#${id}#${randomUUID()}`, groupName = found.Item.name?.S || "your Tribe";
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
  if (!(await canViewProfileMedia(viewerEmail, profileEmail))) return { statusCode: 403, headers, body: JSON.stringify({ error: "Profile media is available to friends and group members." }) };
  const found = await db.send(new GetItemCommand({ TableName: settingsTable, Key: { userEmail: { S: profileEmail } }, ConsistentRead: true }));
  const mediaKey = found.Item?.profileVideoKey?.S || "";
  return { statusCode: 200, headers, body: JSON.stringify({ mediaKey, mediaUrl: signedMediaUrl(mediaKey, 3600) }) };
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
  await db.send(new UpdateItemCommand({
    TableName: settingsTable,
    Key: key,
    UpdateExpression: "SET profileVideoKey = :video, updatedAt = :updated",
    ExpressionAttributeValues: { ":video": { S: mediaKey }, ":updated": { S: new Date().toISOString() } }
  }));
  if (oldKey && oldKey !== mediaKey && oldKey.startsWith(`users/${ownerPrefix}/`)) {
    try { await s3.send(new DeleteObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: oldKey })); }
    catch (error) { console.error("Profile video cleanup remains pending", { oldKey, error }); }
  }
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
  const friendAuthors = [...new Set(rawPosts
    .filter(item => item.userId?.S !== userId && item.audience?.S === "friends" && item.userEmail?.S)
    .map(item => item.userEmail.S))];
  const friendEmails = new Set();
  const viewerGroupIds = new Set();
  const groupNames = new Map([
    ["default-0", "Visual Artist"], ["default-1", "DJs & Producers"], ["default-2", "Fans"], ["default-3", "Venues"], ["default-4", "Events"],
    ["default-5", "Scenes"], ["default-6", "Bands"], ["default-7", "Industry"], ["default-8", "Politics"], ["default-9", "Religion"]
  ]);

  if (viewerEmail && friendAuthors.length) {
    const friendships = await batchGetFriendships(viewerEmail, friendAuthors);
    for (const item of friendships) {
      if (item.status?.S === "friends" && item.friendEmail?.S) friendEmails.add(item.friendEmail.S);
    }
  }

  if (viewerEmail && rawPosts.some(item => item.groupId?.S)) {
    const groupItems = await scanAll({ TableName: groupsTable, ConsistentRead: true });
    for (const item of groupItems) {
      if (item.userEmail?.S === viewerEmail && item.groupId?.S && item.groupId.S !== "META") viewerGroupIds.add(item.groupId.S);
      if (item.groupId?.S === "META" && item.userEmail?.S?.startsWith("GROUP#")) groupNames.set(item.userEmail.S.slice(6), item.name?.S || "Tribe");
    }
  }

  const visiblePosts = rawPosts.filter(item => item.userId?.S === userId || (item.groupId?.S ? viewerGroupIds.has(item.groupId.S) : item.audience?.S === "public" || (item.audience?.S === "friends" && friendEmails.has(item.userEmail?.S))));
  const tagNames = visiblePosts.flatMap(item => (item.taggedUsers?.L || []).map(tag => ({userEmail:tag.M?.userEmail})));
  const authorProfiles = typeof loadFeedAuthorProfiles === "function" ? await loadFeedAuthorProfiles([...visiblePosts,...tagNames]) : new Map();
  const authorNames = await loadFeedAuthorNames([...visiblePosts,...tagNames], authorProfiles);
  const authorName = email => authorNames.get(String(email || "").trim().toLowerCase()) || "DanzStak member";
  const authorPicture = email => authorProfiles.get(String(email || "").trim().toLowerCase())?.picture || "";
  const visibleSources = new Map(visiblePosts.map(item => [item.postId.S,item]));
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
      sharedPost:sharedPreview(visibleSources.get(item.sharedPostId?.S)),
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
  if (post.userId?.S === userId) return { post };
  if (post.groupId?.S) {
    const access = await requireGroupMember(post.groupId.S, userId);
    return access.error ? access : { post };
  }
  if (post.audience?.S === "public") return { post };
  if (post.audience?.S !== "friends" || !post.userEmail?.S) return { error: "Post is not available.", statusCode: 403 };
  const viewerEmail = await accountForSub(userId);
  if (!viewerEmail) return { error: "Account email could not be verified.", statusCode: 409 };
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
  const [reactionItems, commentItems] = await Promise.all([
    queryAll({ TableName: reactionsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ConsistentRead: true }),
    queryAll({ TableName: commentsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ConsistentRead: true })
  ]);
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
    if (!details) return { statusCode: 400, headers, body: JSON.stringify({ error: "Describe the group concern." }) };
    if (!(await groupExists(groupId))) return { statusCode: 404, headers, body: JSON.stringify({ error: "Group not found." }) };
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
  const [comment, post] = await Promise.all([
    db.send(new GetItemCommand({ TableName: commentsTable, Key: { postId: { S: postId }, commentId: { S: commentId } }, ConsistentRead: true })),
    db.send(new GetItemCommand({ TableName: postsTable, Key: { postId: { S: postId } }, ConsistentRead: true }))
  ]);
  if (!comment.Item) return { statusCode: 404, headers, body: JSON.stringify({ error: "Comment not found." }) };
  if (comment.Item.userId?.S !== userId && post.Item?.userId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the comment or post owner can delete this comment." }) };
  await db.send(new DeleteItemCommand({ TableName: commentsTable, Key: { postId: { S: postId }, commentId: { S: commentId } } }));
  if (post.Item?.userEmail?.S) await db.send(new DeleteItemCommand({ TableName: engagementNotificationsTable, Key: { userEmail: { S: post.Item.userEmail.S }, eventId: { S: `comment#${commentId}` } } }));
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: true }) };
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
  const audience = requestedGroupId ? "group" : ["public", "friends", "private"].includes(data.audience) ? data.audience : "public";
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
    });
  }
  const [reactions, comments, notices] = await Promise.all([
    queryAll({ TableName: reactionsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ProjectionExpression: "postId, userId", ConsistentRead: true }),
    queryAll({ TableName: commentsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ProjectionExpression: "postId, commentId", ConsistentRead: true }),
    found.Item.userEmail?.S ? queryAll({ TableName: engagementNotificationsTable, KeyConditionExpression: "userEmail = :u", ExpressionAttributeValues: { ":u": { S: found.Item.userEmail.S } }, ProjectionExpression: "userEmail, eventId, postId", ConsistentRead: true }) : Promise.resolve([])
  ]);
  await db.send(new DeleteItemCommand({ TableName: postsTable, Key: { postId: { S: postId } } }));
  const cleanupTasks = [
    ...reactions.map(item => () => db.send(new DeleteItemCommand({ TableName: reactionsTable, Key: { postId: item.postId, userId: item.userId } }))),
    ...comments.map(item => () => db.send(new DeleteItemCommand({ TableName: commentsTable, Key: { postId: item.postId, commentId: item.commentId } }))),
    ...notices.filter(item => item.postId?.S === postId).map(item => () => db.send(new DeleteItemCommand({ TableName: engagementNotificationsTable, Key: { userEmail: item.userEmail, eventId: item.eventId } }))),
    ...linkedStories.map(item => () => db.send(new DeleteItemCommand({ TableName: storiesTable, Key: { storyId: item.storyId } }))),
    ...(mediaKey ? [() => s3.send(new DeleteObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: mediaKey }))] : [])
  ];
  const cleanupPending = await runCleanup(cleanupTasks);
  if (cleanupPending) console.error("Post deletion cleanup remains pending", { postId, cleanupPending });
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: true, cleanupPending }) };
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
  const categories = (place.Categories || []).map(item => String(item.LocalizedName || item.Name || item.Id || "").trim()).filter(Boolean).slice(0, 8);
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
      ? "A public venue website was returned by the current place search."
      : emails.length || phones.length
        ? "A public contact was returned by the current place search."
        : "A current public place listing was returned; confirm live-show activity before contacting."
  };
}

function isBookableClub(place, genre = "") {
  const description = `${place.name} ${(place.categories || []).join(" ")}`.toLowerCase();
  const selectedGenre = genre.toLowerCase();
  const classicalSearch = selectedGenre.includes("orchestra") || selectedGenre.includes("classical");
  const wrongScale = /\b(stadium|arena|auditorium|amphitheat(?:er|re)|pavilion|pavillon|kurpavillon|stadthalle|konzertmuschel|band shell|performing arts cent(?:er|re)|sports complex|convention cent(?:er|re)|exhibition cent(?:er|re)|raceway|speedway)\b/;
  const nonClassicalInstitution = /\b(symphony|orchestra|opera house)\b/;
  const wrongFormat = /\b(comedy|comic|laughs?|piano bar|cocktail bar|cocktail lounge|salsa|ballroom|table\s*dance|strip club|adult entertainment|escort|dance school|dance class|kindermusik|music school|music lesson|music teacher|music instructor|music with|rehearsal|practice room|studio|choir|chorus|chorale|workshop|clinic|promoter|promotion|productions?|entertainment company|event consultant|entertainment consultant|event planner|church|worship|jubilee|gospel\w*|christmas market|weihnachtsmarkt|variet[eé]|museum|gallery|library|retail|music store|record store|instrument store|community cent(?:er|re)|recreation cent(?:er|re)|hotel|lodging|restaurant only|tourist attraction|park|passport|visa service|consular|government|office)\b/;
  const eventNotRoom = /\b(concerts? in the|concert series|music festival|festival|festspiele|festival office|jazzfest|walking tour|history tour|guided tour|tourist information|tourismus|ostseebad)\b/;
  const wrongGenre = !selectedGenre.includes("jazz") && /\bjazz\w*/.test(description);
  const strongVenue = /\b(live music|live entertainment[- ]?music|music venue|rock club|punk club|metal club|night ?club|concert venue|concert hall)\b/.test(description);
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
  const musicSignal = /\b(music|concert|live|rock|punk|metal|electronic|dj|hip[- ]?hop|jazz)\b/.test(description);
  const classicalRoom = classicalSearch && /\b(symphony|orchestra|opera house|concert hall|recital hall|chamber music)\b/.test(description);
  return !wrongScale.test(description) && (classicalSearch || !nonClassicalInstitution.test(description)) && !wrongFormat.test(description) && !eventNotRoom.test(description) && !wrongGenre && genreEvidence && (strongVenue || classicalRoom || (plausibleRoom && musicSignal));
}

function venueSuitability(place, genre = "") {
  const description = `${place.name} ${(place.categories || []).join(" ")}`.toLowerCase();
  let score = 0;
  if (/\b(live music|music venue|rock club|punk club|metal club|concert venue)\b/.test(description)) score += 12;
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
  return false;
}

function hasBookingContact(place) {
  return Boolean(place.websites?.length || place.emails?.length || place.phones?.length);
}

function normalizedVenueText(value) {
  return String(value || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/^the\s+/, "").replace(/\b(inc|llc|ltd|club|venue|bar)\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
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

async function geocodeTourPlace(query) {
  const result = await geoPlaces.send(new GeocodeCommand({ QueryText: query, MaxResults: 1 }));
  const place = result.ResultItems?.[0];
  if (!place || !Array.isArray(place.Position) || place.Position.length !== 2) throw Object.assign(new Error("Tour location not found"), { statusCode: 422 });
  return { label: String(place.Title || query).slice(0, 160), position: place.Position.slice(0, 2) };
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
  const submitForReview = data.submitForReview === true;
  const publicVenueCertified = data.publicVenueCertified === true;
  let website = clean(data.website, 600), email = clean(data.email, 254).toLowerCase(), phone = clean(data.phone, 30);
  if (!name || !address) return reply(400, { error: "Add the club name and public street address." });
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
          message: { S: JSON.stringify({ venueKey, name, address, locality, position, website, email, phone }) },
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
    categories: ["Member-added public live music venue"],
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
  } else if (latitude >= 45.40 && latitude <= 45.65 && longitude >= -122.85 && longitude <= -122.45) {
    rooms = verifiedPortlandRooms;
    locality = "Portland";
  } else return [];
  const wanted = genre.toLowerCase();
  const genreTerms = wanted.includes("punk") ? ["punk", "diy"] : wanted.includes("metal") ? ["metal"] : wanted.includes("rock") ? ["rock"] : wanted.includes("dj") || wanted.includes("electronic") ? ["dj", "electronic"] : wanted.includes("hip-hop") ? ["hip-hop"] : [];
  const matches = genreTerms.length ? rooms.filter(place => genreTerms.some(term => place.categories.some(category => category.toLowerCase().includes(term)))) : rooms;
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
    "live music pub",
    "music hall",
    "concert venue",
    selectedGenre.includes("DJ") || selectedGenre.includes("Electronic")
      ? "nightclub DJ electronic music"
      : selectedGenre.includes("Orchestra") || selectedGenre.includes("Classical")
        ? "classical concert hall orchestra venue"
        : "rock punk metal music venue"
  ])];
  const searchResults = await Promise.allSettled([search("hotel"), ...venueQueries.map(search)]);
  const [hotelSearch, ...venueSearches] = searchResults;
  // A failed category lookup must not discard clubs found by the other searches.
  if (venueSearches.every(result => result.status === "rejected")) throw venueSearches[0].reason;
  const hotelResults = hotelSearch.status === "fulfilled" ? hotelSearch.value : [];
  const venueBatches = venueSearches.filter(result => result.status === "fulfilled").map(result => result.value);
  const nearby = (place, maximumMiles) => place.distanceMiles === null || place.distanceMiles <= maximumMiles;
  const curatedPool = curatedVenueLeads(point, genre, variation);
  const curated = curatedPool.filter(place => isVenueTypeMatch(place, venueType) && !excludedVenueKeys.has(place.venueKey));
  const discovered = venueBatches.flat()
    .filter(place => nearby(place, 60) && isBookableClub(place, genre) && isVenueTypeMatch(place, venueType) && !excludedVenueKeys.has(place.venueKey))
    .sort((left, right) => venueSuitability(right, genre) - venueSuitability(left, genre));
  const initialFallback = excludedVenueKeys.size || curated.length || discovered.length ? [] : curatedPool;
  // Live map discovery is the product. Curated records only fill genuine gaps and
  // must never crowd newly discovered rooms out of the first results.
  const venuePool = deduplicateVenues([...discovered, ...curated, ...initialFallback]);
  const offset = venuePool.length ? variation % venuePool.length : 0;
  const venues = [...venuePool.slice(offset), ...venuePool.slice(0, offset)].slice(0, 60);
  const hotels = hotelResults.filter(place => nearby(place, 35));
  return { stop: point.label, position: point.position, venues, hotels };
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
  const local = data.mode === "local", directional = data.mode === "direction", direction = cleanPlace(data.direction).toLowerCase(), genre = cleanPlace(data.genre).slice(0, 80), venueType = cleanPlace(data.venueType || "any").toLowerCase(), requestedDays = Math.max(1, Math.min(180, Math.trunc(Number(data.days) || 0))), requestedDepartOn = cleanPlace(data.departOn), returnBy = cleanPlace(data.returnBy), start = cleanPlace(data.start), suppliedStops = local || directional ? [] : Array.isArray(data.stops) ? data.stops.map(cleanPlace).filter(Boolean) : [], suppliedEnd = local || directional ? start : cleanPlace(data.end), end = suppliedEnd || suppliedStops.at(-1) || "", stops = suppliedEnd ? suppliedStops : suppliedStops.slice(0, -1);
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
        const hotels = deduplicateVenues(batches.flatMap(batch => batch.hotels || [])).slice(0, 20);
        if (requestedDepartOn) batches.forEach(batch => { batch.proposedDate = requestedDepartOn; });
        return { statusCode: 200, headers, body: JSON.stringify({ route: { start: homePoint, end: homePoint, stops: samplePoints.map((position, index) => ({ label: `Drawn route area ${index + 1}`, position })), distanceMiles: 0, durationHours: 0, minimumDrivingDays: 0, requestedDays, departOn: requestedDepartOn, returnBy, provider: "Amazon Location Service", planningOnly: true, local: true, drawn: true }, candidates: [{ stop: "Clubs along your drawn route", position: samplePoints[0], venues, hotels, ...(requestedDepartOn ? { proposedDate: requestedDepartOn } : {}) }] }) };
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
    let points = directional ? [home, ...suggestedMarkets, home] : await Promise.all([start, ...stops, end, start].map(geocodeTourPlace));
    let route;
    while (points.length >= 3) {
      try {
        route = await geoRoutes.send(new CalculateRoutesCommand({ Origin: points[0].position, Destination: points.at(-1).position, Waypoints: points.slice(1, -1).map(point => ({ Position: point.position })), TravelMode: "Car" }));
      } catch (error) {
        if (!directional) throw error;
        route = undefined;
      }
      if (route?.Routes?.[0]?.Summary || !directional || points.length === 3) break;
      points = [...points.slice(0, -2), points.at(-1)];
    }
    const summary = route?.Routes?.[0]?.Summary;
    if (!summary) return { statusCode: 422, headers, body: JSON.stringify({ error: "A drivable route could not be calculated." }) };
    const markets = points.slice(1, -1), selected = markets.length <= 6 ? markets : Array.from({ length: 6 }, (_, index) => markets[Math.round(index * (markets.length - 1) / 5)]), candidates = await Promise.all(selected.map(point => tourCandidates(point, genre, excludedVenueKeys, variation, null, venueType)));
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
    return { statusCode: 200, headers, body: JSON.stringify({ route: { start: points[0], end: points.at(-1), turnaround: points.at(-2), stops: points.slice(1, -1), distanceMiles, durationHours, minimumDrivingDays, requestedDays, direction: directional ? direction : undefined, departOn, returnBy, bookingStatus: "proposed", roundTrip: true, provider: "Amazon Location Service", planningOnly: true }, candidates }) };
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
async function bookingWorkspace(event, method) {
  const headers = corsHeaders(event.headers?.origin);
  const reply = (statusCode, data) => ({ statusCode, headers, body: JSON.stringify(data) });
  if (!allowedOrigins.has(event.headers?.origin)) return reply(403, { error: "Forbidden origin" });
  const userId = await getAuthenticatedUser(event);
  if (!userId) return reply(401, { error: "Authentication required." });
  const Key = { userId: { S: userId }, tourId: { S: bookingWorkspaceId } };
  if (method === "GET") {
    const result = await db.send(new GetItemCommand({ TableName: toursTable, Key, ConsistentRead: true }));
    return reply(200, result.Item ? { ...JSON.parse(result.Item.plan.S), revision: result.Item.revision?.S || "" } : { venues: [], artist: {}, revision: "" });
  }
  const data = parseJsonBody(event);
  if (!data || !Array.isArray(data.venues) || data.venues.length > 100 || typeof data.revision !== "string") return reply(400, { error: "Provide up to 100 venues and the loaded revision." });
  const text = (value, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
  const https = value => /^https:\/\//i.test(text(value, 600)) ? text(value, 600) : "";
  const list = (value, clean) => Array.isArray(value) ? value.slice(0, 8).map(clean).filter(Boolean) : [];
  const date = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value ? value : "";
  const timestamp = value => typeof value === "string" && /^\d{4}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : "";
  const stages = new Set(["Research", "Ready to pitch", "Contacted", "In conversation", "Hold", "Confirmed", "Declined"]);
  const venues = data.venues.map(v => {
    if (!v || typeof v !== "object" || !text(v.name)) return null;
    const b = v.booking || {};
    const sources = Array.isArray(v.sources) ? v.sources.slice(0, 6).map(source => source && typeof source === "object" ? { name: text(source.name, 120), url: https(source.url) } : null).filter(source => source?.name) : [];
    return { name: text(v.name, 160), address: text(v.address), venueKey: text(v.venueKey), categories: list(v.categories, x => text(x, 80)), websites: list(v.websites, https), emails: list(v.emails, x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x) ? text(x, 254) : ""), phones: list(v.phones, x => text(x, 30)), sourceUrl: https(v.sourceUrl), sourceName: text(v.sourceName), sources, activityEvidence: text(v.activityEvidence, 1000), discoveredAt: timestamp(v.discoveredAt), imageUrl: https(v.imageUrl), ...(Array.isArray(v.position) && v.position.length === 2 && v.position.every(Number.isFinite) && Math.abs(v.position[0]) <= 180 && Math.abs(v.position[1]) <= 90 ? { position: v.position } : {}), booking: { stage: stages.has(b.stage) ? b.stage : "Research", showDate: date(b.showDate), followUp: date(b.followUp), deal: text(b.deal, 2000), notes: text(b.notes, 2000), outreachDraft: text(b.outreachDraft, 5000) } };
  });
  if (venues.some(v => !v)) return reply(400, { error: "Each venue needs a name." });
  const a = data.artist || {};
  const plan = JSON.stringify({ venues, artist: { name: text(a.name, 100), genre: text(a.genre, 100), hometown: text(a.hometown, 160), epk: https(a.epk), pitch: text(a.pitch, 1000) } });
  if (Buffer.byteLength(plan, "utf8") > 250000) return reply(400, { error: "Workspace is too large. Export a copy and reduce the list." });
  const revision = randomUUID();
  try {
    await db.send(new PutItemCommand({ TableName: toursTable, Item: { ...Key, name: { S: "Booking workspace" }, plan: { S: plan }, revision: { S: revision }, updatedAt: { S: new Date().toISOString() } }, ConditionExpression: data.revision ? "revision = :revision" : "attribute_not_exists(userId)", ...(data.revision ? { ExpressionAttributeValues: { ":revision": { S: data.revision } } } : {}) }));
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") return reply(409, { error: "Another device saved changes. Export your work, then reload the account workspace before saving." });
    throw error;
  }
  return reply(200, { revision });
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
  const tours = (result.Items || []).filter(item => item.tourId?.S !== bookingWorkspaceId).map(item => { let plan = {}; try { plan = JSON.parse(item.plan?.S || "{}"); } catch { /* Ignore malformed legacy data. */ } return { tourId: item.tourId?.S || "", name: item.name?.S || "Tour", updatedAt: item.updatedAt?.S || "", plan }; });
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
  const userId = await getAuthenticatedUser(event);
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

    if (method === "POST" && path === "/tour/manual-venue") return await addManualBookingVenue(event);

    if ((method === "GET" || method === "POST") && path === "/booking-pipeline") return await bookingWorkspace(event, method);
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
