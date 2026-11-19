"use strict";
// Owner 2026-11-18 ("Call alerts does nothing"): Cache.addAll() fails the whole service-worker install when the shell
// lists a URL twice, so new phones got no service worker (no push, no offline). Every shell URL must be unique and exist.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const worker = fs.readFileSync("service-worker.js", "utf8");
const shell = worker.slice(worker.indexOf("const SHELL = ["), worker.indexOf("];", worker.indexOf("const SHELL = [")));
const urls = [...shell.matchAll(/"([^"]+)"/g)].map(m => m[1]);
const dupes = urls.filter((url, i) => urls.indexOf(url) !== i);
assert.deepEqual(dupes, [], `service-worker SHELL lists URLs twice: ${dupes.join(", ")}`);
const missing = urls.filter(url => url !== "/" && !fs.existsSync("." + url.split("?")[0]));
assert.deepEqual(missing, [], `service-worker SHELL lists missing files: ${missing.join(", ")}`);
assert.match(worker, /cache\.addAll\(\[\.\.\.new Set\(SHELL\)\]\)/, "install de-duplicates defensively");
console.log(`Service worker shell checks passed: ${urls.length} unique URLs, all present.`);
