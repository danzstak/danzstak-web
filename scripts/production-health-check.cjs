"use strict";

const assert = require("node:assert");

const baseUrl = String(process.env.DANZSTAK_HEALTH_BASE_URL || "https://danzstak.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.DANZSTAK_HEALTH_TIMEOUT_MS || 15000);
const checks = [];

async function get(path, type = "text") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "DANZSTAK-read-only-health-check/1.0" },
    });
    assert.ok(response.ok, `${path} returned HTTP ${response.status}`);
    const body = type === "json" ? await response.json() : await response.text();
    checks.push({ path, status: response.status, durationMs: Date.now() - started });
    return { response, body };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const home = await get("/");
  assert.match(home.body, /DANZSTAK/i, "home page must contain DANZSTAK branding");

  for (const path of ["/feed.html", "/messages.html", "/booking.html", "/epk.html"]) {
    const page = await get(path);
    assert.match(page.body, /<html|<!doctype/i, `${path} must return HTML`);
  }

  const manifest = await get("/manifest.webmanifest", "json");
  assert.match(String(manifest.body.name || manifest.body.short_name || ""), /DANZSTAK/i, "manifest must identify DANZSTAK");
  assert.ok(Array.isArray(manifest.body.icons) && manifest.body.icons.length > 0, "manifest must publish install icons");

  const worker = await get("/service-worker.js");
  const cacheName = worker.body.match(/danzstak-shell-v\d+/)?.[0];
  assert.ok(cacheName, "service worker must publish a versioned DANZSTAK shell cache");

  const feed = await get("/feed.html?health-check=1");
  const assetPaths = [...feed.body.matchAll(/(?:src|href)=["'](\/?assets\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/gi)]
    .map(match => match[1].startsWith("/") ? match[1] : `/${match[1]}`);
  assert.ok(assetPaths.length >= 2, "feed must reference versioned JavaScript/CSS assets");
  for (const path of [...new Set(assetPaths)].slice(0, 8)) await get(path);

  console.log(JSON.stringify({
    status: "PASS",
    mode: "read-only-public-synthetic",
    baseUrl,
    cacheName,
    checkedAt: new Date().toISOString(),
    checks,
    exclusions: [
      "authenticated user mutation",
      "real or test Stripe charge",
      "outbound email",
      "private Chat or notification content",
    ],
  }, null, 2));
}

main().catch(error => {
  console.error(JSON.stringify({
    status: "FAIL",
    mode: "read-only-public-synthetic",
    baseUrl,
    checkedAt: new Date().toISOString(),
    error: error?.stack || String(error),
    checks,
  }, null, 2));
  process.exitCode = 1;
});
