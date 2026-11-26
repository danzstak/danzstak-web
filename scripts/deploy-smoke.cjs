"use strict";
// D0 smoke checks after a deploy (.github/workflows/deploy.yml). Signed out and read-only: no member data is read, no
// charge, no email. It prints status codes and timings only.
//   - the Auth API Lambda answers GET /auth/session with 401 {"authenticated":false} (a 5xx or HTML means it broke);
//   - call-signaling answers GET /calls/directory with 401 {"error":"Authentication required"};
// The public site pages are checked by scripts/production-health-check.cjs, which the workflow runs next to this.
// Each check is retried a few times so a cold start or a Lambda still finishing its update doesn't fail the run.

const apiBase = String(process.env.DANZSTAK_API_BASE_URL || "https://api.danzstak.com").replace(/\/$/, "");
const timeoutMs = Number(process.env.DANZSTAK_SMOKE_TIMEOUT_MS || 15000);
const attempts = Number(process.env.DANZSTAK_SMOKE_ATTEMPTS || 4);
const pauseMs = Number(process.env.DANZSTAK_SMOKE_PAUSE_MS || 5000);

const checks = [
  {
    name: "Auth API (signed-out session check)",
    path: "/auth/session",
    status: 401,
    body: json => json && json.authenticated === false,
  },
  // One signed-out route per route family that only the deploy script creates: API Gateway answers 500 (never 401)
  // when it has no permission to invoke the function for that path. Owner 2026-11-26: live translation said
  // "isn't available right now" on two phones for exactly that reason.
  ...[["Live translation", "/call-translate"], ["AI profile", "/profile/ai"], ["AI shop", "/shop/ai"], ["Albums", "/albums"]].map(([label, path]) => ({
    name: `Auth API (${label} route reaches the function)`,
    path,
    // Our own code answers a signed-out visitor (401, or 403/400 from a guard) with {"error": …}; API Gateway's own
    // answers ({"message": "Internal Server Error"} / "Not Found") mean the route or its permission is missing.
    status: code => code >= 400 && code < 500 && code !== 404,
    expected: "our own 4xx",
    body: json => Boolean(json && json.error),
  })),
  {
    name: "Call-signaling (signed-out directory)",
    path: "/calls/directory",
    status: 401,
    body: json => json && json.error === "Authentication required",
  },
];

async function once(check) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetch(`${apiBase}${check.path}`, {
      headers: { origin: "https://danzstak.com", "user-agent": "DANZSTAK-deploy-smoke/1.0" },
      signal: controller.signal,
    });
    let json = null;
    try { json = await response.json(); } catch { json = null; }
    const statusOk = typeof check.status === "function" ? check.status(response.status) : response.status === check.status;
    const ok = statusOk && check.body(json);
    return { ok, status: response.status, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, status: error.name === "AbortError" ? "timeout" : "network error", ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const lines = [];
  let failed = 0;
  for (const check of checks) {
    let result;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      result = await once(check);
      if (result.ok) break;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, pauseMs));
    }
    if (!result.ok) failed++;
    const line = `${result.ok ? "PASS" : "FAIL"}  ${check.name}: GET ${check.path} -> ${result.status} (expected ${check.expected || check.status}), ${result.ms} ms`;
    console.log(line);
    lines.push(`| ${result.ok ? "pass" : "**FAIL**"} | ${check.name} | \`GET ${check.path}\` | ${result.status} | ${result.ms} ms |`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    require("node:fs").appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      ["### Smoke checks", "", "| Result | Check | Request | Status | Time |", "|---|---|---|---|---|", ...lines, "", ""].join("\n"));
  }
  if (failed) {
    console.error(`${failed} smoke check(s) failed.`);
    process.exitCode = 1;
  }
}

main();
