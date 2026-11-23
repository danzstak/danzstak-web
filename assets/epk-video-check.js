"use strict";
// Owner 2026-11-23 (phone screenshots of an EPK's Watch section, YouTube's "Video unavailable" inside the player):
// "Before adding to the epk need to make sure the video is there and playable. Youtube is kinda tricky for videos with
// apps." Every YouTube or Vimeo link in "Live video links" is checked twice before it goes in the EPK:
//   1. DanzStak's server asks YouTube/Vimeo (oEmbed, /link-preview): removed or private, or embedding turned off;
//   2. this browser loads the real player out of sight and listens for its error (blocks oEmbed can't see: region,
//      age, a label's claim that stops it playing on other sites).
// A removed or private video is left out of the EPK. One that won't play inside other sites goes in as a link
// (embed:false), so a venue never sees a broken player. The public EPK listens for the same error and swaps the player
// for the link if YouTube changes its mind later.
(() => {
  const api = "https://api.danzstak.com";
  const t = value => window.danzstakTranslate?.(value) || value;
  const results = new Map(); // url → { state: "checking" | "ok" | "link" | "gone" | "unknown", title }
  const listeners = new Set();
  let box = null;

  function embedSource(url, { api: jsApi = false } = {}) {
    try {
      const u = new URL(url), host = u.hostname.replace(/^www\.|^m\./, "").toLowerCase();
      let id = "";
      if (host === "youtube.com" || host === "music.youtube.com") id = u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{6,20})/) || [])[1] || "";
      else if (host === "youtu.be") id = u.pathname.split("/").filter(Boolean)[0] || "";
      if (/^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}${jsApi ? `?enablejsapi=1&playsinline=1&origin=${encodeURIComponent(location.origin)}` : ""}`;
      if (host === "vimeo.com") { const vid = u.pathname.split("/").filter(Boolean).find(part => /^\d+$/.test(part)); if (vid) return `https://player.vimeo.com/video/${vid}`; }
    } catch { /* not a URL */ }
    return "";
  }
  const isYouTube = source => source.startsWith("https://www.youtube-nocookie.com/embed/");

  // The YouTube player reports errors over postMessage once a page says it is listening. Error codes: 2 bad id,
  // 5 HTML5 player error, 100 removed or private, 101/150 owner turned embedding off, 152/153 can't play on this site.
  function watchPlayer(frame, { onError, onReady } = {}) {
    const listen = () => { try { frame.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: "danzstak-epk", channel: "widget" }), "https://www.youtube-nocookie.com"); } catch { /* gone */ } };
    const handler = event => {
      if (event.source !== frame.contentWindow || !/^https:\/\/www\.youtube(-nocookie)?\.com$/.test(event.origin)) return;
      let data; try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; } catch { return; }
      if (data?.event === "onError") onError?.(Number(data.info));
      else if (data?.event === "onReady" || (data?.event === "infoDelivery" && data.info?.videoData?.video_id)) onReady?.();
    };
    window.addEventListener("message", handler);
    frame.addEventListener("load", () => { listen(); setTimeout(listen, 400); setTimeout(listen, 1500); });
    return () => window.removeEventListener("message", handler);
  }

  // A real player, out of sight: does this video play inside a page?
  function testInBrowser(source) {
    return new Promise(resolve => {
      const frame = document.createElement("iframe");
      frame.src = source; frame.title = ""; frame.tabIndex = -1; frame.setAttribute("aria-hidden", "true");
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.className = "epk-video-probe";
      let done = false, stop = () => {};
      const finish = value => { if (done) return; done = true; stop(); clearTimeout(timer); frame.remove(); resolve(value); };
      let ready = false;
      stop = watchPlayer(frame, { onError: code => finish({ error: code }), onReady: () => { ready = true; setTimeout(() => finish({ ok: true }), 1200); } });
      const timer = setTimeout(() => finish(ready ? { ok: true } : { unknown: true }), 9000);
      document.body.append(frame);
    });
  }

  async function check(url) {
    const source = embedSource(url, { api: true });
    if (!source) return { state: "skip" };
    let server = null;
    try {
      const response = await fetch(`${api}/link-preview?url=${encodeURIComponent(url)}`, { credentials: "include", cache: "no-store" });
      if (response.ok) server = (await response.json()).preview || null;
    } catch { /* offline: the browser test still runs */ }
    const title = server?.title || "";
    if (server?.playable === false) return { state: server.reason === "embed_off" ? "link" : "gone", title };
    if (!isYouTube(source)) return { state: server?.playable === true ? "ok" : "unknown", title };
    const probe = await testInBrowser(source);
    if (probe.error) return { state: [100, 2].includes(probe.error) ? "gone" : "link", title };
    if (probe.ok || server?.playable === true) return { state: "ok", title };
    return { state: "unknown", title };
  }

  const LINES = {
    checking: "Checking it plays…",
    ok: "Plays in your EPK",
    link: "Won't play inside other sites, so your EPK shows it as a link to the video.",
    gone: "Not added: this video is removed or private. Check the link.",
    unknown: "Couldn't check it right now. It shows as a player; if it won't play, venues get the link."
  };
  function paint() {
    if (!box) return;
    const items = [...results.entries()].filter(([, r]) => r.state !== "skip");
    box.hidden = !items.length;
    box.replaceChildren(...items.map(([url, r]) => {
      const row = document.createElement("li");
      row.className = "epk-video-check-row"; row.dataset.state = r.state; row.dataset.url = url;
      const name = document.createElement("strong"); name.textContent = r.label || r.title || url;
      const line = document.createElement("span"); line.textContent = t(LINES[r.state] || "");
      row.append(name, line);
      return row;
    }));
    listeners.forEach(fn => fn());
  }

  let timer = 0;
  function scan(links) {
    const wanted = new Set();
    for (const item of links) {
      if (!embedSource(item.url)) continue;
      wanted.add(item.url);
      const known = results.get(item.url);
      if (known) { known.label = item.label; continue; }
      const entry = { state: "checking", label: item.label };
      results.set(item.url, entry);
      check(item.url).then(result => { if (results.get(item.url) === entry) { Object.assign(entry, result); paint(); } });
    }
    for (const url of [...results.keys()]) if (!wanted.has(url)) results.delete(url);
    paint();
  }

  // Builder hooks (epk.js): which links go in the EPK, and how.
  function mark(item) {
    const state = results.get(item.url)?.state;
    if (state === "gone") return null;
    if (state === "link" || item.embed === false) return { ...item, embed: false };
    return item;
  }
  function seed(links = []) { for (const item of links) if (item?.embed === false && item.url && !results.has(item.url)) results.set(item.url, { state: "link", label: item.label }); }

  function start() {
    const area = document.getElementById("videoLinks");
    const query = new URLSearchParams(location.search);
    if (!area || ["id", "share", "outreach"].some(key => query.has(key))) return; // a venue's view: nothing to check
    box = document.createElement("ul");
    box.id = "videoLinkChecks"; box.className = "epk-video-checks"; box.hidden = true;
    box.setAttribute("aria-live", "polite");
    area.closest("label")?.after(box);
    const read = () => String(area.value || "").split(/\r?\n/).map(line => { const [label, ...rest] = line.split("|"); return { label: label.trim(), url: rest.join("|").trim() }; }).filter(item => /^https:\/\//i.test(item.url));
    area.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => scan(read()), 700); });
    area.addEventListener("change", () => { clearTimeout(timer); scan(read()); });
    // fill() sets the value without an input event: look once the saved EPK is in.
    let last = "";
    setInterval(() => { if (area.value !== last && document.activeElement !== area) { last = area.value; scan(read()); } }, 1500);
  }

  window.danzstakEpkVideoCheck = Object.freeze({ embedSource, watchPlayer, mark, seed, scan, onChange: fn => listeners.add(fn), state: url => results.get(url)?.state || "" });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true }); else start();
})();
