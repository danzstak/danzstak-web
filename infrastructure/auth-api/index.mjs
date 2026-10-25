

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
  BatchGetItemCommand
} from "@aws-sdk/client-dynamodb";
import {
  CognitoIdentityProviderClient,
  ListUsersCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const db = new DynamoDBClient({ region: "us-west-1" });
const s3 = new S3Client({ region: "us-west-1" });
const cognito = new CognitoIdentityProviderClient({ region: "us-east-1" });

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
const legalVersion = "2026-10-25";

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
  const value = getCookie(event, sessionCookieName);
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
async function startLogin(mode = "login", legalAcceptanceId = "") {
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
  const expiresAt = now() + 3600;

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
    3600
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

  return redirect(siteUrl + "/", responseCookies);
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

async function listGroups(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const items = await scanAll({ TableName: groupsTable, FilterExpression: "groupId = :meta", ExpressionAttributeValues: { ":meta": { S: "META" } } });
  const groups = items.map(item => ({ id: item.userEmail.S.slice(6), name: item.name?.S || "Group", category: item.category?.S || "Creators", description: item.description?.S || "A DanzStak community group.", createdAt: item.createdAt?.S || "", isOwner: item.ownerId?.S === userId })).sort((a, b) => a.name.localeCompare(b.name));
  return { statusCode: 200, headers, body: JSON.stringify({ groups }) };
}

async function createGroup(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  let data; try { data = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON." }) }; }
  const name = String(data.name || "").trim(), category = String(data.category || "").trim(), description = String(data.description || "A new DanzStak community group.").trim();
  if (!name || name.length > 80 || !groupCategories.has(category) || description.length > 240 || data.communityStandards !== true) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid group details and Community Standards agreement are required." }) };
  const ownerEmail = await accountForSub(userId);
  if (!ownerEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const id = randomUUID(), createdAt = new Date().toISOString();
  await db.send(new PutItemCommand({ TableName: groupsTable, Item: { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" }, ownerId: { S: userId }, name: { S: name }, category: { S: category }, description: { S: description }, createdAt: { S: createdAt } }, ConditionExpression: "attribute_not_exists(userEmail)" }));
  await db.send(new PutItemCommand({ TableName: groupsTable, Item: { userEmail: { S: ownerEmail }, groupId: { S: id }, joinedAt: { S: createdAt } } }));
  return { statusCode: 201, headers, body: JSON.stringify({ group: { id, name, category, description, createdAt, isOwner: true } }) };
}

async function deleteGroup(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event), id = String(event.pathParameters?.groupId || "");
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  if (!/^[a-f0-9-]{36}$/.test(id)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid group required." }) };
  const key = { userEmail: { S: `GROUP#${id}` }, groupId: { S: "META" } };
  const found = await db.send(new GetItemCommand({ TableName: groupsTable, Key: key, ConsistentRead: true }));
  if (!found.Item) return { statusCode: 404, headers, body: JSON.stringify({ error: "Group not found." }) };
  if (found.Item.ownerId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the group owner can delete it." }) };
  const members = await scanAll({ TableName: groupsTable, FilterExpression: "groupId = :id", ExpressionAttributeValues: { ":id": { S: id } }, ProjectionExpression: "userEmail, groupId" });
  await Promise.all([db.send(new DeleteItemCommand({ TableName: groupsTable, Key: key })), ...members.map(item => db.send(new DeleteItemCommand({ TableName: groupsTable, Key: { userEmail: item.userEmail, groupId: item.groupId } })))]);
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: true }) };
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
  const profileEmail = String(event.queryStringParameters?.email || viewerEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Valid profile required." }) };
  if (!(await canViewProfileMedia(viewerEmail, profileEmail))) return { statusCode: 403, headers, body: JSON.stringify({ error: "Profile media is available to friends and group members." }) };
  const found = await db.send(new GetItemCommand({ TableName: settingsTable, Key: { userEmail: { S: profileEmail } }, ConsistentRead: true }));
  const mediaKey = found.Item?.profileVideoKey?.S || "";
  return { statusCode: 200, headers, body: JSON.stringify({ mediaKey, mediaUrl: signedMediaUrl(mediaKey, 3600) }) };
}

async function setProfileVideo(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
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
  if (oldKey && oldKey !== mediaKey && oldKey.startsWith(`users/${ownerPrefix}/`)) await s3.send(new DeleteObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: oldKey }));
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

  if (viewerEmail && friendAuthors.length) {
    const friendships = await batchGetFriendships(viewerEmail, friendAuthors);
    for (const item of friendships) {
      if (item.status?.S === "friends" && item.friendEmail?.S) friendEmails.add(item.friendEmail.S);
    }
  }

  const posts = rawPosts
    .filter(item => item.userId?.S === userId || item.audience?.S === "public" || (item.audience?.S === "friends" && friendEmails.has(item.userEmail?.S)))
    .map(item => ({
      postId: item.postId.S,
      userId: item.userId?.S ?? null,
      userEmail: item.userEmail?.S ?? "",
      content: item.content.S,
      audience: item.audience?.S ?? "public",
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
  if (post.userId?.S === userId || post.audience?.S === "public") return { post };
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
  const reactionCounts = {};
  let myReaction = "";
  for (const item of reactionItems) {
    const reaction = item.reaction?.S || "Like";
    reactionCounts[reaction] = (reactionCounts[reaction] || 0) + 1;
    if (item.userId?.S === userId) myReaction = reaction;
  }
  const comments = commentItems.map(item => ({
    commentId: item.commentId.S, userEmail: item.userEmail?.S || "DanzStak member", content: item.content.S,
    createdAt: item.createdAt.S, isOwner: item.userId?.S === userId, canDelete: item.userId?.S === userId || access.post.userId?.S === userId
  })).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { statusCode: 200, headers, body: JSON.stringify({ reactionCounts, myReaction, comments }) };
}

async function setReaction(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const data = parseJsonBody(event);
  const postId = String(data?.postId || ""), reaction = String(data?.reaction || "");
  if (reaction && !["Like", "Love", "Laugh", "Wow", "Sad", "Fire"].includes(reaction)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Unsupported reaction." }) };
  const access = await postForEngagement(postId, userId);
  if (!access.post) return { statusCode: access.statusCode, headers, body: JSON.stringify({ error: access.error }) };
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
  const data = parseJsonBody(event), postId = String(data?.postId || ""), content = String(data?.content || "").trim();
  if (!content || content.length > 1000) return { statusCode: 400, headers, body: JSON.stringify({ error: "Comment must contain 1–1000 characters." }) };
  const access = await postForEngagement(postId, userId);
  if (!access.post) return { statusCode: access.statusCode, headers, body: JSON.stringify({ error: access.error }) };
  const userEmail = await accountForSub(userId);
  if (!userEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const commentPolicy = access.post.commentPolicy?.S || "everyone", ownerEmail = access.post.userEmail?.S || "";
  if (commentPolicy === "off" && access.post.userId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Comments are turned off for this post." }) };
  if (commentPolicy === "friends" && access.post.userId?.S !== userId) {
    const friendship = await db.send(new GetItemCommand({ TableName: friendsTable, Key: { userEmail: { S: ownerEmail }, friendEmail: { S: userEmail } }, ConsistentRead: true }));
    if (friendship.Item?.status?.S !== "friends") return { statusCode: 403, headers, body: JSON.stringify({ error: "Only friends can comment on this post." }) };
  }
  const commentId = `${String(Date.now()).padStart(13, "0")}#${randomUUID()}`, createdAt = new Date().toISOString();
  await db.send(new PutItemCommand({ TableName: commentsTable, Item: { postId: { S: postId }, commentId: { S: commentId }, userId: { S: userId }, userEmail: { S: userEmail }, content: { S: content }, createdAt: { S: createdAt } } }));
  await notifyPostOwner(access.post, `comment#${commentId}`, "comment", userEmail, content);
  return { statusCode: 201, headers, body: JSON.stringify({ comment: { commentId, userEmail, content, createdAt, isOwner: true, canDelete: true } }) };
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
  const access = await postForEngagement(postId, userId);
  if (!access.post) return { statusCode: access.statusCode, headers, body: JSON.stringify({ error: access.error }) };
  if (access.post.userId?.S === userId) return { statusCode: 400, headers, body: JSON.stringify({ error: "Only other members' posts can be reported." }) };
  const reporterEmail = await accountForSub(userId);
  if (!reporterEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const reportId = randomUUID(), createdAt = new Date().toISOString();
  await db.send(new PutItemCommand({
    TableName: reportsTable,
    Item: {
      reportId: { S: reportId }, reporterId: { S: userId }, reporterEmail: { S: reporterEmail }, postId: { S: postId },
      reportedUserId: { S: access.post.userId?.S || "unknown" }, reason: { S: reason }, details: { S: details },
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
  const notifications = items.map(item => ({ type: item.type.S, email: item.actorEmail.S, postId: item.postId.S, preview: item.preview?.S || "", createdAt: item.createdAt.S, unread: item.read?.BOOL !== true }))
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

  if (!allowedOrigins.has(event.headers?.origin)) {
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

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    typeof data.content !== "string" ||
    !data.content.trim() ||
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

  const content = data.content.trim();
  if (data.originalContentCertified !== true) return { statusCode: 400, headers, body: JSON.stringify({ error: "Original-content certification is required." }) };
  const audience = ["public", "friends", "private"].includes(data.audience) ? data.audience : "public";
  const mediaKey = typeof data.mediaKey === "string" ? data.mediaKey : "";
  const mediaType = ["image", "video"].includes(data.mediaType) ? data.mediaType : "";
  const reel = mediaType === "video" && data.reel === true;
  const userEmail = await accountForSub(userId);
  if (!userEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
  const ownerPrefix = sha256(userEmail).slice(0, 24);
  if ((mediaKey && (!/^users\/[a-f0-9]{24}\/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|mov)$/.test(mediaKey) || !mediaKey.startsWith(`users/${ownerPrefix}/`))) || Boolean(mediaKey) !== Boolean(mediaType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid media reference." }) };
  }
  const postId = randomUUID();
  const createdAt = new Date().toISOString();

  await db.send(new PutItemCommand({
    TableName: postsTable,
    Item: {
      postId: { S: postId },
      userId: { S: userId },
      userEmail: { S: userEmail },
      content: { S: content },
      createdAt: { S: createdAt },
      audience: { S: audience },
      ...(mediaKey ? { mediaKey: { S: mediaKey }, mediaType: { S: mediaType }, ...(reel ? { reel: { BOOL: true } } : {}) } : {})
    },
    ConditionExpression: "attribute_not_exists(postId)"
  }));

  return {
    statusCode: 201,
    headers,
    body: JSON.stringify({
      postId,
      userId,
      userEmail,
      content,
      audience,
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
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const postId = String(event.pathParameters?.postId || "");
  if (!/^[a-f0-9-]{36}$/.test(postId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid post." }) };
  const found = await db.send(new GetItemCommand({ TableName: postsTable, Key: { postId: { S: postId } }, ConsistentRead: true }));
  if (!found.Item) return { statusCode: 404, headers, body: JSON.stringify({ error: "Post not found." }) };
  if (found.Item.userId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the owner can delete this post." }) };
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

async function updateSecurePost(event) {
  const headers = corsHeaders(event.headers?.origin);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const postId = String(event.pathParameters?.postId || ""), data = parseJsonBody(event);
  if (!/^[a-f0-9-]{36}$/.test(postId)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid post." }) };
  if (!data || typeof data !== "object" || Array.isArray(data)) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON request." }) };
  const found = await db.send(new GetItemCommand({ TableName: postsTable, Key: { postId: { S: postId } }, ConsistentRead: true }));
  if (!found.Item) return { statusCode: 404, headers, body: JSON.stringify({ error: "Post not found." }) };
  if (found.Item.userId?.S !== userId) return { statusCode: 403, headers, body: JSON.stringify({ error: "Only the owner can edit this post." }) };
  const updates = [], names = {}, values = { ":updated": { S: new Date().toISOString() } };
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
  await db.send(new UpdateItemCommand(request));
  return { statusCode: 200, headers, body: JSON.stringify({ updated: true, updatedAt: values[":updated"].S, editHistory: values[":editHistory"] ? JSON.parse(values[":editHistory"].S) : postEditHistory(found.Item) }) };
}

// LOG OUT
async function logout(event) {
  const origin = event.headers?.origin;
  const headers = corsHeaders(origin);

  if (!allowedOrigins.has(origin)) {
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

    if (method === "GET" && path === "/profile-video") {
      return await getProfileVideo(event);
    }

    if (method === "POST" && path === "/profile-video") {
      return await setProfileVideo(event);
    }

    if (method === "POST" && path === "/auth/logout") {
      return await logout(event);
    }

    return errorResponse(404, "Not found");

  } catch (error) {
    console.error("Authentication error:", error.name);

    return errorResponse(
      500,
      "Authentication service error"
    );
  }
};
