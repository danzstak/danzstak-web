const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9400 + (process.pid % 400);
const sitePort = Number(process.env.DANZSTAK_QA_PORT || 8877);
const captureOnly = process.env.DANZSTAK_CAPTURE_ONLY === "1";
const screenshotName = process.env.DANZSTAK_SCREENSHOT || "mobile-feed-after-390.png";
const profile = path.join(process.env.TEMP, `danzstak-feed-qa-${process.pid}`);
const browser = spawn(chrome, [
  "--headless=new", "--no-first-run", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"
], { stdio: "ignore" });

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function retry(fn, attempts = 40) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    try { return await fn(); } catch (error) { last = error; await pause(100); }
  }
  throw last;
}

async function main() {
  const target = await retry(async () => {
    const response = await fetch(`http://127.0.0.1:${port}/json/new?http://127.0.0.1:${sitePort}/feed.html?view=feed`, { method: "PUT" });
    if (!response.ok) throw new Error(`CDP target failed: ${response.status}`);
    return response.json();
  });
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
  let id = 0;
  const pending = new Map();
  socket.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message)); else resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const callId = ++id;
    pending.set(callId, { resolve, reject });
    socket.send(JSON.stringify({ id: callId, method, params }));
  });
  await send("Page.enable");
  await send("Runtime.enable");

  const fixture = `(() => {
    document.querySelector('.left')?.remove(); document.querySelector('.right')?.remove();
    document.body.classList.add('content-only');
    document.querySelector('.install-app-button')?.setAttribute('hidden', '');
    const feed = document.querySelector('#feed');
    feed.innerHTML = \`<article class="post" data-post-id="qa-post">
      <header class="post-header"><span class="post-avatar">D</span><div><div class="post-author">DanzStak Artist</div><div class="post-time">12m · Public</div></div><button class="post-menu-toggle" aria-label="Post menu">•••</button></header>
      <div class="post-content">New track, new tour, same loud crew. Who is coming out?</div>
      <img class="post-media" alt="DanzStak concert post" src="assets/danzstak-logo.png">
      <div class="post-actions"><button class="likeBtn" data-reactions-ready="true">👍 18</button><button class="dislikeBtn">👎 1</button><button class="commentBtn">💬 4</button><button class="shareBtn">↗ 3</button><button class="saveBtn">🔖 Save</button></div>
      <section class="comments"><button class="comment-sort">Most relevant ▾</button><div class="commentList">
        <div class="comment"><span class="comment-avatar">L</span><div class="comment-bubble"><strong class="comment-author">Liana</strong><time class="comment-time">8m</time><div class="comment-content">That show was wild. See you in Portland!</div></div><div class="comment-action-row"><div class="comment-action-left"><button class="comment-reply-button">Reply</button><div class="comment-reactions"><button>👍 3</button><button>👎 0</button></div></div><button class="deleteCommentBtn" aria-label="Delete comment">🗑️</button></div></div>
        <div class="comment comment-reply"><span class="comment-avatar">D</span><div class="comment-bubble"><span class="comment-reply-context">Replying to Liana</span><strong class="comment-author">DanzStak Artist</strong><time class="comment-time">6m</time><div class="comment-content">We will save you a spot.</div></div><div class="comment-action-row"><div class="comment-action-left"><button class="comment-reply-button">Reply</button><div class="comment-reactions"><button>👍 1</button><button>👎 0</button></div></div><button class="deleteCommentBtn" aria-label="Delete reply">🗑️</button></div></div>
      </div><div class="comment-composer"><span class="comment-composer-avatar">D</span><div class="comment-composer-field"><input placeholder="Write a comment…"><div class="comment-composer-tools"><button class="comment-emoji-toggle">☺</button></div><button class="comment-send">➤</button></div></div></section>
    </article>\`;
    document.querySelector('#postComposer')?.remove(); document.querySelector('#storiesRail')?.remove(); document.querySelector('#feedStatus')?.remove();
  })()`;

  const widths = [320, 360, 375, 390, 430, 768, 1280];
  for (const width of widths) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width <= 430 });
    await send("Page.navigate", { url: `http://127.0.0.1:${sitePort}/feed.html?view=feed` });
    await retry(async () => {
      const ready = await send("Runtime.evaluate", { expression: "Boolean(document.querySelector('#feed') && document.querySelector('.topnav'))", returnByValue: true });
      if (!ready.result?.value) throw new Error("Feed DOM is not ready");
    });
    const installed = await send("Runtime.evaluate", { expression: fixture });
    if (installed.exceptionDetails) throw new Error(installed.exceptionDetails.exception?.description || installed.exceptionDetails.text);
    await retry(async () => {
      const images = await send("Runtime.evaluate", { expression: "[...document.images].every(image => image.complete)", returnByValue: true });
      if (!images.result?.value) throw new Error("Feed images are not ready");
    });
    const evaluated = await send("Runtime.evaluate", { expression: `(() => {
      const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
      const rows = selector => [...document.querySelectorAll(selector)].map(node => Math.round(node.getBoundingClientRect().top));
      const nav = [...document.querySelectorAll('.topnav button')].map(node => node.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0);
      const actions = [...document.querySelectorAll('.post-actions button')].map(node => node.getBoundingClientRect()).filter(box => box.width > 0 && box.height > 0);
      const row = rect('.comment-action-row'), reply = rect('.comment-reply-button'), trash = rect('.deleteCommentBtn'), composer = rect('.comment-composer-field'), post = rect('.post');
      return { innerWidth, scrollWidth: document.documentElement.scrollWidth, navCount: nav.length, navRows: [...new Set(nav.map(x => Math.round(x.top)))], actionCount: actions.length, actionRows: [...new Set(actions.map(x => Math.round(x.top)))], replyCenter: reply.top + reply.height / 2, trashCenter: trash.top + trash.height / 2, trashRightGap: row.right - trash.right, trashBackground: getComputedStyle(document.querySelector('.deleteCommentBtn')).backgroundColor, composerHeight: composer.height, postLeft: post.left, postRight: post.right };
    })()`, returnByValue: true });
    if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.exception?.description || evaluated.exceptionDetails.text);
    const result = evaluated.result?.value;
    assert.ok(result, `${width}px responsive metrics could not be collected`);
    if (width === 390) {
      const image = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
      fs.writeFileSync(path.join(process.cwd(), screenshotName), Buffer.from(image.data, "base64"));
    }
    if (captureOnly) continue;
    assert.equal(result.innerWidth, width, `${width}px viewport was not applied`);
    assert.ok(result.scrollWidth <= width, `${width}px has horizontal overflow (${result.scrollWidth}px)`);
    assert.equal(result.navCount, width <= 700 ? 5 : 4, `${width}px must keep every navigation control intended for that viewport`);
    assert.equal(result.navRows.length, 1, `${width}px navigation wrapped`);
    assert.equal(result.actionCount, 5, `${width}px must keep all five post actions`);
    assert.equal(result.actionRows.length, 1, `${width}px post actions wrapped`);
    assert.ok(Math.abs(result.replyCenter - result.trashCenter) <= 1, `${width}px Reply and trash are not vertically centered`);
    assert.ok(Math.abs(result.trashRightGap) <= 1, `${width}px trash is not at the far right`);
    assert.equal(result.trashBackground, "rgba(0, 0, 0, 0)", `${width}px trash must not have a colored button background`);
    assert.ok(result.composerHeight >= 44 && result.composerHeight <= 48, `${width}px composer is ${result.composerHeight}px tall`);
    assert.ok(result.postLeft >= 0 && result.postRight <= width, `${width}px feed card leaves the viewport`);
  }
  socket.close();
  console.log(captureOnly ? `Responsive screenshot captured at 390px.` : `Browser responsive checks passed at ${widths.join(", ")}px.`);
}

main().finally(() => { browser.kill(); }).catch(error => { console.error(error); process.exitCode = 1; });
