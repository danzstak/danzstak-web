"use strict";

const assert = require("node:assert");
const crypto = require("node:crypto");

const apiUrl = String(process.env.DANZSTAK_HEALTH_API_URL || "https://api.danzstak.com").replace(/\/$/, "");
const siteOrigin = String(process.env.DANZSTAK_HEALTH_SITE_ORIGIN || "https://danzstak.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.DANZSTAK_HEALTH_TIMEOUT_MS || 15000);
const tokenA = String(process.env.DANZSTAK_SYNTHETIC_SESSION_A || "");
const tokenB = String(process.env.DANZSTAK_SYNTHETIC_SESSION_B || "");
const runId = `health-${new Date().toISOString()}-${crypto.randomUUID()}`;
const checks = [];
const cleanup = [];

assert.match(tokenA, /^[a-f0-9]{64}$/i, "DANZSTAK_SYNTHETIC_SESSION_A must be a 64-character session token");
assert.match(tokenB, /^[a-f0-9]{64}$/i, "DANZSTAK_SYNTHETIC_SESSION_B must be a 64-character session token");
assert.notStrictEqual(tokenA.toLowerCase(), tokenB.toLowerCase(), "Synthetic accounts must use different sessions");

async function request(actor, path, options = {}) {
  const token = actor === "A" ? tokenA : tokenB;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...options,
      signal: controller.signal,
      redirect: "error",
      headers: {
        origin: siteOrigin,
        authorization: `Bearer ${token}`,
        "user-agent": "DANZSTAK-authenticated-health-check/1.0",
        ...(options.body ? { "content-type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    checks.push({ actor, method: options.method || "GET", path, status: response.status, durationMs: Date.now() - started });
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

async function expectOk(actor, path, options) {
  const result = await request(actor, path, options);
  assert.ok(result.response.ok, `${actor} ${options?.method || "GET"} ${path} returned HTTP ${result.response.status}: ${result.body.error || "unknown error"}`);
  return result.body;
}

async function runCleanup() {
  const failures = [];
  while (cleanup.length) {
    const task = cleanup.pop();
    try { await task(); }
    catch (error) { failures.push(error.message); }
  }
  if (failures.length) throw new Error(`Synthetic cleanup failed: ${failures.join("; ")}`);
}

async function main() {
  let primaryError;
  try {
    const [sessionA, sessionB] = await Promise.all([
      expectOk("A", "/auth/session"),
      expectOk("B", "/auth/session"),
    ]);
    const emailA = String(sessionA.user?.email || "").trim().toLowerCase();
    const emailB = String(sessionB.user?.email || "").trim().toLowerCase();
    assert.match(emailA, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Synthetic account A must expose a valid account email");
    assert.match(emailB, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Synthetic account B must expose a valid account email");
    assert.notStrictEqual(emailA, emailB, "Synthetic sessions must belong to different accounts");

    const [epk, booking, tours, credits, outreach] = await Promise.all([
      expectOk("A", "/epk"),
      expectOk("A", "/booking-pipeline"),
      expectOk("A", "/tours"),
      expectOk("A", "/tour-manager/credits"),
      expectOk("A", "/tour-manager/outreach"),
    ]);
    assert.ok(epk.kit === null || epk.kit === undefined || typeof epk.kit === "object", "Private EPK response must be structurally valid");
    assert.ok(Array.isArray(booking.venues), "Booking workspace must return a venue list");
    assert.ok(Array.isArray(tours.tours), "Saved tours must return a tour list");
    for (const field of ["bookingEmailCredits", "purchasedCredits", "sentEmails", "reservedCredits"]) assert.ok(Number.isFinite(Number(credits[field])), `Tour Manager ${field} must be numeric`);
    assert.ok(Array.isArray(outreach.messages), "Tour Manager outreach must return an activity list");

    const post = await expectOk("A", "/secure-posts", {
      method: "POST",
      body: JSON.stringify({
        content: `[synthetic-health] ${runId}`,
        audience: "private",
        originalContentCertified: true,
      }),
    });
    assert.match(String(post.postId || ""), /^[a-f0-9-]{36}$/i, "Post creation must return an identifier");
    cleanup.push(async () => {
      const deleted = await request("A", `/secure-posts/${encodeURIComponent(post.postId)}`, { method: "DELETE" });
      if (!deleted.response.ok && deleted.response.status !== 404) throw new Error(`post cleanup returned HTTP ${deleted.response.status}`);
    });

    const feed = await expectOk("A", "/secure-posts");
    assert.ok(Array.isArray(feed.posts) && feed.posts.some(item => item.postId === post.postId && item.content === `[synthetic-health] ${runId}`), "Private synthetic post must persist and be readable by its owner");

    const sent = await expectOk("A", "/messages", {
      method: "POST",
      body: JSON.stringify({ recipientEmail: emailB, content: `[synthetic-health] ${runId}` }),
    });
    const messageId = String(sent.message?.messageId || "");
    assert.match(messageId, /^\d{13}#[a-f0-9-]{36}$/i, "Message creation must return an identifier");
    cleanup.push(async () => {
      const deleted = await request("A", "/messages", {
        method: "POST",
        body: JSON.stringify({ action: "delete", contactEmail: emailB, messageId, scope: "everyone" }),
      });
      if (!deleted.response.ok && deleted.response.status !== 404) throw new Error(`message cleanup returned HTTP ${deleted.response.status}`);
    });
    cleanup.push(async () => {
      for (const [actor, contact] of [["A", emailB], ["B", emailA]]) {
        const hidden = await request(actor, `/messages/delete?contact=${encodeURIComponent(contact)}`, { method: "POST", body: "{}" });
        if (!hidden.response.ok) throw new Error(`${actor} conversation cleanup returned HTTP ${hidden.response.status}`);
      }
    });

    const inbox = await expectOk("B", `/messages?contact=${encodeURIComponent(emailA)}`);
    assert.ok(Array.isArray(inbox.messages) && inbox.messages.some(item => item.messageId === messageId && item.content === `[synthetic-health] ${runId}`), "Synthetic Chat message must reach the recipient account");

    const notices = await expectOk("B", "/notifications");
    assert.ok(Array.isArray(notices.notifications) && notices.notifications.some(item => item.type === "message" && item.email === emailA), "Recipient must receive the Chat notification");
    await expectOk("B", `/messages?contact=${encodeURIComponent(emailA)}&read=1`);

    await runCleanup();
    const after = await expectOk("B", `/messages?contact=${encodeURIComponent(emailA)}`);
    assert.ok(!after.messages?.some(item => item.messageId === messageId), "Removed synthetic message must not remain visible");
    const feedAfter = await expectOk("A", "/secure-posts");
    assert.ok(!feedAfter.posts?.some(item => item.postId === post.postId), "Removed synthetic post must not remain visible");

    console.log(JSON.stringify({
      status: "PASS",
      mode: "authenticated-isolated-synthetic",
      apiUrl,
      checkedAt: new Date().toISOString(),
      checks,
      verified: [
        "two independent authenticated sessions",
        "private post persistence and cleanup",
        "private Chat delivery and cleanup",
        "recipient notification",
        "private EPK state",
        "private Booking workspace state",
        "private Tour Manager credit and outreach state",
        "post-cleanup verification",
        "message-cleanup verification",
      ],
      exclusions: ["Stripe charges", "outbound email", "real customer accounts"],
    }, null, 2));
  } catch (error) {
    primaryError = error;
    try { await runCleanup(); }
    catch (cleanupError) { primaryError = new AggregateError([error, cleanupError], "Synthetic check and cleanup both failed"); }
    throw primaryError;
  }
}

main().catch(error => {
  console.error(JSON.stringify({
    status: "FAIL",
    mode: "authenticated-isolated-synthetic",
    apiUrl,
    checkedAt: new Date().toISOString(),
    error: error?.stack || String(error),
    checks,
  }, null, 2));
  process.exitCode = 1;
});
