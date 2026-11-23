"use strict";
// scripts/static-server.cjs serves the browser checks in CI (directive F0, 2026-11-19). It must keep connections alive,
// send the right content types without asking the operating system, never serve files outside the site, never let the
// browser cache, and answer video range requests.
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");

const port = 18000 + Math.floor(Math.random() * 2000);
const server = spawn(process.execPath, [path.join(__dirname, "scripts", "static-server.cjs"), String(port), __dirname], { stdio: ["ignore", "pipe", "inherit"] });
const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
const get = (pathname, headers = {}, method = "GET") => new Promise((resolve, reject) => {
  const request = http.request({ host: "127.0.0.1", port, path: pathname, method, headers, agent }, response => {
    const chunks = [];
    response.on("data", chunk => chunks.push(chunk));
    response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks), socket: request.socket }));
  });
  request.on("error", reject);
  request.end();
});

(async () => {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", data => { if (/Serving/.test(String(data))) resolve(); });
    server.on("exit", code => reject(new Error(`static server exited with ${code}`)));
    setTimeout(() => reject(new Error("static server did not start")), 5000);
  });
  try {
    const page = await get("/feed.html?view=feed");
    assert.equal(page.status, 200, "pages load; the query string is ignored");
    assert.equal(page.headers["content-type"], "text/html; charset=utf-8");
    assert.equal(page.headers["cache-control"], "no-store", "the browser never caches, so every check sees the files on disk");
    const script = await get("/assets/media-visibility.js?v=1");
    assert.equal(script.headers["content-type"], "text/javascript; charset=utf-8", "scripts are served as JavaScript on every OS");
    assert.equal(script.socket, page.socket, "HTTP/1.1 keep-alive: the second file reuses the first connection");
    assert.equal((await get("/manifest.webmanifest")).headers["content-type"], "application/manifest+json; charset=utf-8");
    assert.equal((await get("/assets/profile-polish.css")).headers["content-type"], "text/css; charset=utf-8");
    assert.equal((await get("/")).status, 200, "a folder serves its index.html");
    assert.equal((await get("/no-such-page.html")).status, 404);
    for (const escape of ["/../../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd", "/assets/..%2f..%2f..%2fetc%2fpasswd", "/%E0%A4%A"]) {
      assert.equal((await get(escape)).status, 404, `${escape} must not leave the site folder`);
    }
    const range = await get("/feed.html", { range: "bytes=0-9" });
    assert.equal(range.status, 206, "video range requests get 206");
    assert.equal(range.body.length, 10);
    assert.match(range.headers["content-range"], /^bytes 0-9\/\d+$/);
    assert.equal((await get("/feed.html", { range: "bytes=99999999-" })).status, 416);
    const head = await get("/feed.html", {}, "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0, "HEAD sends headers only");
    assert.equal((await get("/feed.html", {}, "POST")).status, 405);
    console.log("Static server checks passed: keep-alive, fixed content types, no caching, range requests, and nothing outside the site.");
  } finally {
    agent.destroy();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; server.kill(); });
