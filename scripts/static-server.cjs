#!/usr/bin/env node
"use strict";
// Static server for the browser checks in CI (and locally): node scripts/static-server.cjs <port> [root]
//
// Directive F0 (2026-11-19): call-audio-output and original-feed-art-direction timed out now and then in CI, only on the
// Windows runners. CI used `python -m http.server`, which speaks HTTP/1.0 (a new connection for every file, ~1,000 per
// check), keeps a listen backlog of 5 and takes file types from the Windows registry. When that backlog is full,
// Windows refuses the connection outright, a page script fails to load, and the page waits for content that never comes.
// This server keeps connections alive (HTTP/1.1), listens with a backlog of 511, sends fixed content types and never
// lets the browser cache, so every check sees the files on disk.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.argv[2] || process.env.PORT || 8017);
const root = path.resolve(process.argv[3] || path.join(__dirname, ".."));
const host = process.env.HOST || "127.0.0.1";
const types = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".ico": "image/x-icon",
  ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime", ".woff": "font/woff",
  ".woff2": "font/woff2", ".ttf": "font/ttf", ".otf": "font/otf", ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8", ".pdf": "application/pdf", ".wasm": "application/wasm", ".map": "application/json"
};

function resolveFile(urlPath) {
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch { return null; }
  const file = path.resolve(root, "." + path.posix.normalize("/" + decoded));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  try {
    const stat = fs.statSync(file);
    if (stat.isDirectory()) {
      const index = path.join(file, "index.html");
      return fs.statSync(index).isFile() ? { file: index, size: fs.statSync(index).size } : null;
    }
    return stat.isFile() ? { file, size: stat.size } : null;
  } catch { return null; }
}

const server = http.createServer((request, response) => {
  const found = ["GET", "HEAD"].includes(request.method) ? resolveFile(new URL(request.url, "http://localhost").pathname) : null;
  if (!found) {
    response.writeHead(request.method === "GET" || request.method === "HEAD" ? 404 : 405, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Not found");
    return;
  }
  const headers = { "content-type": types[path.extname(found.file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store", "accept-ranges": "bytes" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || "");
  let start = 0, end = found.size - 1, status = 200;
  if (range && found.size > 0) {
    start = range[1] === "" ? Math.max(0, found.size - Number(range[2])) : Number(range[1]);
    end = range[1] === "" || range[2] === "" ? found.size - 1 : Math.min(Number(range[2]), found.size - 1);
    if (start > end || start >= found.size) {
      response.writeHead(416, { "content-range": `bytes */${found.size}`, "cache-control": "no-store" });
      response.end();
      return;
    }
    status = 206;
    headers["content-range"] = `bytes ${start}-${end}/${found.size}`;
  }
  headers["content-length"] = found.size ? end - start + 1 : 0;
  response.writeHead(status, headers);
  if (request.method === "HEAD" || !found.size) { response.end(); return; }
  fs.createReadStream(found.file, { start, end }).on("error", () => response.destroy()).pipe(response);
});
server.keepAliveTimeout = 30000;
server.on("clientError", (error, socket) => { if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"); });
server.listen(port, host, 511, () => console.log(`Serving ${root} at http://${host}:${port}/`));
