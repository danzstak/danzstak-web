"use strict";
// Preload for browser checks (review.yml sets NODE_OPTIONS=--require ./scripts/check-diagnostics.cjs on the browser
// steps). It changes nothing while a check passes. When a check fails, it prints what the browser saw just before:
// requests that failed (with the network error), HTTP errors from the local server, page errors and console errors.
// Directive F0 (2026-11-19): two checks timed out once in CI waiting for content and the log said only "Timeout
// 30000ms exceeded", so the cause could not be found afterwards. The next failure names its cause.
let playwright;
try { playwright = require("playwright"); } catch { return; }

// Failures of the local site's own files are kept in full (a missing script is the usual reason a page never fills in);
// everything else keeps only the latest 20 events.
const local = [], other = [];
const started = Date.now();
const stamp = () => `+${((Date.now() - started) / 1000).toFixed(1)}s`;
const isLocal = url => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);
const note = (url, line) => {
  const list = isLocal(url) ? local : other;
  list.push(`${stamp()} ${line}`);
  if (list.length > (list === local ? 60 : 20)) list.shift();
};
const short = url => { try { const u = new URL(url); return u.origin + u.pathname.slice(0, 120); } catch { return String(url).slice(0, 140); } };

function watch(context) {
  if (!context || context.__danzstakDiagnostics) return context;
  context.__danzstakDiagnostics = true;
  context.on("requestfailed", request => note(request.url(), `request failed: ${request.method()} ${short(request.url())} (${request.failure()?.errorText || "unknown"})`));
  context.on("response", response => { if (response.status() >= 400 && isLocal(response.url())) note(response.url(), `HTTP ${response.status()}: ${short(response.url())}`); });
  context.on("weberror", error => note("", `page error: ${String(error.error()?.message || error.error()).slice(0, 300)}`));
  // "Failed to load resource" repeats a request already listed above.
  context.on("console", message => { if (message.type() === "error" && !/^Failed to load resource/.test(message.text())) note("", `console error: ${message.text().slice(0, 300)}`); });
  return context;
}

for (const browserType of [playwright.chromium, playwright.firefox, playwright.webkit].filter(Boolean)) {
  const launch = browserType.launch.bind(browserType);
  browserType.launch = async (...args) => {
    const browser = await launch(...args);
    const newContext = browser.newContext.bind(browser), newPage = browser.newPage.bind(browser);
    browser.newContext = async (...options) => watch(await newContext(...options));
    browser.newPage = async (...options) => { const page = await newPage(...options); watch(page.context()); return page; };
    return browser;
  };
}

process.on("exit", code => {
  if (!(code || process.exitCode)) return;
  const section = (title, lines) => lines.length ? `${title}\n${lines.map(line => `  ${line}`).join("\n")}\n` : "";
  process.stderr.write("\nBrowser diagnostics for this failed check:\n" + (local.length || other.length
    ? section("Local site files that failed:", local) + section(`Latest other events (${other.length}):`, other)
    : "  no failed requests, HTTP errors, page errors or console errors were seen.\n"));
});
