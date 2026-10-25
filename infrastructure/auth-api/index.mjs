

import {
  randomBytes,
  randomUUID,
  createHash,
  createPublicKey,
  verify,
  timingSafeEqual
} from "node:crypto";

import {
  DynamoDBClient,
  PutItemCommand,
  GetItemCommand,
  DeleteItemCommand,
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
const groupsTable = "DANZSTAK-GroupMembers";
const clientId = process.env.COGNITO_CLIENT_ID;
const cognitoDomain = process.env.COGNITO_DOMAIN;
const userPoolId = process.env.COGNITO_USER_POOL_ID;
const siteUrl = process.env.SITE_URL;

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

const now = () => Math.floor(Date.now() / 1000);

const sha256 = value =>
  createHash("sha256").update(value).digest("hex");

const randomValue = () =>
  randomBytes(32).toString("hex");

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
async function startLogin(mode = "login") {
  const state = randomValue();
  const verifier = randomValue();
  const nonce = randomValue();

  // This secret binds the OAuth request to this browser.
  const browserSecret = randomValue();

  await db.send(new PutItemCommand({
    TableName: tableName,
    Item: {
      sessionId: { S: sha256("oauth:" + state) },
      type: { S: "oauth_pending" },
      verifier: { S: verifier },
      nonce: { S: nonce },
      browserHash: { S: sha256(browserSecret) },
      expiresAt: { N: String(now() + 300) }
    },
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

  return redirect(siteUrl + "/", [
    sessionCookie,
    expiredBrowserCookie
  ]);
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

async function listGroups(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event);
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const result = await db.send(new ScanCommand({ TableName: groupsTable, FilterExpression: "groupId = :meta", ExpressionAttributeValues: { ":meta": { S: "META" } }, Limit: 250 }));
  const groups = (result.Items || []).map(item => ({ id: item.userEmail.S.slice(6), name: item.name?.S || "Group", category: item.category?.S || "Creators", description: item.description?.S || "A DanzStak community group.", createdAt: item.createdAt?.S || "", isOwner: item.ownerId?.S === userId })).sort((a, b) => a.name.localeCompare(b.name));
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
  const members = await db.send(new ScanCommand({ TableName: groupsTable, FilterExpression: "groupId = :id", ExpressionAttributeValues: { ":id": { S: id } }, ProjectionExpression: "userEmail, groupId", Limit: 500 }));
  await Promise.all([db.send(new DeleteItemCommand({ TableName: groupsTable, Key: key })), ...(members.Items || []).map(item => db.send(new DeleteItemCommand({ TableName: groupsTable, Key: { userEmail: item.userEmail, groupId: item.groupId } })))]);
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: true }) };
}

// CHECK SESSION
async function checkSession(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event);

  return {
    statusCode: userId ? 200 : 401,
    headers,
    body: JSON.stringify({
      authenticated: Boolean(userId)
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
async function getSecurePosts(event) {
  const headers = corsHeaders(event.headers?.origin);
  const userId = await getAuthenticatedUser(event);

  if (!userId) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  }

  const result = await db.send(new ScanCommand({ TableName: postsTable, Limit: 100, ConsistentRead: true }));
  const rawPosts = (result.Items || []).filter(item => item.postId?.S && item.content?.S && item.createdAt?.S);
  const viewerEmail = await accountForSub(userId);
  const friendAuthors = [...new Set(rawPosts
    .filter(item => item.userId?.S !== userId && item.audience?.S === "friends" && item.userEmail?.S)
    .map(item => item.userEmail.S))];
  const friendEmails = new Set();

  if (viewerEmail && friendAuthors.length) {
    const friendships = await db.send(new BatchGetItemCommand({
      RequestItems: {
        [friendsTable]: {
          Keys: friendAuthors.slice(0, 100).map(email => ({ userEmail: { S: viewerEmail }, friendEmail: { S: email } })),
          ConsistentRead: true,
          ProjectionExpression: "friendEmail, #status",
          ExpressionAttributeNames: { "#status": "status" }
        }
      }
    }));
    for (const item of friendships.Responses?.[friendsTable] || []) {
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
      mediaType: item.mediaType?.S ?? "",
      reel: item.reel?.BOOL === true,
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
  const createdAt = new Date().toISOString();
  await db.send(new PutItemCommand({
    TableName: engagementNotificationsTable,
    Item: {
      userEmail: { S: ownerEmail }, eventId: { S: eventId }, type: { S: type }, actorEmail: { S: actorEmail },
      postId: { S: post.postId.S }, preview: { S: String(preview || "").slice(0, 160) }, createdAt: { S: createdAt },
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
  const [reactionResult, commentResult] = await Promise.all([
    db.send(new QueryCommand({ TableName: reactionsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, Limit: 100, ConsistentRead: true })),
    db.send(new QueryCommand({ TableName: commentsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, Limit: 100, ConsistentRead: true }))
  ]);
  const reactionCounts = {};
  let myReaction = "";
  for (const item of reactionResult.Items || []) {
    const reaction = item.reaction?.S || "Like";
    reactionCounts[reaction] = (reactionCounts[reaction] || 0) + 1;
    if (item.userId?.S === userId) myReaction = reaction;
  }
  const comments = (commentResult.Items || []).map(item => ({
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
  const commentId = `${String(Date.now()).padStart(13, "0")}#${randomUUID()}`, createdAt = new Date().toISOString();
  await db.send(new PutItemCommand({ TableName: commentsTable, Item: { postId: { S: postId }, commentId: { S: commentId }, userId: { S: userId }, userEmail: { S: userEmail }, content: { S: content }, createdAt: { S: createdAt } } }));
  await notifyPostOwner(access.post, `comment#${commentId}`, "comment", userEmail, content);
  return { statusCode: 201, headers, body: JSON.stringify({ comment: { commentId, userEmail, content, createdAt, isOwner: true, canDelete: true } }) };
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
  const result = await db.send(new QueryCommand({ TableName: engagementNotificationsTable, KeyConditionExpression: "userEmail = :u", ExpressionAttributeValues: { ":u": { S: userEmail } }, Limit: 50, ScanIndexForward: false, ConsistentRead: true }));
  const notifications = (result.Items || []).map(item => ({ type: item.type.S, email: item.actorEmail.S, postId: item.postId.S, preview: item.preview?.S || "", createdAt: item.createdAt.S }));
  return { statusCode: 200, headers, body: JSON.stringify({ notifications }) };
}

async function clearEngagementNotifications(event) {
  const headers = corsHeaders(event.headers?.origin), userId = await getAuthenticatedUser(event);
  if (!allowedOrigins.has(event.headers?.origin)) return { statusCode: 403, headers, body: JSON.stringify({ error: "Forbidden origin" }) };
  if (!userId) return { statusCode: 401, headers, body: JSON.stringify({ error: "Authentication required." }) };
  const userEmail = await accountForSub(userId);
  if (!userEmail) return { statusCode: 200, headers, body: JSON.stringify({ cleared: 0 }) };
  const result = await db.send(new QueryCommand({ TableName: engagementNotificationsTable, KeyConditionExpression: "userEmail = :u", ExpressionAttributeValues: { ":u": { S: userEmail } }, ProjectionExpression: "eventId", Limit: 100, ConsistentRead: true }));
  await Promise.all((result.Items || []).map(item => db.send(new DeleteItemCommand({ TableName: engagementNotificationsTable, Key: { userEmail: { S: userEmail }, eventId: { S: item.eventId.S } } }))));
  return { statusCode: 200, headers, body: JSON.stringify({ cleared: result.Items?.length || 0 }) };
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
  const audience = ["public", "friends", "private"].includes(data.audience) ? data.audience : "public";
  const mediaKey = typeof data.mediaKey === "string" ? data.mediaKey : "";
  const mediaType = ["image", "video"].includes(data.mediaType) ? data.mediaType : "";
  const reel = mediaType === "video" && data.reel === true;
  const ownerPrefix = sha256(userId).slice(0, 24);
  if ((mediaKey && (!/^users\/[a-f0-9]{24}\/[a-f0-9-]{36}\.(jpg|png|webp|gif|mp4|webm|mov)$/.test(mediaKey) || !mediaKey.startsWith(`users/${ownerPrefix}/`))) || Boolean(mediaKey) !== Boolean(mediaType)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid media reference." }) };
  }
  const userEmail = await accountForSub(userId);
  if (!userEmail) return { statusCode: 409, headers, body: JSON.stringify({ error: "Account email could not be verified." }) };
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
  if (found.Item.mediaKey?.S) {
    const ownerPrefix = sha256(userId).slice(0, 24);
    if (!found.Item.mediaKey.S.startsWith(`users/${ownerPrefix}/`)) return { statusCode: 409, headers, body: JSON.stringify({ error: "Post media ownership could not be verified." }) };
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.MEDIA_BUCKET, Key: found.Item.mediaKey.S }));
  }
  const [reactions, comments, notices] = await Promise.all([
    db.send(new QueryCommand({ TableName: reactionsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ProjectionExpression: "postId, userId", ConsistentRead: true })),
    db.send(new QueryCommand({ TableName: commentsTable, KeyConditionExpression: "postId = :p", ExpressionAttributeValues: { ":p": { S: postId } }, ProjectionExpression: "postId, commentId", ConsistentRead: true })),
    found.Item.userEmail?.S ? db.send(new QueryCommand({ TableName: engagementNotificationsTable, KeyConditionExpression: "userEmail = :u", ExpressionAttributeValues: { ":u": { S: found.Item.userEmail.S } }, ProjectionExpression: "userEmail, eventId, postId", ConsistentRead: true })) : Promise.resolve({ Items: [] })
  ]);
  await Promise.all([
    ...(reactions.Items || []).map(item => db.send(new DeleteItemCommand({ TableName: reactionsTable, Key: { postId: item.postId, userId: item.userId } }))),
    ...(comments.Items || []).map(item => db.send(new DeleteItemCommand({ TableName: commentsTable, Key: { postId: item.postId, commentId: item.commentId } }))),
    ...(notices.Items || []).filter(item => item.postId?.S === postId).map(item => db.send(new DeleteItemCommand({ TableName: engagementNotificationsTable, Key: { userEmail: item.userEmail, eventId: item.eventId } })))
  ]);
  await db.send(new DeleteItemCommand({ TableName: postsTable, Key: { postId: { S: postId } } }));
  return { statusCode: 200, headers, body: JSON.stringify({ deleted: true }) };
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
      return await startLogin("signup");
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

    if (method === "GET" && path === "/engagement") {
      return await getEngagement(event);
    }

    if (method === "POST" && path === "/reactions") {
      return await setReaction(event);
    }

    if (method === "POST" && path === "/comments") {
      return await addComment(event);
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
