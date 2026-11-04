"use strict";

const assert = require("node:assert");
const { spawn } = require("node:child_process");
const http = require("node:http");

const tokenA = "a".repeat(64), tokenB = "b".repeat(64);
const accounts = new Map([[tokenA, "health-a@danzstak.invalid"], [tokenB, "health-b@danzstak.invalid"]]);
const posts = [], messages = [];
let failNotifications = false;

const json = (response, status, data) => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(data));
};

const readBody = request => new Promise(resolve => {
  let body = "";
  request.on("data", chunk => { body += chunk; });
  request.on("end", () => resolve(body ? JSON.parse(body) : {}));
});

const server = http.createServer(async (request, response) => {
  const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const email = accounts.get(token);
  if (!email) return json(response, 401, { error: "Authentication required" });
  const url = new URL(request.url, "http://localhost");

  if (request.method === "GET" && url.pathname === "/auth/session") return json(response, 200, { authenticated: true, user: { email } });
  if (request.method === "GET" && url.pathname === "/epk") return json(response, 200, { kit: null, published: false });
  if (request.method === "GET" && url.pathname === "/booking-pipeline") return json(response, 200, { venues: [], artist: {}, tour: {}, revision: "" });
  if (request.method === "GET" && url.pathname === "/tours") return json(response, 200, { tours: [] });
  if (request.method === "GET" && url.pathname === "/tour-manager/credits") return json(response, 200, { bookingEmailCredits: 0, purchasedCredits: 0, sentEmails: 0, reservedCredits: 0 });
  if (request.method === "GET" && url.pathname === "/tour-manager/outreach") return json(response, 200, { messages: [] });
  if (request.method === "GET" && url.pathname === "/secure-posts") return json(response, 200, { posts: posts.filter(post => post.userEmail === email) });
  if (request.method === "POST" && url.pathname === "/secure-posts") {
    const body = await readBody(request), postId = "10000000-0000-4000-8000-000000000001";
    posts.push({ postId, userEmail: email, content: body.content, audience: body.audience });
    return json(response, 201, { postId, content: body.content });
  }
  if (request.method === "DELETE" && url.pathname.startsWith("/secure-posts/")) {
    const index = posts.findIndex(post => post.postId === url.pathname.slice("/secure-posts/".length) && post.userEmail === email);
    if (index < 0) return json(response, 404, { error: "Post not found" });
    posts.splice(index, 1);
    return json(response, 200, { deleted: true });
  }
  if (request.method === "POST" && url.pathname === "/messages") {
    const body = await readBody(request);
    if (body.action === "delete") {
      const index = messages.findIndex(message => message.messageId === body.messageId && message.senderEmail === email);
      if (index < 0) return json(response, 404, { error: "Message not found" });
      messages.splice(index, 1);
      return json(response, 200, { deleted: true });
    }
    const message = { messageId: "1700000000000#10000000-0000-4000-8000-000000000002", senderEmail: email, recipientEmail: body.recipientEmail, content: body.content };
    messages.push(message);
    return json(response, 201, { message });
  }
  if (request.method === "GET" && url.pathname === "/messages") {
    const contact = url.searchParams.get("contact");
    return json(response, 200, { messages: messages.filter(message => (message.senderEmail === email && message.recipientEmail === contact) || (message.recipientEmail === email && message.senderEmail === contact)) });
  }
  if (request.method === "POST" && url.pathname === "/messages/delete") return json(response, 200, { deleted: true });
  if (request.method === "GET" && url.pathname === "/notifications") {
    if (failNotifications) return json(response, 503, { error: "Controlled notification outage" });
    return json(response, 200, { notifications: messages.filter(message => message.recipientEmail === email).map(message => ({ type: "message", email: message.senderEmail })) });
  }
  return json(response, 404, { error: "Not found" });
});

function runCheck(port) {
  return new Promise(resolve => {
  const address = server.address();
  const child = spawn(process.execPath, ["scripts/authenticated-production-health-check.cjs"], {
    cwd: __dirname,
    env: {
      ...process.env,
      DANZSTAK_HEALTH_API_URL: `http://127.0.0.1:${port || address.port}`,
      DANZSTAK_HEALTH_SITE_ORIGIN: "https://danzstak.com",
      DANZSTAK_SYNTHETIC_SESSION_A: tokenA,
      DANZSTAK_SYNTHETIC_SESSION_B: tokenB,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  child.stdout.on("data", chunk => { stdout += chunk; });
  child.stderr.on("data", chunk => { stderr += chunk; });
  child.on("close", code => resolve({ code, stdout, stderr }));
  });
}

server.listen(0, "127.0.0.1", async () => {
  try {
    const port = server.address().port;
    const success = await runCheck(port);
    assert.strictEqual(success.code, 0, success.stderr || success.stdout);
    const result = JSON.parse(success.stdout);
    assert.strictEqual(result.status, "PASS");
    assert.strictEqual(result.mode, "authenticated-isolated-synthetic");
    assert.ok(result.verified.includes("private post persistence and cleanup"));
    assert.ok(result.verified.includes("private Chat delivery and cleanup"));
    assert.ok(result.verified.includes("private EPK state"));
    assert.ok(result.verified.includes("private Booking workspace state"));
    assert.ok(result.verified.includes("private Tour Manager credit and outreach state"));
    assert.strictEqual(posts.length, 0, "post cleanup must leave no records");
    assert.strictEqual(messages.length, 0, "message cleanup must leave no records");
    assert.ok(!success.stdout.includes(tokenA) && !success.stdout.includes(tokenB), "session tokens must never be logged");

    failNotifications = true;
    const failure = await runCheck(port);
    assert.strictEqual(failure.code, 1, "a private API outage must fail the health check");
    assert.match(failure.stderr, /Controlled notification outage/);
    assert.strictEqual(posts.length, 0, "failure cleanup must remove the private post");
    assert.strictEqual(messages.length, 0, "failure cleanup must remove the Chat message");
    assert.ok(!failure.stderr.includes(tokenA) && !failure.stderr.includes(tokenB), "failure logs must not expose session tokens");
    console.log("Authenticated production-health checks passed: sessions, persistence, Chat, notifications, success cleanup, and failure cleanup.");
  } finally {
    server.close();
  }
});
