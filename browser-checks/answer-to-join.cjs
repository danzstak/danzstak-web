"use strict";
// Answer to join (owner 2026-11-18): drives installed Google Chrome over the DevTools protocol (no Playwright needed)
// and checks answer.html at 320–1366px: caller shown, 44px targets, no overflow, consent required, signup keeps the invite.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const root = process.argv[2] || process.cwd(), out = process.argv[3] || path.resolve("docs/screenshots/answer-to-join");
fs.mkdirSync(out, { recursive: true });
const token = "A".repeat(43);
const server = http.createServer((req, res) => { const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname)); fs.readFile(p.endsWith("/") ? p + "index.html" : p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, { "content-type": p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".png") ? "image/png" : "text/html" }); res.end(d); }); }).listen(8099);
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--remote-debugging-port=9333", "--user-data-dir=/tmp/cdp/profile", "about:blank"], { stdio: "ignore" });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let targets; for (let i = 0; i < 50; i++) { try { targets = await (await fetch("http://127.0.0.1:9333/json")).json(); break; } catch { await sleep(200); } }
  const ws = new WebSocket(targets.find(t => t.type === "page").webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const waiting = new Map(), events = [];
  ws.onmessage = m => { const msg = JSON.parse(m.data); if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); } else events.push(msg); onEvent(msg); };
  const send = (method, params = {}) => new Promise(r => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const requests = []; let mode = "open";
  function onEvent(msg) {
    if (msg.method !== "Fetch.requestPaused") return;
    const { requestId, request } = msg.params; requests.push(request.url);
    const reply = (status, body) => send("Fetch.fulfillRequest", { requestId, responseCode: status, responseHeaders: [{ name: "content-type", value: "application/json" }, { name: "access-control-allow-origin", value: "http://127.0.0.1:8099" }, { name: "access-control-allow-credentials", value: "true" }], body: Buffer.from(JSON.stringify(body)).toString("base64") });
    if (request.method === "OPTIONS") return send("Fetch.fulfillRequest", { requestId, responseCode: 204, responseHeaders: [{ name: "access-control-allow-origin", value: "http://127.0.0.1:8099" }, { name: "access-control-allow-credentials", value: "true" }, { name: "access-control-allow-headers", value: "content-type" }, { name: "access-control-allow-methods", value: "POST,GET" }] });
    if (request.url.includes("/auth/session")) return reply(200, { authenticated: false });
    if (request.url.includes("/calls/invites/preview")) return mode === "gone" ? reply(404, { code: "CALL_INVITE_GONE" }) : reply(200, { caller: { name: "Eroticon", picture: "" }, kind: "video", expiresAt: "2026-11-19T00:00:00Z" });
    if (request.url.includes("/auth/legal-acceptance")) return reply(201, { accepted: true });
    if (request.url.includes("/auth/signup")) return send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "text/html" }], body: Buffer.from("<p>signup</p>").toString("base64") });
    return reply(404, {});
  }
  await send("Page.enable"); await send("Runtime.enable");
  await send("Fetch.enable", { patterns: [{ urlPattern: "https://api.danzstak.com/*" }] });
  const evaluate = async expr => (await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true })).result.result.value;
  for (const width of [320, 360, 375, 390, 414, 430, 1366]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: width > 500 ? 850 : 780, deviceScaleFactor: 1, mobile: width < 500 });
    await send("Page.navigate", { url: `http://127.0.0.1:8099/answer.html?i=${token}` }); await sleep(600);
    for (let i = 0; i < 40 && !(await evaluate(`!document.getElementById("answerCard")?.hidden`)); i++) await sleep(150);
    const g = await evaluate(`(()=>{const b=document.getElementById("answerBtn").getBoundingClientRect(),l=document.querySelector(".answer-login").getBoundingClientRect();return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bh:b.height,br:b.right,lh:l.height,name:document.getElementById("callerName").textContent,kind:document.getElementById("callKind").textContent,login:document.getElementById("loginLink").href,sh:document.documentElement.scrollHeight,vh:innerHeight}})()`);
    if (g.sw > g.cw + 1) throw new Error(`${width}px overflows`);
    if (g.bh < 44 || g.lh < 44) throw new Error(`${width}px touch target too small`);
    if (g.name !== "Eroticon" || g.kind !== "is video calling you") throw new Error("caller not shown " + JSON.stringify(g));
    if (!g.login.includes("next=%2Fmessages.html%3Finvite%3D" + token)) throw new Error("login link loses the invite");
    const shot = await send("Page.captureScreenshot", { format: "png" });
    fs.writeFileSync(path.join(out, `answer-${width}.png`), Buffer.from(shot.result.data, "base64"));
    console.log(width, "ok", g.sh <= g.vh ? "fits one screen" : `scrolls (${g.sh}>${g.vh})`);
  }
  // Answer without consent stays put; with consent it goes to signup with the return path.
  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 780, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: `http://127.0.0.1:8099/answer.html?i=${token}` }); await sleep(600);
  for (let i = 0; i < 40 && !(await evaluate(`!document.getElementById("answerCard")?.hidden`)); i++) await sleep(150);
  await evaluate(`document.getElementById("answerBtn").click()`); await sleep(300);
  const msg = await evaluate(`document.getElementById("answerStatus").textContent`);
  if (!/Tick the box/.test(msg)) throw new Error("no consent message: " + msg);
  if (requests.some(u => u.includes("legal-acceptance"))) throw new Error("legal accepted without consent");
  await evaluate(`document.getElementById("legalAgreement").click(); document.getElementById("answerBtn").click()`);
  for (let i = 0; i < 40 && !requests.some(u => u.includes("/auth/signup")); i++) await sleep(150);
  const signup = requests.find(u => u.includes("/auth/signup"));
  if (!signup || !signup.includes("next=%2Fmessages.html%3Finvite%3D" + token)) throw new Error("signup lost the invite: " + signup);
  console.log("answer → signup ok:", signup.replace(token, "<token>"));
  // Gone state.
  mode = "gone";
  await send("Page.navigate", { url: `http://127.0.0.1:8099/answer.html?i=${token}` }); await sleep(600);
  for (let i = 0; i < 40 && (await evaluate(`document.getElementById("answerGone")?.hidden`)); i++) await sleep(150);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(out, `answer-gone-390.png`), Buffer.from(shot.result.data, "base64"));
  console.log("gone state ok");
  ws.close(); chrome.kill(); server.close();
})().catch(e => { console.error(e); chrome.kill(); server.close(); process.exit(1); });
